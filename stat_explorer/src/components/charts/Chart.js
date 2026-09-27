import { useId, useMemo } from "react";
import { ChartContext } from "./ChartContext";
import { createScale } from "./scales";
import useElementSize from "./useElementSize";
import "./charts.css";

const DEFAULT_MARGIN = { top: 16, right: 16, bottom: 28, left: 40 };

// Responsive SVG frame. Fills its container's width, measures it, builds the x/y scales for the
// inner plot area and shares them (plus sizes) with children through context.
// Titles, legends and tooltips are deliberately not here: the consuming component renders those
// as ordinary HTML around the chart.
//
//   <Chart height={260} margin={{ left: 48 }} x={{ domain: [600, 0] }} y={{ domain: [-8, 8] }} label="...">
//     <Band .../> <Axis orient="bottom" /> <Line .../>
//   </Chart>
export default function Chart({ height = 260, margin, x, y, label, description, className, children }) {
  const [ref, { width }] = useElementSize();
  const m = useMemo(() => ({ ...DEFAULT_MARGIN, ...margin }), [margin?.top, margin?.right, margin?.bottom, margin?.left]); // eslint-disable-line react-hooks/exhaustive-deps
  const clipId = useId();

  const innerWidth = Math.max(0, width - m.left - m.right);
  const innerHeight = Math.max(0, height - m.top - m.bottom);

  // Specs are plain objects, so key the memo on their contents, not their identity.
  const xKey = JSON.stringify(x);
  const yKey = JSON.stringify(y);
  const scales = useMemo(() => ({
    x: createScale(x, [0, innerWidth]),
    y: createScale(y, [innerHeight, 0]),
  }), [xKey, yKey, innerWidth, innerHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ width, height, innerWidth, innerHeight, margin: m, x: scales.x, y: scales.y, clipId, container: ref.current }),
    [width, height, innerWidth, innerHeight, m, scales, clipId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div ref={ref} className={`chart${className ? ` ${className}` : ""}`} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} aria-description={description}>
          <defs>
            <clipPath id={clipId}>
              <rect width={innerWidth} height={innerHeight} />
            </clipPath>
          </defs>
          <ChartContext.Provider value={value}>
            <g transform={`translate(${m.left},${m.top})`}>{children}</g>
          </ChartContext.Provider>
        </svg>
      )}
    </div>
  );
}
