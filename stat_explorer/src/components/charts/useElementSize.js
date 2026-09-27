import { useEffect, useRef, useState } from "react";

// Tracks an element's content box. Updates are batched to one per animation frame and skipped
// when the size did not change, so window drags do not flood React with renders.
export default function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { width, height } = entry.contentRect;
        setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return [ref, size];
}
