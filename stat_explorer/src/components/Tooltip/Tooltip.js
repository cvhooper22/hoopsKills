import './Tooltip.css';

// Reusable hover/focus tooltip. CSS-driven (not the native `title` attribute)
// so it appears instantly instead of waiting on the browser's own delay, and
// so the panel can be styled/wrapped. `children` is the trigger element;
// `content` is the panel's body (a string or JSX). `align="center"` centers
// the panel under the trigger instead of hanging off its left edge — use it
// when the trigger sits mid-row and the default risks running off the edge.
export default function Tooltip({ children, content, align = 'left', panelClassName = '' }) {
  return (
    <span className="tooltip" tabIndex={0}>
      {children}
      <span
        className={`tooltip__panel ${align === 'center' ? 'tooltip__panel--center' : ''} ${panelClassName}`}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}
