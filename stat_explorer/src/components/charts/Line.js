import { memo, useMemo } from "react";
import { line } from "d3";
import { useChart } from "./ChartContext";
import { positionOf } from "./scales";

// One path from `data`. `curve` takes any d3 curve factory (curveStepAfter for step charts, etc.).
// Pass `clip` to keep the path inside the plot area. The path is memoized on data and scales, so
// re-renders that do not change them cost nothing.
//   <Line data={pts} x={(d) => d.t} y={(d) => d.margin} curve={curveStepAfter} />
function Line({ data, x, y, curve, defined, clip = false, className, ...svgProps }) {
  const chart = useChart();
  const d = useMemo(() => {
    const gen = line().x((p) => positionOf(chart.x, x(p))).y((p) => positionOf(chart.y, y(p)));
    if (curve) gen.curve(curve);
    if (defined) gen.defined(defined);
    return gen(data);
  }, [data, x, y, curve, defined, chart.x, chart.y]);

  return (
    <path
      className={`chart-line${className ? ` ${className}` : ""}`}
      d={d ?? undefined}
      clipPath={clip ? `url(#${chart.clipId})` : undefined}
      {...svgProps}
    />
  );
}

export default memo(Line);
