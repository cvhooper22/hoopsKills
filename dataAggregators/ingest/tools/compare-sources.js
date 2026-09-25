// Compares the same games as normalized from two different sources, stored in two databases.
//   A_URL=...pbp  B_URL=...pbp_espn_test  node ingest/tools/compare-sources.js
const { Client } = require('pg');

const A_URL = process.env.A_URL || 'postgres://postgres:postgres@localhost:5544/pbp';
const B_URL = process.env.B_URL || 'postgres://postgres:postgres@localhost:5544/pbp_espn_test';

const PLAYER_SQL = `
  SELECT player_id,
    COALESCE(SUM(shot_value) FILTER (WHERE is_made), 0)::int                                    AS pts,
    COUNT(*) FILTER (WHERE play_category = 'shot_attempt' AND is_made)::int                     AS fgm,
    COUNT(*) FILTER (WHERE play_category = 'shot_attempt')::int                                 AS fga,
    COUNT(*) FILTER (WHERE play_category = 'shot_attempt' AND shot_value = 3 AND is_made)::int  AS tpm,
    COUNT(*) FILTER (WHERE play_category = 'shot_attempt' AND shot_value = 3)::int              AS tpa,
    COUNT(*) FILTER (WHERE play_category = 'free_throw' AND is_made)::int                       AS ftm,
    COUNT(*) FILTER (WHERE play_category = 'free_throw')::int                                   AS fta,
    COUNT(*) FILTER (WHERE play_category = 'rebound' AND play_subtype IS DISTINCT FROM 'deadball')::int AS reb,
    COUNT(*) FILTER (WHERE play_category = 'steal')::int                                        AS stl,
    COUNT(*) FILTER (WHERE play_category = 'block')::int                                        AS blk,
    COUNT(*) FILTER (WHERE play_category = 'turnover')::int                                     AS tov,
    COUNT(*) FILTER (WHERE play_category = 'foul')::int                                         AS pf
  FROM plays WHERE game_id = $1 AND player_id IS NOT NULL GROUP BY 1`;

const ASSIST_SQL = `
  SELECT pp.player_id, COUNT(*)::int AS ast FROM play_participants pp JOIN plays p USING (play_id)
  WHERE p.game_id = $1 AND pp.role = 'assister' GROUP BY 1`;

const SHOTS_SQL = `
  SELECT period_number AS p, player_id AS pid, is_made, shot_value
  FROM plays WHERE game_id = $1 AND play_category = 'shot_attempt' ORDER BY sequence_number`;

// Player ids differ between the two databases, so B's are translated to A's through the ESPN id
// (A got its ESPN mappings when the ESPN raw data was linked).
async function idTranslator(a, b) {
  const espnToA = new Map((await a.query(`SELECT external_id, player_id FROM player_external_ids WHERE source = 'espn'`)).rows.map(r => [r.external_id, r.player_id]));
  const bToEspn = new Map((await b.query(`SELECT external_id, player_id FROM player_external_ids WHERE source = 'espn'`)).rows.map(r => [r.player_id, r.external_id]));
  return id => espnToA.get(bToEspn.get(id)) || `unmapped:${id}`;
}

async function players(c, gameId, tr = id => id) {
  const out = new Map();
  for (const r of (await c.query(PLAYER_SQL, [gameId])).rows) out.set(tr(r.player_id), { ...r, player_id: tr(r.player_id) });
  for (const r of (await c.query(ASSIST_SQL, [gameId])).rows) {
    const id = tr(r.player_id);
    if (!out.has(id)) out.set(id, { player_id: id });
    out.get(id).ast = r.ast;
  }
  return out;
}

async function main() {
  const a = new Client({ connectionString: A_URL }), b = new Client({ connectionString: B_URL });
  await a.connect(); await b.connect();
  const tr = await idTranslator(a, b);
  const games = (await b.query('SELECT game_id FROM games ORDER BY game_date')).rows.map(r => r.game_id);
  let bad = 0;
  for (const gameId of games) {
    const [pa, pb] = [await players(a, gameId), await players(b, gameId, tr)];
    if (!pa.size) { console.log(`${gameId}: not in A, skipped`); continue; }
    const cols = ['pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'reb', 'stl', 'blk', 'tov', 'pf', 'ast'];
    const diffs = [];
    for (const id of new Set([...pa.keys(), ...pb.keys()])) {
      const x = pa.get(id) || {}, y = pb.get(id) || {};
      for (const col of cols) if ((x[col] || 0) !== (y[col] || 0)) diffs.push(`${id} ${col}: A ${x[col] || 0} vs B ${y[col] || 0}`);
    }
    const key = (r, t) => `${r.p}|${t(r.pid)}|${r.is_made}|${r.shot_value}`;
    const sa = (await a.query(SHOTS_SQL, [gameId])).rows.map(r => key(r, x => x));
    const sb = (await b.query(SHOTS_SQL, [gameId])).rows.map(r => key(r, tr));
    const sameOrder = sa.length === sb.length && sa.every((k, i) => k === sb[i]);
    const totals = k => [...pa.values()].reduce((n, r) => n + (r[k] || 0), 0);
    console.log(`\n${gameId}: ${pa.size} players in A, ${pb.size} in B, A points ${totals('pts')}, B points ${[...pb.values()].reduce((n, r) => n + r.pts, 0)}`);
    console.log(`  per-player stat differences: ${diffs.length}` + (diffs.length ? '\n   ' + diffs.slice(0, 15).join('\n   ') : ''));
    console.log(`  shot sequence (period|shooter|made|value): ${sa.length} vs ${sb.length} shots, ${sameOrder ? 'identical order' : 'ORDER DIFFERS'}`);
    if (diffs.length || !sameOrder) bad++;
  }
  await a.end(); await b.end();
  console.log(bad ? `\n${bad} game(s) differ` : '\nall games agree');
}

main().catch(err => { console.error(err); process.exit(1); });
