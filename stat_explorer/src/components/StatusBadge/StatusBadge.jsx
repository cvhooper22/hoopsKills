import React from 'react';
import './StatusBadge.css';

// Edit icons/colors here. Icons are Material Symbols Sharp glyph names; a new
// icon must also be added to the icon_names list in public/index.html.
// These are the values an alum's `statuses` array can hold (independent of
// `inactive`, which only controls the Active tab). Key order is the order
// badges stack on the card and appear in the editor.
export const STATUSES = {
  updateSoon: { label: 'Update soon', icon: 'hourglass_top', tone: 'navy' },
  injured:    { label: 'Injured',     icon: 'healing',       tone: 'red' },
  retired:    { label: 'Retired',     icon: 'military_tech', tone: 'gray' },  // alt: sports_basketball, checkroom
  unsigned:   { label: 'Unsigned',    icon: 'edit_off',      tone: 'gray' },  // alt: person_search
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
