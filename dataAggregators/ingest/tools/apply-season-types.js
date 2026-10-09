// Writes season_type / is_postseason (and the conference flag for conference tournament games)
// onto every game of the seasons listed in config/season-boundaries.json. Re-run after changing
// the markers. Ingest also applies it per game, so new games pick it up automatically.
// Usage: node ingest/tools/apply-season-types.js
const { connect } = require('../../db/client');
const { applySeasonTypes } = require('../lib/season-type');

async function main() {
  const client = await connect();
  try {
    const changed = await applySeasonTypes(client);
    changed.forEach(c => console.log(`${c.gameId} -> ${c.seasonType}`));
    console.log(`${changed.length} game(s) updated`);
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
