import React from 'react';
import './StatusBadge.css';

// Edit icons/colors here. Icons are Material Symbols Sharp glyph names.
export const STATUSES = {
  newTeam:  { label: 'New team', icon: 'swap_horiz',    tone: 'royal' },
  injured:  { label: 'Injured',  icon: 'healing',       tone: 'red' },   // or 'navy'
  inactive: { label: 'Inactive', icon: 'pause',         tone: 'gray' },
  retired:  { label: 'Retired',  icon: 'military_tech', tone: 'gray' },  // alt: sports_basketball, checkroom
  unsigned: { label: 'Unsigned', icon: 'edit_off',      tone: 'gray' },  // alt: person_search
};

// <StatusBadge status="injured" />  — absolutely positioned on a position:relative card.
// <StatusBadge status="retired" inline />  — for lists/legends.
export default function StatusBadge({ status, label, icon, tone, inline = false, className = '' }) {
  const s = STATUSES[status] || {};
  const text = label || s.label;
  if (!text) return null;
  const cls = ['status-badge', `status-badge--${tone || s.tone || 'gray'}`, inline && 'status-badge--inline', className].filter(Boolean).join(' ');
  return (
    <div className={cls} role="status" aria-label={`Status: ${text}`}>
      <span className="status-badge__edge">
        <span className="status-badge__body">
          <span className="status-badge__icon" aria-hidden="true">{icon || s.icon}</span>
          <span className="status-badge__label">{text}</span>
        </span>
      </span>
      <span className="status-badge__curl" aria-hidden="true"></span>
    </div>
  );
}
