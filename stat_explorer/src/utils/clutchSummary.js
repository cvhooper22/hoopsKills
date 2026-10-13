// Per-game clutch summary: the additive facts the season aggregation sums. Pure; no I/O.
// Written once per game to clutch/games/<gameId>.json by dataAggregators/ingest/tools/export-game-clutch.js.
// The season merge (clutchSeason.js) turns summaries into rows and folds them.
//
// The definition is fixed (CLUTCH_DEFINITION) because the season files are precomputed. The game page
// keeps its adjustable definition by working from the plays directly.
//
// Imports use explicit .js extensions so Node can require() this file as well as webpack.
import { genClutchData, CLUTCH_STAT_KEYS } from './clutchUtils.js';

// Bump when the definition or the counting changes. The season aggregator refuses mixed versions.
export const CLUTCH_RULES_VERSION = 1;
export const CLUTCH_DEFINITION = { seconds: 300, margin: 5 };

// What a team line carries. Players also carry minutes and plus/minus; a team's own are its clutch
// time and net, so those come from the totals instead.
const TEAM_KEYS = CLUTCH_STAT_KEYS.filter((k) => k !== 'plusMinus' && k !== 'seconds' && k !== 'pts');
const ACTIVITY_KEYS = CLUTCH_STAT_KEYS.filter((k) => k !== 'plusMinus');

const SITUATIONS = ['leading', 'tied', 'trailing'];
const periodKey = (period) => (period >= 3 ? 'OT' : '2');

// Clock subtraction leaves float noise (96.99999999999997); tenths are plenty.
const round1 = (n) => Math.round(n * 10) / 10;

const zeroTally = () => ({ stretches: 0, seconds: 0, ptsFor: 0, ptsAgainst: 0 });

function roundTallies(tallies) {
  return Object.fromEntries(Object.entries(tallies).map(([k, t]) => [k, { ...t, seconds: round1(t.seconds) }]));
}

// game: { gameId, date, seasonYear, homeTeamId, awayTeamId, finalScoreHome, finalScoreAway,
//         isNeutralSite, isConferenceGame, seasonType, tournamentRound, primarySource }
// Everything is from focusTeamId's side; the opponent is kept as team totals only.
export function buildGameClutchSummary({ plays, game, focusTeamId = 'byu', generatedAt = new Date().toISOString() }) {
  const focusHome = game.homeTeamId === focusTeamId;
  if (!focusHome && game.awayTeamId !== focusTeamId) {
    throw new Error(`${focusTeamId} did not play in ${game.gameId}`);
  }
  const oppTeamId = focusHome ? game.awayTeamId : game.homeTeamId;
  const scoreFor = focusHome ? game.finalScoreHome : game.finalScoreAway;
  const scoreAgainst = focusHome ? game.finalScoreAway : game.finalScoreHome;
  const sign = focusHome ? 1 : -1;

  const data = genClutchData(plays, CLUTCH_DEFINITION);
  const { stretches } = data;
  const teamPts = (id) => data.teams[id]?.pts ?? 0;

  const teamLine = (teamId, pts) => {
    const line = { pts };
    TEAM_KEYS.forEach((k) => { line[k] = 0; });
    data.players.filter((p) => p.teamId === teamId).forEach((p) => TEAM_KEYS.forEach((k) => { line[k] += p[k]; }));
    return line;
  };

  const players = {};
  data.players
    .filter((p) => p.teamId === focusTeamId && ACTIVITY_KEYS.some((k) => p[k]))
    .forEach((p) => {
      players[p.id] = { name: p.name };
      CLUTCH_STAT_KEYS.forEach((k) => { players[p.id][k] = k === 'seconds' ? round1(p[k]) : p[k]; });
    });

  // How each stretch began for the focus team, and how it went. Totals are per stretch; the period
  // split follows the clock, so a stretch that runs from regulation into overtime counts in both.
  const entries = Object.fromEntries(SITUATIONS.map((s) => [s, zeroTally()]));
  const periods = { 2: zeroTally(), OT: zeroTally() };
  const outcomes = { won: 0, lost: 0, even: 0 };
  stretches.forEach((s) => {
    const lead = sign * (s.start.home - s.start.away);
    const ptsFor = s.pts[focusTeamId] ?? 0;
    const ptsAgainst = s.pts[oppTeamId] ?? 0;
    const entry = entries[lead > 0 ? 'leading' : lead < 0 ? 'trailing' : 'tied'];
    entry.stretches += 1;
    entry.seconds += s.seconds;
    entry.ptsFor += ptsFor;
    entry.ptsAgainst += ptsAgainst;
    if (ptsFor > ptsAgainst) outcomes.won += 1; else if (ptsFor < ptsAgainst) outcomes.lost += 1; else outcomes.even += 1;
    Object.entries(s.byPeriod).forEach(([period, t]) => {
      const row = periods[periodKey(Number(period))];
      row.seconds += t.seconds;
      row.ptsFor += t.pts[focusTeamId] ?? 0;
      row.ptsAgainst += t.pts[oppTeamId] ?? 0;
    });
    // a stretch counts toward the period it began in
    periods[periodKey(s.start.period)].stretches += 1;
  });

  return {
    gameId: game.gameId,
    source: game.primarySource || null,
    rulesVersion: CLUTCH_RULES_VERSION,
    generatedAt,
    definition: CLUTCH_DEFINITION,
    // Same game block as the kills and lineups summaries, so every view names and filters games alike.
    game: {
      date: game.date,
      seasonYear: game.seasonYear,
      oppTeamId,
      location: game.isNeutralSite ? 'neutral' : focusHome ? 'home' : 'away',
      isConferenceGame: !!game.isConferenceGame,
      seasonType: game.seasonType || 'regular',
      tournamentRound: game.tournamentRound || null,
      result: scoreFor > scoreAgainst ? 'W' : 'L',
      scoreFor,
      scoreAgainst,
      margin: scoreFor - scoreAgainst,
    },
    seconds: round1(data.seconds),
    stretches: stretches.length,
    outcomes,
    entries: roundTallies(entries),
    periods: roundTallies(periods),
    team: {
      for: teamLine(focusTeamId, teamPts(focusTeamId)),
      against: teamLine(oppTeamId, teamPts(oppTeamId)),
    },
    players,
  };
}
