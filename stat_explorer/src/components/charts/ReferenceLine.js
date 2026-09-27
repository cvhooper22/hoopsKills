import { memo } from "react";
import { useChart } from "./ChartContext";

// A line at a data value across the whole plot: pass `x` for a vertical line, `y` for a horizontal
// one. `label` (optional) is drawn beside the line; `labelOffset` nudges it.
function ReferenceLine({ x, y, label, labelOffset = 6, className }) {
  const chart = useChart();
  const vertical = x !== undefined;
  const pos = vertical ? chart.x(x) : chart.y(y);
  const cls = `chart-refline${className ? ` ${className}` : ""}`;
  return (
    <g className={cls}>
      {vertical
        ? <line x1={pos} x2={pos} y1={0} y2={chart.innerHeight} />
        : <line y1={pos} y2={pos} x1={0} x2={chart.innerWidth} />}
      {label && (vertical
        ? <text className="chart-refline__label" x={pos + labelOffset} y={labelOffset + 6}>{label}</text>
        : <text className="chart-refline__label" x={labelOffset} y={pos - labelOffset}>{label}</text>)}
    </g>
  );
}

export default memo(ReferenceLine);
