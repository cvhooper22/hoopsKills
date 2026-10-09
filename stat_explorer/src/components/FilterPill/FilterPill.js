import { useEffect, useRef, useState } from 'react';
import Filters from '../Icons/Filters';
import './FilterPill.css';

// Floating filters button, fixed to the top right like the game pill is at the top left. Icon only;
// it opens a panel with whatever you pass as children and closes on an outside click or Escape.
// A view owns its own filter state: pass `count` (how many are active) to badge the icon, and
// `onClear` to show a "Clear" link in the panel. `selected` is the list of active filters as
// `{ id, label, onRemove }`: they render as removable chips beside the button on wider screens and
// as a bar fixed to the bottom on phones.
export default function FilterPill({ count = 0, onClear, selected = [], label = 'Filters', children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`filter-pill${open ? ' filter-pill--open' : ''}`} ref={rootRef}>
      <div className="filter-pill__row">
      {selected.length > 0 && (
        <div className="filter-pill__selected" role="group" aria-label={`Active ${label.toLowerCase()}`}>
          <div className="filter-pill__chips">
            {selected.map((f) => (
              <button key={f.id} type="button" className="filter-pill__chip" aria-label={`Remove ${f.label}`} onClick={f.onRemove}>
                {f.label}<span aria-hidden="true" className="filter-pill__chip-x">×</span>
              </button>
            ))}
          </div>
          {onClear && <button type="button" className="filter-pill__bar-clear" onClick={onClear}>Clear</button>}
        </div>
      )}
      <button
        type="button"
        className="filter-pill__button"
        aria-label={count ? `${label} (${count} active)` : label}
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        <Filters />
        {count > 0 && <span className="filter-pill__count">{count}</span>}
      </button>
      </div>
      <div className="filter-pill__panel" role="group" aria-label={label} aria-hidden={!open}>
        <div className="filter-pill__panel-inner">
          {children}
          {count > 0 && onClear && (
            <button type="button" className="filter-pill__clear" tabIndex={open ? 0 : -1} onClick={onClear}>Clear</button>
          )}
        </div>
      </div>
    </div>
  );
}
