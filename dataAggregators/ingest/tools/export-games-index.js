// Dump the full games list (id, date, season, teams, final score) as one JSON array,
// for the stat_explorer game/season switcher. Usage: node ingest/tools/export-games-index.js [out_path]
// Each game also carries `opponentRatings` (see migration 005): the opponent's rank / rating / percentile per rating system,
// as of tip-off (atGame) and in the season's latest snapshot (latest). Rank is a game-level fact, so the app filters games
// by it ("vs a top-40 defense") and plays and players follow. A system with no snapshot for the game is simply absent.
// Also writes rating-systems.json beside the index (labels, units and direction for each system), for the filter UI.
const fs = require('fs');
const path = require('path');
const { connect } = require('../../db/client');

const num = (v) => (v === null || v === undefined ? null : Number(v));

// { gameId: { system: { atGame: {...}, latest: {...} } } } from game_opponent_ratings. Skipped (null) when the ratings
// tables are not in this database.
async function loadOpponentRatings(client) {
  try {
    const { rows } = await client.query(`SELECT * FROM game_opponent_ratings ORDER BY game_id, system, basis`);
    const { rows: sys } = await client.query(`SELECT system, name, kind, metric_meta FROM rating_systems WHERE active ORDER BY system`);
    const out = new Map();
    for (const r of rows) {
      const byGame = out.get(r.game_id) || {};
      const bySystem = byGame[r.system] || (byGame[r.system] = {});
      bySystem[r.basis === 'at_game' ? 'atGame' : 'latest'] = {
        throughDate: r.through_date.toISOString ? r.through_date.toISOString().slice(0, 10) : String(r.through_date).slice(0, 10),
        teams: num(r.n_teams),
        overallRank: r.opp_overall_rank, overallRating: num(r.opp_overall_rating), overallPctile: num(r.opp_overall_pctile), marginVsAvg: num(r.opp_margin_vs_avg),
        offRank: r.opp_off_rank, offRating: num(r.opp_off_rating), offPctile: num(r.opp_off_pctile), offVsAvg: num(r.opp_off_vs_avg),
        defRank: r.opp_def_rank, defRating: num(r.opp_def_rating), defPctile: num(r.opp_def_pctile), defVsAvg: num(r.opp_def_vs_avg),
        byuOverallRank: r.byu_overall_rank,
        metrics: r.opp_metrics,
      };
      out.set(r.game_id, byGame);
    }
    const systems = Object.fromEntries(sys.map((s) => [s.system, {
      name: s.name, kind: s.kind,
      parts: Object.fromEntries(Object.entries(s.metric_meta).map(([part, m]) => [part, { label: m.label, unit: m.unit, higherIsBetter: m.higher_is_better }])),
    }]));
    return { opponentRatings: out, systems };
  } catch (err) {
    if (err.code === '42P01') return { opponentRatings: new Map(), systems: null }; // views not migrated here
    throw err;
  }
}

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
    const { rows: exh } = await client.query("SELECT game_id FROM game_tags WHERE tag = 'exhibition'");
    const exhibitions = new Set(exh.map(r => r.game_id));
    const { opponentRatings, systems } = await loadOpponentRatings(client);
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
      isExhibition: exhibitions.has(g.game_id), // tag-game.js <id> exhibition; left out of season aggregations
      opponentRatings: opponentRatings.get(g.game_id) || {},
    }));

    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(index));
    console.log(`wrote ${index.length} games -> ${out}`);
    if (systems) {
      const systemsOut = path.join(path.dirname(out), 'rating-systems.json');
      fs.writeFileSync(systemsOut, JSON.stringify(systems));
      console.log(`wrote ${Object.keys(systems).length} rating systems -> ${systemsOut}`);
    }
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
