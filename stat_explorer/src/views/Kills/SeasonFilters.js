import { useState } from 'react';
import './SeasonFilters.css';

// Filter state lives in the URL (like Clutch's ?min=&margin=&view=) so a filtered season view can
// be shared or reloaded. Filters stack: conference + postseason leaves the conference tournament.
export const LOCATIONS = [
  { id: null, label: 'All' },
  { id: 'home', label: 'Home' },
  { id: 'away', label: 'Away' },
  { id: 'neutral', label: 'Neutral' },
];
const LAST_N = [null, 5, 10];

export function readFilters(params) {
  const loc = params.get('loc');
  const last = Number(params.get('last'));
  return {
    conferenceOnly: params.get('conf') === '1',
    postseasonOnly: params.get('post') === '1',
    location: LOCATIONS.some((l) => l.id === loc) ? loc : null,
    lastN: LAST_N.includes(last) ? last : null,
  };
}

export function activeFilterCount(f) {
  return [f.conferenceOnly, f.postseasonOnly, f.location, f.lastN].filter(Boolean).length;
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" className={`season-chip${active ? ' season-chip--active' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

// `patch` keys are URL param names; a null value clears the param.
export default function SeasonFilters({ filters, onChange }) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);
  return (
    <div className="season-filters">
      <button type="button" className="season-filters__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Filters{count ? <span className="season-filters__count">{count}</span> : null}
      </button>
      <div className={`season-filters__panel${open ? ' season-filters__panel--open' : ''}`}>
        <div className="season-filters__group" role="group" aria-label="Game type">
          <Chip active={filters.conferenceOnly} onClick={() => onChange({ conf: filters.conferenceOnly ? null : '1' })}>Conference</Chip>
          <Chip active={filters.postseasonOnly} onClick={() => onChange({ post: filters.postseasonOnly ? null : '1' })}>Postseason only</Chip>
        </div>
        <div className="season-filters__group" role="group" aria-label="Location">
          {LOCATIONS.map((l) => (
            <Chip key={l.label} active={filters.location === l.id} onClick={() => onChange({ loc: l.id })}>{l.label}</Chip>
          ))}
        </div>
        <div className="season-filters__group" role="group" aria-label="Recent games">
          {LAST_N.map((n) => (
            <Chip key={n ?? 'all'} active={filters.lastN === n} onClick={() => onChange({ last: n })}>{n ? `Last ${n}` : 'All games'}</Chip>
          ))}
        </div>
        {count > 0 && (
          <button type="button" className="season-filters__clear" onClick={() => onChange({ conf: null, post: null, loc: null, last: null })}>Clear</button>
        )}
      </div>
    </div>
  );
}
