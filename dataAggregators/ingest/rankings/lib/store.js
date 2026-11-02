// Writes one ratings snapshot (one system, one through-date, every team) into the rating tables. Idempotent:
// a snapshot with the same (system, season, through_date) and identical content is left alone, a changed one is replaced.
const crypto = require('crypto');
const { insertRaw } = require('../../lib/store');
const { keyIndex, matchTeam, loadSynonyms } = require('./names');

const seasonOf = (isoDate) => { const [y, m] = isoDate.split('-').map(Number); return m >= 8 ? y : y - 1; };

// metric_meta: what each part means in the system's own units, and which direction is better.
const SYSTEMS = {
  torvik: {
    name: 'Bart Torvik (T-Rank)', kind: 'efficiency', source_url: 'https://barttorvik.com', access: 'http',
    meta: { overall: { label: 'Barthag (win probability vs average D-I)', unit: 'probability', higher_is_better: true, margin_metric: 'adjem' },
      off: { label: 'Adj. offensive efficiency', unit: 'points per 100 possessions', higher_is_better: true },
      def: { label: 'Adj. defensive efficiency', unit: 'points allowed per 100 possessions', higher_is_better: false } },
  },
  net: {
    name: 'NCAA NET', kind: 'resume', source_url: 'https://www.ncaa.com/rankings/basketball-men/d1/ncaa-mens-basketball-net-rankings', access: 'http',
    meta: { overall: { label: 'NET rank', unit: 'rank', higher_is_better: false } },
  },
  haslam: {
    name: 'Haslametrics', kind: 'efficiency', source_url: 'https://haslametrics.com', access: 'http',
    meta: { overall: { label: 'Efficiency margin (offense - defense)', unit: 'points per 100 possessions', higher_is_better: true, margin_is_rating: true },
      off: { label: 'Offensive efficiency', unit: 'points per 100 possessions', higher_is_better: true },
      def: { label: 'Defensive efficiency', unit: 'points allowed per 100 possessions', higher_is_better: false } },
  },
  kenpom: {
    name: 'KenPom', kind: 'efficiency', source_url: 'https://kenpom.com', access: 'browser',
    meta: { overall: { label: 'AdjEM', unit: 'points per 100 possessions vs average', higher_is_better: true, margin_is_rating: true },
      off: { label: 'AdjO', unit: 'points per 100 possessions', higher_is_better: true },
      def: { label: 'AdjD', unit: 'points allowed per 100 possessions', higher_is_better: false } },
  },
  evanmiya: {
    name: 'EvanMiya', kind: 'efficiency', source_url: 'https://evanmiya.com', access: 'browser',
    meta: { overall: { label: 'Relative rating', unit: 'points above average (Bayesian performance rating)', higher_is_better: true, margin_is_rating: true },
      off: { label: 'O-Rate', unit: 'points above average per 100', higher_is_better: true },
      def: { label: 'D-Rate', unit: 'points above average per 100', higher_is_better: true } },
  },
};

async function ensureSystems(client) {
  for (const [system, s] of Object.entries(SYSTEMS)) {
    await client.query(
      `INSERT INTO rating_systems (system, name, kind, source_url, access, metric_meta) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (system) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind, source_url = EXCLUDED.source_url,
         access = EXCLUDED.access, metric_meta = EXCLUDED.metric_meta`,
      [system, s.name, s.kind, s.source_url, s.access, JSON.stringify(s.meta)]);
  }
}

// A site's spelling is matched to the app's canonical team (rating_teams, mirrored from config/rating-teams.json) by name
// key and the synonyms file; nothing here ever invents a team. Misses are reported so they can be mapped, or added as a
// new team, on the admin page. Matches are remembered per (system, spelling).
async function makeResolver(client, system) {
  const { rows } = await client.query('SELECT rating_team_id, name FROM rating_teams');
  if (!rows.length) throw new Error('no canonical teams: run `node ingest/rankings/mappings.js seed` (or collect through run.js, which syncs config/rating-teams.json)');
  const ids = new Set(rows.map((r) => r.rating_team_id));
  const byKey = keyIndex(Object.fromEntries(rows.map((r) => [r.rating_team_id, { name: r.name }])));
  const synonyms = loadSynonyms();
  const { rows: aliases } = await client.query('SELECT alias, rating_team_id FROM rating_team_aliases WHERE system = $1', [system]);
  const byAlias = new Map(aliases.map((a) => [a.alias, a.rating_team_id]));
  return {
    async resolve(name) {
      if (byAlias.has(name)) return byAlias.get(name);
      const id = matchTeam(name, { byKey, synonyms });
      if (id && ids.has(id)) {
        byAlias.set(name, id);
        await client.query('INSERT INTO rating_team_aliases (system, alias, rating_team_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [system, name, id]);
        return id;
      }
      return null;
    },
  };
}

/**
 * snap: { system, throughDate:'YYYY-MM-DD', asofLabel, rows:[{name, conference, record, overall:{rank,rating}, off:{..}, def:{..}, metrics:{..}}],
 *         teamsExpected, raw (any JSON, kept in raw_payloads), notes }
 * Returns { status: 'inserted'|'replaced'|'unchanged', snapshotId, covered, unresolved:[names] }.
 */
async function writeSnapshot(client, snap) {
  const season = seasonOf(snap.throughDate);
  const hash = crypto.createHash('sha1').update(JSON.stringify(snap.rows)).digest('hex');
  const existing = (await client.query(
    'SELECT snapshot_id, content_hash, teams_covered FROM rating_snapshots WHERE system = $1 AND season_year = $2 AND through_date = $3',
    [snap.system, season, snap.throughDate])).rows[0];
  // same content AND every team matched last time (an earlier partial match is retried after a synonym is added)
  if (existing && existing.content_hash === hash && existing.teams_covered === snap.rows.length) return { status: 'unchanged', snapshotId: existing.snapshot_id };

  await client.query('BEGIN');
  try {
    const resolver = await makeResolver(client, snap.system);
    const unresolved = [], resolved = [];
    for (const r of snap.rows) {
      const id = await resolver.resolve(r.name);
      if (id) resolved.push({ ...r, id }); else unresolved.push(r.name);
    }
    const rawId = snap.raw === undefined ? null : await insertRaw(client, snap.system, snap.throughDate, 'ratings', snap.raw);
    const notes = { ...(snap.notes || {}), ...(unresolved.length ? { unresolved } : {}) };
    let snapshotId;
    if (existing) {
      snapshotId = existing.snapshot_id;
      await client.query('DELETE FROM team_ratings WHERE snapshot_id = $1', [snapshotId]);
      await client.query(
        `UPDATE rating_snapshots SET asof_label=$2, captured_at=now(), teams_covered=$3, teams_expected=$4, content_hash=$5, raw_id=$6, notes=$7 WHERE snapshot_id=$1`,
        [snapshotId, snap.asofLabel || null, resolved.length, snap.teamsExpected || snap.rows.length, hash, rawId, JSON.stringify(notes)]);
    } else {
      snapshotId = (await client.query(
        `INSERT INTO rating_snapshots (system, season_year, through_date, asof_label, teams_covered, teams_expected, content_hash, raw_id, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING snapshot_id`,
        [snap.system, season, snap.throughDate, snap.asofLabel || null, resolved.length, snap.teamsExpected || snap.rows.length, hash, rawId, JSON.stringify(notes)])).rows[0].snapshot_id;
    }
    for (const r of resolved) {
      await client.query(
        `INSERT INTO team_ratings (snapshot_id, rating_team_id, conference, record, overall_rank, overall_rating, off_rank, off_rating, def_rank, def_rating, metrics)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (snapshot_id, rating_team_id) DO NOTHING`,
        [snapshotId, r.id, r.conference ?? null, r.record ?? null, r.overall?.rank ?? null, r.overall?.rating ?? null,
          r.off?.rank ?? null, r.off?.rating ?? null, r.def?.rank ?? null, r.def?.rating ?? null, JSON.stringify(r.metrics || {})]);
    }
    await client.query('COMMIT');
    return { status: existing ? 'replaced' : 'inserted', snapshotId, covered: resolved.length, unresolved };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

module.exports = { ensureSystems, writeSnapshot, makeResolver, seasonOf, SYSTEMS };
