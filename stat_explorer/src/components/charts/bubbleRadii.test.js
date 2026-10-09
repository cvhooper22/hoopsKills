import { bubbleRadii } from './bubbleRadii';

describe('bubbleRadii', () => {
  it('gives every dot the same radius without a size accessor', () => {
    expect(bubbleRadii([1, 2, 3], undefined, 8, 4)).toEqual([8, 8, 8]);
  });
  it('maps the smallest value to minRadius and the largest to radius', () => {
    const r = bubbleRadii([{ v: 1 }, { v: 5 }, { v: 9 }], (d) => d.v, 10, 4);
    expect(r[0]).toBeCloseTo(4);
    expect(r[2]).toBeCloseTo(10);
    expect(r[1]).toBeGreaterThan(r[0]);
    expect(r[1]).toBeLessThan(r[2]);
  });
  it('makes area, not radius, follow the value', () => {
    // minRadius 0: a value twice as big has twice the area
    const [a, b] = bubbleRadii([{ v: 1 }, { v: 2 }], (d) => d.v, 10, 0, [0, 2]);
    expect((b * b) / (a * a)).toBeCloseTo(2);
  });
  it('uses the smallest dot for a datum with no number, and a pinned domain clamps', () => {
    const r = bubbleRadii([{ v: null }, { v: 100 }], (d) => d.v, 10, 3, [0, 10]);
    expect(r[0]).toBe(3);
    expect(r[1]).toBeCloseTo(10);
  });
  it('does not divide by zero when every value is equal', () => {
    expect(bubbleRadii([{ v: 3 }, { v: 3 }], (d) => d.v, 9, 4)).toEqual([9, 9]);
  });
});
