import { memo, useMemo } from "react";
import { area } from "d3";
import { useChart } from "./ChartContext";
import { positionOf } from "./scales";

// A filled band between two values per datum (a min/max envelope, an interval). `y0` and `y1` give the two edges in data
// units, so the band can run in either direction; use `defined` to leave gaps where there is no value. `curve` takes any
// d3 curve factory. Like Line, the path is memoized on data and scales, and `clip` keeps it inside the plot.
//   <Area data={pts} x={(d) => d.t} y0={(d) => d.min} y1={(d) => d.max} defined={(d) => d.min != null} />
function Area({ data, x, y0, y1, curve, defined, clip = false, className, ...svgProps }) {
  const chart = useChart();
  const d = useMemo(() => {
    const gen = area().x((p) => positionOf(chart.x, x(p))).y0((p) => positionOf(chart.y, y0(p))).y1((p) => positionOf(chart.y, y1(p)));
    if (curve) gen.curve(curve);
    if (defined) gen.defined(defined);
    return gen(data);
  }, [data, x, y0, y1, curve, defined, chart.x, chart.y]);

  return (
    <path
      className={`chart-area${className ? ` ${className}` : ""}`}
      d={d ?? undefined}
      clipPath={clip ? `url(#${chart.clipId})` : undefined}
      {...svgProps}
    />
  );
}

export default memo(Area);
