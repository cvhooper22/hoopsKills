// Filtering games by the opponent's rating. Pure; no I/O.
//
// A games-index entry (dataAggregators/ingest/tools/export-games-index.js) carries
//   opponentRatings: { [system]: { atGame: {...}, latest: {...} } }
// where atGame is the opponent as of tip-off and latest is the end-of-season (or newest) ranking. Rank is a fact about the
// game, so a filter picks a set of games and everything built from games (kills, clutch, lineups, plays, players)
// follows: pass the resulting gameIds to filterRows({ gameIds }).
//
// A filter is { system, basis, part, field, op, value, max? }:
//   system  'torvik' | 'net' | 'haslam' | 'kenpom' | 'evanmiya' | ...
//   basis   'atGame' (default) | 'latest'
//   part    'overall' (default) | 'off' | 'def'
//   field   'rank' (default; 1 is best) | 'rating' (the system's own units; check its direction) | 'pctile' (1 is best) | 'vsAvg' (above the D-I average, higher is better)
//   op      'lte' | 'gte' | 'lt' | 'gt' | 'eq' | 'between' (value..max, inclusive)
// Examples: { system: 'torvik', part: 'overall', field: 'rank', op: 'lte', value: 40 }   a top-40 team at tip-off
//           { system: 'torvik', basis: 'latest', part: 'def', field: 'rank', op: 'lte', value: 40 }   a top-40 defense by the final ratings
//           { system: 'torvik', part: 'def', field: 'rating', op: 'lte', value: 95.5 }   defensive efficiency 95.5 or lower
// A game with no data for a filter's system and basis does not match (coverage() says how many are in that position).

// overall + rating means Barthag for Torvik and the system's headline rating elsewhere; 'overall' + 'vsAvg' is the margin.
const FIELD_KEY = {
  overall: { rank: 'overallRank', rating: 'overallRating', pctile: 'overallPctile', vsAvg: 'marginVsAvg' },
  off: { rank: 'offRank', rating: 'offRating', pctile: 'offPctile', vsAvg: 'offVsAvg' },
  def: { rank: 'defRank', rating: 'defRating', pctile: 'defPctile', vsAvg: 'defVsAvg' },
};

export function opponentValue(game, { system, basis = 'atGame', part = 'overall', field = 'rank' }) {
  const key = FIELD_KEY[part] && FIELD_KEY[part][field];
  if (!key) throw new Error(`unknown opponent filter part/field: ${part}/${field}`);
  const entry = game.opponentRatings && game.opponentRatings[system] && game.opponentRatings[system][basis];
  const v = entry ? entry[key] : null;
  return v === null || v === undefined ? null : v;
}

const TESTS = {
  lte: (v, f) => v <= f.value,
  gte: (v, f) => v >= f.value,
  lt: (v, f) => v < f.value,
  gt: (v, f) => v > f.value,
  eq: (v, f) => v === f.value,
  between: (v, f) => v >= f.value && v <= f.max,
};

export function matchesFilter(game, filter) {
  const test = TESTS[filter.op];
  if (!test) throw new Error(`unknown opponent filter op: ${filter.op}`);
  const v = opponentValue(game, filter);
  return v !== null && test(v, filter);
}

/** Games (index entries) that match every filter. Exhibitions are not removed here; callers drop them as they do elsewhere. */
export function filterGamesByOpponent(games, filters = []) {
  return filters.length ? games.filter((g) => filters.every((f) => matchesFilter(g, f))) : games;
}

/** gameIds for filterRows({ gameIds }). null means "no opponent filter", i.e. every game. */
export function opponentGameIds(games, filters = []) {
  return filters.length ? new Set(filterGamesByOpponent(games, filters).map((g) => g.gameId)) : null;
}

/** How many of the games have a value for this system and basis; the UI should show it ("12 of 35 games have KenPom data"). */
export function coverage(games, { system, basis = 'atGame', part = 'overall', field = 'rank' }) {
  const have = games.filter((g) => opponentValue(g, { system, basis, part, field }) !== null).length;
  return { have, total: games.length };
}
