import React, { useState } from 'react';
import StatusBadge, { STATUSES } from '../../../components/StatusBadge/StatusBadge';
import XClose from '../../../components/Icons/XClose';

export const FILTERS = Object.entries(STATUSES).map(([key, s]) => ({ key, ...s }));

// OR across selected filters; nothing selected shows everyone.
export function matchesFilters(alum, selected) {
  if (!selected.length) return true;
  return selected.some((key) => alum.statuses?.includes(key));
}

// Trigger button that fans the badge filters out beside it. When closed, only
// the selected filters stay next to the trigger.
export default function BadgeFilters({ selected, onChange }) {
  const [open, setOpen] = useState(false);

  function onFilterClick(key) {
    if (!open) {
      setOpen(true);
      return;
    }
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  return (
    <div className={`badge-filters${open ? ' badge-filters--open' : ''}`} style={{ '--count': FILTERS.length }}>
      <button
        type='button'
        className='badge-filters__trigger flex-aic'
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className='badge-filters__trigger-icon' aria-hidden='true'>filter_list</span>
        Filter
      </button>
      {FILTERS.map((f, i) => {
        const isSelected = selected.includes(f.key);
        const shown = open || isSelected;
        return (
          <button
            type='button'
            key={f.key}
            className={`badge-filter${shown ? ' badge-filter--shown' : ''}${isSelected ? ' badge-filter--selected' : ''}`}
            style={{ '--i': i }}
            aria-pressed={isSelected}
            aria-label={`${f.label} filter`}
            aria-hidden={!shown}
            tabIndex={shown ? 0 : -1}
            onClick={() => onFilterClick(f.key)}
          >
            <StatusBadge label={f.label} icon={f.icon} tone={f.tone} inline />
          </button>
        );
      })}
      <button
        type='button'
        className={`badge-filter badge-filters__close flex-aic jcc${open ? ' badge-filter--shown' : ''}`}
        style={{ '--i': FILTERS.length }}
        aria-label='Close filters'
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      >
        <XClose height={16} width={16} />
      </button>
    </div>
  );
}
