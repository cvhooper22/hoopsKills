import { useEffect, useState } from "react";

// Live result of a CSS media query, for layout decisions such as (hover: none) or (pointer: coarse).
// For behavior that depends on how someone is interacting right now, prefer the event's pointerType.
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}
