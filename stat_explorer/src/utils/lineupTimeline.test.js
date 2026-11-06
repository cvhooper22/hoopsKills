import { lineupStints, playerFloorTime, netRating, scoreAt } from './lineupTimeline';

const chance = (over) => ({
  offense: 'byu', poss: 0, k: 0, per: 1, startRem: 2400, dur: 10, pts: 0, fga: 1, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0,
  lu: { byu: ['A', 'B'], opp: ['X', 'Y'] }, ...over,
});
const lu2 = { byu: ['A', 'C'], opp: ['X', 'Y'] };

// 2400 = tip; each chance 60s apart
const PLAYS = [
  chance({ poss: 0, startRem: 2400, pts: 2 }),
  chance({ poss: 1, offense: 'opp', startRem: 2340, pts: 3 }),
  chance({ poss: 2, startRem: 2280, lu: lu2, pts: 0, dur: 20 }),
  chance({ poss: 3, startRem: 2220, lu: lu2, pts: 2 }),
];

test('stints are runs of the same five, ending where the next begins', () => {
  const s = lineupStints(PLAYS, 'byu');
  expect(s).toHaveLength(2);
  expect(s[0]).toMatchObject({ names: ['A', 'B'], startMin: 0, endMin: 2, scored: 2, allowed: 3 });
  expect(s[1]).toMatchObject({ names: ['A', 'C'], startMin: 2, scored: 2, allowed: 0 });
  expect(s[1].endMin).toBeCloseTo(3 + 10 / 60); // the last stint runs to the end of the last chance
});

test('the other team gets its own stints from the same chances', () => {
  const s = lineupStints(PLAYS, 'opp');
  expect(s).toHaveLength(1);
  expect(s[0]).toMatchObject({ names: ['X', 'Y'], scored: 3, allowed: 4 });
});

test('floor time merges adjacent stints per player', () => {
  const f = playerFloorTime(lineupStints(PLAYS, 'byu'));
  const a = f.find((x) => x.name === 'A');
  expect(a.spans).toHaveLength(1);
  expect(a.spans[0][0]).toBe(0);
  expect(f.find((x) => x.name === 'B').spans).toEqual([[0, 2]]);
  expect(f[0].name).toBe('A'); // most minutes first
});

test('plays without lineups give no stints', () => {
  expect(lineupStints([{ offense: 'byu', per: 1, startRem: 2400, pts: 2 }], 'byu')).toEqual([]);
});

import { lineupMatches, lineupSplit, minutesOn, specIsEmpty } from './lineupTimeline';
import { summarize } from './playGroups';

test('on/off matching', () => {
  expect(lineupMatches(['A', 'B', 'C'], { on: ['A'], off: [] })).toBe(true);
  expect(lineupMatches(['A', 'B', 'C'], { on: ['A', 'D'], off: [] })).toBe(false);
  expect(lineupMatches(['A', 'B', 'C'], { on: [], off: ['B'] })).toBe(false);
  expect(lineupMatches(['A', 'B', 'C'], { on: ['A'], off: ['D'] })).toBe(true);
  expect(lineupMatches(['A'], { on: [], off: [] })).toBe(true);
  expect(specIsEmpty({ on: [], off: [] })).toBe(true);
});

test('at least N of a group', () => {
  const five = ['A', 'B', 'C', 'D', 'E'];
  expect(lineupMatches(five, { on: [], off: [], anyOf: ['A', 'B', 'X'], atLeast: 2 })).toBe(true);
  expect(lineupMatches(five, { on: [], off: [], anyOf: ['A', 'X', 'Y'], atLeast: 2 })).toBe(false);
  expect(lineupMatches(five, { on: [], off: [], anyOf: ['A', 'X'], atLeast: 1 })).toBe(true);
  expect(lineupMatches(five, { on: [], off: [], anyOf: ['X', 'Y'], atLeast: 1 })).toBe(false);
  expect(lineupMatches(five, { on: ['A'], off: ['E'], anyOf: ['B', 'C'], atLeast: 2 })).toBe(false); // E is required off
  expect(lineupMatches(five, { on: ['A'], off: ['Z'], anyOf: ['B', 'C'], atLeast: 2 })).toBe(true);
  expect(lineupMatches(five, { on: [], off: [], anyOf: [], atLeast: 3 })).toBe(true);                  // no group, no condition
  expect(specIsEmpty({ on: [], off: [], anyOf: ['A'], atLeast: 1 })).toBe(false);
});

test('a split has the team\'s offense and defense, and the inverse is the rest of the time', () => {
  const spec = { on: ['B'], off: [] };
  const on = lineupSplit(PLAYS, 'byu', spec);
  expect(on.off).toHaveLength(1);          // the one byu chance with B on the floor
  expect(on.def).toHaveLength(1);          // the opp chance while B was on the floor
  const rest = lineupSplit(PLAYS, 'byu', spec, true);
  expect(rest.off).toHaveLength(2);
  expect(rest.def).toHaveLength(0);
  expect(on.off.length + rest.off.length).toBe(PLAYS.filter((p) => p.offense === 'byu').length);
});

test('minutes on the floor, and turnovers in a summary', () => {
  const stints = lineupStints(PLAYS, 'byu');
  expect(minutesOn(stints, { on: ['B'], off: [] })).toBeCloseTo(stints[0].mins);
  expect(minutesOn(stints, { on: ['B'], off: [] }, true)).toBeCloseTo(stints[1].mins);
  expect(summarize([chance({ end: 'turnover' }), chance({ poss: 1, end: 'made_fg' })])).toMatchObject({ tov: 1, tovRate: 0.5 });
});

test('each floor span carries what the team scored and allowed over it', () => {
  const f = playerFloorTime(lineupStints(PLAYS, 'byu'));
  expect(f.find((x) => x.name === 'A').totals).toEqual([{ scored: 4, allowed: 3, offPoss: 3, defPoss: 1 }]); // both stints merged
  expect(f.find((x) => x.name === 'B').totals).toEqual([{ scored: 2, allowed: 3, offPoss: 1, defPoss: 1 }]);
});

test('net rating is points per possession scored minus allowed', () => {
  expect(netRating({ scored: 4, allowed: 3, offPoss: 2, defPoss: 2 })).toBe(0.5);
  expect(netRating({ scored: 2, allowed: 0, offPoss: 1, defPoss: 0 })).toBeNull();
});

test('score at a game minute is the last event at or before it', () => {
  const ev = [{ per: 1, rem: 2340, sc: [2, 0] }, { per: 1, rem: 2280, sc: [2, 3] }];
  expect(scoreAt(ev, 0)).toEqual([0, 0]);
  expect(scoreAt(ev, 1)).toEqual([2, 0]);
  expect(scoreAt(ev, 5)).toEqual([2, 3]);
});
