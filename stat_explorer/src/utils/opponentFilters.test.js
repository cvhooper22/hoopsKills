import { opponentValue, matchesFilter, filterGamesByOpponent, opponentGameIds, coverage } from './opponentFilters';

const rating = (overallRank, defRank, defRating) => ({
  overallRank, overallRating: 0.9, overallPctile: 1 - (overallRank - 1) / 364, marginVsAvg: 10,
  offRank: 20, offRating: 115, offPctile: 0.95, offVsAvg: 6, defRank, defRating, defPctile: 1 - (defRank - 1) / 364, defVsAvg: 100 - defRating,
});
const game = (gameId, opponentRatings) => ({ gameId, opponentRatings });

const games = [
  game('g1', { torvik: { atGame: rating(52, 53, 97.7), latest: rating(34, 37, 96.0) } }),
  game('g2', { torvik: { atGame: rating(325, 360, 114), latest: rating(335, 332, 113) }, net: { latest: { overallRank: 331 } } }),
  game('g3', { torvik: { atGame: rating(8, 20, 94.1), latest: rating(9, 11, 93.0) } }),
  game('g4', {}),                      // nothing collected for this game
  game('g5', { torvik: { latest: rating(120, 100, 101) } }),   // no tip-off snapshot
];
const ids = (gs) => gs.map((g) => g.gameId);

describe('opponentFilters', () => {
  it('filters on the opponent as of tip-off by default', () => {
    expect(ids(filterGamesByOpponent(games, [{ system: 'torvik', op: 'lte', value: 60 }]))).toEqual(['g1', 'g3']);
  });

  it('can use the latest ranking instead, which is how a team that climbed shows up', () => {
    const top40Final = { system: 'torvik', basis: 'latest', op: 'lte', value: 40 };
    const top40Then = { system: 'torvik', basis: 'atGame', op: 'lte', value: 40 };
    expect(ids(filterGamesByOpponent(games, [top40Final]))).toEqual(['g1', 'g3']);
    expect(ids(filterGamesByOpponent(games, [top40Then]))).toEqual(['g3']);   // g1 was 52nd when we played them
  });

  it('filters on offense/defense rank and on native values', () => {
    expect(ids(filterGamesByOpponent(games, [{ system: 'torvik', part: 'def', field: 'rank', op: 'lte', value: 40 }]))).toEqual(['g3']);
    expect(ids(filterGamesByOpponent(games, [{ system: 'torvik', part: 'def', field: 'rating', op: 'lte', value: 95.5 }]))).toEqual(['g3']);
    expect(ids(filterGamesByOpponent(games, [{ system: 'torvik', part: 'def', field: 'rating', op: 'between', value: 97, max: 102 }]))).toEqual(['g1']);
  });

  it('stacks filters (AND), across systems and bases', () => {
    const f = [{ system: 'torvik', basis: 'latest', op: 'gte', value: 300 }, { system: 'net', basis: 'latest', op: 'gte', value: 300 }];
    expect(ids(filterGamesByOpponent(games, f))).toEqual(['g2']);
  });

  it('never matches a game with no data, and says how many have it', () => {
    expect(ids(filterGamesByOpponent(games, [{ system: 'kenpom', op: 'lte', value: 400 }]))).toEqual([]);
    expect(coverage(games, { system: 'torvik' })).toEqual({ have: 3, total: 5 });
    expect(coverage(games, { system: 'torvik', basis: 'latest' })).toEqual({ have: 4, total: 5 });
    expect(coverage(games, { system: 'net', basis: 'latest' })).toEqual({ have: 1, total: 5 });
  });

  it('no filters means every game; opponentGameIds returns null so filterRows ignores it', () => {
    expect(filterGamesByOpponent(games, [])).toBe(games);
    expect(opponentGameIds(games, [])).toBeNull();
    expect(opponentGameIds(games, [{ system: 'torvik', op: 'lte', value: 60 }])).toEqual(new Set(['g1', 'g3']));
  });

  it('rejects a filter it cannot read instead of silently matching nothing', () => {
    expect(() => opponentValue(games[0], { system: 'torvik', part: 'nope' })).toThrow(/unknown opponent filter/);
    expect(() => matchesFilter(games[0], { system: 'torvik', op: 'near', value: 1 })).toThrow(/unknown opponent filter op/);
  });
});
