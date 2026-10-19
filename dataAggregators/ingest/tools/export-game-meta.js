// Dump one game's header facts and player headshots as JSON (for the stat_explorer Clutch view).
// Pairs with export-game-plays.js. Usage: node ingest/tools/export-game-meta.js <game_id> [out_path]
const fs = require('fs');
const path = require('path');
const { connect } = require('../../db/client');
const { fetchGameMeta } = require('../lib/game-meta');

async function main() {
  const [gameId, outArg] = process.argv.slice(2);
  if (!gameId) throw new Error('usage: export-game-meta.js <game_id> [out_path]');
  const out = outArg || path.join(__dirname, '../../../stat_explorer/public/data', `${gameId}.meta.json`);
  const client = await connect();
  try {
    const meta = await fetchGameMeta(client, gameId);
    if (!meta) throw new Error(`no game ${gameId}`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(meta, null, 1));
    console.log(`wrote meta (${Object.keys(meta.headshots).length} headshots) -> ${out}`);
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
