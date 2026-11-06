import { useState } from "react";
import { arc as d3Arc } from "d3";
import { useChart } from "./ChartContext";
import Tooltip from "./Tooltip";

// Radial bars: the circle is cut into one wedge per datum (clockwise from 12 o'clock, in data order) and each
// wedge holds one bar per series, its length the series' value from a small hole out to a shared maximum.
// Goes inside <Chart>, centered and sized to the smaller side of the plot area; leave a margin for the labels.
//
//   <Chart height={340} margin={{ top: 24, right: 24, bottom: 24, left: 24 }} label="Points per shot by shot clock">
//     <RadialBars data={rows} label={(d) => d.label}
//       series={[{ name: "BYU", value: (d) => d.byu.pps, color: "var(--blue-stop-3)" }, { name: "Ohio St.", value: (d) => d.opp.pps, color: "var(--opp-color)" }]}
//       format={f2} rings={[0.5, 1, 1.5]} />
//   </Chart>
//
// data            array of anything, one wedge each
// label           (d) => string, printed outside the wedge
// series          [{ name, value: (d) => number | null, color, muted?: (d) => bool }]; muted bars are drawn faded
// max             value at the outer edge (defaults to the largest value, rounded up to the next ring)
// rings           values to draw a dashed guide circle at; the default is every 0.5 up to max
// ringLabels      false hides the value printed on each guide ring (default true)
// format          (v) => string for the value printed past each bar's end
// hole            radius in px of the empty center
// tooltip         ({ datum, index }) => markup, shown beside the active wedge
// onActiveChange  ({ index, datum } | null) => void
const LABEL_ROOM = 34; // px outside the longest possible bar kept for the wedge label
const WEDGE_PAD = 4; // degrees between wedges
const BAR_PAD = 1; // degrees between a wedge's bars

const polar = (r, deg) => [r * Math.sin((deg * Math.PI) / 180), -r * Math.cos((deg * Math.PI) / 180)];

export default function RadialBars({ data, label, series, max, rings, ringLabels = true, format = String, hole = 22, tooltip, onActiveChange, className }) {
  const { innerWidth, innerHeight } = useChart();
  const [active, setActive] = useState(-1);
  const select = (i) => { setActive(i); if (onActiveChange) onActiveChange(i < 0 ? null : { index: i, datum: data[i] }); };

  const outer = Math.max(hole + 10, Math.min(innerWidth, innerHeight) / 2 - LABEL_ROOM);
  const peak = Math.max(0, ...data.flatMap((d) => series.map((s) => s.value(d) || 0)));
  const top = max ?? Math.max(1, Math.ceil(peak * 2) / 2);
  const guides = rings ?? Array.from({ length: Math.floor(top / 0.5 + 1e-9) }, (_, k) => (k + 1) * 0.5);
  const radius = (v) => hole + (Math.min(v, top) / top) * (outer - hole);

  const step = 360 / data.length;
  const sub = (step - WEDGE_PAD) / series.length;
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const arcOf = (r1, a0, a1) => d3Arc().innerRadius(hole).outerRadius(r1).startAngle((a0 * Math.PI) / 180).endAngle((a1 * Math.PI) / 180).cornerRadius(2)();
  const activeAt = active >= 0 ? polar(outer, active * step + step / 2) : null;

  return (
    <>
      <g className={`chart-radial${className ? ` ${className}` : ""}`} transform={`translate(${cx},${cy})`}>
        {guides.map((v) => (
          <g key={v}>
            <circle className="chart-radial__ring" r={radius(v)} />
            {ringLabels && <text className="chart-radial__tick" x={3} y={-radius(v) - 2}>{format(v)}</text>}
          </g>
        ))}
        {data.map((d, i) => {
          const a0 = i * step + WEDGE_PAD / 2;
          const [lx, ly] = polar(outer + LABEL_ROOM - 12, i * step + step / 2);
          return (
            <g
              key={i}
              className={`chart-radial__wedge${i === active ? " chart-radial__wedge--active" : ""}`}
              tabIndex={0}
              role="img"
              aria-label={`${label(d)}: ${series.map((s) => `${s.name} ${s.value(d) != null ? format(s.value(d)) : "none"}`).join(", ")}`}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") select(i); }}
              onPointerLeave={(e) => { if (e.pointerType === "mouse") select(-1); }}
              onPointerUp={(e) => { if (e.pointerType !== "mouse") select(i === active ? -1 : i); }}
              onFocus={() => select(i)}
              onBlur={() => select(-1)}
            >
              <path className="chart-radial__hit" d={arcOf(outer + LABEL_ROOM - 8, i * step, (i + 1) * step)} />
              {series.map((s, j) => {
                const v = s.value(d);
                if (v == null) return null;
                const s0 = a0 + j * sub, s1 = s0 + sub - BAR_PAD, r = radius(v), [vx, vy] = polar(r + 9, (s0 + s1) / 2);
                return (
                  <g key={j} className={s.muted && s.muted(d) ? "chart-radial__bar--muted" : undefined}>
                    <path className="chart-radial__bar" d={arcOf(r, s0, s1)} style={{ fill: s.color }} />
                    <text className="chart-radial__value" x={vx} y={vy} dy="0.32em" textAnchor="middle">{format(v)}</text>
                  </g>
                );
              })}
              <text className="chart-radial__label" x={lx} y={ly} dy="0.32em" textAnchor="middle">{label(d)}</text>
            </g>
          );
        })}
      </g>
      {tooltip && activeAt && <Tooltip x={cx + activeAt[0]} y={cy + activeAt[1]}>{tooltip({ datum: data[active], index: active })}</Tooltip>}
    </>
  );
}
