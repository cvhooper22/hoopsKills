import { stageSize } from './exportStage';

describe('stageSize', () => {
  it('keeps the natural size for fit', () => {
    expect(stageSize(960, 420, null)).toEqual({ width: 960, height: 420 });
  });

  it('pads the short side to reach the ratio', () => {
    expect(stageSize(960, 420, 1)).toEqual({ width: 960, height: 960 });
    expect(stageSize(960, 420, 16 / 9)).toEqual({ width: 960, height: 540 });
    expect(stageSize(420, 270, 4 / 5)).toEqual({ width: 420, height: 525 });
  });

  it('widens the canvas when the content is too tall for the width', () => {
    expect(stageSize(420, 600, 1)).toEqual({ width: 600, height: 600 });
    const { width, height } = stageSize(420, 600, 16 / 9);
    expect(width).toBeGreaterThanOrEqual(Math.floor(600 * 16 / 9));
    expect(height).toBeGreaterThanOrEqual(600);
  });
});
