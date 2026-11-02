import { elapsedSec, summarize } from './playGroups';

// Exact lineups from the event log. The per-chance rows (`plays[].lu`) only snapshot each team's five at the START of a chance, so a
// substitution is not seen until the next chance and the time in between is credited to the earlier five. The substitution events
// carry the exact moment, so this replays them, starting from the first chance's five, and turns each change into a synthetic
// `lineup_change` event: { cat: 'lineup_change', synthetic: true, side, names, key, sec, t (game minute), seq, per, rem }.
//
// `seq` is where the change sits in the event log: it takes effect before `events[seq]`. Order in the log, not the clock, decides
// which five an event belongs to, because a sub and a foul or free throw often share a second.
//
// The synthetic events are returned beside the log (never written into data.events), so nothing that reads the log sees them.
// Anything that does not add up (a sub for a player who is not on the floor, a team without five, a replayed five that disagrees
// with a chance's snapshot) is listed in `anomalies` instead of being quietly smoothed over.

const FIVE = 5;
const keyOf = (names) => [...names].sort().join('|');
const secOf = (e) => elapsedSec({ per: e.per, startRem: e.rem });

export function buildLineupModel(events = [], plays = []) {
  const first = plays.find((p) => p.lu && p.lu.byu.length === FIVE && p.lu.opp.length === FIVE);
  if (!first) return null;
  const initial = { byu: [...first.lu.byu].sort(), opp: [...first.lu.opp].sort() };
  const floor = { byu: new Set(initial.byu), opp: new Set(initial.opp) };
  const anomalies = [];
  const changes = [];
  const pending = new Set(); // sides with subs applied that have not yet been written out
  let last = null; // the latest substitution event in the current run

  // A run of consecutive substitutions is one batch (out and in rarely arrive in one order). It becomes a change per team once that
  // team is back to five; a team that is not stays pending into the next run.
  const flush = (seq) => {
    if (!last) return;
    for (const side of ['byu', 'opp']) {
      if (!pending.has(side) || floor[side].size !== FIVE) continue;
      const names = [...floor[side]].sort();
      changes.push({ cat: 'lineup_change', synthetic: true, side, names, key: keyOf(names), sec: secOf(last), t: secOf(last) / 60, seq, per: last.per, rem: last.rem });
      pending.delete(side);
    }
    last = null;
  };

  events.forEach((e, i) => {
    if (e.cat !== 'substitution') { flush(i); return; }
    if (!e.player || !floor[e.side]) return;
    const at = { t: secOf(e) / 60, side: e.side, player: e.player };
    if (e.sub === 'out') {
      if (!floor[e.side].delete(e.player)) anomalies.push({ type: 'out-not-on-floor', ...at });
    } else if (e.sub === 'in') {
      if (floor[e.side].has(e.player)) anomalies.push({ type: 'in-already-on-floor', ...at });
      floor[e.side].add(e.player);
    }
    pending.add(e.side);
    last = e;
  });
  flush(events.length);
  for (const side of pending) anomalies.push({ type: 'unresolved', side, size: floor[side].size });

  // per team: the five in force from each point on (the starting five at 0)
  const bySide = {};
  for (const side of ['byu', 'opp']) {
    const pts = [{ sec: 0, seq: 0, names: initial[side], key: keyOf(initial[side]) }];
    for (const c of changes) if (c.side === side && c.key !== pts[pts.length - 1].key) pts.push(c);
    bySide[side] = pts;
  }

  const lastIdx = (list, ok) => { let lo = 0, hi = list.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ok(list[m])) lo = m; else hi = m - 1; } return lo; };
  // the five in force for the event at log index `seq` (its own substitutions excluded), and at a game minute (changes AT it count)
  const lineupAtSeq = (side, seq) => bySide[side][lastIdx(bySide[side], (p) => p.seq <= seq)].names;
  const lineupAtTime = (side, min) => bySide[side][lastIdx(bySide[side], (p) => p.sec <= min * 60 + 1e-6)].names;

  // Each chance's own snapshot must be a five that was in force at its start second. The snapshot is taken before subs that share that
  // second (or part-way through a run of them, around free throws), so any state from just before the second through its last change
  // is accepted. A snapshot outside that means the feed missed or misordered a sub.
  for (const p of plays) {
    if (!p.lu) continue;
    const s = elapsedSec(p);
    for (const side of ['byu', 'opp']) {
      if (!p.lu[side].length) continue;
      const pts = bySide[side];
      const before = lastIdx(pts, (x) => x.sec < s);
      const ok = pts.filter((x, i) => i >= before && x.sec <= s + 1e-6).map((x) => x.key);
      if (!ok.includes(keyOf(p.lu[side]))) anomalies.push({ type: 'snapshot-mismatch', side, t: s / 60, replayed: lineupAtTime(side, s / 60), snapshot: p.lu[side] });
    }
  }

  const gameEnd = Math.max(0, ...events.map(secOf), ...plays.map((p) => elapsedSec(p) + (p.dur || 0))) / 60;

  // A chance belongs to the five on the floor when it ENDS (the one that produced the result); if it began after a change it can not
  // belong to an earlier five.
  function stintIndexOf(side, p) {
    const pts = bySide[side];
    const start = elapsedSec(p), end = start + (p.dur || 0);
    return Math.max(lastIdx(pts, (s) => s.sec <= start), lastIdx(pts, (s) => s.sec < end));
  }
  const lineupOfPlay = (side, p) => bySide[side][stintIndexOf(side, p)].names;

  // Stints: the stretch each five held, with what each team scored over it, by the rule above.
  function stints(side) {
    const pts = bySide[side];
    const other = side === 'byu' ? 'opp' : 'byu';
    const buckets = pts.map(() => []);
    for (const p of plays) buckets[stintIndexOf(side, p)].push(p);
    return pts.map((s, i) => {
      const startMin = s.sec / 60, endMin = i + 1 < pts.length ? pts[i + 1].sec / 60 : gameEnd;
      const off = summarize(buckets[i].filter((p) => p.offense === side)), def = summarize(buckets[i].filter((p) => p.offense === other));
      return { key: s.key, names: s.names, startMin, endMin, mins: Math.max(0, endMin - startMin), startSeq: s.seq, endSeq: i + 1 < pts.length ? pts[i + 1].seq : events.length, scored: off.pts, allowed: def.pts, offPoss: off.poss, defPoss: def.poss };
    });
  }

  // the log with the synthetic changes placed where they happen
  const merged = [];
  let c = 0;
  events.forEach((e, i) => {
    while (c < changes.length && changes[c].seq <= i) merged.push(changes[c++]);
    merged.push(e);
  });
  while (c < changes.length) merged.push(changes[c++]);

  return { initial, changes, anomalies, events: merged, lineupAtSeq, lineupAtTime, lineupOfPlay, stints, gameEnd };
}
