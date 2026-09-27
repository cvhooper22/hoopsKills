import { memo } from "react";
import { fillSlot, useAnchor } from "./anchor";

// A label attached to a point at data coordinates. `dx` / `dy` offset the label from the anchor, and
// `connector` draws a line from the anchor to it. The default drawing is `label` as text; to draw
// anything else, pass `render` or a function child. It is called with
// { x, y, dx, dy, chart } and its output is drawn in a group translated to the anchor.
//
//   <Annotation x={t} y={m} dx={10} dy={-14} connector label="Dagger" />
//   <Annotation x={t} yPx={(c) => c.innerHeight - 10}>{() => <Badge n={1} />}</Annotation>
function Annotation({
  x, y, xPx, yPx, dx = 0, dy = 0, label, textAnchor = "middle", connector = false, className, render, children, ...svgProps
}) {
  const { px, py, chart } = useAnchor({ x, y, xPx, yPx });
  const custom = fillSlot({ render, children }, { x: px, y: py, dx, dy, chart });
  return (
    <g className={`chart-annotation${className ? ` ${className}` : ""}`} transform={`translate(${px},${py})`} {...svgProps}>
      {connector && <line className="chart-annotation__connector" x1={0} y1={0} x2={dx} y2={dy} />}
      {custom ?? <text className="chart-annotation__text" x={dx} y={dy} textAnchor={textAnchor} dominantBaseline="middle">{label}</text>}
    </g>
  );
}

export default memo(Annotation);
