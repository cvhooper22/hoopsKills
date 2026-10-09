// Dump the full games list (id, date, season, teams, final score) as one JSON array,
// for the stat_explorer game/season switcher. Usage: node ingest/tools/export-games-index.js [out_path]
const fs = require('fs');
const path = require('path');
const { connect } = require('../../db/client');

async function main() {
  const [outArg] = process.argv.slice(2);
  const out = outArg || path.join(__dirname, '../../../stat_explorer/public/data', 'games-index.json');
  const client = await connect();
  try {
    const { rows: games } = await client.query(
      `SELECT game_id, to_char(game_date, 'YYYY-MM-DD') AS game_date, season_year, season_type, tournament_round, is_postseason, is_conference_game,
              home_team_id, away_team_id, final_score_home, final_score_away, status, is_neutral_site
       FROM games ORDER BY game_date`
    );
    const teamIds = [...new Set(games.flatMap(g => [g.home_team_id, g.away_team_id]))];
    const { rows: teams } = await client.query(
      `SELECT team_id, name FROM teams WHERE team_id = ANY($1)`,
      [teamIds]
    );
    const teamName = Object.fromEntries(teams.map(t => [t.team_id, t.name]));

    const index = games.map(g => ({
      gameId: g.game_id,
      date: g.game_date,
      seasonYear: g.season_year,
      seasonType: g.season_type,
      tournamentRound: g.tournament_round,
      isPostseason: g.is_postseason,
      isConferenceGame: g.is_conference_game,
      homeTeamId: g.home_team_id,
      homeTeamName: teamName[g.home_team_id] || null,
      awayTeamId: g.away_team_id,
      awayTeamName: teamName[g.away_team_id] || null,
      finalScoreHome: g.final_score_home,
      finalScoreAway: g.final_score_away,
      status: g.status,
      neutralSite: g.is_neutral_site,
    }));

    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(index));
    console.log(`wrote ${index.length} games -> ${out}`);
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
