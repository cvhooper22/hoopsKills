// Dump one game's normalized plays as a JSON array (for the stat_explorer Lineups view).
// Usage: node ingest/tools/export-game-plays.js <game_id> [out_path]
const fs = require('fs');
const path = require('path');
const { connect } = require('../../db/client');

const PLAY_COLUMNS = `
  p.sequence_number, p.period_number, p.period_type, p.clock_display,
  p.clock_seconds_remaining, p.game_seconds_elapsed,
  p.team_id, p.team_side, p.player_id, pl.name AS player_name,
  p.play_category, p.play_type, p.play_subtype, p.play_description,
  p.home_score_after, p.away_score_after, p.shot_value, p.is_made,
  p.lineup_home, p.lineup_away`;

async function main() {
  const [gameId, outArg] = process.argv.slice(2);
  if (!gameId) throw new Error('usage: export-game-plays.js <game_id> [out_path]');
  const out = outArg || path.join(__dirname, '../../../stat_explorer/public/data', `${gameId}.json`);
  const client = await connect();
  try {
    const { rows } = await client.query(
      `SELECT ${PLAY_COLUMNS} FROM plays p LEFT JOIN players pl USING (player_id)
       WHERE p.game_id = $1 ORDER BY p.sequence_number`,
      [gameId]
    );
    if (!rows.length) throw new Error(`no plays for ${gameId}`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(rows));
    console.log(`wrote ${rows.length} plays -> ${out}`);
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
