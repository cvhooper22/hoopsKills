// Per-game lineups summary: each BYU lineup's minutes and net for one game. Pure; no I/O.
// Written once per game to lineups/games/<gameId>.json by dataAggregators/ingest/tools/export-game-lineups.js.
// The season merge (lineupsSeason.js) sums these. Stints are left out; the game view recomputes them.
//
// Imports use explicit .js extensions so Node can require() this file as well as webpack.
import genLineupData from './lineupUtils.js';
import playsToBbgame from './playsToBbgame.js';

// Bump when stint / net / minutes logic changes. The season aggregator refuses mixed versions.
export const LINEUPS_RULES_VERSION = 1;

// game: same shape buildGameSummary takes in killsSummary.js.
export function buildGameLineupsSummary({ plays, game, focusTeamId = 'byu', generatedAt = new Date().toISOString() }) {
  const focusHome = game.homeTeamId === focusTeamId;
  if (!focusHome && game.awayTeamId !== focusTeamId) {
    throw new Error(`${focusTeamId} did not play in ${game.gameId}`);
  }
  const scoreFor = focusHome ? game.finalScoreHome : game.finalScoreAway;
  const scoreAgainst = focusHome ? game.finalScoreAway : game.finalScoreHome;

  const data = genLineupData(playsToBbgame(plays, focusTeamId));
  const lineups = {};
  Object.entries(data.lineups).forEach(([hash, l]) => {
    lineups[hash] = { names: l.names, mins: l.totalTime, net: l.totalNet };
  });

  return {
    gameId: game.gameId,
    source: game.primarySource || null,
    rulesVersion: LINEUPS_RULES_VERSION,
    generatedAt,
    // Same game block as the kills summary, so both views name and filter games the same way.
    game: {
      date: game.date,
      seasonYear: game.seasonYear,
      oppTeamId: focusHome ? game.awayTeamId : game.homeTeamId,
      location: game.isNeutralSite ? 'neutral' : focusHome ? 'home' : 'away',
      isConferenceGame: !!game.isConferenceGame,
      seasonType: game.seasonType || 'regular',
      tournamentRound: game.tournamentRound || null,
      result: scoreFor > scoreAgainst ? 'W' : 'L',
      scoreFor,
      scoreAgainst,
      margin: scoreFor - scoreAgainst,
    },
    starterHash: data.starterHash,
    lineups,
  };
}
