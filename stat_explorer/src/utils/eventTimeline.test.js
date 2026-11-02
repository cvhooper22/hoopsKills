import { timelineEvents, gapStats, formatGap, assignLanes, toCheckname, lineSideOf, KIND_BY_KEY } from './eventTimeline';

const ev = (o) => ({ per: 1, rem: 2400, side: 'byu', player: 'Jaxon Kohler', cat: 'shot_attempt', type: 'layup', sub: null, made: true, val: 2, sc: [2, 0], ...o });

test('classifies events into stat kinds and drops the rest', () => {
  const out = timelineEvents([
    ev({}), ev({ made: false, val: 3, rem: 2390 }), ev({ cat: 'free_throw', type: 'free_throw', sub: '1of2', val: null, rem: 2380 }),
    ev({ cat: 'rebound', type: 'deadball', made: null, rem: 2370 }), ev({ cat: 'substitution', rem: 2360 }), ev({ cat: 'foul', type: 'personal', made: null, rem: 2350 }),
  ]);
  expect(out.map((e) => e.kind)).toEqual(['fg2m', 'fg3x', 'ftm', 'foul']);
  expect(out[2].detail).toBe('1 of 2');
});

test('time is game minutes and the score is carried forward', () => {
  const out = timelineEvents([ev({ rem: 2340, sc: [2, 0] }), ev({ cat: 'steal', type: null, made: null, val: null, rem: 2100, sc: null }), ev({ per: 2, rem: 1200, cat: 'turnover', made: null, sc: [2, 3] })]);
  expect(out[0].t).toBeCloseTo(1);
  expect(out[1]).toMatchObject({ byu: 2, opp: 0 });
  expect(out[2].t).toBeCloseTo(20);
  expect(out[2].clock).toBe(1200);
});

test('defensive stats go on the other side\'s line', () => {
  expect(lineSideOf({ kind: 'stl', side: 'byu' })).toBe('opp');
  expect(lineSideOf({ kind: 'fg3m', side: 'byu' })).toBe('byu');
  expect(KIND_BY_KEY.blk.defensive).toBe(true);
});

test('gap stats', () => {
  expect(gapStats([2, 5, 6], 10)).toEqual({ n: 3, since: 4, avg: 2, longest: 3, shortest: 1 });
  expect(gapStats([4], 10)).toEqual({ n: 1, since: 6, avg: null, longest: null, shortest: null });
  expect(gapStats([], 10).since).toBeNull();
  expect(formatGap(2.5)).toBe('2:30');
  expect(formatGap(null)).toBe('—');
});

test('lanes spread close markers in the same group only', () => {
  expect(assignLanes([{ x: 10, group: 'a' }, { x: 12, group: 'a' }, { x: 13, group: 'a' }, { x: 12, group: 'b' }], 8)).toEqual([0, -1, 1, 0]);
  expect(assignLanes([{ x: 10, group: 'a' }, { x: 30, group: 'a' }], 8)).toEqual([0, 0]);
});

test('checkname matches the shared player filter format', () => {
  expect(toCheckname('Robert Wright III')).toBe('WRIGHT III,ROBERT');
  expect(toCheckname('AJ Dybantsa')).toBe('DYBANTSA,AJ');
});
