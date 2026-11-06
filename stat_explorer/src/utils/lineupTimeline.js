import { elapsedSec, summarize } from './playGroups';

// A team's lineups in game order, from the box payload's per-chance rows (each carries both teams' five at its start, so a
// change is seen at the first chance after it; the time between a substitution and the next chance lands on the earlier
// lineup). A stint is a run of chances with the same five; it ends where the next one starts.
export function lineupStints(plays, side) {
  const other = side === 'byu' ? 'opp' : 'byu';
  const ordered = plays.filter((p) => p.lu && p.lu[side].length).sort((a, b) => elapsedSec(a) - elapsedSec(b));
  if (!ordered.length) return [];
  const runs = [];
  for (const p of ordered) {
    const key = p.lu[side].join('|');
    const last = runs[runs.length - 1];
    if (last && last.key === key) last.plays.push(p);
    else runs.push({ key, names: p.lu[side], plays: [p] });
  }
  const gameEnd = Math.max(...ordered.map((p) => (elapsedSec(p) + (p.dur || 0)) / 60));
  return runs.map((r, i) => {
    const startMin = i === 0 ? 0 : elapsedSec(r.plays[0]) / 60;
    const endMin = i + 1 < runs.length ? elapsedSec(runs[i + 1].plays[0]) / 60 : gameEnd;
    const off = summarize(r.plays.filter((p) => p.offense === side)), def = summarize(r.plays.filter((p) => p.offense === other));
    return { key: r.key, names: r.names, startMin, endMin, mins: Math.max(0, endMin - startMin), scored: off.pts, allowed: def.pts, offPoss: off.poss, defPoss: def.poss };
  });
}

const addTotals = (t, s) => { t.scored += s.scored; t.allowed += s.allowed; t.offPoss += s.offPoss; t.defPoss += s.defPoss; };

// Per player: the stretches of game time on the floor (adjacent stints merged) and the total minutes. `totals[i]` is what the
// team scored and allowed (and the possessions behind it) over `spans[i]`.
export function playerFloorTime(stints) {
  const by = new Map();
  for (const s of stints) {
    for (const name of s.names) {
      if (!by.has(name)) by.set(name, { name, spans: [], totals: [], mins: 0 });
      const e = by.get(name), last = e.spans[e.spans.length - 1];
      if (last && Math.abs(last[1] - s.startMin) < 1e-9) { last[1] = s.endMin; addTotals(e.totals[e.totals.length - 1], s); }
      else {
        e.spans.push([s.startMin, s.endMin]);
        e.totals.push({ scored: 0, allowed: 0, offPoss: 0, defPoss: 0 });
        addTotals(e.totals[e.totals.length - 1], s);
      }
      e.mins += s.endMin - s.startMin;
    }
  }
  return [...by.values()].sort((a, b) => b.mins - a.mins || (a.name < b.name ? -1 : 1));
}

// ---- on/off comparisons. A spec is { on: [names who must be on the floor], off: [names who must not be] }, optionally with
// anyOf: [names] and atLeast: N, meaning at least N of those names are on the floor (N = 1 is "any of them"). An empty spec
// matches every lineup. "Rest of the time" is the same spec inverted. The lineup is the one at the start of each chance.
export const lineupMatches = (names, spec) => spec.on.every((n) => names.includes(n)) && !spec.off.some((n) => names.includes(n))
  && (!spec.anyOf || !spec.anyOf.length || spec.anyOf.filter((n) => names.includes(n)).length >= (spec.atLeast || 1));

// The team's chances while the spec holds (or, inverted, while it doesn't): its own possessions (off) and the other team's (def).
export function lineupSplit(plays, side, spec, invert = false, luOf = (p, s) => p.lu[s]) {
  const hit = (p) => p.lu && p.lu[side].length && lineupMatches(luOf(p, side), spec) !== invert;
  return { off: plays.filter((p) => p.offense === side && hit(p)), def: plays.filter((p) => p.offense !== side && hit(p)) };
}

// Minutes of game time the spec held (or didn't), from the stints.
export const minutesOn = (stints, spec, invert = false) => stints.filter((s) => lineupMatches(s.names, spec) !== invert).reduce((m, s) => m + s.mins, 0);

export const specIsEmpty = (spec) => !spec.on.length && !spec.off.length && !(spec.anyOf && spec.anyOf.length);

// Points per possession scored minus allowed; null until both sides have a possession.
export const netRating = (t) => (t.offPoss && t.defPoss ? t.scored / t.offPoss - t.allowed / t.defPoss : null);

// The score [BYU, opponent] at a game minute, from the box payload's event log (each event carries the score after it).
export function scoreAt(events, min) {
  let sc = [0, 0];
  for (const e of events) {
    if (elapsedSec({ per: e.per, startRem: e.rem }) / 60 > min + 1e-6) break;
    if (e.sc && e.sc[0] !== null) sc = e.sc;
  }
  return sc;
}
