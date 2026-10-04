import React, { useEffect, useState } from 'react';
import { useCollection } from '../../contexts/CollectionContext';
import { itemId } from '../../utils/collection';
import './Collectable.css';

const NOTICE_MS = 2000;

// Wraps a table or stat so it can be added to the collection (see utils/collection.js
// for the descriptor shape). With the `collection` flag off, or in export mode (the
// copy being rendered on /collection), it renders its children untouched.
export default function Collectable ({ descriptor, exportMode = false, className = '', children }) {
  const { enabled, has, add, remove } = useCollection();
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  if (!enabled || exportMode) return children;

  const id = itemId(descriptor);
  const collected = has(id);

  function toggle () {
    if (collected) {
      remove(id);
      return;
    }
    const result = add(descriptor);
    if (result === 'full') setNotice('Collection is full');
  }

  const label = collected ? `Remove ${descriptor.title} from collection` : `Add ${descriptor.title} to collection`;

  return (
    <div className={`collectable${collected ? ' collectable--collected' : ''} ${className}`.trim()}>
      {children}
      <div className="collectable__controls">
        {notice && <span className="collectable__notice" role="status">{notice}</span>}
        <button
          type="button"
          className="collectable__btn"
          onClick={toggle}
          aria-pressed={collected}
          aria-label={label}
          title={label}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
            {collected ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M12 5v14M5 12h14" />}
          </svg>
        </button>
      </div>
    </div>
  );
}
