import { elapsedSec, periodStartMin, periodLenMin } from './playGroups';

// Box-score counting stats for any slice of a game, summed from the event log (`data.events`). A slice is a predicate over an
// event and its index in the log; `eventLines` splits what it keeps into the focus team's line and the other team's.

export const emptyLine = () => ({ pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 });

export function addEvent(l, e) {
  if (e.cat === 'shot_attempt') {
    l.fga++;
    if (e.val === 3) l.tpa++;
    if (e.made) { l.fgm++; l.pts += e.val || 0; if (e.val === 3) l.tpm++; }
  } else if (e.cat === 'free_throw') {
    l.fta++;
    if (e.made) { l.ftm++; l.pts++; }
  } else if (e.cat === 'rebound') {
    if (e.type === 'offensive') l.oreb++;
    else if (e.type === 'defensive') l.dreb++;
  } else if (e.cat === 'assist') l.ast++;
  else if (e.cat === 'steal') l.stl++;
  else if (e.cat === 'block') l.blk++;
  else if (e.cat === 'turnover') l.tov++;
  else if (e.cat === 'foul') l.pf++;
}

const ratio = (a, b) => (b ? a / b : null);

// Adds the totals and rates that follow from the counts.
export function finishLine(l) {
  const twoM = l.fgm - l.tpm, twoA = l.fga - l.tpa;
  return {
    ...l, twoM, twoA, reb: l.oreb + l.dreb,
    fgPct: ratio(l.fgm, l.fga), twoPct: ratio(twoM, twoA), tpPct: ratio(l.tpm, l.tpa), ftPct: ratio(l.ftm, l.fta),
  };
}

// `players` is the same split by player: { team: Map(name -> line), opp: Map(name -> line) }.
export function eventLines(events, side, take) {
  const team = emptyLine(), opp = emptyLine();
  const players = { team: new Map(), opp: new Map() };
  (events || []).forEach((e, i) => {
    if (!e.side || !take(e, i)) return;
    const who = e.side === side ? 'team' : 'opp';
    addEvent(who === 'team' ? team : opp, e);
    if (!e.player) return;
    if (!players[who].has(e.player)) players[who].set(e.player, emptyLine());
    addEvent(players[who].get(e.player), e);
  });
  for (const m of Object.values(players)) for (const [k, l] of m) m.set(k, finishLine(l));
  return { team: finishLine(team), opp: finishLine(opp), players };
}

const minuteOf = (e) => elapsedSec({ per: e.per, startRem: e.rem }) / 60;

// Whether an event falls in a stint-compare group's periods and game-minute window (its play-type filter does not apply to events).
export function inWindow(e, g) {
  if (g.periods.length && !g.periods.includes(e.per)) return false;
  const min = minuteOf(e);
  if (g.fromMin !== null && min < g.fromMin) return false;
  if (g.toMin !== null && min >= g.toMin) return false;
  return true;
}

// ---- minutes and possessions for each player over a slice

const clip = (spans, lo, hi) => spans.map(([a, b]) => [Math.max(a, lo), Math.min(b, hi)]).filter(([a, b]) => b > a);

// The game-minute spans a stint-compare group covers: its periods (all when none picked) cut to its window.
export function windowSpans(g, periodList) {
  const spans = (g.periods.length ? g.periods : periodList).map((per) => [periodStartMin(per), periodStartMin(per) + periodLenMin(per)]);
  return clip(spans, g.fromMin ?? 0, g.toMin ?? Infinity);
}

// What is left of [0, end] once `spans` (sorted, not overlapping) are taken out.
export function complementSpans(spans, end) {
  const out = [];
  let at = 0;
  for (const [a, b] of [...spans].sort((x, y) => x[0] - y[0])) { if (a > at) out.push([at, a]); at = Math.max(at, b); }
  if (at < end) out.push([at, end]);
  return out;
}

// Per player, over `spans` of game time: minutes on the floor (from each team's stints) and the distinct possessions, either
// team's, that ran while they were out there (from `plays`, the slice's chances). Both come back as { team: Map, opp: Map } for
// the focus `side` and the other one.
export function playerContext({ plays, luOf = (p, s) => p.lu[s], side, stints, spans }) {
  const other = side === 'byu' ? 'opp' : 'byu';
  const out = { mins: { team: new Map(), opp: new Map() }, poss: { team: new Map(), opp: new Map() } };
  [['team', side], ['opp', other]].forEach(([who, s]) => {
    for (const st of stints[s]) {
      const m = clip(spans, st.startMin, st.endMin).reduce((t, [a, b]) => t + (b - a), 0);
      if (m > 0) for (const n of st.names) out.mins[who].set(n, (out.mins[who].get(n) || 0) + m);
    }
    const seen = new Map();
    for (const p of plays) {
      if (!p.lu || !p.lu[s].length) continue;
      for (const n of luOf(p, s)) { if (!seen.has(n)) seen.set(n, new Set()); seen.get(n).add(p.poss); }
    }
    seen.forEach((set, n) => out.poss[who].set(n, set.size));
  });
  return out;
}
