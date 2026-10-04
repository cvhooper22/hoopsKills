import React, { useEffect, useMemo, useRef, useState } from 'react';
import StatusBadge, { STATUSES } from '../../../components/StatusBadge/StatusBadge';
import XClose from '../../../components/Icons/XClose';
import { EMPTY_FILTERS, divisionOptions, hasAnyFilter, regionOptions, toggleValue } from '../../../utils/alumniFilters';

const STATUS_FILTERS = Object.entries(STATUSES).map(([key, s]) => ({ key, ...s }));

// Hover-out grace period so crossing the gap between a group and its options doesn't close it.
const HOVER_CLOSE_MS = 150;

// One drop-down group. Its options slide out to the right of the label.
function FilterGroup({ index, id, label, options, selected, isOpen, panelOpen, onLabelClick, onHover, onLeave, onPick }) {
  const visible = panelOpen;
  return (
    <div
      className={`filter-group${visible ? ' filter-group--shown' : ''}${isOpen ? ' filter-group--open' : ''}`}
      style={{ '--g': index }}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(id)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onLeave(id)}
      data-filter-group={id}
    >
      <button
        type='button'
        className={`filter-group__label${selected.length ? ' filter-group__label--active' : ''}`}
        aria-expanded={isOpen}
        aria-controls={`filter-options-${id}`}
        tabIndex={visible ? 0 : -1}
        onPointerDown={(e) => onLabelClick.remember(e.pointerType)}
        onClick={() => onLabelClick(id)}
      >
        {label}
        {selected.length > 0 && <span className='filter-group__count'>{selected.length}</span>}
        <span className='filter-group__chevron' aria-hidden='true' />
      </button>
      <div className='filter-group__options' id={`filter-options-${id}`} aria-hidden={!isOpen}>
        {options.map((o) => {
          const isSelected = selected.includes(o.key);
          return (
            <button
              type='button'
              key={o.key}
              className={`filter-option${isSelected ? ' filter-option--selected' : ''}`}
              aria-pressed={isSelected}
              tabIndex={isOpen ? 0 : -1}
              onClick={() => onPick(o.key)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A "Filter" trigger that opens two layers: the status badges fan out to its right, and the
// Division / Geo groups drop down beneath it. A group's options open to its side on hover
// (tap on touch), one group at a time. Collapsed, whatever is selected stays beside the trigger.
// `selected` is { statuses, divisions, regions } (see utils/alumniFilters.js).
export default function AlumniFilters({ alum, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const rootRef = useRef(null);
  const closeTimer = useRef(null);
  const lastPointer = useRef(null);

  const groups = useMemo(() => [
    { id: 'divisions', label: 'Division', options: divisionOptions(alum ?? []) },
    { id: 'regions', label: 'Geo', options: regionOptions(alum ?? []) },
  ].filter((g) => g.options.length), [alum]);

  const labelFor = (groupId, key) => groups.find((g) => g.id === groupId)?.options.find((o) => o.key === key)?.label ?? key;
  const selectedChips = groups.flatMap((g) => selected[g.id].map((key) => ({ groupId: g.id, key })));

  function closeAll() {
    setOpen(false);
    setOpenGroup(null);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      // The scrim closes things itself (group first, then the panel), so skip it here.
      if (!e.target.closest?.('[data-filter-group], .alumni-filters__scrim')) setOpenGroup(null);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (openGroup) setOpenGroup(null);
      else setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, openGroup]);

  function onStatusClick(key) {
    if (!open) {
      setOpen(true);
      return;
    }
    onChange({ ...selected, statuses: toggleValue(selected.statuses, key) });
  }

  function hoverGroup(id) {
    clearTimeout(closeTimer.current);
    setOpenGroup(id);
  }

  function leaveGroup(id) {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenGroup((cur) => (cur === id ? null : cur)), HOVER_CLOSE_MS);
  }

  // A mouse click on a label that hover already opened must not toggle it shut again;
  // touch has no hover, so there a tap toggles.
  function clickGroupLabel(id) {
    const viaMouse = lastPointer.current === 'mouse';
    lastPointer.current = null;
    if (viaMouse && openGroup === id) return;
    setOpenGroup(openGroup === id ? null : id);
  }
  clickGroupLabel.remember = (pointerType) => { lastPointer.current = pointerType; };

  return (
    <div className='alumni-filters' ref={rootRef}>
      <div
        className={`alumni-filters__scrim${open ? ' alumni-filters__scrim--shown' : ''}`}
        aria-hidden='true'
        onClick={() => (openGroup ? setOpenGroup(null) : setOpen(false))}
      />
      <div className={`badge-filters${open ? ' badge-filters--open' : ''}`} style={{ '--count': STATUS_FILTERS.length }}>
        <button
          type='button'
          className='badge-filters__trigger flex-aic'
          aria-expanded={open}
          onClick={() => (open ? closeAll() : setOpen(true))}
        >
          <span className='badge-filters__trigger-icon' aria-hidden='true'>filter_list</span>
          Filter
        </button>
        {STATUS_FILTERS.map((f, i) => {
          const isSelected = selected.statuses.includes(f.key);
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
              onClick={() => onStatusClick(f.key)}
            >
              <StatusBadge label={f.label} icon={f.icon} tone={f.tone} inline />
            </button>
          );
        })}
        {!open && selectedChips.map((c) => (
          <button
            type='button'
            key={`${c.groupId}:${c.key}`}
            className='filter-option filter-chip'
            aria-label={`${labelFor(c.groupId, c.key)} filter, selected. Open filters`}
            onClick={() => setOpen(true)}
          >
            {labelFor(c.groupId, c.key)}
          </button>
        ))}
        <button
          type='button'
          className={`badge-filter badge-filters__close flex-aic jcc${open ? ' badge-filter--shown' : ''}`}
          style={{ '--i': STATUS_FILTERS.length }}
          aria-label='Close filters'
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          onClick={closeAll}
        >
          <XClose height={16} width={16} />
        </button>
        {!open && hasAnyFilter(selected) && (
          <button type='button' className='filter-clear' onClick={() => onChange(EMPTY_FILTERS)}>
            Clear all
          </button>
        )}
      </div>
      <div className={`filter-groups${open ? ' filter-groups--open' : ''}`}>
        {groups.map((g, i) => (
          <FilterGroup
            key={g.id}
            index={i}
            id={g.id}
            label={g.label}
            options={g.options}
            selected={selected[g.id]}
            isOpen={openGroup === g.id}
            panelOpen={open}
            onLabelClick={clickGroupLabel}
            onHover={hoverGroup}
            onLeave={leaveGroup}
            onPick={(key) => onChange({ ...selected, [g.id]: toggleValue(selected[g.id], key) })}
          />
        ))}
      </div>
    </div>
  );
}
