// Dump one game's normalized plays as a JSON array (for the stat_explorer Lineups view).
// Usage: node ingest/tools/export-game-plays.js <game_id> [out_path]
const fs = require('fs');
const path = require('path');
const { connect } = require('../../db/client');
const { fetchGamePlays } = require('../lib/game-plays');

async function main() {
  const [gameId, outArg] = process.argv.slice(2);
  if (!gameId) throw new Error('usage: export-game-plays.js <game_id> [out_path]');
  const out = outArg || path.join(__dirname, '../../../stat_explorer/public/data', `${gameId}.json`);
  const client = await connect();
  try {
    const rows = await fetchGamePlays(client, gameId);
    if (!rows.length) throw new Error(`no plays for ${gameId}`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(rows));
    console.log(`wrote ${rows.length} plays -> ${out}`);
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
