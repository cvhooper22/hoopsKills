import { memo } from "react";
import { fillSlot, useAnchor } from "./anchor";

// A point at data coordinates. Draws a circle by default (`variant` "solid" or "hollow", `r` radius).
// To draw anything else, pass `render` or a function child. It is called with { x, y, chart } (the
// pixel anchor and the chart context) and its output is drawn in a group already translated to the
// anchor, so draw around (0, 0). Plain JSX children work too.
//
//   <Marker x={t} y={m} />                                   default dot
//   <Marker x={t} y={m} variant="hollow" />
//   <Marker x={t} y={m}>{() => <Star />}</Marker>            custom shape
function Marker({ x, y, xPx, yPx, r = 5, variant = "solid", className, render, children, ...svgProps }) {
  const { px, py, chart } = useAnchor({ x, y, xPx, yPx });
  const custom = fillSlot({ render, children }, { x: px, y: py, chart });
  return (
    <g className={`chart-marker${className ? ` ${className}` : ""}`} transform={`translate(${px},${py})`} {...svgProps}>
      {custom ?? <circle className={`chart-marker__dot chart-marker__dot--${variant}`} r={r} />}
    </g>
  );
}

export default memo(Marker);
