import FilterPill from '../../components/FilterPill/FilterPill';
import './SeasonFilters.css';

// Each chip toggles its filter and none selected means no filter, so there is no "All" chip.
// Filter state lives in the URL (like Clutch's ?min=&margin=&view=) so a filtered season view can
// be shared or reloaded. Filters stack: conference + postseason leaves the conference tournament.
export const LOCATIONS = [
  { id: 'home', label: 'Home' },
  { id: 'away', label: 'Away' },
  { id: 'neutral', label: 'Neutral' },
];
const LAST_N = [5, 10];
export const RESULTS = [
  { id: 'W', param: 'w', label: 'Wins' },
  { id: 'L', param: 'l', label: 'Losses' },
];

export function readFilters(params) {
  const loc = params.get('loc');
  const last = Number(params.get('last'));
  const res = RESULTS.find((r) => r.param === params.get('res'));
  return {
    conferenceOnly: params.get('conf') === '1',
    postseasonOnly: params.get('post') === '1',
    location: LOCATIONS.some((l) => l.id === loc) ? loc : null,
    result: res ? res.id : null,
    lastN: LAST_N.includes(last) ? last : null,
  };
}

export function activeFilterCount(f) {
  return [f.conferenceOnly, f.postseasonOnly, f.location, f.result, f.lastN].filter(Boolean).length;
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" className={`season-chip${active ? ' season-chip--active' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

// Lives in the floating FilterPill (top right). `patch` keys are URL param names; a null value
// clears the param.
export default function SeasonFilters({ filters, onChange }) {
  const count = activeFilterCount(filters);
  const selected = [
    filters.conferenceOnly && { id: 'conf', label: 'Conference', onRemove: () => onChange({ conf: null }) },
    filters.postseasonOnly && { id: 'post', label: 'Postseason only', onRemove: () => onChange({ post: null }) },
    filters.location && { id: 'loc', label: LOCATIONS.find((l) => l.id === filters.location).label, onRemove: () => onChange({ loc: null }) },
    filters.result && { id: 'res', label: RESULTS.find((r) => r.id === filters.result).label, onRemove: () => onChange({ res: null }) },
    filters.lastN && { id: 'last', label: `Last ${filters.lastN}`, onRemove: () => onChange({ last: null }) },
  ].filter(Boolean);
  return (
    <FilterPill count={count} selected={selected} onClear={() => onChange({ conf: null, post: null, loc: null, res: null, last: null })}>
      <div className="season-filters__group" role="group" aria-label="Game type">
        <Chip active={filters.conferenceOnly} onClick={() => onChange({ conf: filters.conferenceOnly ? null : '1' })}>Conference</Chip>
        <Chip active={filters.postseasonOnly} onClick={() => onChange({ post: filters.postseasonOnly ? null : '1' })}>Postseason only</Chip>
      </div>
      <div className="season-filters__group" role="group" aria-label="Location">
        {LOCATIONS.map((l) => (
          <Chip key={l.id} active={filters.location === l.id} onClick={() => onChange({ loc: filters.location === l.id ? null : l.id })}>{l.label}</Chip>
        ))}
      </div>
      <div className="season-filters__group" role="group" aria-label="Result">
        {RESULTS.map((r) => (
          <Chip key={r.id} active={filters.result === r.id} onClick={() => onChange({ res: filters.result === r.id ? null : r.param })}>{r.label}</Chip>
        ))}
      </div>
      <div className="season-filters__group" role="group" aria-label="Recent games">
        {LAST_N.map((n) => (
          <Chip key={n} active={filters.lastN === n} onClick={() => onChange({ last: filters.lastN === n ? null : n })}>Last {n}</Chip>
        ))}
      </div>
    </FilterPill>
  );
}
