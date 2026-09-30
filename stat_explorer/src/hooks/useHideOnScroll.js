import { useEffect, useState } from "react";

const THRESHOLD = 12; // px of travel in one direction before the bar flips, so jitter doesn't flicker it
const REVEAL_ABOVE = 102; // never hide while still within the bar's own height of the top

// True while a fixed bar should be tucked away: hides on scroll down, returns on
// scroll up. Does nothing (always false) when `enabled` is false, e.g. above mobile
// widths. `resetKey` (such as the pathname) brings the bar back on navigation.
//
// Listens in the capture phase on `document` because scroll events don't bubble and
// the page may scroll inside a container rather than the window. Horizontal scrolls
// (the nav strip, game rows) are ignored by tracking each target's vertical offset, and
// small inner scrollers (like the open game list) are ignored by size.
export default function useHideOnScroll(enabled, resetKey) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => { setHidden(false); }, [resetKey, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const lastTop = new WeakMap();
    let anchor = 0;

    const onScroll = (e) => {
      const el = e.target;
      const isDoc = el === document;
      if (!isDoc && el.clientHeight < window.innerHeight / 2) return; // a small inner list, not the page
      const y = Math.max(0, isDoc ? window.scrollY : el.scrollTop);
      const prev = lastTop.get(el) ?? 0;
      lastTop.set(el, y);
      if (y === prev) return; // a horizontal scroll: vertical offset unchanged

      if (y <= REVEAL_ABOVE) { // also covers iOS rubber-banding past the top
        anchor = y;
        setHidden(false);
      } else if (y > anchor + THRESHOLD) {
        anchor = y;
        setHidden(true);
      } else if (y < anchor - THRESHOLD) {
        anchor = y;
        setHidden(false);
      }
    };

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [enabled]);

  return enabled && hidden;
}
