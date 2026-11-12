import { kindOf, eventText, searchEvents, shotTotals, emptySearch, logPlayers, tagSituations } from './playSearch';

const shot = (over) => ({ per: 1, rem: 2300, side: 'byu', player: 'Bruce Branch III', cat: 'shot_attempt', type: 'jumpshot', sub: null, made: true, val: 3, sc: [3, 0], ...over });
const EVENTS = [
  shot({}),
  shot({ made: false, val: 2, rem: 2200 }),
  shot({ player: 'Collin Chandler', val: 2, ast: 'Bruce Branch III', rem: 2100 }),
  { per: 1, rem: 2100, side: 'byu', player: 'Bruce Branch III', cat: 'assist', of: { player: 'Collin Chandler', val: 2, made: true, type: 'layup', sub: null }, sc: [5, 0] },
  { per: 2, rem: 900, side: 'opp', player: 'Pryce Sandfort', cat: 'rebound', type: 'defensive', sc: [30, 28] },
  { per: 2, rem: 800, side: 'opp', player: 'Pryce Sandfort', cat: 'free_throw', sub: '1of2', made: false, sc: [30, 28] },
];

test('kinds', () => {
  expect(kindOf(EVENTS[0])).toBe('fg');
  expect(kindOf(EVENTS[3])).toBe('ast');
});

test('all of one player\'s assists', () => {
  const r = searchEvents(EVENTS, { ...emptySearch(), player: 'Bruce Branch III', kinds: ['ast'] });
  expect(r).toEqual([EVENTS[3]]);
  expect(eventText(r[0])).toBe('Assist to Collin Chandler on a 2-pt layup');
});

test('field goals: makes, misses, both, and by value', () => {
  const f = { ...emptySearch(), kinds: ['fg'] };
  expect(searchEvents(EVENTS, f)).toHaveLength(3);
  expect(searchEvents(EVENTS, { ...f, result: 'made' })).toHaveLength(2);
  expect(searchEvents(EVENTS, { ...f, result: 'missed' })).toEqual([EVENTS[1]]);
  expect(searchEvents(EVENTS, { ...f, points: 3 })).toEqual([EVENTS[0]]);
  expect(searchEvents(EVENTS, { ...f, side: 'opp' })).toEqual([]);
});

test('sub-filters only apply to their own kind', () => {
  // "made" on field goals must not drop an assist that is also selected
  const r = searchEvents(EVENTS, { ...emptySearch(), kinds: ['fg', 'ast'], result: 'made' });
  expect(r).toHaveLength(3);
  expect(searchEvents(EVENTS, { ...emptySearch(), kinds: ['reb'], reb: 'offensive' })).toEqual([]);
  expect(searchEvents(EVENTS, { ...emptySearch(), kinds: ['reb'], reb: 'defensive' })).toHaveLength(1);
});

test('limits to a group\'s stretch', () => {
  const g = { side: 'byu', periods: [2], fromMin: null, toMin: null, buckets: [] };
  const r = searchEvents(EVENTS, { ...emptySearch(), inGroup: true }, g);
  expect(r.map((e) => e.per)).toEqual([2, 2]);
});

test('text and totals', () => {
  expect(eventText(EVENTS[0])).toBe('Made 3-pt jump shot');
  expect(eventText(EVENTS[2])).toBe('Made 2-pt jump shot (assist: Bruce Branch III)');
  expect(eventText(EVENTS[5])).toBe('Missed free throw (1 of 2)');
  expect(shotTotals(EVENTS)).toEqual({ fgm: 2, fga: 3, ftm: 0, fta: 1 });
  expect(logPlayers(EVENTS)).toEqual({ byu: ['Bruce Branch III', 'Collin Chandler'], opp: ['Pryce Sandfort'] });
});

test('shot names do not repeat words', () => {
  expect(eventText(shot({ type: 'layup', sub: 'driving' }))).toBe('Made 3-pt driving layup');
  expect(eventText(shot({ type: 'dunk', sub: 'alleyoop' }))).toBe('Made 3-pt alley-oop dunk');
  expect(eventText(shot({ type: 'jumpshot', sub: 'stepback' }))).toBe('Made 3-pt step-back jump shot');
});

test('on/off floor filter', () => {
  const floorAt = (i) => (i < 3 ? { byu: ['Bruce Branch III'], opp: [] } : { byu: ['Collin Chandler'], opp: ['Pryce Sandfort'] });
  expect(searchEvents(EVENTS, { ...emptySearch(), on: ['Bruce Branch III'] }, null, floorAt)).toEqual(EVENTS.slice(0, 3));
  expect(searchEvents(EVENTS, { ...emptySearch(), on: ['Collin Chandler', 'Pryce Sandfort'] }, null, floorAt)).toEqual(EVENTS.slice(3));
  expect(searchEvents(EVENTS, { ...emptySearch(), off: ['Bruce Branch III'] }, null, floorAt)).toEqual(EVENTS.slice(3));
});

test('situations: chance types, squeezed and havoc', () => {
  const plays = [
    { offense: 'byu', per: 1, startRem: 2300, dur: 20, label: 'transition' },
    { offense: 'byu', per: 1, startRem: 2200, dur: 30, label: 'initial_halfcourt', sub: 'standard' },
  ];
  const havoc = { opp: { squeeze: { plays: [{ per: 1, startRem: 2200, endRem: 2170 }] } }, byu: { squeeze: { plays: [] } } };
  const evs = [
    shot({ rem: 2290 }),
    shot({ rem: 2190 }),
    { per: 1, rem: 2185, side: 'opp', player: 'X', cat: 'steal', sc: [0, 0] },
    { per: 1, rem: 2100, side: 'opp', player: 'Y', cat: 'rebound', type: 'defensive', sc: [0, 0] },
  ];
  const t = tagSituations(evs, plays, havoc);
  expect(searchEvents(t, { ...emptySearch(), situations: ['transition'] })).toEqual([t[0]]);
  expect(searchEvents(t, { ...emptySearch(), situations: ['standard'] })).toEqual([t[1], t[2]]);
  expect(searchEvents(t, { ...emptySearch(), situations: ['squeezed'] })).toEqual([t[1], t[2]]);
  expect(searchEvents(t, { ...emptySearch(), situations: ['havoc'] })).toEqual([t[2]]);
  expect(searchEvents(t, { ...emptySearch(), situations: ['transition', 'havoc'] })).toEqual([t[0], t[2]]);
});
