import { useState } from "react";
import { scaleLinear } from "d3";
import { useChart } from "./ChartContext";
import Tooltip from "./Tooltip";

// Mirrored horizontal bars: one row per datum, one side's bar growing left from the center label and the
// other's growing right, both on the same scale so lengths compare directly. Goes inside <Chart>; give the
// chart left / right margins (about 44px) for the optional outer columns and a top margin for the side names.
//
//   <Chart height={rows.length * 42 + 26} margin={{ top: 22, right: 44, bottom: 4, left: 44 }} label="Shot share">
//     <ButterflyBars data={rows} label={(d) => d.label}
//       left={{ name: "BYU", value: (d) => d.byu.share, color: "var(--blue-stop-3)", format: pct, outer: (d) => f2(d.byu.pps) }}
//       right={{ name: "Ohio St.", value: (d) => d.opp.share, color: "var(--opp-color)", format: pct, outer: (d) => f2(d.opp.pps) }}
//       lead={(d) => (d.byu.pps >= d.opp.pps ? "left" : "right")} />
//   </Chart>
//
// data                array of anything, one row each
// label, sub          (d) => string for the center label, and an optional smaller line under it
// left, right         { name, value: (d) => number | null, color, format, outer?: (d) => string, outerName?: string, thin?: (d) => bool }
//                     value sets the bar length, outer is the text out in the margin column (muted when thin) and
//                     outerName is that column's header
// lead                (d) => "left" | "right" | null, which outer number is bold
// The value label (format of the bar's value) sits inside the bar when it fits and just past the bar's end when it does not.
// centerWidth         px reserved for the center label
// tooltip             ({ datum, index }) => markup, shown beside the active row
// onActiveChange      ({ index, datum } | null) => void
const CHAR_W = 7.8; // px per character of the value label, to decide whether it fits inside its bar
const PAD_IN = 14; // px of bar left around a label sitting inside it

export default function ButterflyBars({ data, label, sub, left, right, lead, centerWidth = 76, tooltip, onActiveChange, className }) {
  const { innerWidth, innerHeight } = useChart();
  const [active, setActive] = useState(-1);
  const select = (i) => { setActive(i); if (onActiveChange) onActiveChange(i < 0 ? null : { index: i, datum: data[i] }); };

  const half = Math.max(0, (innerWidth - centerWidth) / 2);
  const max = Math.max(1e-9, ...data.flatMap((d) => [left.value(d) || 0, right.value(d) || 0]));
  const len = scaleLinear().domain([0, max]).range([0, half]);
  const step = data.length ? innerHeight / data.length : 0;
  const barH = Math.min(26, step * 0.72);
  const cx = innerWidth / 2;

  const side = (cfg, d, i, dir) => {
    const v = cfg.value(d);
    const w = v ? Math.max(2, len(v)) : 0;
    const x0 = dir < 0 ? cx - centerWidth / 2 - w : cx + centerWidth / 2;
    const end = dir < 0 ? x0 : x0 + w;
    return (
      <g key={dir}>
        {w > 0 && <rect className="chart-butterfly__bar" x={x0} y={(step - barH) / 2} width={w} height={barH} rx={4} style={{ fill: cfg.color }} />}
        {v != null && (() => {
          const text = cfg.format ? cfg.format(v) : String(v);
          const inside = w >= text.length * CHAR_W + PAD_IN; // a bar too short for its label puts it beyond the end instead
          return (
            <text
              className={`chart-butterfly__value${inside ? " chart-butterfly__value--in" : ""}`}
              x={inside ? x0 + w / 2 : end + dir * 6} y={step / 2} dy="0.32em" textAnchor={inside ? "middle" : dir < 0 ? "end" : "start"}
            >
              {text}
            </text>
          );
        })()}
        {cfg.outer && (
          <text
            className={`chart-butterfly__outer${(lead && lead(d) === (dir < 0 ? "left" : "right")) ? " chart-butterfly__outer--lead" : ""}${cfg.thin && cfg.thin(d) ? " chart-butterfly__outer--thin" : ""}`}
            x={dir < 0 ? -8 : innerWidth + 8} y={step / 2} dy="0.32em" textAnchor={dir < 0 ? "end" : "start"}
          >
            {cfg.outer(d)}
          </text>
        )}
      </g>
    );
  };

  return (
    <>
      <g className={`chart-butterfly${className ? ` ${className}` : ""}`}>
        <text className="chart-butterfly__side" x={cx - centerWidth / 2 - 4} y={-8} textAnchor="end">{left.name}</text>
        <text className="chart-butterfly__side" x={cx + centerWidth / 2 + 4} y={-8} textAnchor="start">{right.name}</text>
        {left.outerName && <text className="chart-butterfly__side" x={-8} y={-8} textAnchor="end">{left.outerName}</text>}
        {right.outerName && <text className="chart-butterfly__side" x={innerWidth + 8} y={-8} textAnchor="start">{right.outerName}</text>}
        {data.map((d, i) => (
          <g
            key={i}
            className={`chart-butterfly__row${i === active ? " chart-butterfly__row--active" : ""}`}
            transform={`translate(0,${i * step})`}
            tabIndex={0}
            role="img"
            aria-label={`${label(d)}: ${left.name} ${left.value(d) != null && left.format ? left.format(left.value(d)) : "none"}, ${right.name} ${right.value(d) != null && right.format ? right.format(right.value(d)) : "none"}`}
            onPointerEnter={(e) => { if (e.pointerType === "mouse") select(i); }}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") select(-1); }}
            onPointerUp={(e) => { if (e.pointerType !== "mouse") select(i === active ? -1 : i); }}
            onFocus={() => select(i)}
            onBlur={() => select(-1)}
          >
            <rect className="chart-butterfly__hit" x={-44} width={innerWidth + 88} height={step} />
            {side(left, d, i, -1)}
            {side(right, d, i, 1)}
            <text className="chart-butterfly__label" x={cx} y={sub ? step / 2 - 4 : step / 2} dy={sub ? "0em" : "0.32em"} textAnchor="middle">{label(d)}</text>
            {sub && sub(d) && <text className="chart-butterfly__sub" x={cx} y={step / 2 + 8} textAnchor="middle">{sub(d)}</text>}
          </g>
        ))}
      </g>
      {tooltip && active >= 0 && <Tooltip x={0} y={(active + 1) * step}>{tooltip({ datum: data[active], index: active })}</Tooltip>}
    </>
  );
}
