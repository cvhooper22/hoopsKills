import { killGain } from './killInsights';

// Score-over-time series and per-kill "boost" spans for the game flow chart (KillsFlow). Reshapes
// plays and detectKills() output only; no rules live here. See kills-rules.md for stops and kills.

// Running score after every play, carried forward where a play has no score. t is game seconds.
export function scoreSeries(plays, defense) {
  const opp = defense === 'home' ? 'away' : 'home';
  let byu = 0;
  let them = 0;
  return plays.map((p) => {
    if (p[`${defense}_score_after`] != null) byu = p[`${defense}_score_after`];
    if (p[`${opp}_score_after`] != null) them = p[`${opp}_score_after`];
    return { seq: p.sequence_number, t: p.game_seconds_elapsed, byu, opp: them, margin: byu - them };
  });
}

// Line points for one series (e.g. 'margin'): the value holds flat, then ramps to its new value over the RAMP
// seconds before the change (the ESPN look), plus the start and the final horn. Draw with a
// monotone curve so the ramps are smooth and the flats stay flat.
export const RAMP = 40;
export function stepPoints(series, side) {
  const out = [{ t: 0, score: 0 }];
  series.forEach((s) => {
    const prev = out[out.length - 1];
    if (s[side] === prev.score) return;
    const from = Math.max(prev.t, s.t - RAMP);
    if (from > prev.t) out.push({ t: from, score: prev.score });
    out.push({ t: s.t, score: s[side] });
  });
  const end = series[series.length - 1];
  if (end && end.t > out[out.length - 1].t) out.push({ t: end.t, score: end[side] });
  return out;
}

// Every kill and potential kill as a span from its first stop to its breaker (the same timing the
// rest of the kills data uses). `gain` is BYU's margin change over the span measured just before
// the breaker's own score, so it is the points BYU scored while the opponent was held; it drives
// the green/red color. `pts` is the table's "Pts gained" (margin swing through BYU's possession after the
// last stop), which the tooltip shows. A streak
// that runs to the final horn has no breaker; its span ends at the last play, inclusive.
// Kills sharing a streak share a breaker, so their spans overlap by design.
export function flowSpans(plays, series, result, defense) {
  const bySeq = new Map(series.map((s, i) => [s.seq, i]));
  const at = (i) => series[Math.max(0, i)];
  const stopBySeq = new Map(result.stops.map((st) => [st.seq, st]));
  const span = (kind, firstSeq, breaker, label, pts) => {
    const from = bySeq.get(firstSeq);
    const to = breaker.gameEnded ? series.length - 1 : bySeq.get(breaker.seq) - 1;
    const a = at(from - 1);
    const b = at(to);
    const t0 = series[from].t;
    const t1 = breaker.gameEnded ? b.t : series[to + 1].t;
    const gain = (b.byu - a.byu) - (b.opp - a.opp);
    const first = stopBySeq.get(firstSeq);
    return { kind, label, t0, t1, held: t1 - t0, period: first.period, clock: first.clock, startByu: a.byu, endByu: b.byu, opp: a.opp, gain, pts };
  };
  const spans = result.kills.map((k, i) => span('kill', k.stops[0], k.end, `K${i + 1}`, killGain(k)));
  result.potentialKills.forEach((pk, i) => spans.push(span('potential', pk.stops[0], pk.end, `PK${i + 1}`, pk.gainEnd - pk.startMargin)));
  return spans.sort((x, y) => x.t0 - y.t0);
}

// The drawn line between ta and tb: its own points inside the window, with the ends read off the
// line itself, so a highlight built from it can never drift away from the line underneath.
export function windowPoints(points, ta, tb) {
  const at = (t) => {
    const i = points.findIndex((p, k) => k < points.length - 1 && t >= p.t && t <= points[k + 1].t);
    if (i < 0) return points[points.length - 1].score;
    const [p, q] = [points[i], points[i + 1]];
    return q.t === p.t ? q.score : p.score + ((q.score - p.score) * (t - p.t)) / (q.t - p.t);
  };
  return [{ t: ta, score: at(ta) }, ...points.filter((p) => p.t > ta && p.t < tb), { t: tb, score: at(tb) }];
}

// Where a span's highlight ends. The margin line starts falling RAMP seconds before the opponent's
// breaker basket, so the highlight stops there.
export const spanEnd = (s) => Math.max(s.t0, s.t1 - RAMP);
