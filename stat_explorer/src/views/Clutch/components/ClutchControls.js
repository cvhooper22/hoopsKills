import { useEffect, useState } from "react";

const PRESETS = [
  { min: 5, margin: 5, tag: "NBA" },
  { min: 4, margin: 3 },
  { min: 3, margin: 5 },
  { min: 2, margin: 3 },
  { min: 1, margin: 3 },
];
const MAX_MINUTES = 20;

// Number field with - / + buttons. Text is local so it can be cleared while typing;
// only a valid number is pushed up.
function Stepper({ label, unit, value, min, max, onChange }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const step = (delta) => onChange(Math.min(max, Math.max(min, value + delta)));
  return (
    <div className="clutch-stepper">
      <span className="clutch-stepper__label">{label}</span>
      <div className="clutch-stepper__field">
        <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= min} onClick={() => step(-1)}>−</button>
        <input
          type="number" inputMode="decimal" min={min} max={max} step="any"
          aria-label={`${label} ${unit}`} value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value);
            if (n >= min && n <= max) onChange(n);
          }}
        />
        <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= max} onClick={() => step(1)}>+</button>
      </div>
      <span className="clutch-stepper__unit">{unit}</span>
    </div>
  );
}

export default function ClutchControls({ minutes, margin, onChange }) {
  return (
    <div className="clutch-controls" role="dialog" aria-label="Clutch definition">
      <p className="clutch-controls__hint">2nd half or OT only</p>
      <Stepper
        label="Last" unit="min" value={minutes} min={1} max={MAX_MINUTES}
        onChange={(m) => onChange({ min: m, margin })}
      />
      <Stepper
        label="Within" unit="pts" value={margin} min={0} max={99}
        onChange={(m) => onChange({ min: minutes, margin: Math.round(m) })}
      />
      <div className="clutch-controls__presets">
        {PRESETS.map((p) => (
          <button
            key={`${p.min}-${p.margin}`} type="button"
            className={`clutch-controls__preset${p.min === minutes && p.margin === margin ? " clutch-controls__preset--on" : ""}`}
            onClick={() => onChange({ min: p.min, margin: p.margin })}
          >
            {p.min} · {p.margin}{p.tag && <small>{p.tag}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}
