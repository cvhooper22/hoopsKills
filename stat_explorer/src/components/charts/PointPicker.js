import { useEffect, useMemo, useRef, useState } from "react";
import { useChart } from "./ChartContext";
import Tooltip from "./Tooltip";

// Hover / touch picking over loose points (scatter, event markers), where HoverLayer's "nearest along x"
// is wrong because points can share an x. Put it LAST inside <Chart> so it sits on top.
//
// `points` are in PLOT PIXELS ({ key, x, y, ...anything }), so the caller can lay them out (jitter,
// lanes) with the scales from useChart() before passing them in. The pointer picks the closest point
// within `radius` px (`touchRadius` for a finger).
//
//   <PointPicker
//     points={pts}
//     render={(p, { active }) => <circle r={active ? 7 : 5} />}   // drawn in a group translated to the point
//     tooltip={(p) => <div>...</div>}                              // HTML, rendered in a Tooltip
//     onActiveChange={(p | null) => ...}
//   />
//
// Same touch rules as HoverLayer: mouse selects while it hovers; a touch selection STAYS after the finger
// lifts and clears on a second tap on it, a tap elsewhere, or Escape. Vertical swipes still scroll the page.
export default function PointPicker({ points, render, tooltip, radius = 12, touchRadius = 22, label = "Chart points", onActiveChange }) {
  const { innerWidth, innerHeight, container } = useChart();
  const [sel, setSel] = useState({ key: null, type: "mouse" });
  const emitRef = useRef(onActiveChange);
  emitRef.current = onActiveChange;

  const active = useMemo(() => points.find((p) => p.key === sel.key) ?? null, [points, sel.key]);
  useEffect(() => { emitRef.current?.(active); }, [active]);

  const touching = active && sel.type === "touch";
  useEffect(() => {
    if (!touching || !container) return undefined;
    const onOutside = (e) => { if (!container.contains(e.target)) setSel((s) => ({ ...s, key: null })); };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [touching, container]);

  const pick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const reach = e.pointerType === "touch" ? touchRadius : radius;
    let best = null;
    let bestD = reach * reach;
    for (const p of points) {
      const d = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (d <= bestD) { best = p; bestD = d; }
    }
    return best;
  };
  const onPointerDown = (e) => {
    const p = pick(e);
    if (e.pointerType === "touch" && p && sel.type === "touch" && sel.key === p.key) setSel({ key: null, type: "touch" });
    else setSel({ key: p ? p.key : null, type: e.pointerType });
  };
  const onPointerMove = (e) => {
    if (e.pointerType === "touch") return; // a drag is a scroll, not a selection
    const p = pick(e);
    const key = p ? p.key : null;
    if (key !== sel.key) setSel({ key, type: e.pointerType });
  };
  const onLeave = (e) => { if (e.pointerType !== "touch") setSel((s) => (s.key === null ? s : { ...s, key: null })); };

  return (
    <g className="chart-picker" role="group" aria-label={label} onKeyDown={(e) => e.key === "Escape" && setSel((s) => ({ ...s, key: null }))}>
      <g pointerEvents="none">
        {points.map((p) => (p === active ? null : <g key={p.key} transform={`translate(${p.x},${p.y})`}>{render(p, { active: false })}</g>))}
        {active && <g transform={`translate(${active.x},${active.y})`}>{render(active, { active: true })}</g>}
      </g>
      <rect
        className="chart-picker__surface" width={innerWidth} height={innerHeight}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerLeave={onLeave} onPointerCancel={onLeave}
      />
      {active && tooltip && <Tooltip x={active.x} y={active.y} offset={14}>{tooltip(active)}</Tooltip>}
    </g>
  );
}
