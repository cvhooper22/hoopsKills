import { bucketOf, elapsedSec, clockSec, emptyGroup, matches, summarize, select, selectRest, breakdown, hasShotLines, mediaTimeouts, teamTimeouts, snapNear } from './playGroups';

const chance = (over) => ({
  offense: 'byu', poss: 0, k: 0, per: 1, startRem: 2400, dur: 10, label: 'initial_halfcourt', sub: 'standard', pts: 0,
  start: 'after_made_FG', end: 'missed_fg', fga: 1, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, ...over,
});

const PLAYS = [
  chance({ poss: 0, pts: 3, fgm: 1, tpa: 1, tpm: 1, end: 'made_fg' }),
  chance({ poss: 0, k: 1, label: 'quick_putback', sub: null, pts: 0, fga: 1, end: 'missed_fg' }),
  chance({ poss: 1, per: 2, startRem: 600, label: 'transition', sub: null, pts: 2, fgm: 1, end: 'made_fg' }),
  chance({ poss: 2, offense: 'opp', pts: 1, fga: 0, fta: 2, ftm: 1, end: 'ft' }),
];

test('time helpers', () => {
  expect(elapsedSec({ per: 1, startRem: 2400 })).toBe(0);
  expect(elapsedSec({ per: 2, startRem: 600 })).toBe(1800);
  expect(elapsedSec({ per: 3, startRem: 300 })).toBe(2400);
  expect(elapsedSec({ per: 4, startRem: 240 })).toBe(2400 + 300 + 60);
  expect(clockSec({ per: 1, startRem: 1500 })).toBe(300);
  expect(clockSec({ per: 2, startRem: 600 })).toBe(600);
});

test('bucketOf uses the sub for half-court plays', () => {
  expect(bucketOf(PLAYS[0])).toBe('standard');
  expect(bucketOf(PLAYS[1])).toBe('quick_putback');
});

test('filters by side, period, window and type', () => {
  const g = emptyGroup('byu');
  expect(select(PLAYS, g)).toHaveLength(3);
  expect(select(PLAYS, { ...g, periods: [2] })).toHaveLength(1);
  expect(select(PLAYS, { ...g, fromMin: 10 })).toHaveLength(1); // only the 2nd-half play starts at 10:00 or later
  expect(select(PLAYS, { ...g, toMin: 20 })).toHaveLength(2);
  expect(select(PLAYS, { ...g, buckets: ['transition'] })).toHaveLength(1);
  expect(matches(PLAYS[3], g)).toBe(false);
});

test('rest of the game is the same side minus the group', () => {
  const g = { ...emptyGroup('byu'), periods: [1] };
  expect(selectRest(PLAYS, g)).toEqual([PLAYS[2]]);
});

test('summarize counts possessions once and splits 2s from 3s', () => {
  const s = summarize(select(PLAYS, emptyGroup('byu')));
  expect(s.chances).toBe(3);
  expect(s.poss).toBe(2);
  expect(s.pts).toBe(5);
  expect(s.ppp).toBeCloseTo(2.5);
  expect(s).toMatchObject({ fgm: 2, fga: 3, tpm: 1, tpa: 1, twoM: 1, twoA: 2 });
  expect(s.efg).toBeCloseTo((2 + 0.5) / 3);
  expect(s.twoPct).toBeCloseTo(0.5);
});

test('summarize of nothing has null rates, not NaN', () => {
  const s = summarize([]);
  expect(s.ppp).toBeNull();
  expect(s.fgPct).toBeNull();
});

test('free throws and true shooting', () => {
  const s = summarize([PLAYS[3]]);
  expect(s).toMatchObject({ ftm: 1, fta: 2, ftPct: 0.5 });
  expect(s.ts).toBeCloseTo(1 / (2 * 0.88));
});

test('breakdown by type is in the standard order', () => {
  const rows = breakdown(select(PLAYS, emptyGroup('byu')), 'type');
  expect(rows.map((r) => r.label)).toEqual(['Transition', 'Half-court (first shot)', 'Quick putbacks']);
  expect(rows.map((r) => r.pts)).toEqual([2, 3, 0]);
  expect(breakdown(PLAYS, 'period').map((r) => r.label)).toEqual(['1st half', '2nd half']);
});

test('hasShotLines flags older payloads', () => {
  expect(hasShotLines(PLAYS)).toBe(true);
  expect(hasShotLines([{ offense: 'byu', pts: 2 }])).toBe(false);
});

import { marginTimeline, gameMinutes } from './playGroups';

test('margin timeline steps at the end of each scoring chance', () => {
  const tl = marginTimeline([
    chance({ pts: 3, startRem: 2400, dur: 10 }),
    chance({ offense: 'opp', pts: 2, startRem: 2380, dur: 5 }),
    chance({ pts: 0, startRem: 2370, dur: 5 }),
  ]);
  expect(tl.map((x) => x.margin)).toEqual([0, 3, 1]);
  expect(tl[1].t).toBeCloseTo(10 / 60);
  expect(tl[2].t).toBeCloseTo((20 + 5) / 60);
});

test('game length includes overtimes', () => {
  expect(gameMinutes([chance({ per: 2 })])).toBe(40);
  expect(gameMinutes([chance({ per: 4 })])).toBe(50);
});

import { toMinute, fromMinute, parseClock, formatClock } from './playGroups';

test('period + clock left convert to game minutes and back', () => {
  expect(toMinute(1, 1200)).toBe(0);
  expect(toMinute(1, 0)).toBe(20);
  expect(toMinute(2, 600)).toBe(30);
  expect(toMinute(3, 300)).toBe(40);
  expect(toMinute(3, 0)).toBe(45);
  expect(fromMinute(5)).toEqual({ per: 1, clockSec: 900 });
  expect(fromMinute(30.5)).toEqual({ per: 2, clockSec: 570 });
  expect(fromMinute(42)).toEqual({ per: 3, clockSec: 180 });
});

test('a window end on a boundary stays in the ending period', () => {
  expect(fromMinute(20, true)).toEqual({ per: 1, clockSec: 0 });
  expect(fromMinute(20, false)).toEqual({ per: 2, clockSec: 1200 });
  expect(fromMinute(40, true)).toEqual({ per: 2, clockSec: 0 });
});

test('clock text parsing', () => {
  expect(parseClock('12:30')).toBe(750);
  expect(parseClock('12')).toBe(720);
  expect(parseClock('7.5')).toBe(450);
  expect(parseClock('abc')).toBeNull();
  expect(formatClock(750)).toBe('12:30');
  expect(formatClock(65)).toBe('1:05');
  expect(formatClock(58.200000000000045)).toBe('0:58');
  expect(formatClock(44.799999999999955)).toBe('0:45');
  expect(formatClock(59.6)).toBe('1:00');
});

import { selectOpposing, selectOpposingRest } from './playGroups';

test('opposing plays share the window but not the play-type filter', () => {
  const g = { ...emptyGroup('byu'), periods: [1], buckets: ['transition'] };
  expect(selectOpposing(PLAYS, g)).toEqual([PLAYS[3]]);
  expect(selectOpposingRest(PLAYS, { ...emptyGroup('byu'), periods: [2] })).toEqual([PLAYS[3]]);
  expect(summarize(selectOpposing(PLAYS, emptyGroup('byu'))).ppp).toBe(1);
});

import { lineupRows, shortName, hasLineups } from './playGroups';

test('short names drop suffixes and handle "Last, First"', () => {
  expect(shortName('Robert Wright III')).toBe('Wright');
  expect(shortName('Jaxon Kohler')).toBe('Kohler');
  expect(shortName('Kohler, Jaxon')).toBe('Kohler');
});

test('lineup rows combine offense and defense per five', () => {
  const lu1 = { byu: ['A', 'B'], opp: ['X', 'Y'] }, lu2 = { byu: ['A', 'C'], opp: ['X', 'Y'] };
  const off = [chance({ poss: 0, pts: 2, lu: lu1 }), chance({ poss: 1, pts: 0, lu: lu1 }), chance({ poss: 2, pts: 3, lu: lu2 })];
  const def = [chance({ poss: 3, offense: 'opp', pts: 2, lu: lu1 })];
  const rows = lineupRows(off, def, 'byu');
  expect(rows).toHaveLength(2);
  expect(rows[0].names).toEqual(['A', 'B']);
  expect(rows[0].off).toMatchObject({ poss: 2, pts: 2 });
  expect(rows[0].def).toMatchObject({ poss: 1, pts: 2 });
  expect(rows[1].def.poss).toBe(0);
  expect(hasLineups(off)).toBe(true);
  expect(hasLineups([chance({})])).toBe(false);
});

import { scoreTimeline, pointAt } from './playGroups';

test('score timeline steps where the score changes and can be read at any minute', () => {
  const ev = [
    { per: 1, rem: 2380, sc: [0, 0] },
    { per: 1, rem: 2340, sc: [3, 0] },
    { per: 1, rem: 2330, sc: [3, 0] },
    { per: 1, rem: 2280, sc: [3, 2] },
    { per: 2, rem: 1200, sc: [10, 12] },
  ];
  const tl = scoreTimeline(ev);
  expect(tl.map((p) => [p.byu, p.opp, p.margin])).toEqual([[0, 0, 0], [3, 0, 3], [3, 2, 1], [10, 12, -2]]);
  expect(pointAt(tl, 0.5).byu).toBe(0);
  expect(pointAt(tl, 1)).toMatchObject({ byu: 3, opp: 0 });
  expect(pointAt(tl, 30)).toMatchObject({ byu: 10, opp: 12 });
  expect(pointAt(tl, 1000).margin).toBe(-2);
});

test('media timeouts are the commercial ones, in game minutes, one per moment', () => {
  const ev = [
    { cat: 'timeout', type: 'short', per: 1, rem: 2200 },
    { cat: 'timeout', type: 'commercial', per: 2, rem: 600 },
    { cat: 'timeout', type: 'commercial', per: 1, rem: 1800 },
    { cat: 'timeout', type: 'commercial', per: 1, rem: 1800 },
    { cat: 'shot_attempt', per: 1, rem: 1700 },
  ];
  expect(mediaTimeouts(ev)).toEqual([10, 30]);
  expect(mediaTimeouts()).toEqual([]);
});

test('a time snaps to the nearest point within range, otherwise stays', () => {
  expect(snapNear(9.4, [10, 30], 1)).toBe(10);
  expect(snapNear(11.5, [10, 30], 1)).toBe(11.5);
  expect(snapNear(9.9, [9.5, 10], 1)).toBe(10);
});

test('team timeouts are the non-media ones with a team, in game minutes', () => {
  const ev = [
    { cat: 'timeout', type: 'commercial', side: null, per: 1, rem: 1800 },
    { cat: 'timeout', type: 'short', side: 'opp', per: 2, rem: 600 },
    { cat: 'timeout', type: 'full', side: 'byu', per: 1, rem: 2100 },
  ];
  expect(teamTimeouts(ev)).toEqual([{ t: 5, side: 'byu' }, { t: 30, side: 'opp' }]);
  expect(teamTimeouts()).toEqual([]);
});
