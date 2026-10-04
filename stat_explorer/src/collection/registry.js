import FlipPad from '../components/FlipPad/FlipPad';
import KillsTable from '../views/Kills/KillsTable';

// Maps a cart item's `type` to how it renders from its stored snapshot. Each `render` gets
// the whole item and must work from the snapshot alone (no fetching), in export mode.
//
// To make something collectable: wrap it in <Collectable descriptor={...}> where the
// descriptor's `snapshot` is exactly what its `render` below needs, then add the type here.
// Changing a snapshot's shape incompatibly? Bump COLLECTION_VERSION in utils/collection.js.
export const REGISTRY = {
  'kpi-flip': {
    exportWidth: 420,
    render: (item) => <FlipPad {...item.snapshot} seed={item.id} />,
  },
  'kills-table': {
    exportWidth: 960,
    render: (item) => <KillsTable result={item.snapshot} initialSort={item.params?.sort} exportMode />,
  },
};

export function exportWidthFor (item) {
  return REGISTRY[item.type]?.exportWidth;
}

export function renderItem (item) {
  const entry = REGISTRY[item.type];
  return entry ? entry.render(item) : null;
}
