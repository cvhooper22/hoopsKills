import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { COLLECTION } from '../constants/featureFlags';
import { useFlag } from './FeatureFlagsContext';
import {
  COLLECTION_STORAGE_KEY,
  MAX_ITEMS,
  collectionReducer,
  createItem,
  deserializeCollection,
  serializeCollection,
} from '../utils/collection';
import { getStorageItem, setStorageItem } from '../utils/localStorage';

const INERT = {
  enabled: false,
  items: [],
  count: 0,
  has: () => false,
  add: () => 'disabled',
  remove: () => {},
  clear: () => {},
};

export const CollectionContext = createContext(INERT);

// The cart lives in localStorage on this device only. While the `collection` flag is off
// the provider is inert: it never reads or writes storage and exposes an empty cart.
export function CollectionProvider ({ children }) {
  const enabled = useFlag(COLLECTION);
  const [items, setItems] = useState([]);
  // Latest cart, updated synchronously so back-to-back actions in one tick don't see stale state.
  const itemsRef = useRef(items);

  const replace = useCallback((next) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  // Storage is written here, per user action, rather than from an effect: an effect would
  // fire on the initial empty cart and overwrite whatever was saved before we loaded it.
  const commit = useCallback((action) => {
    const next = collectionReducer(itemsRef.current, action);
    if (next === itemsRef.current) return;
    replace(next);
    setStorageItem(COLLECTION_STORAGE_KEY, serializeCollection(next));
  }, [replace]);

  useEffect(() => {
    if (!enabled) {
      replace([]);
      return undefined;
    }
    replace(deserializeCollection(getStorageItem(COLLECTION_STORAGE_KEY)));
    // Keep other open tabs in step.
    const onStorage = (e) => {
      if (e.key === COLLECTION_STORAGE_KEY || e.key === null) {
        replace(deserializeCollection(e.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [enabled, replace]);

  // Returns 'added' | 'updated' | 'full' | 'invalid' | 'disabled' so callers can show feedback.
  const add = useCallback((descriptor) => {
    if (!enabled) return 'disabled';
    const item = createItem(descriptor);
    if (!item) return 'invalid';
    const exists = itemsRef.current.some((i) => i.id === item.id);
    if (!exists && itemsRef.current.length >= MAX_ITEMS) return 'full';
    commit({ type: 'add', item });
    return exists ? 'updated' : 'added';
  }, [enabled, commit]);

  const remove = useCallback((id) => commit({ type: 'remove', id }), [commit]);
  const clear = useCallback(() => commit({ type: 'clear' }), [commit]);

  const value = useMemo(() => ({
    enabled,
    items,
    count: items.length,
    has: (id) => items.some((i) => i.id === id),
    add,
    remove,
    clear,
  }), [enabled, items, add, remove, clear]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection () {
  return useContext(CollectionContext);
}
