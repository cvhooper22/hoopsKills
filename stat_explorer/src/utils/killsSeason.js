// Season kills aggregation. Pure; no I/O; shared by the aggregator CLI and the app.
//
// Principle: rows (one per game) carry additive facts. foldRows sums them into `totals` and
// derives ratios / maxes afterwards, so a season (or any filtered subset of games) is always
// computed from counts, never from averages of averages. Shapes: futureWork/season-kills-aggregation.md.
import { PERIOD_KEYS } from './killsSummary.js';
import { STOP_TYPES } from '../constants/stopTypes.js';

const STREAK_KEYS = ['2', '3', '4', '5plus'];
const BUCKET_KEYS = ['critical', 'garbage', 'clutch', 'adjacent'];
const COUNT_KEYS = ['kills', 'oppKills', 'potential', 'stops', 'pure', 'dirty', 'gainSum', 'gainCount', 'avoidableBreakers'];

const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));

// One byGame row from a per-game summary: everything the games table and the re-fold need,
// flattened. Player credit is not included (it stays season-wide).
export function gameRow(summary) {
  const { game, byu } = summary;
  return {
    gameId: summary.gameId,
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
    kills: byu.kills,
    oppKills: summary.oppKills,
    potential: byu.potential,
    stops: byu.stops,
    pure: byu.pure,
    dirty: byu.dirty,
    gainSum: byu.gainSum,
    gainCount: byu.gainCount,
    avoidableBreakers: byu.avoidableBreakers,
    byPeriod: byu.byPeriod,
    buckets: byu.buckets,
    streakLengths: byu.streakLengths,
    longestStreak: byu.longestStreak,
    stopMix: byu.stopMix,
    gaps: byu.gaps,
    durations: byu.durations,
    killTimes: byu.killTimes,
    // Per-game derived values, so the table does no math.
    completion: ratio(byu.kills, byu.kills + byu.potential),
    efficiency: ratio(byu.gainSum, byu.gainCount),
  };
}

function ratio(n, d) {
  return d ? n / d : null;
}

function rangeStats(values) {
  if (!values.length) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return { avg: sum / values.length, longest: Math.max(...values), shortest: Math.min(...values), count: values.length };
}

// Every game that ties for the longest streak, not just the first.
function longestStreakOver(rows) {
  const withStreak = rows.filter((r) => r.longestStreak);
  if (!withStreak.length) return null;
  const length = Math.max(...withStreak.map((r) => r.longestStreak.length));
  return {
    length,
    games: withStreak
      .filter((r) => r.longestStreak.length === length)
      .map((r) => ({ gameId: r.gameId, oppTeamId: r.oppTeamId, date: r.date, period: r.longestStreak.period })),
  };
}

// Sum the additive facts across rows, then derive. Works on any subset of a season's rows, which
// is how the app applies filters. Returns { totals, derived }.
export function foldRows(rows) {
  const totals = {
    games: rows.length,
    ...zeros(COUNT_KEYS),
    byPeriod: Object.fromEntries(PERIOD_KEYS.map((p) => [p, zeros(['kills', 'potential', 'stops', 'pure', 'dirty'])])),
    buckets: zeros(BUCKET_KEYS),
    streakLengths: zeros(STREAK_KEYS),
    stopMix: zeros(STOP_TYPES.map((t) => t.type)),
  };
  const gaps = [];
  const durations = [];

  rows.forEach((r) => {
    COUNT_KEYS.forEach((k) => { totals[k] += r[k] || 0; });
    PERIOD_KEYS.forEach((p) => Object.keys(totals.byPeriod[p]).forEach((k) => { totals.byPeriod[p][k] += (r.byPeriod[p] || {})[k] || 0; }));
    BUCKET_KEYS.forEach((k) => { totals.buckets[k] += r.buckets[k] || 0; });
    STREAK_KEYS.forEach((k) => { totals.streakLengths[k] += r.streakLengths[k] || 0; });
    Object.keys(r.stopMix).forEach((k) => { totals.stopMix[k] = (totals.stopMix[k] || 0) + r.stopMix[k]; });
    gaps.push(...r.gaps);
    durations.push(...r.durations);
  });

  const n = rows.length;
  const perGame = (v) => (n ? v / n : null);
  const derived = {
    completion: ratio(totals.kills, totals.kills + totals.potential),
    efficiency: ratio(totals.gainSum, totals.gainCount),
    diff: totals.kills - totals.oppKills,
    perGame: {
      kills: perGame(totals.kills),
      oppKills: perGame(totals.oppKills),
      potential: perGame(totals.potential),
      stops: perGame(totals.stops),
      avoidableBreakers: perGame(totals.avoidableBreakers),
    },
    gaps: rangeStats(gaps),
    durations: rangeStats(durations),
    longestStreak: longestStreakOver(rows),
  };
  return { totals, derived };
}

// All kill start times (game seconds) across rows, for the "when do kills happen" histogram.
export function pooledKillTimes(rows) {
  return rows.flatMap((r) => r.killTimes);
}

// Season-wide steal / block credit, merged by player name across summaries.
export function mergeCredit(summaries) {
  const byName = {};
  summaries.forEach((s) => {
    Object.entries(s.byu.credit || {}).forEach(([name, c]) => {
      const row = byName[name] || (byName[name] = { name, steals: 0, blocks: 0, gamesWithCredit: 0 });
      row.steals += c.steals;
      row.blocks += c.blocks;
      row.gamesWithCredit += 1;
    });
  });
  return Object.values(byName).sort((a, b) => (b.steals + b.blocks) - (a.steals + a.blocks) || a.name.localeCompare(b.name));
}

// Filters stack (AND). `location` is 'home' | 'away' | 'neutral'; neutral games never count as
// home or away. `postseasonOnly` keeps conference-tournament and postseason games. `result` is 'W' or
// 'L' to keep only wins or losses. Last N applies after the rest, so it is the last N wins, say.
export function filterRows(rows, { conferenceOnly = false, location = null, postseasonOnly = false, result = null, lastN = null } = {}) {
  let out = rows.filter((r) => (
    (!conferenceOnly || r.isConferenceGame)
    && (!location || r.location === location)
    && (!postseasonOnly || r.seasonType !== 'regular')
    && (!result || r.result === result)
  ));
  if (lastN) out = out.slice(-lastN); // rows are date-sorted
  return out;
}

// Build the whole season file from per-game summaries. Throws if the summaries were produced under
// different kill rules; a game with no usable summary is passed in `skipped` and kept in the file.
export function buildSeason({ season, team, summaries, skipped = [], generatedAt = new Date().toISOString() }) {
  const versions = [...new Set(summaries.map((s) => s.rulesVersion))];
  if (versions.length > 1) {
    const byVersion = versions.map((v) => `v${v}: ${summaries.filter((s) => s.rulesVersion === v).map((s) => s.gameId).join(', ')}`);
    throw new Error(`kills rules versions differ; regenerate the older games.\n${byVersion.join('\n')}`);
  }
  const byGame = summaries.map(gameRow).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameId.localeCompare(b.gameId)));
  const { totals, derived } = foldRows(byGame);
  return {
    season,
    team,
    rulesVersion: versions[0] ?? null,
    generatedAt,
    gamesIncluded: summaries.length,
    gamesSkipped: skipped,
    totals,
    derived,
    players: mergeCredit(summaries),
    byGame,
  };
}
