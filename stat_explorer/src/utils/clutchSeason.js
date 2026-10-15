// Season clutch aggregation. Pure; no I/O; shared by the aggregator CLI and the app.
//
// Same principle as killsSeason.js: rows (one per game) carry additive facts, foldRows sums them and
// derives ratios afterwards, so a season or any filtered subset of games is computed from counts.
// Clutch here is the fixed definition in clutchSummary.js (2nd half / OT, 5:00 or less, margin of 5 or less).
import { CLUTCH_RULES_VERSION } from './clutchSummary.js';
import { CLUTCH_STAT_KEYS } from './clutchUtils.js';

// Game filters are the same ones the kills season view uses.
export { filterRows } from './killsSeason.js';

// Counting stats on a team line; pts is first. Player lines add plus/minus and clutch seconds.
export const TEAM_STAT_KEYS = ['pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'reb', 'oreb', 'ast', 'stl', 'blk', 'tov', 'pf'];
export const SITUATIONS = ['leading', 'tied', 'trailing'];
export const PERIOD_KEYS = ['2', 'OT'];

const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));
const ratio = (n, d) => (d ? n / d : null);

// One byGame row from a per-game summary: everything the games table, the box score and the re-fold need.
export function gameRow(summary) {
  const { game } = summary;
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
    seconds: summary.seconds,
    stretches: summary.stretches,
    outcomes: summary.outcomes,
    entries: summary.entries,
    periods: summary.periods,
    last2: summary.last2,
    team: summary.team,
    players: summary.players,
    // Per-game derived value, so the table does no math.
    net: summary.team.for.pts - summary.team.against.pts,
  };
}

const efg = (t) => ratio(t.fgm + 0.5 * t.tpm, t.fga);

// Possessions are estimated (FGA + 0.44 FTA - OREB + TOV): the file has no possession count, and
// rebounds / turnovers charged to the team rather than a player are not in these lines, so it runs a
// little off. Over a few minutes of clutch time it is a rough guide, best used for comparing the two sides.
export const estimatePossessions = (t) => t.fga + 0.44 * t.fta - t.oreb + t.tov;

// Shooting rates and points per possession for one side's summed team line.
function sideRates(t) {
  const poss = estimatePossessions(t);
  return {
    efg: efg(t),
    fgPct: ratio(t.fgm, t.fga),
    twoPct: ratio(t.fgm - t.tpm, t.fga - t.tpa),
    tpPct: ratio(t.tpm, t.tpa),
    ftPct: ratio(t.ftm, t.fta),
    tsPct: ratio(t.pts, 2 * (t.fga + 0.44 * t.fta)),
    poss,
    ppp: poss > 0 ? t.pts / poss : null,
  };
}

// `games` counts the games that had any of this kind of clutch: a game with two stretches that began
// trailing counts once. That is the denominator for the per-game numbers, since a game, not a stretch,
// is the unit of clutch opportunity.
const TALLY_KEYS = ['stretches', 'seconds', 'ptsFor', 'ptsAgainst'];
const tally = () => ({ games: 0, stretches: 0, seconds: 0, ptsFor: 0, ptsAgainst: 0 });
const addTally = (acc, t) => {
  Object.keys(acc).forEach((k) => { if (k !== 'games') acc[k] += t[k] || 0; });
  if ((t.stretches || 0) > 0 || (t.seconds || 0) > 0) acc.games += 1;
};
const withNet = (t) => ({
  ...t,
  net: t.ptsFor - t.ptsAgainst,
  perGame: { ptsFor: ratio(t.ptsFor, t.games), ptsAgainst: ratio(t.ptsAgainst, t.games), net: ratio(t.ptsFor - t.ptsAgainst, t.games) },
});

// Season player lines from each row's players. `gp` counts the games a player was on the floor or
// recorded a stat in the clutch. Sorted by clutch time, then points.
export function foldPlayers(rows) {
  const byId = {};
  rows.forEach((r) => {
    Object.entries(r.players || {}).forEach(([id, p]) => {
      const line = byId[id] || (byId[id] = { id, name: p.name, gp: 0, ...zeros(CLUTCH_STAT_KEYS) });
      line.name = p.name;
      line.gp += 1;
      CLUTCH_STAT_KEYS.forEach((k) => { line[k] += p[k] || 0; });
    });
  });
  return Object.values(byId).sort((a, b) => b.seconds - a.seconds || b.pts - a.pts || a.name.localeCompare(b.name));
}

// Sum the additive facts across rows, then derive. Works on any subset of a season's rows, which is
// how the app applies filters. Returns { totals, derived, players }.
export function foldRows(rows) {
  const totals = {
    games: rows.length,
    clutchGames: 0,
    seconds: 0,
    stretches: 0,
    outcomes: zeros(['won', 'lost', 'even']),
    for: zeros(TEAM_STAT_KEYS),
    against: zeros(TEAM_STAT_KEYS),
    entries: Object.fromEntries(SITUATIONS.map((s) => [s, tally()])),
    periods: Object.fromEntries(PERIOD_KEYS.map((p) => [p, tally()])),
    last2: tally(),
    all: tally(), // regulation and overtime clutch together
  };
  const record = { w: 0, l: 0 }; // results of the games that had any clutch time

  rows.forEach((r) => {
    if (r.seconds > 0) {
      totals.clutchGames += 1;
      if (r.result === 'W') record.w += 1; else record.l += 1;
    }
    totals.seconds += r.seconds;
    totals.stretches += r.stretches;
    Object.keys(totals.outcomes).forEach((k) => { totals.outcomes[k] += r.outcomes[k] || 0; });
    TEAM_STAT_KEYS.forEach((k) => {
      totals.for[k] += r.team.for[k] || 0;
      totals.against[k] += r.team.against[k] || 0;
    });
    SITUATIONS.forEach((s) => addTally(totals.entries[s], r.entries[s] || {}));
    PERIOD_KEYS.forEach((p) => addTally(totals.periods[p], r.periods[p] || {}));
    addTally(totals.last2, r.last2 || {}); // rows from before rules version 2 have none
    const all = {};
    TALLY_KEYS.forEach((k) => { all[k] = PERIOD_KEYS.reduce((n, p) => n + ((r.periods || {})[p]?.[k] || 0), 0); });
    addTally(totals.all, all);
  });

  const net = totals.for.pts - totals.against.pts;
  const derived = {
    record,
    net,
    perGame: {
      net: ratio(net, totals.clutchGames),
      seconds: ratio(totals.seconds, totals.clutchGames),
      stretches: ratio(totals.stretches, totals.clutchGames),
    },
    forRates: sideRates(totals.for),
    againstRates: sideRates(totals.against),
    entries: Object.fromEntries(SITUATIONS.map((s) => [s, withNet(totals.entries[s])])),
    periods: Object.fromEntries(PERIOD_KEYS.map((p) => [p, withNet(totals.periods[p])])),
    last2: withNet(totals.last2),
    all: withNet(totals.all),
  };
  return { totals, derived, players: foldPlayers(rows) };
}

// Build the whole season file from per-game summaries. Throws if the summaries were produced under
// different rules; a game with no usable summary is passed in `skipped` and kept in the file.
// `headshots` maps player id to photo url; it is kept for the players in these games only.
export function buildSeason({ season, team, summaries, skipped = [], headshots = {}, generatedAt = new Date().toISOString() }) {
  const versions = [...new Set(summaries.map((s) => s.rulesVersion))];
  if (versions.length > 1) {
    const byVersion = versions.map((v) => `v${v}: ${summaries.filter((s) => s.rulesVersion === v).map((s) => s.gameId).join(', ')}`);
    throw new Error(`clutch rules versions differ; regenerate the older games.\n${byVersion.join('\n')}`);
  }
  const byGame = summaries.map(gameRow).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameId.localeCompare(b.gameId)));
  const { totals, derived, players } = foldRows(byGame);
  const photos = Object.fromEntries(players.filter((p) => headshots[p.id]).map((p) => [p.id, headshots[p.id]]));
  return {
    season,
    team,
    rulesVersion: versions[0] ?? CLUTCH_RULES_VERSION,
    definition: summaries[0]?.definition ?? null,
    generatedAt,
    gamesIncluded: summaries.length,
    gamesSkipped: skipped,
    headshots: photos,
    totals,
    derived,
    byGame,
  };
}
