// Canvas shapes a collected item can be exported at. `ratio` is width / height; 'fit' has none
// and exports at the content's natural size. Ids are filename-safe (no colons).
const EXPORT_RATIOS = [
  { id: 'fit', label: 'Fit', ratio: null },
  { id: '1x1', label: '1:1', ratio: 1 },
  { id: '4x5', label: '4:5', ratio: 4 / 5 },
  { id: '16x9', label: '16:9', ratio: 16 / 9 },
];

const DEFAULT_RATIO_ID = 'fit';
const RATIO_STORAGE_KEY = 'collection_ratio';

export { EXPORT_RATIOS, DEFAULT_RATIO_ID, RATIO_STORAGE_KEY };
