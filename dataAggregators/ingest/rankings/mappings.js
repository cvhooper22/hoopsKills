// The app's canonical team list for ratings and the spelling -> team mapping, for the admin page and the command line.
// Local only: it edits config/rating-teams.json and config/rating-team-synonyms.json in the repo.
//   node ingest/rankings/mappings.js state
//   node ingest/rankings/mappings.js seed [--dry-run]                      one time: start the list from Torvik's names
//   node ingest/rankings/mappings.js map --alias "UNH" --team new-hampshire     map a site's spelling to a team (id or name)
//   node ingest/rankings/mappings.js unmap --key "unh"
//   node ingest/rankings/mappings.js add-team --name "New Team" [--id new-team] [--alias "Spelling a site uses"]
//   node ingest/rankings/mappings.js rename --id connecticut --name "UConn"     (the old name keeps matching)
// Prints one JSON object. Editing a mapping also forgets exact-spelling matches remembered for that alias, so the next
// collection run re-resolves it. After mapping a name, re-run the system that reported it.
const { connect } = require('../../db/client');
const { slugify } = require('../lib/slug');
const { baseKey, keyIndex, loadSynonyms, saveSynonyms, loadCanonical, saveCanonical } = require('./lib/names');
const { syncCanonical, seedCanonical } = require('./lib/canonical');

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const need = (k) => { const v = (opt(k) || '').trim(); if (!v) throw new Error(`${cmd} needs ${k}`); return v; };

async function forgetAliases(client, key) {
  const { rows } = await client.query('SELECT system, alias FROM rating_team_aliases');
  let n = 0;
  for (const r of rows.filter((x) => baseKey(x.alias) === key)) {
    await client.query('DELETE FROM rating_team_aliases WHERE system = $1 AND alias = $2', [r.system, r.alias]);
    n++;
  }
  return n;
}

const findTeam = (canonical, ref) => {
  const id = Object.keys(canonical).find((i) => i === ref) || Object.keys(canonical).find((i) => canonical[i].name.toLowerCase() === ref.toLowerCase());
  if (!id) throw new Error(`"${ref}" is not a canonical team; pick one from the list`);
  return id;
};

async function state(client) {
  const canonical = loadCanonical();
  const { rows: games } = await client.query('SELECT team_id, name FROM teams');
  const appNames = Object.fromEntries(games.map((g) => [g.team_id, g.name]));
  const { rows: snaps } = await client.query(
    `SELECT DISTINCT ON (system) system, through_date::text AS through_date, notes
     FROM rating_snapshots ORDER BY system, through_date DESC, snapshot_id DESC`);
  return {
    teams: Object.entries(canonical).map(([id, t]) => ({ id, name: t.name, appName: appNames[id] || null })).sort((a, b) => a.name.localeCompare(b.name)),
    synonyms: Object.entries(loadSynonyms()).map(([alias_key, team_id]) => ({ alias_key, team_id, team_name: canonical[team_id] ? canonical[team_id].name : null }))
      .sort((a, b) => a.alias_key.localeCompare(b.alias_key)),
    unresolved: snaps.filter((s) => s.notes && s.notes.unresolved && s.notes.unresolved.length)
      .map((s) => ({ system: s.system, throughDate: s.through_date, names: s.notes.unresolved })),
  };
}

async function main() {
  const client = await connect();
  try {
    if (cmd === 'state') {
      console.log(JSON.stringify(await state(client)));
    } else if (cmd === 'seed') {
      console.log(JSON.stringify({ ok: true, dryRun: args.includes('--dry-run'), ...(await seedCanonical(client, { dryRun: args.includes('--dry-run') })) }, null, 2));
    } else if (cmd === 'map') {
      const alias = need('--alias'), canonical = loadCanonical(), id = findTeam(canonical, need('--team'));
      const key = baseKey(alias);
      if (!key) throw new Error('that spelling has no letters in it');
      const owner = keyIndex(canonical).get(key);
      if (owner === id) throw new Error(`"${alias}" already matches ${canonical[id].name} by name; no mapping is needed`);
      if (owner) throw new Error(`"${alias}" is already the name of ${canonical[owner].name}; rename that team first if it is wrong`);
      const synonyms = loadSynonyms();
      synonyms[key] = id;
      saveSynonyms(synonyms);
      console.log(JSON.stringify({ ok: true, alias_key: key, team_id: id, team_name: canonical[id].name, forgotten: await forgetAliases(client, key) }));
    } else if (cmd === 'unmap') {
      const key = need('--key'), synonyms = loadSynonyms();
      if (!(key in synonyms)) throw new Error(`no mapping for key "${key}"`);
      delete synonyms[key];
      saveSynonyms(synonyms);
      console.log(JSON.stringify({ ok: true, removed: key, forgotten: await forgetAliases(client, key) }));
    } else if (cmd === 'add-team') {
      const name = need('--name'), id = (opt('--id') || slugify(name)).trim();
      const canonical = loadCanonical();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`"${id}" is not a usable id (lowercase letters, digits, dashes)`);
      if (canonical[id]) throw new Error(`team id ${id} already exists (${canonical[id].name})`);
      const clash = keyIndex(canonical).get(baseKey(name));
      if (clash) throw new Error(`"${name}" reduces to the same name as ${canonical[clash].name}; map it to that team instead`);
      canonical[id] = { name };
      saveCanonical(Object.fromEntries(Object.entries(canonical).sort(([a], [b]) => a.localeCompare(b))));
      const alias = (opt('--alias') || '').trim();
      if (alias && baseKey(alias) !== baseKey(name)) { const syn = loadSynonyms(); syn[baseKey(alias)] = id; saveSynonyms(syn); await forgetAliases(client, baseKey(alias)); }
      await syncCanonical(client);
      console.log(JSON.stringify({ ok: true, id, name }));
    } else if (cmd === 'rename') {
      const canonical = loadCanonical(), id = findTeam(canonical, need('--id')), name = need('--name');
      const old = canonical[id].name, oldKey = baseKey(old), newKey = baseKey(name);
      const clash = keyIndex(canonical).get(newKey);
      if (clash && clash !== id) throw new Error(`"${name}" reduces to the same name as ${canonical[clash].name}`);
      canonical[id] = { ...canonical[id], name };
      saveCanonical(canonical);
      if (oldKey !== newKey) { const syn = loadSynonyms(); syn[oldKey] = id; saveSynonyms(syn); }   // the old spelling keeps matching
      await syncCanonical(client);
      console.log(JSON.stringify({ ok: true, id, from: old, to: name }));
    } else {
      throw new Error('usage: mappings.js state | seed | map | unmap | add-team | rename (see the header of this file)');
    }
  } finally {
    await client.end();
  }
}
main().catch((err) => { console.error(err.message); process.exit(1); });
