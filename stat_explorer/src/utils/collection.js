// Pure logic for the "collect and share" cart. No React, no storage - see
// contexts/CollectionContext.js for those.
//
// A cart item pairs a descriptor (what it is, so it can link back to the live view)
// with a frozen snapshot (the computed props it rendered with, so /collection shows
// the numbers the user saw even after data or rules change):
//   { id, type, gameId, params, title, subtitle, snapshot, savedAt }

export const COLLECTION_STORAGE_KEY = 'collection';
// Bump when the item shape or a snapshot adapter changes incompatibly; older carts are dropped.
export const COLLECTION_VERSION = 1;
export const MAX_ITEMS = 24;

function stableStringify (value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

// Same view + same settings = same id, so collecting twice updates rather than duplicates.
export function itemId ({ type, gameId, params }) {
  return [type, gameId ?? '', stableStringify(params ?? {})].join('|');
}

// Returns a cart item, or null when the descriptor is unusable.
export function createItem (descriptor, now = Date.now()) {
  const { type, gameId = null, params = {}, title, subtitle = '', snapshot } = descriptor ?? {};
  if (typeof type !== 'string' || !type) return null;
  if (typeof title !== 'string' || !title) return null;
  if (snapshot === undefined) return null;
  return {
    id: itemId({ type, gameId, params }),
    type,
    gameId,
    params,
    title,
    subtitle,
    snapshot,
    savedAt: now,
  };
}

function isValidItem (item) {
  return Boolean(item) && typeof item.id === 'string' && typeof item.type === 'string'
    && typeof item.title === 'string' && item.snapshot !== undefined;
}

export function collectionReducer (items, action) {
  switch (action.type) {
    case 'load':
      return action.items;
    case 'add': {
      const index = items.findIndex((i) => i.id === action.item.id);
      if (index >= 0) return items.map((i, n) => (n === index ? action.item : i));
      if (items.length >= MAX_ITEMS) return items;
      return [...items, action.item];
    }
    case 'remove':
      return items.filter((i) => i.id !== action.id);
    case 'clear':
      return items.length ? [] : items;
    default:
      return items;
  }
}

export function serializeCollection (items) {
  return JSON.stringify({ version: COLLECTION_VERSION, items });
}

// Anything unreadable, or from another schema version, becomes an empty cart.
export function deserializeCollection (raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== COLLECTION_VERSION || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter(isValidItem).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}
