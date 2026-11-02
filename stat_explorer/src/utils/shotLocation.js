// Turns each feed's shot coordinates into one normalized location, so the shot chart never needs to know where a play
// came from. Normalized = feet from the rim centre, for a single basket: x is lateral (-25..25), y is distance toward
// half court (the baseline is at -5.25, half court at 41.75). The chart's court is drawn in the same frame.
//
// Adapters are keyed by the coordinate scheme a play carries, not by feed, so a new feed that reuses a scheme needs no code:
//   grid50        court_x / court_y: a 50 x 47 ft half-court grid, one basket (ESPN). Rim sits at (25, ~0.5) in it; fitted from
//                 the shots' own "NN-foot" descriptions (35 shots, mean error 0.3 ft), not documented by ESPN.
//   fullCourtPct  raw_x / raw_y / goal_side: both baskets on a 0-100 by 0-100 full court (WMT). Shots at the RIGHT goal are
//                 rotated 180 degrees onto the left one, which keeps the real geometry.
export const COURT = { halfWidth: 25, baselineY: -5.25, halfCourtY: 41.75, length: 94, width: 50, rimFromBaseline: 5.25 };

const GRID50_RIM = { x: 25, y: 0.5 };

const ADAPTERS = {
  grid50: {
    applies: (p) => p.court_x != null && p.court_y != null,
    toFeet: (p) => ({ x: p.court_x - GRID50_RIM.x, y: p.court_y - GRID50_RIM.y }),
  },
  fullCourtPct: {
    applies: (p) => p.raw_x != null && p.raw_y != null && !!p.goal_side,
    toFeet: (p) => {
      const right = p.goal_side === 'RIGHT';
      const x = right ? 100 - p.raw_x : p.raw_x;
      const y = right ? 100 - p.raw_y : p.raw_y;
      return { x: (y - 50) * (COURT.width / 100), y: x * (COURT.length / 100) - COURT.rimFromBaseline };
    },
  },
};

export const SCHEMES = Object.keys(ADAPTERS);

// One play -> { x, y, made, value, ... } in feet, or null when it isn't a field goal with a trustworthy location.
export function normalizeShot(play) {
  if (play.play_category !== 'shot_attempt' || play.has_valid_location === false) return null;
  const scheme = SCHEMES.find((s) => ADAPTERS[s].applies(play));
  if (!scheme) return null;
  const { x, y } = ADAPTERS[scheme].toFeet(play);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x, y, scheme,
    made: !!play.is_made,
    value: play.shot_value === 3 ? 3 : 2,
    teamId: play.team_id,
    playerId: play.player_id,
    player: play.player_name || null,
    period: play.period_number,
    clock: play.clock_display,
    description: play.play_description,
    sequence: play.sequence_number,
  };
}

export const normalizeShots = (plays) => (plays || []).map(normalizeShot).filter(Boolean);

export const distanceFeet = (shot) => Math.hypot(shot.x, shot.y);

// Zones (metrics only for now). A three is whatever the feed scored as a three, which is more reliable than the arc
// geometry; every other attempt is in the paint (inside the lane rectangle: 16 ft wide, out to the free-throw line)
// or mid range.
export const LANE = { halfWidth: 8, ftLineY: 15 - COURT.rimFromBaseline };
export const ZONES = [
  { id: 'paint', label: 'In the paint' },
  { id: 'mid', label: 'Mid range' },
  { id: 'three', label: 'Threes' },
];

export function zoneOf(shot) {
  if (shot.value === 3) return 'three';
  return Math.abs(shot.x) <= LANE.halfWidth && shot.y <= LANE.ftLineY ? 'paint' : 'mid';
}

const line = (shots) => {
  const made = shots.filter((s) => s.made).length;
  return { made, att: shots.length, pct: shots.length ? made / shots.length : null };
};

// FG, 2PT, 3PT and the three zones for a set of normalized shots; `share` is the zone's part of all attempts.
export function summarizeShots(shots) {
  const zones = {};
  ZONES.forEach(({ id }) => {
    const inZone = shots.filter((s) => zoneOf(s) === id);
    zones[id] = { ...line(inZone), share: shots.length ? inZone.length / shots.length : null };
  });
  return {
    fg: line(shots),
    twos: line(shots.filter((s) => s.value !== 3)),
    threes: line(shots.filter((s) => s.value === 3)),
    zones,
  };
}
