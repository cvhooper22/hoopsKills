import { createContext, useContext } from "react";

export const ChartContext = createContext(null);

// { width, height, innerWidth, innerHeight, margin, x, y, clipId, container }
// container is the chart's wrapping <div> (position: relative), the mount point for HTML overlays.
export function useChart() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("Chart parts must be rendered inside <Chart>");
  return ctx;
}
