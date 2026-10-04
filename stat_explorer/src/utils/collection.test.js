import {
  MAX_ITEMS,
  COLLECTION_VERSION,
  collectionReducer,
  createItem,
  deserializeCollection,
  itemId,
  serializeCollection,
} from './collection';

const desc = (over = {}) => ({
  type: 'kills-table',
  gameId: 'g1',
  params: { sort: { key: 'pts', dir: 'desc' } },
  title: 'Kills',
  snapshot: { rows: [1, 2] },
  ...over,
});

describe('itemId', () => {
  it('ignores param key order', () => {
    expect(itemId({ type: 't', gameId: 'g', params: { a: 1, b: 2 } }))
      .toBe(itemId({ type: 't', gameId: 'g', params: { b: 2, a: 1 } }));
  });

  it('differs by game and by params', () => {
    const base = itemId(desc());
    expect(itemId(desc({ gameId: 'g2' }))).not.toBe(base);
    expect(itemId(desc({ params: { sort: { key: 'pts', dir: 'asc' } } }))).not.toBe(base);
  });
});

describe('createItem', () => {
  it('builds an item with an id and timestamp', () => {
    const item = createItem(desc(), 123);
    expect(item).toMatchObject({ type: 'kills-table', gameId: 'g1', title: 'Kills', savedAt: 123 });
    expect(item.id).toBe(itemId(desc()));
  });

  it('rejects missing type, title or snapshot', () => {
    expect(createItem(desc({ type: '' }))).toBeNull();
    expect(createItem(desc({ title: undefined }))).toBeNull();
    expect(createItem(desc({ snapshot: undefined }))).toBeNull();
    expect(createItem(null)).toBeNull();
  });
});

describe('collectionReducer', () => {
  it('adds, upserts in place, removes and clears', () => {
    const a = createItem(desc(), 1);
    const b = createItem(desc({ gameId: 'g2' }), 2);
    let items = collectionReducer([], { type: 'add', item: a });
    items = collectionReducer(items, { type: 'add', item: b });
    expect(items.map((i) => i.id)).toEqual([a.id, b.id]);

    const a2 = { ...a, snapshot: { rows: [9] } };
    items = collectionReducer(items, { type: 'add', item: a2 });
    expect(items).toHaveLength(2);
    expect(items[0].snapshot).toEqual({ rows: [9] });

    items = collectionReducer(items, { type: 'remove', id: a.id });
    expect(items.map((i) => i.id)).toEqual([b.id]);
    expect(collectionReducer(items, { type: 'clear' })).toEqual([]);
  });

  it('stops adding new items at the cap but still updates existing ones', () => {
    const full = Array.from({ length: MAX_ITEMS }, (_, n) => createItem(desc({ gameId: `g${n}` })));
    const extra = createItem(desc({ gameId: 'extra' }));
    expect(collectionReducer(full, { type: 'add', item: extra })).toBe(full);
    const updated = { ...full[0], title: 'Renamed' };
    expect(collectionReducer(full, { type: 'add', item: updated })[0].title).toBe('Renamed');
  });
});

describe('serialize / deserialize', () => {
  it('round-trips', () => {
    const items = [createItem(desc(), 1)];
    expect(deserializeCollection(serializeCollection(items))).toEqual(items);
  });

  it('returns an empty cart for junk, wrong versions and invalid items', () => {
    expect(deserializeCollection(null)).toEqual([]);
    expect(deserializeCollection('nope')).toEqual([]);
    expect(deserializeCollection(JSON.stringify({ version: COLLECTION_VERSION + 1, items: [createItem(desc())] }))).toEqual([]);
    const good = createItem(desc());
    expect(deserializeCollection(JSON.stringify({ version: COLLECTION_VERSION, items: [good, { id: 1 }, null] }))).toEqual([good]);
  });
});
