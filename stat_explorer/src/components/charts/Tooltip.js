import { createPortal } from "react-dom";
import { useChart } from "./ChartContext";

// HTML tooltip anchored at plot pixel (x, y). It is portaled into the chart's container, so it can
// hold ordinary markup and CSS (SVG cannot), and never takes pointer events. It flips to the left of
// the anchor in the right half of the chart so it stays inside.
//   <Tooltip x={active.x} y={0}>{...markup}</Tooltip>
export default function Tooltip({ x, y = 0, offset = 12, className, children }) {
  const { container, margin, width } = useChart();
  if (!container) return null;
  const left = margin.left + x;
  const flip = left > width / 2;
  return createPortal(
    <div
      className={`chart-tooltip${className ? ` ${className}` : ""}`}
      style={{
        left,
        top: margin.top + y,
        transform: `translateX(${flip ? `calc(-100% - ${offset}px)` : `${offset}px`})`,
      }}
    >
      {children}
    </div>,
    container
  );
}
