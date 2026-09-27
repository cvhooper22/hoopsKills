import { memo, useMemo } from "react";
import { useChart } from "./ChartContext";
import { isBandScale } from "./scales";

const TICK_PAD = 8;
const TEXT_PROPS = {
  bottom: { y: 0, dy: "0.71em", textAnchor: "middle" },
  top: { y: 0, dy: "0em", textAnchor: "middle" },
  left: { x: 0, dy: "0.32em", textAnchor: "end" },
  right: { x: 0, dy: "0.32em", textAnchor: "start" },
};

function resolveTicks(scale, tickValues, tickCount) {
  if (tickValues) return tickValues;
  if (scale.ticks) return scale.ticks(tickCount);
  return scale.domain(); // band / point scales
}

// One axis for all four sides. Ticks are React-rendered <g>s (d3 only supplies the tick values),
// so there is no d3 DOM mutation. `grid` draws a line across the whole plot for every tick.
//   <Axis orient="bottom" tickValues={[0, 120, 240]} tickFormat={formatClock} />
function Axis({ orient = "bottom", scale, tickCount = 6, tickValues, tickFormat, tickSize = 0, grid = false, hideDomain = false, className }) {
  const chart = useChart();
  const horizontal = orient === "bottom" || orient === "top";
  const s = scale ?? (horizontal ? chart.x : chart.y);
  const offset = isBandScale(s) ? s.bandwidth() / 2 : 0;

  const ticks = useMemo(() => {
    const format = tickFormat ?? (s.tickFormat ? s.tickFormat(tickCount) : String);
    return resolveTicks(s, tickValues, tickCount).map((value) => ({ value, pos: s(value) + offset, text: format(value) }));
  }, [s, tickValues, tickCount, tickFormat, offset]);

  const translate = { bottom: `translate(0,${chart.innerHeight})`, top: undefined, left: undefined, right: `translate(${chart.innerWidth},0)` }[orient];
  const sign = orient === "top" || orient === "left" ? -1 : 1;
  const [r0, r1] = s.range();
  const gridLength = horizontal ? chart.innerHeight : chart.innerWidth;

  return (
    <g className={`chart-axis chart-axis--${orient}${className ? ` ${className}` : ""}`} transform={translate}>
      {grid && (
        <g className="chart-axis__grid">
          {ticks.map((t) => (horizontal
            ? <line key={t.value} x1={t.pos} x2={t.pos} y1={0} y2={-sign * gridLength} />
            : <line key={t.value} y1={t.pos} y2={t.pos} x1={0} x2={-sign * gridLength} />))}
        </g>
      )}
      {!hideDomain && (horizontal
        ? <line className="chart-axis__domain" x1={r0} x2={r1} />
        : <line className="chart-axis__domain" y1={r0} y2={r1} />)}
      {ticks.map((t) => (
        <g key={t.value} className="chart-axis__tick" transform={horizontal ? `translate(${t.pos},0)` : `translate(0,${t.pos})`}>
          {tickSize > 0 && (horizontal
            ? <line y2={sign * tickSize} />
            : <line x2={sign * tickSize} />)}
          <text
            {...TEXT_PROPS[orient]}
            {...(horizontal ? { y: sign * (tickSize + TICK_PAD) } : { x: sign * (tickSize + TICK_PAD) })}
          >
            {t.text}
          </text>
        </g>
      ))}
    </g>
  );
}

export default memo(Axis);
