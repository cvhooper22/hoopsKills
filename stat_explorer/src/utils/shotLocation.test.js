import { normalizeShot, normalizeShots, distanceFeet, zoneOf, summarizeShots, COURT } from './shotLocation';

const shot = (over) => ({ play_category: 'shot_attempt', is_made: true, shot_value: 2, has_valid_location: true, ...over });

describe('shotLocation', () => {
  test('grid50 (ESPN) is re-centred on the rim', () => {
    const s = normalizeShot(shot({ court_x: 41, court_y: 1, play_description: 'misses 16-foot pullup' }));
    expect(s.scheme).toBe('grid50');
    expect(s.x).toBe(16);
    expect(s.y).toBeCloseTo(0.5);
    // the description says 16 feet: the fit holds
    expect(distanceFeet(s)).toBeCloseTo(16, 0);
  });

  test('a deep three from ESPN lands outside the college three-point arc', () => {
    const s = normalizeShot(shot({ court_x: 12, court_y: 23, shot_value: 3 }));
    expect(distanceFeet(s)).toBeGreaterThan(22.14);
  });

  test('fullCourtPct (WMT) maps the left goal straight through', () => {
    const s = normalizeShot(shot({ raw_x: 17, raw_y: 28, goal_side: 'LEFT' }));
    expect(s.scheme).toBe('fullCourtPct');
    expect(s.y).toBeCloseTo(17 * 0.94 - COURT.rimFromBaseline);
    expect(s.x).toBeCloseTo(-11);
  });

  test('a shot at the right goal is rotated onto the left one', () => {
    const left = normalizeShot(shot({ raw_x: 6, raw_y: 40, goal_side: 'LEFT' }));
    const right = normalizeShot(shot({ raw_x: 94, raw_y: 60, goal_side: 'RIGHT' }));
    expect(right.x).toBeCloseTo(left.x);
    expect(right.y).toBeCloseTo(left.y);
  });

  test('zones: threes by value, then lane box, then mid range', () => {
    expect(zoneOf({ x: 0, y: 1, value: 2 })).toBe('paint');
    expect(zoneOf({ x: -8, y: 9.7, value: 2 })).toBe('paint');
    expect(zoneOf({ x: 8.5, y: 3, value: 2 })).toBe('mid');
    expect(zoneOf({ x: 0, y: 12, value: 2 })).toBe('mid');
    expect(zoneOf({ x: 1, y: 23, value: 3 })).toBe('three');
    expect(zoneOf({ x: 0, y: 2, value: 3 })).toBe('three');
  });

  test('summarizeShots breaks out 2PT, 3PT and zones', () => {
    const s = (x, y, value, made) => ({ x, y, value, made });
    const t = summarizeShots([s(0, 1, 2, true), s(1, 2, 2, false), s(15, 8, 2, true), s(0, 23, 3, false)]);
    expect(t.fg).toEqual({ made: 2, att: 4, pct: 0.5 });
    expect(t.twos).toEqual({ made: 2, att: 3, pct: 2 / 3 });
    expect(t.threes).toEqual({ made: 0, att: 1, pct: 0 });
    expect(t.zones.paint).toMatchObject({ made: 1, att: 2, share: 0.5 });
    expect(t.zones.mid).toMatchObject({ made: 1, att: 1 });
    expect(t.zones.three.att).toBe(1);
    expect(summarizeShots([]).fg.pct).toBeNull();
  });

  test('plays without a usable location are dropped', () => {
    expect(normalizeShot(shot({ court_x: 25, court_y: 0, has_valid_location: false }))).toBeNull();
    expect(normalizeShot(shot({}))).toBeNull();
    expect(normalizeShot({ play_category: 'free_throw', court_x: 3, court_y: 3, has_valid_location: true })).toBeNull();
    expect(normalizeShots([shot({ court_x: 25, court_y: 5 }), { play_category: 'rebound' }])).toHaveLength(1);
  });
});
