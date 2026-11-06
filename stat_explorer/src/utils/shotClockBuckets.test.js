import { bucketIndex, clockRemaining, shotClockBuckets, isFirstShot } from './shotClockBuckets';

const shot = (over) => ({ offense: 'byu', k: 0, dur: 10, start: 'after_other_dead_ball', end: 'missed_fg', pts: 0, fga: 1, fgm: 0, tpm: 0, ...over });

test('buckets split at 22, 15 and 10 seconds left, and squeezed is 5 or less', () => {
  expect([30, 22].map(bucketIndex)).toEqual([0, 0]);
  expect([21.9, 15].map(bucketIndex)).toEqual([1, 1]);
  expect([14, 10].map(bucketIndex)).toEqual([2, 2]);
  expect([9, 5.1].map(bucketIndex)).toEqual([3, 3]);
  expect([5, 4.9, 0].map(bucketIndex)).toEqual([4, 4, 4]);
});

test('clock left is the clock length minus the chance duration, with a lag after a made basket', () => {
  expect(clockRemaining(shot({ dur: 10 }))).toBe(20);
  expect(clockRemaining(shot({ dur: 10, start: 'after_made_FG' }))).toBe(23);
  expect(clockRemaining(shot({ dur: 40 }))).toBe(0);
  expect(clockRemaining(shot({ dur: 1, start: 'after_made_FG' }))).toBe(30);
});

test('only first shots that ended in a field goal count', () => {
  expect(isFirstShot(shot({}))).toBe(true);
  expect(isFirstShot(shot({ k: 1 }))).toBe(false);
  expect(isFirstShot(shot({ end: 'turnover', fga: 0 }))).toBe(false);
  expect(isFirstShot(shot({ end: 'ft', fga: 0 }))).toBe(false);
});

test('shares, points per shot and eFG per bucket', () => {
  const r = shotClockBuckets([
    shot({ dur: 5, end: 'made_fg', pts: 3, fgm: 1, tpm: 1 }),
    shot({ dur: 6, end: 'missed_fg' }),
    shot({ dur: 28 }),
    shot({ k: 1, dur: 5 }),
    shot({ offense: 'opp', dur: 12, end: 'made_fg', pts: 2, fgm: 1 }),
  ]);
  expect(r.n).toEqual({ byu: 3, opp: 1 });
  expect(r.byu[0]).toMatchObject({ n: 2, pts: 3 });
  expect(r.byu[0].pps).toBeCloseTo(1.5);
  expect(r.byu[0].efg).toBeCloseTo(0.75);
  expect(r.byu[4].n).toBe(1);
  expect(r.byu[0].share).toBeCloseTo(2 / 3);
  expect(r.opp[1].n).toBe(1);
  expect(r.byu[2].pps).toBeNull();
});
