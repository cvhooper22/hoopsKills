// Writes the per-game box payload (aggregations + per-chance rows + play log: everything the app's Box, Plays and Lineup
// timeline views read) as JSON, plus the index of the games written.
// Usage: node ingest/tools/export-game-box.js <game_id> [--out-dir DIR]
//        node ingest/tools/export-game-box.js --all [--out-dir DIR]
// Writes <out-dir>/box/games/<game_id>.json and rebuilds <out-dir>/box/index.json from every game file in that folder
// (default out-dir: <tmp>). --all covers every final BYU game. Upload with ingest/tools/upload.js:
//   node ingest/tools/upload.js <out-dir>/box/games/<game_id>.json box/games/<game_id>.json
//   node ingest/tools/upload.js <out-dir>/box/index.json box/index.json
// The payload is the same one derivations/game-box-prototype.js writes for the local preview.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { connect } = require('../../db/client');
const { computeBox, load, loadRim, loadWp } = require('../../derivations/game-box-prototype');

async function exportOne(client, gameId, rim, dir) {
  const D = await load(client, gameId);
  if (!D.game) throw new Error(`no such game ${gameId}`);
  if (!D.evs.length) throw new Error(`no plays for ${gameId}`);
  const W = await loadWp(client, gameId, D.game);
  const { payload, checks } = computeBox({ D, rim, W });
  const out = path.join(dir, 'box', 'games', `${gameId}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload));
  const failed = checks.filter((c) => !c.ok);
  console.log(`${gameId}: ${payload.plays.length} chances, ${payload.events.length} events${failed.length ? `, FAILED CHECKS: ${failed.map((c) => c.name).join('; ')}` : ''} -> ${out}`);
}

// newest first, same shape as the local preview's index (see BoxRouter's LatestBox)
function writeIndex(dir) {
  const gamesDir = path.join(dir, 'box', 'games');
  const index = fs.readdirSync(gamesDir).filter((f) => f.endsWith('.json')).map((f) => {
    const h = JSON.parse(fs.readFileSync(path.join(gamesDir, f), 'utf8')).header;
    return { gameId: h.gameId, date: h.date, label: `${h.teams.byu} ${h.final.byu}, ${h.teams.opp} ${h.final.opp}` };
  }).sort((a, b) => (a.date < b.date ? 1 : -1));
  const out = path.join(dir, 'box', 'index.json');
  fs.writeFileSync(out, JSON.stringify(index));
  console.log(`index: ${index.length} games -> ${out}`);
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const dir = opt('--out-dir') || os.tmpdir();
  const gameId = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out-dir');
  if (!gameId && !args.includes('--all')) throw new Error('usage: export-game-box.js <game_id> | --all [--out-dir DIR]');
  const client = await connect();
  try {
    const rim = await loadRim(client);
    let failed = 0;
    if (args.includes('--all')) {
      const { rows } = await client.query(
        `SELECT game_id FROM games WHERE status = 'final' AND (home_team_id = 'byu' OR away_team_id = 'byu') ORDER BY game_date`);
      for (const r of rows) {
        try { await exportOne(client, r.game_id, rim, dir); } catch (err) { failed++; console.error(`FAILED ${r.game_id}: ${err.message}`); }
      }
    } else {
      await exportOne(client, gameId, rim, dir);
    }
    writeIndex(dir);
    if (failed) process.exitCode = 1;
  } finally { await client.end(); }
}

main().catch((e) => { console.error(e); process.exit(1); });
