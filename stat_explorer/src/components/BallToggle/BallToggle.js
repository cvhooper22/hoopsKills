import './BallToggle.css';

// Basketball.
function Ball() {
  return (
    <svg className="ball-toggle__ball" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" className="ball-toggle__leather" />
      <g className="ball-toggle__seams" fill="none" strokeWidth="1.3" strokeLinecap="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <line x1="1" y1="12" x2="23" y2="12" />
        <path d="M4.2 4.2C8.5 8 8.5 16 4.2 19.8" />
        <path d="M19.8 4.2C15.5 8 15.5 16 19.8 19.8" />
      </g>
    </svg>
  );
}

// A two-way switch whose knob is a basketball. `checked` means the right-hand option is on.
// Clicking either label also picks that side. Give it an `ariaLabel` describing what it changes.
// `size` is 'regular' (default) or 'small'.
export default function BallToggle({ checked, onChange, leftLabel, rightLabel, ariaLabel, size = 'regular' }) {
  return (
    <div className={`ball-toggle${size === 'small' ? ' ball-toggle--small' : ''}`}>
      <button type="button" className={`ball-toggle__label${checked ? '' : ' ball-toggle__label--on'}`} onClick={() => onChange(false)}>
        {leftLabel}
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        className={`ball-toggle__track${checked ? ' ball-toggle__track--right' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="ball-toggle__knob"><Ball /></span>
      </button>
      <button type="button" className={`ball-toggle__label${checked ? ' ball-toggle__label--on' : ''}`} onClick={() => onChange(true)}>
        {rightLabel}
      </button>
    </div>
  );
}
