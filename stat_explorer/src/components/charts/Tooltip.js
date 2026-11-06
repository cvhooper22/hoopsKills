import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useChart } from "./ChartContext";

const EDGE = 8; // px kept between the tooltip and the edge of the screen

// HTML tooltip anchored at plot pixel (x, y). It is portaled into the chart's container, so it can
// hold ordinary markup and CSS (SVG cannot), and never takes pointer events. It starts on the right of
// the anchor, flips to the left in the right half of the chart, then is nudged so it never runs off the
// screen (a phone is narrower than a tooltip beside an anchor near the middle).
//   <Tooltip x={active.x} y={0}>{...markup}</Tooltip>
export default function Tooltip({ x, y = 0, offset = 12, className, children }) {
  const { container, margin, width } = useChart();
  const ref = useRef(null);
  const [shift, setShift] = useState({ dx: 0, dy: 0 });

  // Measure where it landed without the current nudge, then keep it inside the visible screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const left = r.left - shift.dx, top = r.top - shift.dy;
    const dx = Math.max(EDGE - left, Math.min(0, vw - EDGE - (left + r.width)));
    const dy = Math.max(EDGE - top, Math.min(0, vh - EDGE - (top + r.height)));
    if (Math.abs(dx - shift.dx) > 0.5 || Math.abs(dy - shift.dy) > 0.5) setShift({ dx, dy });
  });

  if (!container) return null;
  const left = margin.left + x;
  const flip = left > width / 2;
  return createPortal(
    <div
      ref={ref}
      className={`chart-tooltip${className ? ` ${className}` : ""}`}
      style={{
        left,
        top: margin.top + y,
        transform: `translate(${shift.dx}px, ${shift.dy}px) translateX(${flip ? `calc(-100% - ${offset}px)` : `${offset}px`})`,
      }}
    >
      {children}
    </div>,
    container
  );
}
