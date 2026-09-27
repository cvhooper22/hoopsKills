// Dump one game's header facts and player headshots as JSON (for the stat_explorer Clutch view).
// Pairs with export-game-plays.js. Usage: node ingest/tools/export-game-meta.js <game_id> [out_path]
const fs = require('fs');
const path = require('path');
const { connect } = require('../../db/client');

async function main() {
  const [gameId, outArg] = process.argv.slice(2);
  if (!gameId) throw new Error('usage: export-game-meta.js <game_id> [out_path]');
  const out = outArg || path.join(__dirname, '../../../stat_explorer/public/data', `${gameId}.meta.json`);
  const client = await connect();
  try {
    const { rows: [g] } = await client.query(
      `SELECT g.game_id, to_char(g.game_date, 'YYYY-MM-DD') AS game_date, g.venue, g.is_neutral_site, g.status,
              g.home_team_id, g.away_team_id, g.final_score_home, g.final_score_away
       FROM games g WHERE g.game_id = $1`,
      [gameId]
    );
    if (!g) throw new Error(`no game ${gameId}`);
    const { rows: teams } = await client.query(
      `SELECT team_id, name, abbrev FROM teams WHERE team_id = ANY($1)`,
      [[g.home_team_id, g.away_team_id]]
    );
    const { rows: images } = await client.query(
      `SELECT pi.player_id, pi.hosted_url FROM player_images pi
       WHERE pi.player_id IN (SELECT DISTINCT player_id FROM plays WHERE game_id = $1 AND player_id IS NOT NULL)`,
      [gameId]
    );
    const meta = {
      gameId: g.game_id,
      date: g.game_date,
      venue: g.venue,
      neutralSite: g.is_neutral_site,
      status: g.status,
      homeId: g.home_team_id,
      awayId: g.away_team_id,
      final: { [g.home_team_id]: g.final_score_home, [g.away_team_id]: g.final_score_away },
      teams: Object.fromEntries(teams.map((t) => [t.team_id, { name: t.name, abbrev: t.abbrev }])),
      headshots: Object.fromEntries(images.map((i) => [i.player_id, i.hosted_url])),
    };
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(meta, null, 1));
    console.log(`wrote meta (${images.length} headshots) -> ${out}`);
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
