import { useId } from "react";
import useElementSize from "./useElementSize";

// An old-timey stopwatch drawn around a chart: crown and ring on top, a plunger at 10 o'clock, a
// silver case, a tick bezel and a white dial. Put a chart in it and the chart appears on the dial.
//
//   <StopwatchFrame className="my-watch">
//     {({ size }) => <Chart height={size} ...><Donut .../></Chart>}
//   </StopwatchFrame>
//
// children   JSX, or a function called with { size }: the dial's side in px, so a chart can size
//            itself to fit (the dial is square). The frame fills its container's width; cap it in
//            CSS (max-width) from the className, which is added to the outer element.
// The drawing is plain SVG with class names (stopwatch__case, __dial, __tick ...), so a stylesheet
// can restyle it.
const W = 300;
const H = 380;
const C = { x: 150, y: 235 };   // center of the case
const CASE_R = 128;
const DIAL_R = 108;
const DIAL_FIT = 94;            // radius of the square area handed to the chart: inside the ticks

const ticks = Array.from({ length: 60 }, (_, i) => {
  const major = i % 5 === 0;
  const a = (i / 60) * Math.PI * 2;
  const r1 = DIAL_R - 3;
  const r2 = DIAL_R - (major ? 12 : 7);
  return { i, major, x1: C.x + Math.sin(a) * r1, y1: C.y - Math.cos(a) * r1, x2: C.x + Math.sin(a) * r2, y2: C.y - Math.cos(a) * r2 };
});

export default function StopwatchFrame({ className, children }) {
  const [ref, { width }] = useElementSize();
  const gid = useId();
  const scale = width / W;
  const size = DIAL_FIT * 2 * scale;

  return (
    <div ref={ref} className={`stopwatch${className ? ` ${className}` : ""}`} style={{ aspectRatio: `${W} / ${H}` }}>
      <svg className="stopwatch__svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <linearGradient id={`${gid}-metal`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4f6f8" />
            <stop offset="0.45" stopColor="#c3c9cf" />
            <stop offset="0.7" stopColor="#eef0f2" />
            <stop offset="1" stopColor="#9aa1a8" />
          </linearGradient>
          <linearGradient id={`${gid}-knurl`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8d949b" />
            <stop offset="0.5" stopColor="#f1f3f5" />
            <stop offset="1" stopColor="#8d949b" />
          </linearGradient>
        </defs>

        {/* plunger at 10 o'clock: drawn pointing up, then swung around the case */}
        <g transform={`rotate(-50 ${C.x} ${C.y})`}>
          <rect className="stopwatch__metal" x={C.x - 8} y={C.y - CASE_R - 18} width="16" height="24" rx="2" fill={`url(#${gid}-knurl)`} />
          <rect className="stopwatch__metal" x={C.x - 11} y={C.y - CASE_R - 30} width="22" height="16" rx="3" fill={`url(#${gid}-knurl)`} />
        </g>

        {/* crown, stem and ring */}
        <circle className="stopwatch__ring" cx={C.x} cy="36" r="23" fill="none" strokeWidth="5" />
        <rect className="stopwatch__metal" x={C.x - 10} y="78" width="20" height="32" fill={`url(#${gid}-knurl)`} />
        <rect className="stopwatch__metal" x={C.x - 20} y="50" width="40" height="32" rx="4" fill={`url(#${gid}-knurl)`} />
        {Array.from({ length: 7 }, (_, i) => (
          <line key={i} className="stopwatch__knurl" x1={C.x - 15 + i * 5} y1="54" x2={C.x - 15 + i * 5} y2="78" />
        ))}

        {/* case, bezel, dial, ticks */}
        <circle className="stopwatch__case" cx={C.x} cy={C.y} r={CASE_R} fill={`url(#${gid}-metal)`} />
        <circle className="stopwatch__bezel" cx={C.x} cy={C.y} r={CASE_R - 9} fill="none" />
        <circle className="stopwatch__dial" cx={C.x} cy={C.y} r={DIAL_R} />
        {ticks.map((t) => (
          <line key={t.i} className={`stopwatch__tick${t.major ? " stopwatch__tick--major" : ""}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
        ))}
      </svg>

      <div
        className="stopwatch__face"
        style={{
          left: `${((C.x - DIAL_FIT) / W) * 100}%`,
          top: `${((C.y - DIAL_FIT) / H) * 100}%`,
          width: `${((DIAL_FIT * 2) / W) * 100}%`,
          height: `${((DIAL_FIT * 2) / H) * 100}%`,
        }}
      >
        {width > 0 && (typeof children === "function" ? children({ size }) : children)}
      </div>
    </div>
  );
}
