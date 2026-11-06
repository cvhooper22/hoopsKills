// Splits each team's first shots of a possession by estimated shot clock remaining.
// First shots only: later chances in a possession follow an offensive rebound, which resets the clock to 20 (not 30)
// in college, so they would never reach the top bucket and would inflate the middle ones.
// The clock itself is not in the data: it is the chance's duration, minus a few seconds to get the ball in after a
// made basket (same estimate the Havoc and squeeze section uses).

export const CLOCK_BUCKETS = [
  { key: 'quick', label: '22+', note: 'quick' },
  { key: 'mid', label: '15–22', note: '' },
  { key: 'mid2', label: '10–15', note: '' },
  { key: 'late', label: '5–10', note: '' },
  { key: 'squeezed', label: '≤5', note: 'squeezed' },
];
const EDGES = [22, 15, 10]; // lower edge (seconds left) of the first three buckets
const SQUEEZE_SEC = 5; // squeezed is 5 seconds left or less, the same line the Havoc and squeeze section uses

const SHOT_ENDS = new Set(['made_fg', 'missed_fg']);

export const isFirstShot = (p) => p.k === 0 && SHOT_ENDS.has(p.end) && p.fga > 0;

export function clockRemaining(p, { SHOT_CLOCK_LEN = 30, LAG_AFTER_MAKE_SEC = 3 } = {}) {
  const lag = p.start === 'after_made_FG' ? LAG_AFTER_MAKE_SEC : 0;
  const left = SHOT_CLOCK_LEN - (p.dur - lag);
  return Math.min(SHOT_CLOCK_LEN, Math.max(0, left));
}

export function bucketIndex(secLeft) {
  const i = EDGES.findIndex((e) => secLeft >= e);
  if (i !== -1) return i;
  return secLeft > SQUEEZE_SEC ? EDGES.length : EDGES.length + 1;
}

const blank = () => ({ n: 0, pts: 0, fgm: 0, fga: 0, tpm: 0 });

// -> { byu: [...5 buckets], opp: [...], n: { byu, opp } } with share (of that team's first shots), pps (points per first
// shot, free throws on that chance included) and efg for every bucket. Rates are null on an empty bucket.
export function shotClockBuckets(plays, params) {
  const out = { byu: CLOCK_BUCKETS.map(blank), opp: CLOCK_BUCKETS.map(blank), n: { byu: 0, opp: 0 } };
  (plays || []).filter(isFirstShot).forEach((p) => {
    if (!out[p.offense]) return;
    const b = out[p.offense][bucketIndex(clockRemaining(p, params))];
    b.n += 1; b.pts += p.pts; b.fgm += p.fgm; b.fga += p.fga; b.tpm += p.tpm;
    out.n[p.offense] += 1;
  });
  ['byu', 'opp'].forEach((s) => out[s].forEach((b) => {
    b.share = out.n[s] ? b.n / out.n[s] : null;
    b.pps = b.n ? b.pts / b.n : null;
    b.efg = b.fga ? (b.fgm + 0.5 * b.tpm) / b.fga : null;
  }));
  return out;
}
