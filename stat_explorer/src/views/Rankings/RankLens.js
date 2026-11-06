import { useEffect, useRef } from 'react';
import { PARTS } from '../../utils/rankingsTimeline';

const DESCRIPTIONS = {
  overall: 'Overall rank in each rating system',
  off: 'Offensive efficiency rank',
  def: 'Defensive efficiency rank',
};
const labelOf = (part) => PARTS.find((p) => p.key === part).label;

// The column title with its rank type underneath: a stepper at desktop widths, a button that opens RankLensSheet on a phone.
// The switch between the two is CSS only (see RankingsTimeline.css), so both are rendered.
export function RankLensHeader({ title, part, onChange, onOpenSheet }) {
  const i = PARTS.findIndex((p) => p.key === part);
  const step = (d) => onChange(PARTS[(i + d + PARTS.length) % PARTS.length].key);
  const label = labelOf(part);
  return (
    <div className="rk-lens">
      <span className="rk-lens__title">{title}</span>
      <div className="rk-lens__stepper" role="group" aria-label="Rank type">
        <button type="button" className="rk-lens__step" aria-label="Previous rank type" onClick={() => step(-1)}><span className="rk-lens__arrow rk-lens__arrow--prev" aria-hidden="true" /></button>
        <span className="rk-lens__current" aria-live="polite">
          {label}
          <span className="rk-lens__pips" aria-hidden="true">{PARTS.map((p) => <i key={p.key} className={p.key === part ? 'rk-lens__pip--on' : ''} />)}</span>
        </span>
        <button type="button" className="rk-lens__step" aria-label="Next rank type" onClick={() => step(1)}><span className="rk-lens__arrow rk-lens__arrow--next" aria-hidden="true" /></button>
      </div>
      <button type="button" className="rk-lens__menu" aria-haspopup="dialog" aria-label={`Rank type: ${label}. Change`} onClick={(e) => onOpenSheet(e.currentTarget)}>
        {label}<span className="rk-lens__chev" aria-hidden="true" />
      </button>
    </div>
  );
}

// Phone-width picker for the same setting, rendered once for the whole table. Hidden at desktop widths by CSS.
export function RankLensSheet({ part, onChange, onClose, opener }) {
  const selected = useRef(null);
  useEffect(() => {
    if (selected.current) selected.current.focus();
    return () => { if (opener && opener.focus) opener.focus(); };
  }, [opener]);
  return (
    <div className="rk-sheet" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <button type="button" className="rk-sheet__scrim" tabIndex={-1} aria-label="Close rank type" onClick={onClose} />
      <div className="rk-sheet__panel" role="dialog" aria-modal="true" aria-label="Rank type">
        <div className="rk-sheet__head">
          <h3>Rank type</h3>
          <button type="button" className="rk-sheet__close" aria-label="Close" onClick={onClose}><span aria-hidden="true" /></button>
        </div>
        <div role="radiogroup" aria-label="Rank type">
          {PARTS.map((p) => (
            <button key={p.key} type="button" role="radio" aria-checked={p.key === part} ref={p.key === part ? selected : null}
              className={`rk-sheet__row${p.key === part ? ' rk-sheet__row--on' : ''}`}
              onClick={() => { onChange(p.key); onClose(); }}>
              <span className="rk-sheet__radio" aria-hidden="true" />
              <span className="rk-sheet__text"><b>{p.label}</b><small>{DESCRIPTIONS[p.key]}</small></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const rankTypeLabel = labelOf;
