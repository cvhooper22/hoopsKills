import { exportFilename } from './exportImage';

describe('exportFilename', () => {
  it('builds a slug from type, game and params label', () => {
    expect(exportFilename({ type: 'kpi-flip', gameId: '2026-03-19-texas-at-byu', params: { label: 'Potential kills' } }))
      .toBe('byu-hoops-kpi-flip-2026-03-19-texas-at-byu-potential-kills.png');
  });

  it('adds the aspect ratio unless it is fit', () => {
    const item = { type: 'kills-table', gameId: 'g1', params: {} };
    expect(exportFilename(item, '4x5')).toBe('byu-hoops-kills-table-g1-4x5.png');
    expect(exportFilename(item, 'fit')).toBe('byu-hoops-kills-table-g1.png');
  });

  it('skips missing parts and strips odd characters', () => {
    expect(exportFilename({ type: 'kills-table', gameId: null, params: {} })).toBe('byu-hoops-kills-table.png');
    expect(exportFilename({ type: 'x', gameId: 'A/B  C!', params: { label: '50%' } })).toBe('byu-hoops-x-a-b-c-50.png');
  });
});
