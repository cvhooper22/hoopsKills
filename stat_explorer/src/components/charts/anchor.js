import { useChart } from "./ChartContext";
import { positionOf } from "./scales";

// Pixel position of an anchor inside the plot. Data values (x, y) go through the scales; xPx / yPx
// override them with plot pixels, or with a function of the chart for edge-relative spots:
//   yPx={(c) => c.innerHeight - 12}
export function useAnchor({ x, y, xPx, yPx }) {
  const chart = useChart();
  const resolve = (px, value, scale) => {
    if (px === undefined) return positionOf(scale, value);
    return typeof px === "function" ? px(chart) : px;
  };
  return { px: resolve(xPx, x, chart.x), py: resolve(yPx, y, chart.y), chart };
}

// A slot is filled by `render` or by function-children (both called with the context), or by plain
// JSX children (rendered as-is). Returns undefined when the caller supplied nothing, so the
// component can fall back to its default drawing.
export function fillSlot({ render, children }, ctx) {
  const fn = render ?? (typeof children === "function" ? children : null);
  if (fn) return fn(ctx);
  return children ?? undefined;
}
