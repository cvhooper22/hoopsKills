import { memo } from "react";
import { useChart } from "./ChartContext";

// A shaded rectangle in data coordinates. Leave a bound out (undefined/null) to run to the edge of
// the plot: <Band y0={-5} y1={5} /> is a full-width horizontal band, <Band x0={300} x1={0} /> a full-height one.
function Band({ x0, x1, y0, y1, className, ...svgProps }) {
  const { x, y, innerWidth, innerHeight } = useChart();
  const edges = (scale, a, b, extent) => {
    if (a == null && b == null) return [0, extent];
    const p = [a == null ? 0 : scale(a), b == null ? extent : scale(b)].sort((m, n) => m - n);
    return p;
  };
  const [left, right] = edges(x, x0, x1, innerWidth);
  const [top, bottom] = edges(y, y0, y1, innerHeight);
  return (
    <rect
      className={`chart-band${className ? ` ${className}` : ""}`}
      x={left} y={top} width={right - left} height={bottom - top}
      {...svgProps}
    />
  );
}

export default memo(Band);
