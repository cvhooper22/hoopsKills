import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fillSlot } from "./anchor";
import { useChart } from "./ChartContext";
import { nearestIndex } from "./nearest";
import { positionOf } from "./scales";
import Tooltip from "./Tooltip";

// Pointer, touch and keyboard scrubbing over a series. Put it LAST inside <Chart> so it sits on top.
// It snaps to a datum in `data` (sorted along the x axis, either direction), draws a crosshair, and
// can show a tooltip. Only the layer re-renders as the pointer moves, and only when the snapped
// datum changes.
//
//   <HoverLayer
//     data={points} x={(d) => d.t} y={(d) => d.margin}
//     tooltip={({ datum }) => <div>...</div>}          // HTML, rendered in a Tooltip
//     describe={(d) => "4:10 left, BYU 61-59"}          // announced to screen readers
//     onActiveChange={(active) => ...}                  // { index, datum, x, y, pointerType } | null
//   />
//
// Touch is sticky, mouse is hover. That is decided per event from pointerType, not from any device
// sniffing, so hybrid devices behave correctly: a touch selects a point and it STAYS after the
// finger lifts (a scroll gesture does not clear it), and it clears on a tap on the same point, a tap
// outside the chart, or Escape. A mouse selects while it hovers and clears when it leaves.
//
// A finger covers a tooltip drawn beside the point, so `tooltipOnTouch={false}` skips the floating
// tooltip for touch; the consumer then shows the selection itself (for example as a readout line
// above the chart) from onActiveChange.
//
// Draws a vertical line and a dot by default; pass `render` / a function child to draw your own
// (called with { active, chart }), or crosshair={false} for none.
export default function HoverLayer({
  data, x, y, mode = "nearest", crosshair = true, tooltip, tooltipOnTouch = true, describe, onActiveChange,
  label = "Chart values", render, children,
}) {
  const chart = useChart();
  const { innerWidth, innerHeight, container } = chart;
  const [selection, setSelection] = useState({ index: -1, type: "mouse" });
  const selectionRef = useRef(selection);
  const emitRef = useRef(onActiveChange);
  emitRef.current = onActiveChange;

  const pixelOf = useCallback((d) => positionOf(chart.x, x(d)), [chart.x, x]);
  const ascending = data.length < 2 || pixelOf(data[0]) <= pixelOf(data[data.length - 1]);

  const select = useCallback((index, type) => {
    const prev = selectionRef.current;
    if (index === prev.index && type === prev.type) return;
    selectionRef.current = { index, type };
    setSelection(selectionRef.current);
  }, []);
  const clear = useCallback(() => select(-1, selectionRef.current.type), [select]);

  // clear when the data or scales change under an active index
  useEffect(() => { clear(); }, [data, chart.x, clear]);

  const { index: activeIndex, type: pointerType } = selection;
  const active = useMemo(() => {
    const datum = data[activeIndex];
    if (!datum) return null;
    return { index: activeIndex, datum, x: pixelOf(datum), y: y ? positionOf(chart.y, y(datum)) : null, pointerType };
  }, [data, activeIndex, pointerType, pixelOf, y, chart.y]);

  useEffect(() => {
    emitRef.current?.(active);
  }, [active]);

  // a touch selection has no "leave", so a tap anywhere outside the chart dismisses it
  const touching = active?.pointerType === "touch";
  useEffect(() => {
    if (!touching || !container) return undefined;
    const onOutside = (e) => { if (!container.contains(e.target)) clear(); };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [touching, container, clear]);

  const indexAt = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return nearestIndex(data, pixelOf, e.clientX - rect.left, mode);
  };
  const onPointerDown = (e) => {
    const index = indexAt(e);
    const cur = selectionRef.current;
    // tapping the point that is already selected toggles it off
    if (e.pointerType === "touch" && cur.type === "touch" && cur.index === index) select(-1, "touch");
    else select(index, e.pointerType);
  };
  const onPointerMove = (e) => select(indexAt(e), e.pointerType);
  // touch has no hover: lifting the finger or a scroll gesture must not dismiss the selection
  const onLeave = (e) => { if (e.pointerType !== "touch") clear(); };

  const onKeyDown = (e) => {
    const last = data.length - 1;
    const current = selectionRef.current.index;
    const step = { ArrowRight: ascending ? 1 : -1, ArrowLeft: ascending ? -1 : 1 }[e.key];
    if (step) select(Math.min(last, Math.max(0, (current < 0 ? (step > 0 ? -1 : last + 1) : current) + step)), "keyboard");
    else if (e.key === "Home") select(ascending ? 0 : last, "keyboard");
    else if (e.key === "End") select(ascending ? last : 0, "keyboard");
    else if (e.key === "Escape") clear();
    else return;
    e.preventDefault();
  };

  const cursor = active && fillSlot({ render, children }, { active, chart });
  const showTooltip = active && tooltip && (tooltipOnTouch || !touching);

  return (
    <g
      className="chart-hover" tabIndex={0} role="group" aria-label={label}
      onKeyDown={onKeyDown}
      onFocus={() => { if (selectionRef.current.index < 0 && data.length) select(ascending ? 0 : data.length - 1, "keyboard"); }}
      onBlur={() => { if (selectionRef.current.type === "keyboard") clear(); }}
    >
      <rect className="chart-hover__frame" width={innerWidth} height={innerHeight} />
      {active && crosshair && (cursor ?? (
        <g className="chart-hover__cursor">
          <line x1={active.x} x2={active.x} y1={0} y2={innerHeight} />
          {active.y != null && <circle cx={active.x} cy={active.y} r={4.5} />}
        </g>
      ))}
      {active && !crosshair && cursor}
      <rect
        className="chart-hover__surface" width={innerWidth} height={innerHeight}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerLeave={onLeave} onPointerCancel={onLeave}
      />
      {showTooltip && <Tooltip x={active.x}>{tooltip(active)}</Tooltip>}
      {describe && (
        <Tooltip x={0} className="chart-tooltip--sr"><span aria-live="polite">{active ? describe(active.datum) : ""}</span></Tooltip>
      )}
    </g>
  );
}
