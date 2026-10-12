// Season lineups aggregation. Pure; no I/O; shared by the aggregator CLI and the app.
// Sums per-game lineup summaries (lineupsSummary.js) into one row per lineup.
//
// Output: { season, team, rulesVersion, generatedAt, gamesIncluded, gamesSkipped,
//           players: [{ name, minutes, games }],   // everyone who played, most minutes first
//           games:   { [gameId]: { date, oppTeamId, location, ... } },   // same fields as kills byGame rows
//           lineups: { [hash]: { names, totalMinutes, totalNet,
//                                games: [{ gameId, net, mins }] } } }
// Games are named by gameId + oppTeamId (joined to meta/teams.json in the app), as in the kills view.
import { LINEUPS_RULES_VERSION } from './lineupsSummary.js';

function gameInfo(summary) {
  const { game } = summary;
  return {
    date: game.date,
    seasonYear: game.seasonYear,
    oppTeamId: game.oppTeamId,
    location: game.location,
    isConferenceGame: game.isConferenceGame,
    seasonType: game.seasonType,
    tournamentRound: game.tournamentRound,
    result: game.result,
    scoreFor: game.scoreFor,
    scoreAgainst: game.scoreAgainst,
    margin: game.margin,
  };
}

// A player's minutes are the minutes of every lineup he was in; games are the distinct games
// those lineups played. Names are the same LAST,FIRST strings the lineups carry.
function playersOf(lineups) {
  const byName = {};
  Object.values(lineups).forEach((l) => {
    l.names.forEach((name) => {
      const row = byName[name] || (byName[name] = { name, minutes: 0, gameIds: new Set() });
      row.minutes += l.totalMinutes;
      l.games.forEach((g) => row.gameIds.add(g.gameId));
    });
  });
  return Object.values(byName)
    .map((r) => ({ name: r.name, minutes: r.minutes, games: r.gameIds.size }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
}

export function buildSeason({ season, team = 'byu', summaries, skipped = [], generatedAt = new Date().toISOString() }) {
  const versions = [...new Set(summaries.map((s) => s.rulesVersion))];
  if (versions.length > 1) {
    throw new Error(`mixed lineups rules versions (${versions.join(', ')}); regenerate every game summary`);
  }
  if (versions.length && versions[0] !== LINEUPS_RULES_VERSION) {
    throw new Error(`summaries are rules version ${versions[0]} but the code is ${LINEUPS_RULES_VERSION}; regenerate them`);
  }

  const ordered = [...summaries].sort((a, b) => a.game.date.localeCompare(b.game.date) || a.gameId.localeCompare(b.gameId));
  const games = {};
  const lineups = {};
  ordered.forEach((s) => {
    games[s.gameId] = gameInfo(s);
    Object.entries(s.lineups).forEach(([hash, l]) => {
      const row = lineups[hash] || (lineups[hash] = { names: l.names, totalMinutes: 0, totalNet: 0, games: [] });
      row.totalMinutes += l.mins;
      row.totalNet += l.net;
      row.games.push({ gameId: s.gameId, net: l.net, mins: l.mins });
    });
  });

  return {
    season,
    team,
    rulesVersion: LINEUPS_RULES_VERSION,
    generatedAt,
    gamesIncluded: ordered.length,
    gamesSkipped: skipped,
    players: playersOf(lineups),
    games,
    lineups,
  };
}
