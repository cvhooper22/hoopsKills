// Per-game kills summary: the compact, additive facts the season aggregation sums. Pure; no I/O.
// Written once per game to kills/games/<gameId>.json by dataAggregators/ingest/tools/export-game-kills.js.
// The season merge (killsSeason.js) turns summaries into rows and folds them; see
// futureWork/season-kills-aggregation.md for the shapes.
//
// Imports use explicit .js extensions so Node can require() this file as well as webpack.
import { detectKills, KILLS_RULES_VERSION } from './kills.js';
import { killGain, killGaps } from './killInsights.js';
import { STOP_TYPES } from '../constants/stopTypes.js';

export const OVERTIME_KEY = 'OT';
export const PERIOD_KEYS = ['1', '2', OVERTIME_KEY];

export function periodKey(period) {
  if (period === 1) return '1';
  if (period === 2) return '2';
  return OVERTIME_KEY;
}

const zeroPeriod = () => ({ kills: 0, potential: 0, stops: 0, pure: 0, dirty: 0 });

function streakLengthBuckets(streaks) {
  const out = { 2: 0, 3: 0, 4: 0, '5plus': 0 };
  streaks.forEach((s) => {
    if (s.length >= 5) out['5plus'] += 1;
    else if (s.length >= 2) out[s.length] += 1;
  });
  return out;
}

// The longest run of stops in the game (first one on a tie), with where it happened.
function longestStreakOf(result) {
  const stopBySeq = new Map(result.stops.map((s) => [s.seq, s]));
  let best = null;
  result.streaks.forEach((s) => {
    if (best && s.length <= best.length) return;
    const first = stopBySeq.get(s.stops[0]);
    best = {
      length: s.length,
      period: first.period,
      startSeconds: first.gameSeconds,
      endSeconds: s.breaker ? s.breaker.gameSeconds : null, // only tracked for streaks of 2+
      converted: s.kills.length,
    };
  });
  return best;
}

function stopMixOf(stops) {
  const mix = Object.fromEntries(STOP_TYPES.map((t) => [t.type, 0]));
  stops.forEach((s) => { mix[s.type] = (mix[s.type] || 0) + 1; });
  return mix;
}

// Steal / block credit by player name (stops carry the name, not an id). Charges and uncredited
// stops are counted in stopMix only. A credited tie-up counts as a steal, as in the game view.
function creditOf(stops) {
  const credit = {};
  stops.forEach((s) => {
    if (s.type === 'charge' || !s.credit) return;
    const row = credit[s.credit] || (credit[s.credit] = { steals: 0, blocks: 0 });
    if (s.type === 'block') row.blocks += 1;
    else row.steals += 1;
  });
  return credit;
}

// game: { gameId, date, seasonYear, homeTeamId, awayTeamId, finalScoreHome, finalScoreAway,
//         isNeutralSite, isConferenceGame, seasonType, tournamentRound, primarySource }
// focusTeamId's defense is the "byu" side; the other team's kills are counted as oppKills.
export function buildGameSummary({ plays, game, focusTeamId = 'byu', generatedAt = new Date().toISOString() }) {
  const focusHome = game.homeTeamId === focusTeamId;
  if (!focusHome && game.awayTeamId !== focusTeamId) {
    throw new Error(`${focusTeamId} did not play in ${game.gameId}`);
  }
  const result = detectKills(plays, focusHome ? 'home' : 'away');
  const { kills, potentialKills, stops } = result;

  const scoreFor = focusHome ? game.finalScoreHome : game.finalScoreAway;
  const scoreAgainst = focusHome ? game.finalScoreAway : game.finalScoreHome;

  const byPeriod = { 1: zeroPeriod(), 2: zeroPeriod(), [OVERTIME_KEY]: zeroPeriod() };
  stops.forEach((s) => { byPeriod[periodKey(s.period)].stops += 1; });
  potentialKills.forEach((p) => { byPeriod[periodKey(p.period)].potential += 1; });
  kills.forEach((k) => {
    const row = byPeriod[periodKey(k.start.period)];
    row.kills += 1;
    if (k.dirty) row.dirty += 1; else row.pure += 1;
  });

  return {
    gameId: game.gameId,
    source: game.primarySource || null,
    rulesVersion: KILLS_RULES_VERSION,
    generatedAt,
    game: {
      date: game.date,
      seasonYear: game.seasonYear,
      oppTeamId: focusHome ? game.awayTeamId : game.homeTeamId,
      // From the focus team's side plus the neutral flag, never from a source's event name.
      location: game.isNeutralSite ? 'neutral' : focusHome ? 'home' : 'away',
      isConferenceGame: !!game.isConferenceGame,
      seasonType: game.seasonType || 'regular',
      tournamentRound: game.tournamentRound || null,
      result: scoreFor > scoreAgainst ? 'W' : 'L',
      scoreFor,
      scoreAgainst,
      margin: scoreFor - scoreAgainst,
    },
    byu: {
      kills: kills.length,
      potential: potentialKills.length,
      stops: stops.length,
      pure: kills.filter((k) => !k.dirty).length,
      dirty: kills.filter((k) => k.dirty).length,
      byPeriod,
      gainSum: kills.reduce((sum, k) => sum + killGain(k), 0),
      gainCount: kills.length,
      gaps: killGaps(kills).map((g) => g.seconds),
      durations: kills.map((k) => k.durationSeconds),
      killTimes: kills.map((k) => k.start.gameSeconds),
      streakLengths: streakLengthBuckets(result.streaks),
      longestStreak: longestStreakOf(result),
      buckets: {
        critical: kills.filter((k) => k.critical).length,
        garbage: kills.filter((k) => k.garbage).length,
        clutch: kills.filter((k) => k.clutch === 'clutch').length,
        adjacent: kills.filter((k) => k.clutch === 'adjacent').length,
      },
      stopMix: stopMixOf(stops),
      credit: creditOf(stops),
      avoidableBreakers: result.streaks.filter((s) => s.breaker && s.breaker.avoidable).length,
    },
    // The opponent's kills; only the count is kept.
    oppKills: detectKills(plays, focusHome ? 'away' : 'home').kills.length,
  };
}
