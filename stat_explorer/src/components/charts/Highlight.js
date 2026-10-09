import { memo } from "react";
import { useChart } from "./ChartContext";

// Emphasizes one or more regions of the plot, in data coordinates: a translucent band with edge lines,
// and an optional label (a string, or an array of strings for one line each). Meant to be driven by something outside the chart (hovering or picking rows in
// a table or a legend), so it renders nothing until a region is given. Put it BEFORE the data it sits
// behind.
//
//   <Highlight x0={240} x1={480} label="16–12" />       a vertical band over those x values
//   <Highlight y0={-5} y1={5} />                          a horizontal band
//   <Highlight x0={2400} />                               open ended: runs to the right edge of the plot
//   <Highlight region={active} />                         { x0, x1, y0, y1, label } | null, for state
//   <Highlight region={[a, b, c]} />                      several at once; [] draws nothing
//
// Leave a bound out (undefined / null) to run to that edge of the plot, as Band does; a region with no
// bounds at all, or `region={null}`, draws nothing. Bounds past the plot are clamped to it. Regions that
// overlap just stack their shading; merge touching ones beforehand if you want a single band. Pair it
// with `dimmed` on the series (BubbleStream) to fade whatever is outside the regions.
const has = (v) => v !== undefined && v !== null;

function Region({ r, className }) {
  const { x, y, innerWidth, innerHeight } = useChart();
  if (!r || (!has(r.x0) && !has(r.x1) && !has(r.y0) && !has(r.y1))) return null;

  const span = (scale, a, b, extent) => {
    const p = [has(a) ? scale(a) : 0, has(b) ? scale(b) : extent].sort((m, n) => m - n);
    return [Math.max(0, Math.min(extent, p[0])), Math.max(0, Math.min(extent, p[1]))];
  };
  const [left, right] = span(x, r.x0, r.x1, innerWidth);
  const [top, bottom] = span(y, r.y0, r.y1, innerHeight);
  const vertical = has(r.x0) || has(r.x1);

  return (
    <g className={`chart-highlight${className ? ` ${className}` : ""}`} pointerEvents="none">
      <rect className="chart-highlight__fill" x={left} y={top} width={right - left} height={bottom - top} />
      {vertical ? (
        <>
          {has(r.x0) && <line className="chart-highlight__edge" x1={left} x2={left} y1={top} y2={bottom} />}
          {has(r.x1) && <line className="chart-highlight__edge" x1={right} x2={right} y1={top} y2={bottom} />}
        </>
      ) : (
        <>
          {has(r.y0) && <line className="chart-highlight__edge" x1={left} x2={right} y1={top} y2={top} />}
          {has(r.y1) && <line className="chart-highlight__edge" x1={left} x2={right} y1={bottom} y2={bottom} />}
        </>
      )}
      {r.label && (
        <text className="chart-highlight__label" x={(left + right) / 2} y={top + 12} textAnchor="middle">
          {[].concat(r.label).map((line, i) => <tspan key={i} x={(left + right) / 2} dy={i === 0 ? 0 : "1.15em"}>{line}</tspan>)}
        </text>
      )}
    </g>
  );
}

function Highlight({ region, x0, x1, y0, y1, label, className }) {
  const regions = region === undefined ? [{ x0, x1, y0, y1, label }] : Array.isArray(region) ? region : [region];
  return regions.map((r, i) => <Region key={i} r={r} className={className} />);
}

export default memo(Highlight);
