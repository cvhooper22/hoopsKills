import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

const GAP = 6;
const EDGE = 8;

// Reusable hover/focus tooltip. CSS-styled (not the native `title` attribute)
// so it appears instantly instead of waiting on the browser's own delay, and
// so the panel can be styled/wrapped. `children` is the trigger element;
// `content` is the panel's body (a string or JSX). `align="center"` centers
// the panel under the trigger instead of hanging off its left edge — use it
// when the trigger sits mid-row and the default risks running off the edge.
// The panel is portaled to <body> and fixed-positioned so a scroll container
// or overflow:hidden ancestor (a table wrapper) can't clip it; it flips above
// the trigger when there isn't room below.
export default function Tooltip({ children, content, align = 'left', panelClassName = '' }) {
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined; }
    const place = () => {
      const t = triggerRef.current.getBoundingClientRect();
      const p = panelRef.current.getBoundingClientRect();
      let left = align === 'center' ? t.left + t.width / 2 - p.width / 2 : t.left;
      left = Math.max(EDGE, Math.min(left, window.innerWidth - p.width - EDGE));
      const below = t.bottom + GAP;
      const top = below + p.height > window.innerHeight - EDGE && t.top - GAP - p.height >= EDGE
        ? t.top - GAP - p.height
        : below;
      setPos({ left, top });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align]);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  return (
    <span
      className="tooltip"
      tabIndex={0}
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && createPortal(
        <span
          ref={panelRef}
          className={`tooltip__panel ${panelClassName}`}
          role="tooltip"
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}
        >
          {content}
        </span>,
        document.body,
      )}
    </span>
  );
}
