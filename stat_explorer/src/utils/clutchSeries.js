// Data prep for the margin-over-time chart. Pure functions of the plays (and stretches), so a
// chart component only maps the result to <Line>s and <Marker>s.

// +1 when the focus team is home, -1 when away: margin = sign * (home - away)
export function focusSign(plays, focusId) {
  return plays.find((p) => p.team_id === focusId)?.team_side === "home" ? 1 : -1;
}

export const marginOf = (sign, home, away) => sign * (home - away);

// The focus team's margin after every score change in the last `windowSeconds` of the 2nd half, as
// step points { t: seconds remaining, margin, seq } in game order. Real score changes also carry
// { clock, us, them, description } for hover; the opening and closing points do not. It opens with the margin when
// the window began and closes with the margin at the buzzer, so a step line spans the whole axis.
// Several scores at one clock time (free throws) are separate points and draw as a vertical run.
export function marginSeries(plays, { focusId, windowSeconds }) {
  const sign = focusSign(plays, focusId);
  const points = [];
  let margin = 0;
  let opened = false;
  const open = () => {
    if (!opened) points.push({ t: windowSeconds, margin, seq: -1 });
    opened = true;
  };
  plays.forEach((p) => {
    if (p.home_score_after == null) return;
    const m = marginOf(sign, p.home_score_after, p.away_score_after);
    const inWindow = p.period_number === 2 && p.clock_seconds_remaining <= windowSeconds;
    if (!inWindow) {
      if (p.period_number <= 2) margin = m; // still before the window (or the window's end)
      return;
    }
    open();
    if (m !== margin) {
      const [us, them] = sign === 1 ? [p.home_score_after, p.away_score_after] : [p.away_score_after, p.home_score_after];
      points.push({
        t: p.clock_seconds_remaining, margin: m, seq: p.sequence_number,
        clock: p.clock_display, us, them, description: p.play_description,
      });
    }
    margin = m;
  });
  open();
  points.push({ t: 0, margin, seq: Infinity });
  return { points, sign };
}

// The part of the series that belongs to one stretch: it starts at the stretch's start point, runs
// through every score change inside it, and (when the stretch ended at the buzzer, not because the
// margin blew out) closes at its last clock time. A stretch cut off by a margin blowout ends on the
// scoring play that pushed it out, which is the last point.
export function stretchSlice(points, stretch, sign) {
  const slice = [{
    t: stretch.start.clockSeconds,
    margin: marginOf(sign, stretch.start.home, stretch.start.away),
    seq: stretch.startSeq - 0.5,
  }];
  points.forEach((p) => {
    if (p.seq >= stretch.startSeq && p.seq <= stretch.endSeq) slice.push(p);
  });
  if (stretch.exit.reason !== "margin") {
    slice.push({ t: stretch.end.clockSeconds, margin: marginOf(sign, stretch.end.home, stretch.end.away), seq: stretch.endSeq });
  }
  return slice;
}
