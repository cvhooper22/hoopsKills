import { useMemo, useState } from "react";
import { arc as d3Arc, pie as d3Pie } from "d3";
import { fillSlot } from "./anchor";
import { useChart } from "./ChartContext";
import Tooltip from "./Tooltip";

// Donut chart. Goes inside <Chart> (which supplies the size, the aria label and the tooltip mount)
// and fills the plot area, centered. Slices run clockwise from 12 o'clock in data order.
//
//   <Chart height={240} margin={{ top: 4, right: 4, bottom: 4, left: 4 }} label="Kills by period">
//     <Donut data={buckets} value={(d) => d.count} label={(d) => d.label} color={(d) => shade(d.count)}>
//       {({ active, total }) => <text textAnchor="middle">{active ? active.value : total}</text>}
//     </Donut>
//   </Chart>
//
// data           array of anything; read through value / label / color
// value, label   (d) => number / string
// color          a color string, an array cycled by index, or (d, i) => color. Defaults to the chart blues.
// innerRadius    hole size as a share of the outer radius (0 draws a pie)
// padAngle       gap between slices, radians
// activeIndex    controlled highlight (-1 for none); leave out and the donut tracks hover / focus / touch itself
// onActiveChange ({ index, datum } | null) => void, for syncing a legend
// onSliceClick   ({ index, datum }) => void, on a mouse click or Enter / Space on a focused slice (a tap
//                on touch only highlights the slice, so a stray tap never triggers it)
// tooltip        ({ datum, value, share }) => markup, shown beside the active slice
// children       the center: a function called with { active, total, radius, innerRadius } (active is
//                { index, datum, value, share } | null), or plain JSX, drawn at the center of the donut
const BLUES = ["#003fa2", "#00377a", "#bdd6e6", "#002e52", "#4f7fc4", "#7aa6d6"];
const GROW = 4; // px an active slice grows outward

export default function Donut({
  data, value = (d) => d.value, label = (d) => d.label, color, innerRadius = 0.62, padAngle = 0.015, cornerRadius = 2,
  activeIndex, onActiveChange, onSliceClick, tooltip, children, className,
}) {
  const { innerWidth, innerHeight } = useChart();
  const [own, setOwn] = useState(-1);
  const active = activeIndex ?? own;

  const radius = Math.max(0, Math.min(innerWidth, innerHeight) / 2 - GROW);
  const total = useMemo(() => data.reduce((sum, d) => sum + value(d), 0), [data, value]);
  const slices = useMemo(() => d3Pie().sort(null).value(value).padAngle(padAngle)(data), [data, value, padAngle]);

  const colorOf = (d, i) => (typeof color === "function" ? color(d, i) : Array.isArray(color) ? color[i % color.length] : color ?? BLUES[i % BLUES.length]);
  const select = (index) => {
    setOwn(index);
    if (onActiveChange) onActiveChange(index < 0 ? null : { index, datum: data[index] });
  };

  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const shape = (extra) => d3Arc().innerRadius(radius * innerRadius).outerRadius(radius + extra).cornerRadius(cornerRadius);
  const activeSlice = slices[active];
  const info = activeSlice && { index: active, datum: activeSlice.data, value: activeSlice.value, share: total ? activeSlice.value / total : 0 };

  const center = fillSlot({ children }, { active: info, total, radius, innerRadius: radius * innerRadius });
  const centroid = activeSlice && shape(0).centroid(activeSlice);

  return (
    <>
      <g className={`chart-donut${className ? ` ${className}` : ""}`} transform={`translate(${cx},${cy})`}>
        {slices.map((s, i) => (
          s.value > 0 && (
            <path
              key={i}
              style={onSliceClick ? { cursor: "pointer" } : undefined}
              className={`chart-donut__slice${i === active ? " chart-donut__slice--active" : ""}`}
              d={shape(i === active ? GROW : 0)(s)}
              fill={colorOf(s.data, i)}
              tabIndex={0}
              role="img"
              aria-label={`${label(s.data)}: ${s.value}`}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") select(i); }}
              onPointerLeave={(e) => { if (e.pointerType === "mouse") select(-1); }}
              onPointerUp={(e) => { if (e.pointerType !== "mouse") select(i === active ? -1 : i); }}
              onClick={(e) => { if (onSliceClick && e.detail > 0 && e.nativeEvent.pointerType !== "touch") onSliceClick({ index: i, datum: s.data }); }}
              onKeyDown={(e) => { if (onSliceClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSliceClick({ index: i, datum: s.data }); } }}
              onFocus={() => select(i)}
              onBlur={() => select(-1)}
            />
          )
        ))}
        {center && <g className="chart-donut__center">{center}</g>}
      </g>
      {tooltip && info && <Tooltip x={cx + centroid[0]} y={cy + centroid[1]}>{tooltip(info)}</Tooltip>}
    </>
  );
}
