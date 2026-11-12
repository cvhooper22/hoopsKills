import { secondsToSafe, requiredLead, isFinalState, pointsShort, analyzeGame, playText } from './analyticallyFinal';

// The first-half clock in the event log counts down from 2400 to 1200, the second half from 1200 to 0, overtime from 300.
const ev = (o) => ({ per: 2, rem: 600, side: 'byu', player: 'Jaxon Kohler', cat: 'shot_attempt', type: 'layup', sub: null, made: true, val: 2, sc: null, ...o });
const bucket = (rem, sc, o) => ev({ rem, sc, ...o });
const miss = (rem, side) => ev({ rem, side, made: false, val: 2, sc: null });
const tov = (rem, side) => ev({ rem, side, cat: 'turnover', type: 'badpass', made: null, val: null, sc: null });

test('matches Haslam\'s cheat sheet', () => {
  expect(secondsToSafe(6)).toBe(1);
  expect(secondsToSafe(10)).toBe(25);
  expect(secondsToSafe(21)).toBe(256); // 2H, 4:16
  expect(secondsToSafe(40)).toBe(1225); // 1H, 0:25 => 20:25 left
  expect(secondsToSafe(42)).toBe(1369); // 1H, 2:49
  [1, 2, 3, 4, 5].forEach((l) => expect(secondsToSafe(l)).toBe(0));
  expect(requiredLead(25)).toBe(10);
});

test('final state: a lead of 5 or less only at the buzzer, ties never', () => {
  expect(isFinalState(10, 25)).toBe(true);
  expect(isFinalState(10, 26)).toBe(false);
  expect(isFinalState(5, 1)).toBe(false);
  expect(isFinalState(5, 0)).toBe(true);
  expect(isFinalState(0, 0)).toBe(false);
  expect(pointsShort(10, 25)).toBe(0);
  expect(pointsShort(8, 25)).toBe(2);
});

test('a score that makes the lead safe is credited with it', () => {
  // 8-0 up, 30 seconds left: needs 10.5. A bucket with 24 left makes it 10-0 and 24 <= 25.
  const r = analyzeGame([bucket(40, [8, 0]), bucket(24, [10, 0])]);
  expect(r.crossings).toHaveLength(1);
  expect(r.crossings[0]).toMatchObject({ cause: 'score', kind: 'fg2m', leader: 'byu', secs: 24 });
  expect(r.finalAt.seq).toBe(1);
  expect(r.finalNow).toBe(true);
});

test('the trailing team\'s miss or turnover can be the play that makes it final', () => {
  // 10-0 with 40 left: not final (needs 25). The next event, a missed shot by the trailing team at 20 seconds, is.
  const r = analyzeGame([bucket(40, [10, 0]), miss(20, 'opp')]);
  expect(r.crossings[0]).toMatchObject({ cause: 'stop', kind: 'fg2x', side: 'opp' });
  expect(playText(r.crossings[0], { byu: 'BYU', opp: 'Utah' })).toBe('Utah missed 2');
  const t = analyzeGame([bucket(40, [10, 0]), tov(20, 'opp')]);
  expect(t.crossings[0].cause).toBe('stop');
});

test('a steal or block by the leader counts as the stop', () => {
  const r = analyzeGame([bucket(40, [10, 0]), ev({ rem: 20, side: 'byu', cat: 'steal', type: null, made: null, val: null })]);
  expect(r.crossings[0]).toMatchObject({ cause: 'stop', kind: 'stl', side: 'byu' });
});

test('a lead of 3 goes final at the buzzer, and only when the game is over', () => {
  const log = [bucket(60, [3, 0])];
  expect(analyzeGame(log).finalNow).toBe(false);
  const over = analyzeGame(log, { final: true });
  expect(over.finalAt).toMatchObject({ kind: 'buzzer', cause: 'buzzer', secs: 0 });
});

test('losing a final lead is a reversal', () => {
  const r = analyzeGame([bucket(30, [10, 0]), miss(20, 'opp'), bucket(15, [10, 3], { side: 'opp', val: 3 })]);
  expect(r.crossings).toHaveLength(1);
  expect(r.reversals).toHaveLength(1);
  expect(r.finalNow).toBe(false);
  expect(r.finalAt).toBeNull();
});

test('time close and times close: one episode, ending final', () => {
  // 8-0 with 20 seconds left. Needs 9.47, so 1.47 short: close from the start of that stretch until 20s -> (8-5+3)^2 = 36 s mark.
  const r = analyzeGame([bucket(100, [8, 0]), miss(9, 'opp')]);
  // Lead 8 is safe at 9 s and within 3 points of it from 36 s: close for 27 seconds of the 100 -> 9 stretch.
  expect(r.secondsClose).toBeCloseTo(27);
  expect(r.episodes).toHaveLength(1);
  expect(r.episodes[0]).toMatchObject({ outcome: 'final', leader: 'byu', secs: 36 });
  expect(r.timesClose).toBe(1);
  expect(r.nearMisses).toBe(0);
});

test('an episode that the other team ends by cutting the lead is a near miss; a fresh approach is a new one', () => {
  const r = analyzeGame([
    bucket(100, [8, 0]), // close from 36 s on
    bucket(30, [8, 6], { side: 'opp' }), // lead 2: 8.5 short, past 3 + 1, so the episode fades
    bucket(20, [12, 6]), // lead 6: safe at 1 s, within 3 points from 16 s
    miss(10, 'opp'), // 10 s: lead 6 is close again
  ]);
  expect(r.nearMisses).toBe(1);
  expect(r.episodes[0].outcome).toBe('faded');
  expect(r.timesClose).toBe(2);
});

test('dips count every time a lead in range is pushed back out, with no buffer', () => {
  // 8-0 is close (within 3) from 36 s. The trailing team makes it 8-3 (lead 5, 31 s left: 8.6 short, out of range) = dip 1.
  // The leader makes it 10-3 (lead 7 at 30 s: 5 + sqrt(30) - 7 = 3.48, still out), then 12-3 (lead 9 at 20 s: 0.47 short, in range),
  // then the trailing team makes it 12-7 (lead 5 at 15 s: 3.87 short, out) = dip 2.
  const r = analyzeGame([bucket(100, [8, 0]), bucket(31, [8, 3], { side: 'opp' }), bucket(30, [10, 3]), bucket(20, [12, 3]), bucket(15, [12, 7], { side: 'opp' })]);
  expect(r.dips).toBe(2);
});

test('far from final the game is not close', () => {
  const r = analyzeGame([bucket(2000, [10, 0]), bucket(1000, [10, 8], { side: 'opp' })]);
  expect(r.secondsClose).toBe(0);
  expect(r.timesClose).toBe(0);
});

test('the clock keeps its own rules in overtime', () => {
  // End of regulation tied, then a 7-point lead in OT with 0:30 left: safe at 4 s -> not final; short = 5 + sqrt(30) - 7 = 3.48.
  const r = analyzeGame([bucket(5, [60, 60], { per: 2 }), bucket(100, [67, 60], { per: 3 }), ev({ per: 3, rem: 3, side: 'opp', made: false, val: 2 })], { final: false });
  expect(r.crossings).toHaveLength(1);
  expect(r.crossings[0]).toMatchObject({ per: 3, secs: 3, cause: 'stop' });
});

test('an empty log returns an empty analysis', () => {
  const r = analyzeGame([]);
  expect(r.timesClose).toBe(0);
  expect(r.finalAt).toBeNull();
});
