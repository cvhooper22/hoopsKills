// Filtering and summing the box payload's per-chance rows (`data.plays`, written by
// dataAggregators/derivations/game-box-prototype.js) for the Stint Compare tab. A chance is one opportunity to score inside a
// possession, so a possession can hold several (every offensive rebound starts a new one).

export const BUCKETS = [
  ['transition', 'Transition'], ['quick_off_make', 'Quick off a make'], ['ato_own', 'After own timeout'],
  ['standard', 'Half-court (first shot)'], ['quick_putback', 'Quick putbacks'], ['reset', 'Reset second chances'],
];
export const START_LABELS = {
  after_made_FG: 'Made FG', after_made_FT: 'Made FT', after_def_rebound: 'Defensive rebound', after_live_ball_TO: 'Live-ball turnover',
  after_dead_ball_TO: 'Dead-ball turnover', after_other_dead_ball: 'Other dead ball',
};
export const END_LABELS = {
  made_fg: 'Made FG', missed_fg: 'Missed FG', ft: 'Free throws (made last)', ft_miss: 'Free throws (missed last)', turnover: 'Turnover',
  period_end: 'End of period', held_ball: 'Held ball', in_progress: 'In progress', end: 'End of game',
};

export const bucketOf = (p) => (p.label === 'initial_halfcourt' ? p.sub : p.label);

// Regulation is 2 x 20 minutes, overtimes 5. The payload's startRem counts down the whole regulation game in periods 1-2,
// and per overtime in later ones.
export const elapsedSec = (p) => (p.per <= 2 ? 2400 - p.startRem : 2400 + (p.per - 3) * 300 + (300 - p.startRem));
// Game minutes of the media (commercial) timeouts in the event log, in order. Two events in the same second count once.
export function mediaTimeouts(events = []) {
  const mins = events.filter((e) => e.cat === 'timeout' && e.type === 'commercial').map((e) => elapsedSec({ per: e.per, startRem: e.rem }) / 60).sort((a, b) => a - b);
  return mins.filter((m, i) => !i || m - mins[i - 1] > 1 / 60);
}

// The teams' own timeouts (full or short) as { t: game minute, side: 'byu' | 'opp' }, in order.
export function teamTimeouts(events = []) {
  return events.filter((e) => e.cat === 'timeout' && e.type !== 'commercial' && e.side)
    .map((e) => ({ t: elapsedSec({ per: e.per, startRem: e.rem }) / 60, side: e.side })).sort((a, b) => a.t - b.t);
}

// `t` moved onto the nearest of `points` when one is within `range`, else left alone.
export function snapNear(t, points, range) {
  let best = t, gap = range;
  for (const p of points) if (Math.abs(p - t) <= gap) { best = p; gap = Math.abs(p - t); }
  return best;
}

export const clockSec = (p) => (p.per === 1 ? p.startRem - 1200 : p.startRem);

// A chance has the stat lines when the payload is new enough (older stored games predate them).
export const hasShotLines = (plays) => !plays.length || plays[0].fga !== undefined;

// group: { side: 'byu' | 'opp', name (custom label, '' for the default), periods: number[] (empty = all), fromMin, toMin (game minutes, null = open), buckets: string[] (empty = all) }
export const emptyGroup = (side = 'byu') => ({ side, name: '', periods: [], fromMin: null, toMin: null, buckets: [] });

export function matches(p, g) {
  if (p.offense !== g.side) return false;
  if (g.periods.length && !g.periods.includes(p.per)) return false;
  const min = elapsedSec(p) / 60;
  if (g.fromMin !== null && min < g.fromMin) return false;
  if (g.toMin !== null && min >= g.toMin) return false;
  if (g.buckets.length && !g.buckets.includes(bucketOf(p))) return false;
  return true;
}

const ratio = (a, b) => (b ? a / b : null);

// Totals for a set of chances. Possessions are counted by distinct possession, so a filter that keeps only a possession's
// second chance still counts that possession once.
export function summarize(plays) {
  const t = { chances: plays.length, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, tov: 0 };
  const poss = new Set();
  for (const p of plays) {
    poss.add(p.poss);
    if (p.end === 'turnover') t.tov++;
    for (const k of ['pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta']) t[k] += p[k] || 0;
  }
  const twoM = t.fgm - t.tpm, twoA = t.fga - t.tpa;
  return {
    ...t, poss: poss.size, twoM, twoA,
    ppp: ratio(t.pts, poss.size), ppc: ratio(t.pts, t.chances), tovRate: ratio(t.tov, poss.size),
    fgPct: ratio(t.fgm, t.fga), twoPct: ratio(twoM, twoA), tpPct: ratio(t.tpm, t.tpa), ftPct: ratio(t.ftm, t.fta),
    efg: ratio(t.fgm + 0.5 * t.tpm, t.fga), ts: ratio(t.pts, 2 * (t.fga + 0.44 * t.fta)),
  };
}

// Tag each chance with how it began: `oreb` (the previous chance in the same possession ended on a miss) or `dreb`
// (the team took the ball off the other team's miss). Done on the full game list, since filtering breaks the adjacency.
export function tagRebounds(plays) {
  return plays.map((p, i) => {
    const prev = plays[i - 1];
    const oreb = !!prev && prev.poss === p.poss && (prev.end === 'missed_fg' || prev.end === 'ft_miss');
    return { ...p, oreb, dreb: !oreb && p.start === 'after_def_rebound' };
  });
}

// Rebound lines for the team on `off` chances, against the other team's chances `def` over the same stretch.
export function reboundLines(off, def) {
  const oreb = off.filter((p) => p.oreb).length, dreb = off.filter((p) => p.dreb).length;
  const oppOreb = def.filter((p) => p.oreb).length, oppDreb = def.filter((p) => p.dreb).length;
  const share = (a, b) => ratio(a, a + b);
  return { oreb, dreb, reb: oreb + dreb, oppOreb, oppDreb, orebPct: share(oreb, oppDreb), drebPct: share(dreb, oppOreb), rebPct: share(oreb + dreb, oppOreb + oppDreb) };
}

export const select = (plays, g) => plays.filter((p) => matches(p, g));

// Everything on the same side that the group leaves out: the "rest of the game" comparison.
export const selectRest = (plays, g) => plays.filter((p) => p.offense === g.side && !matches(p, g));

// The other team's chances over the same stretch (same periods and game-minute window; the play-type filter describes the
// group's own plays, so it doesn't apply), for the "what the opponent did meanwhile" line.
const otherSide = (s) => (s === 'byu' ? 'opp' : 'byu');
export const selectOpposing = (plays, g) => select(plays, { ...g, side: otherSide(g.side), buckets: [] });
export const selectOpposingRest = (plays, g) => selectRest(plays, { ...g, side: otherSide(g.side), buckets: [] });

// Break a set of chances into rows by one field.
export const BREAKDOWNS = {
  type: { label: 'Play type', key: bucketOf, order: BUCKETS.map((b) => b[0]), name: (k) => BUCKETS.find((b) => b[0] === k)?.[1] ?? k },
  period: { label: 'Period', key: (p) => p.per, order: null, name: (k) => (k === 1 ? '1st half' : k === 2 ? '2nd half' : `OT${k - 2}`) },
  start: { label: 'How it started', key: (p) => p.start, order: null, name: (k) => START_LABELS[k] ?? k },
  end: { label: 'How it ended', key: (p) => p.end, order: null, name: (k) => END_LABELS[k] ?? k },
};

export function breakdown(plays, by) {
  const spec = BREAKDOWNS[by];
  const groups = new Map();
  for (const p of plays) {
    const k = spec.key(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const keys = [...groups.keys()].sort((a, b) => (spec.order ? spec.order.indexOf(a) - spec.order.indexOf(b) : a < b ? -1 : a > b ? 1 : 0));
  return keys.map((k) => ({ key: k, label: spec.name(k), ...summarize(groups.get(k)) }));
}

// Score margin (focus team minus opponent) over the game, from the chances' points, for the game-flow graph. One point per
// chance, at the moment it ends. Technical free throws are not part of any chance, so this can sit a point or two off the
// real score.
export function marginTimeline(plays) {
  const end = (p) => (elapsedSec(p) + (p.dur || 0)) / 60;
  const sorted = [...plays].sort((a, b) => end(a) - end(b));
  let m = 0;
  const pts = [{ t: 0, margin: 0 }];
  for (const p of sorted) {
    if (p.pts) { m += p.offense === 'byu' ? p.pts : -p.pts; pts.push({ t: end(p), margin: m }); }
  }
  return pts;
}

// Length of the game in minutes: 40, plus 5 per overtime seen.
export const gameMinutes = (plays) => {
  const last = plays.reduce((m, p) => Math.max(m, p.per), 2);
  return 40 + (last - 2) * 5;
};

// ---- half / time-left <-> game minute. Group windows are stored as game minutes (see `matches`); the UI speaks in periods
// and the clock left in them.
export const periodStartMin = (per) => (per <= 1 ? 0 : per === 2 ? 20 : 40 + (per - 3) * 5);
export const periodLenMin = (per) => (per <= 2 ? 20 : 5);
export const toMinute = (per, clockSec) => periodStartMin(per) + periodLenMin(per) - clockSec / 60;

// The period and clock left at a game minute. At a period boundary a window's end belongs to the period that is ending
// (1st half, 0:00) and its start to the one beginning (2nd half, 20:00).
export function fromMinute(min, isEnd = false) {
  let per = 1;
  while (per < 30 && (isEnd ? min > periodStartMin(per) + periodLenMin(per) : min >= periodStartMin(per) + periodLenMin(per))) per++;
  return { per, clockSec: Math.max(0, Math.round((periodStartMin(per) + periodLenMin(per) - min) * 60)) };
}

// Rounds to the nearest second; sub ins can carry fractional clock values.
export const formatClock = (sec) => {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// "12:30", "12" (minutes) or "12.5" -> seconds, or null when it isn't a time.
export function parseClock(text) {
  const t = String(text).trim();
  let m = /^(\d+):(\d{1,2})$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^\d+(\.\d+)?$/.exec(t);
  return m ? Math.round(Number(t) * 60) : null;
}

// ---- lineups. Each chance carries both teams' five at its start (`lu`), so a lineup's line is every chance it started on
// offense (offPlays) and every one it started on defense (defPlays, the other team's chances over the same stretch).
export const hasLineups = (plays) => !plays.length || plays[0].lu !== undefined;

const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
export function shortName(name) {
  if (name.includes(',')) return name.split(',')[0].trim();
  const parts = name.trim().split(/\s+/);
  while (parts.length > 1 && SUFFIXES.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  return parts[parts.length - 1];
}

export function lineupRows(offPlays, defPlays, side, luOf = (p, s) => p.lu[s]) {
  const by = new Map();
  const entry = (lu) => {
    const key = lu.join('|');
    if (!by.has(key)) by.set(key, { key, names: lu, off: [], def: [] });
    return by.get(key);
  };
  for (const p of offPlays) if (p.lu && p.lu[side].length) entry(luOf(p, side)).off.push(p);
  for (const p of defPlays) if (p.lu && p.lu[side].length) entry(luOf(p, side)).def.push(p);
  return [...by.values()]
    .map((e) => ({ key: e.key, names: e.names, off: summarize(e.off), def: summarize(e.def) }))
    .sort((a, b) => b.off.poss + b.def.poss - (a.off.poss + a.def.poss) || (a.key < b.key ? -1 : 1));
}

// Tick marks for a game-time axis: the time left in the period every 5 minutes, and one label span per half / overtime.
export function axisLayout(total) {
  const ticks = [], periods = [];
  for (let per = 1; periodStartMin(per) < total; per++) {
    const start = periodStartMin(per), len = periodLenMin(per);
    periods.push({ per, start, len });
    for (let k = 0; k < len / 5; k++) ticks.push({ t: start + k * 5, label: `${len - k * 5}:00` });
  }
  ticks.push({ t: total, label: '0:00' });
  return { ticks, periods };
}

// The running score from the event log (each event carries the score after it): one point wherever the score changed. Exact,
// unlike marginTimeline, which only knows the points inside chances.
export function scoreTimeline(events) {
  const out = [{ t: 0, byu: 0, opp: 0, margin: 0 }];
  for (const e of events) {
    if (!e.sc || e.sc[0] == null || e.sc[1] == null) continue;
    const last = out[out.length - 1];
    if (e.sc[0] === last.byu && e.sc[1] === last.opp) continue;
    out.push({ t: elapsedSec({ per: e.per, startRem: e.rem }) / 60, byu: e.sc[0], opp: e.sc[1], margin: e.sc[0] - e.sc[1] });
  }
  return out;
}

// The timeline point in force at game minute t (the last one at or before it).
export function pointAt(timeline, t) {
  let lo = 0, hi = timeline.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (timeline[mid].t <= t) lo = mid; else hi = mid - 1; }
  return timeline[lo];
}
