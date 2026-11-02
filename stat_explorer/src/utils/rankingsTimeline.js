// BYU's rating history for the rankings timeline page. Pure; no I/O.
//
// Inputs: the timeline file written by dataAggregators/ingest/tools/export-rankings-timeline.js
//   { season, systems: { [system]: { name, kind, parts, points: [{ date, record, overallRank, offRank, defRank, ..., metrics }] } }, games: [...] }
// and the hand-tracked 2025-26 values in constants/rankingsManual.js. Every point means "games through `date`, inclusive".
//
// A series is { system, name, source: 'collected' | 'manual', daily, points }, with points sorted by date and carrying
//   { date, t (UTC ms), record, overallRank, offRank, defRank, offRating, defRating, wab, wabRank }.

export const PARTS = [
  { key: 'overall', label: 'Overall', rankKey: 'overallRank' },
  { key: 'off', label: 'Offense', rankKey: 'offRank' },
  { key: 'def', label: 'Defense', rankKey: 'defRank' },
];
export const partRankKey = (part) => PARTS.find((p) => p.key === part).rankKey;

const DAY = 86400000;
export const toTime = (iso) => Date.parse(`${iso}T00:00:00Z`);
export const toIso = (t) => new Date(t).toISOString().slice(0, 10);

// A system with a point every day or two can be read between points; a sparse one (the hand-tracked sheet, a single NET
// snapshot) cannot, so it is not used for game impact and only carried forward a few days for the average.
const DAILY_MEDIAN_GAP_DAYS = 1.5;
const CARRY_DAYS = 10;
const MIN_POINTS_FOR_BAND = 2;

function medianGapDays(points) {
  if (points.length < 3) return Infinity;
  const gaps = points.slice(1).map((p, i) => (p.t - points[i].t) / DAY).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function normalize(p) {
  const m = p.metrics || {};
  return {
    date: p.date, t: toTime(p.date), record: p.record ?? null,
    overallRank: p.overallRank ?? null, offRank: p.offRank ?? null, defRank: p.defRank ?? null,
    offRating: p.offRating ?? null, defRating: p.defRating ?? null,
    wab: m.wab ?? p.wab ?? null, wabRank: m.wab_rank ?? p.wabRank ?? null,
  };
}

function makeSeries(system, name, source, rawPoints) {
  const points = rawPoints.map(normalize).sort((a, b) => a.t - b.t);
  return { system, name, source, daily: medianGapDays(points) <= DAILY_MEDIAN_GAP_DAYS, points };
}

/** All series for a season: what was collected, plus the hand-tracked ones for the season they cover (not duplicating a collected system). */
export function buildSeries({ timeline, manual }) {
  const series = Object.entries(timeline.systems || {}).map(([system, s]) => makeSeries(system, s.name, 'collected', s.points));
  if (manual && manual.season === timeline.season) {
    for (const [system, s] of Object.entries(manual.systems)) {
      if (!(timeline.systems || {})[system]) series.push(makeSeries(system, s.name, 'manual', s.points));
    }
  }
  return series;
}

/** The latest point at or before `date`, at most `maxAgeDays` old (null if none). */
export function pointAt(series, date, maxAgeDays = Infinity) {
  const t = toTime(date);
  let lo = 0;
  let hi = series.points.length - 1;
  let found = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series.points[mid].t <= t) { found = series.points[mid]; lo = mid + 1; } else hi = mid - 1;
  }
  return found && (t - found.t) / DAY <= maxAgeDays ? found : null;
}

/** Every date any series has a point on, ascending: the snap targets for hovering. */
export function allDates(series) {
  return [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
}

/**
 * Average and spread of the systems at each date, for one part ('overall' | 'off' | 'def'). Sparse systems are carried
 * forward up to CARRY_DAYS so they count between their points, but not past their last one; a single-snapshot system
 * (NET) is left out. A date with fewer than `minSystems` systems has no average.
 */
export function envelope(series, part, dates, { minSystems = 2 } = {}) {
  const key = partRankKey(part);
  const usable = series.filter((s) => s.points.length >= MIN_POINTS_FOR_BAND);
  return dates.map((date) => {
    const vals = usable.map((s) => {
      const p = pointAt(s, date, s.daily ? 3 : CARRY_DAYS);
      return p && p[key] != null ? { system: s.system, value: p[key] } : null;
    }).filter(Boolean);
    if (vals.length < minSystems) return { date, t: toTime(date), n: vals.length, avg: null, min: null, max: null };
    const nums = vals.map((v) => v.value);
    return { date, t: toTime(date), n: vals.length, avg: nums.reduce((a, b) => a + b, 0) / nums.length, min: Math.min(...nums), max: Math.max(...nums), values: vals };
  });
}

/**
 * What one game did to BYU's standing in a daily series: the last point before the game day against the point on it
 * (which already includes the game). `change` is positive when BYU moved up (rank number fell). Null when the series
 * can't say (not daily, or no point on both sides).
 */
export function gameImpact(series, game) {
  if (!series.daily) return null;
  const dayBefore = toIso(toTime(game.date) - DAY);
  const before = pointAt(series, dayBefore, 3);
  const after = series.points.find((p) => p.date === game.date) || null;
  if (!before || !after) return null;
  const rank = (key) => (before[key] != null && after[key] != null ? { before: before[key], after: after[key], change: before[key] - after[key] } : null);
  return {
    overall: rank('overallRank'), off: rank('offRank'), def: rank('defRank'),
    wab: before.wab != null && after.wab != null ? { before: before.wab, after: after.wab, change: after.wab - before.wab } : null,
  };
}

/** The domain a rank chart needs: from rank 1 to just past the worst rank drawn, rounded so the axis reads cleanly. */
export function rankDomain(series, part) {
  const key = partRankKey(part);
  const worst = Math.max(10, ...series.flatMap((s) => s.points.map((p) => p[key]).filter((v) => v != null)));
  const step = worst > 60 ? 20 : worst > 30 ? 10 : 5;
  return [Math.ceil((worst + 1) / step) * step, 1];
}
