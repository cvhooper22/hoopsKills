// Writes the per-game kills summary (the additive facts the season aggregation sums) as JSON.
// Usage: node ingest/tools/export-game-kills.js <game_id> [out_path]
//        node ingest/tools/export-game-kills.js --all [--team byu] [--out-dir DIR]
// --all writes <out-dir>/<game_id>.json for every final game the team played (default
// <tmp>/kills/games). Upload each with ingest/tools/upload.js to kills/games/<game_id>.json.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { connect } = require('../../db/client');
const { fetchGamePlays } = require('../lib/game-plays');
const { killsSummary } = require('../../derivations/app-modules');

const GAME_SQL = `
  SELECT game_id, to_char(game_date, 'YYYY-MM-DD') AS game_date, season_year, season_type, tournament_round,
         home_team_id, away_team_id, final_score_home, final_score_away,
         is_neutral_site, is_conference_game, primary_source, status
  FROM games`;

function toGame(g) {
  return {
    gameId: g.game_id,
    date: g.game_date,
    seasonYear: g.season_year,
    seasonType: g.season_type,
    tournamentRound: g.tournament_round,
    homeTeamId: g.home_team_id,
    awayTeamId: g.away_team_id,
    finalScoreHome: g.final_score_home,
    finalScoreAway: g.final_score_away,
    isNeutralSite: g.is_neutral_site,
    isConferenceGame: g.is_conference_game,
    primarySource: g.primary_source,
  };
}

async function exportOne(client, g, team, out) {
  const plays = await fetchGamePlays(client, g.game_id);
  if (!plays.length) throw new Error(`no plays for ${g.game_id}`);
  const summary = killsSummary.buildGameSummary({ plays, game: toGame(g), focusTeamId: team });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(summary));
  const b = summary.byu;
  console.log(`${g.game_id}: ${b.kills} kills, ${b.potential} potential, ${b.stops} stops, opp ${summary.oppKills} -> ${out}`);
}

async function main() {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const team = opt('--team') || 'byu';
  const client = await connect();
  try {
    if (args.includes('--all')) {
      const dir = opt('--out-dir') || path.join(os.tmpdir(), 'kills', 'games');
      const { rows } = await client.query(
        `${GAME_SQL} WHERE status = 'final' AND (home_team_id = $1 OR away_team_id = $1) ORDER BY game_date`, [team]);
      let failed = 0;
      for (const g of rows) {
        try { await exportOne(client, g, team, path.join(dir, `${g.game_id}.json`)); }
        catch (err) { failed++; console.error(`FAILED ${g.game_id}: ${err.message}`); }
      }
      console.log(`${rows.length - failed}/${rows.length} summaries written to ${dir}`);
      if (failed) process.exit(1);
      return;
    }
    const [gameId, outArg] = args;
    if (!gameId) throw new Error('usage: export-game-kills.js <game_id> [out_path] | --all [--team byu] [--out-dir DIR]');
    const { rows: [g] } = await client.query(`${GAME_SQL} WHERE game_id = $1`, [gameId]);
    if (!g) throw new Error(`no game ${gameId}`);
    await exportOne(client, g, team, outArg || path.join(os.tmpdir(), 'kills', 'games', `${gameId}.json`));
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
