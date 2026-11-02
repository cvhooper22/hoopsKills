// The app's canonical team list for ratings: config/rating-teams.json ({ id: { name } }), mirrored into the
// rating_teams table. Torvik's spelling is only where the list started; after that a site renaming a team is just an
// unmatched spelling to map, never a silent duplicate. Where a team also exists in the games universe (`teams`), its
// canonical id is that team's id, so the games join needs no separate link.
const { slugify } = require('../../lib/slug');
const { baseKey, candidateKeys, keyIndex, matchTeam, loadCanonical, saveCanonical, loadSynonyms, saveSynonyms } = require('./names');

/** Config -> rating_teams (name, and team_id where the id is also a games team). Run at the start of every collection. */
async function syncCanonical(client) {
  const canonical = loadCanonical();
  if (!Object.keys(canonical).length) throw new Error('config/rating-teams.json is empty: run `node ingest/rankings/mappings.js seed` first');
  keyIndex(canonical); // throws on two teams with the same name key
  const { rows: games } = await client.query('SELECT team_id FROM teams');
  const gameTeams = new Set(games.map((t) => t.team_id));
  for (const [id, t] of Object.entries(canonical)) {
    await client.query(
      `INSERT INTO rating_teams (rating_team_id, name, team_id) VALUES ($1, $2, $3)
       ON CONFLICT (rating_team_id) DO UPDATE SET name = EXCLUDED.name, team_id = EXCLUDED.team_id`,
      [id, t.name, gameTeams.has(id) ? id : null]);
  }
}

/**
 * One-time start of the list from what the first collections stored (Torvik's names), with ids moved onto the games
 * teams' ids where a rating team is the same team as a games team (UConn, Eastern Wash., ...). Old synonyms
 * (name key -> Torvik key) become name key -> team id. Returns a report; with dryRun nothing is changed.
 */
async function seedCanonical(client, { dryRun = false } = {}) {
  const { rows: rts } = await client.query('SELECT rating_team_id AS id, name FROM rating_teams ORDER BY name');
  const { rows: games } = await client.query('SELECT team_id, name FROM teams ORDER BY team_id');
  if (!rts.length) throw new Error('no rating teams yet: collect Torvik once so there is a list to start from');
  if (Object.keys(loadCanonical()).length) throw new Error('config/rating-teams.json already has teams: the list is seeded; edit it from the admin page or the file');
  const oldSyn = loadSynonyms();
  // old matching: synonym values are Torvik name keys
  const byKey = new Map(rts.map((r) => [baseKey(r.name), r.id]));
  const oldMatch = (name) => {
    for (const k of candidateKeys(name)) { const t = oldSyn[k] || k; if (byKey.has(t)) return byKey.get(t); }
    return null;
  };
  const rename = new Map(); // old id -> new id
  const unmatchedGames = [];
  for (const g of games) {
    const old = oldMatch(g.name);
    if (!old) { unmatchedGames.push(g); continue; }
    if (old !== g.team_id) rename.set(old, g.team_id);
  }
  const idOf = (id) => rename.get(id) || id;
  const canonical = {};
  for (const r of rts) canonical[idOf(r.id)] = { name: r.name };
  const sorted = Object.fromEntries(Object.entries(canonical).sort(([a], [b]) => a.localeCompare(b)));
  const synonyms = {};
  for (const [alias, torvikKey] of Object.entries(oldSyn)) {
    const id = byKey.get(torvikKey);
    if (id) synonyms[alias] = idOf(id); else throw new Error(`synonym "${alias}" points at "${torvikKey}", which is no Torvik team`);
  }
  const report = { teams: rts.length, renamedIds: [...rename].map(([from, to]) => `${from} -> ${to}`), unmatchedGameTeams: unmatchedGames.map((g) => `${g.team_id} (${g.name})`),
    nameDiffs: games.map((g) => ({ id: g.team_id, appName: g.name, canonicalName: (sorted[g.team_id] || {}).name })).filter((d) => d.canonicalName && d.canonicalName !== d.appName) };
  if (dryRun) return report;

  const fs = require('fs');
  const { CANONICAL_FILE, SYNONYMS_FILE } = require('./names');
  const backup = [CANONICAL_FILE, SYNONYMS_FILE].map((f) => [f, fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null]);
  await client.query('BEGIN');
  try {
    for (const [from, to] of rename) {
      const { rows: [o] } = await client.query('SELECT name FROM rating_teams WHERE rating_team_id = $1', [from]);
      await client.query('INSERT INTO rating_teams (rating_team_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [to, o.name]);
      await client.query('UPDATE rating_team_aliases SET rating_team_id = $2 WHERE rating_team_id = $1', [from, to]);
      await client.query('UPDATE team_ratings SET rating_team_id = $2 WHERE rating_team_id = $1', [from, to]);
      await client.query('DELETE FROM rating_teams WHERE rating_team_id = $1', [from]);
    }
    saveCanonical(sorted);
    saveSynonyms(synonyms);
    await syncCanonical(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    for (const [f, text] of backup) if (text !== null) fs.writeFileSync(f, text);   // keep the files in step with the rolled-back database
    throw err;
  }
  return report;
}

module.exports = { syncCanonical, seedCanonical, slugify };
