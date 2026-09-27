import { useMemo, useState } from "react";
import { curveStepAfter } from "d3";
import { Annotation, Axis, Band, Chart, HoverLayer, Line, Marker, ReferenceLine, useChart } from "../../../components/charts";
import useMediaQuery from "../../../hooks/useMediaQuery";
import { marginOf, marginSeries, stretchSlice } from "../../../utils/clutchSeries";
import { teamName } from "./teamNames";

const MIN_WINDOW = 600;
const X_PAD = 2; // points of headroom above and below the data, room for the stretch numbers
const CHART_MARGIN = { top: 24, right: 16, bottom: 30, left: 44 };

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const signed = (v) => (v > 0 ? `+${v}` : String(v));
const timeOf = (d) => d.t;
const marginAt = (d) => d.margin;
const hasPlay = (p) => p.description !== undefined;

const MIN_NUMBER_GAP = 18; // px between stretch numbers before one is dropped

// Stretch numbers along the bottom of the plot. On narrow charts neighbours collide, so a number that
// would land within MIN_NUMBER_GAP of the previous one is left out (the list below still has all).
function StretchNumbers({ stretches }) {
  const { x } = useChart();
  let lastX = -Infinity;
  return stretches.map((s) => {
    const at = (s.start.clockSeconds + s.end.clockSeconds) / 2;
    const px = x(at);
    if (px - lastX < MIN_NUMBER_GAP) return null;
    lastX = px;
    return <Annotation key={`n${s.id}`} x={at} yPx={(c) => c.innerHeight - 12} label={String(s.id)} />;
  });
}

function xTicks(windowSeconds) {
  const step = windowSeconds > 600 ? 300 : 120;
  const ticks = [];
  for (let t = windowSeconds; t > 0; t -= step) ticks.push(t);
  ticks.push(0);
  return ticks;
}

// The focus team's margin through the end of the 2nd half. Clutch stretches are drawn heavy over a
// thin grey line for the whole window; the play that pushed a stretch out is a solid dot, the play
// that pulled the game back in is a hollow one. The chart's header and legend are plain HTML.
export default function MarginChart({ plays, clutch, definition, focusId }) {
  const windowSeconds = Math.max(MIN_WINDOW, definition.seconds);
  const { points, sign } = useMemo(
    () => marginSeries(plays, { focusId, windowSeconds }),
    [plays, focusId, windowSeconds]
  );
  const stretches = useMemo(() => clutch.stretches.filter((s) => s.start.period === 2), [clutch.stretches]);
  const slices = useMemo(() => stretches.map((s) => stretchSlice(points, s, sign)), [stretches, points, sign]);

  // hover snaps to real score changes only, not the synthetic opening / closing points
  const hoverPoints = useMemo(() => points.filter(hasPlay), [points]);
  const opponentId = clutch.homeId === focusId ? clutch.awayId : clutch.homeId;
  const inClutch = (p) => stretches.some((s) => p.seq >= s.startSeq && p.seq <= s.endSeq);

  // Devices with no hover get a readout line above the chart instead of a floating tooltip, which a
  // finger would cover. Touch behavior itself (sticky selection) comes from the pointer type, not this.
  const noHover = useMediaQuery("(hover: none)");
  const [selected, setSelected] = useState(null);
  const tipContent = (p) => (
    <>
      <div className="margin-chart__tip-head">
        <b>{clock(p.t)} left</b>
        {inClutch(p) && <span className="margin-chart__tip-badge">Clutch</span>}
      </div>
      <div>{teamName(focusId)} {p.us}, {teamName(opponentId)} {p.them} ({signed(p.margin)})</div>
      <div className="margin-chart__tip-play">{p.description}</div>
    </>
  );

  const bound = Math.max(definition.margin, ...points.map((p) => Math.abs(p.margin))) + X_PAD;
  const yTicks = useMemo(() => [-definition.margin, 0, definition.margin], [definition.margin]);
  const xAxisTicks = useMemo(() => xTicks(windowSeconds), [windowSeconds]);
  const x = useMemo(() => ({ domain: [windowSeconds, 0] }), [windowSeconds]);
  const y = useMemo(() => ({ domain: [-bound, bound] }), [bound]);

  return (
    <div className="margin-chart">
      <div className="margin-chart__head">
        <h3 className="margin-chart__title">{teamName(focusId)} margin · last {clock(windowSeconds)} of the 2nd half</h3>
        <ul className="margin-chart__legend">
          <li><span className="margin-chart__swatch margin-chart__swatch--band" />Within {definition.margin}, last {clock(definition.seconds)}</li>
          <li><span className="margin-chart__swatch margin-chart__swatch--line" />Clutch stretch</li>
          <li><span className="margin-chart__swatch margin-chart__swatch--dot" />Out of clutch</li>
        </ul>
      </div>
      {noHover && (
        <div className="margin-chart__readout" aria-hidden="true">
          {selected
            ? <div className="margin-chart__tip">{tipContent(selected.datum)}</div>
            : <span className="margin-chart__readout-hint">Tap or drag on the chart to see each play</span>}
        </div>
      )}
      <Chart
        height={240} margin={CHART_MARGIN} x={x} y={y}
        label={`${teamName(focusId)} scoring margin over the last ${clock(windowSeconds)} of the 2nd half, with ${stretches.length} clutch ${stretches.length === 1 ? "stretch" : "stretches"} highlighted`}
      >
        <Band x0={definition.seconds} x1={0} y0={-definition.margin} y1={definition.margin} />
        <Axis orient="left" tickValues={yTicks} tickFormat={signed} grid hideDomain />
        <Axis orient="bottom" tickValues={xAxisTicks} tickFormat={clock} />
        <ReferenceLine x={definition.seconds} label={clock(definition.seconds)} />
        <Line className="margin-chart__base" data={points} x={timeOf} y={marginAt} curve={curveStepAfter} />
        {slices.map((slice, i) => (
          <Line key={stretches[i].id} className="margin-chart__stretch" data={slice} x={timeOf} y={marginAt} curve={curveStepAfter} />
        ))}
        <StretchNumbers stretches={stretches} />
        {stretches.map((s) => s.entry && (
          <Marker key={`in${s.id}`} variant="hollow" x={s.entry.clockSeconds} y={marginOf(sign, s.entry.home, s.entry.away)} />
        ))}
        {stretches.map((s) => s.exit.reason === "margin" && s.exit.play && (
          <Marker key={`out${s.id}`} x={s.exit.play.clockSeconds} y={marginOf(sign, s.exit.play.home, s.exit.play.away)} />
        ))}
        <HoverLayer
          data={hoverPoints} x={timeOf} y={marginAt} label="Scoring margin by play"
          describe={(p) => `${clock(p.t)} left. ${teamName(focusId)} ${p.us}, ${teamName(opponentId)} ${p.them}. ${p.description}`}
          tooltip={({ datum: p }) => <div className="margin-chart__tip">{tipContent(p)}</div>}
          tooltipOnTouch={!noHover}
          onActiveChange={noHover ? setSelected : undefined}
        />
      </Chart>
    </div>
  );
}
