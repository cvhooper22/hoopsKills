import { useEffect, useRef, useState } from "react";

// The pixel width of an element, kept current as it resizes. Attach `ref`; `width` is `fallback` until it has been measured.
export default function useElementWidth(fallback = 0) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const update = () => setWidth(Math.floor(el.getBoundingClientRect().width) || fallback);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fallback]);
  return [ref, width];
}
