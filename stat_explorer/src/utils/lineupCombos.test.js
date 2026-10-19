import { topCombos } from './lineupCombos';

const L = (names, totalTime, totalNet) => ({ names, totalTime, totalNet });

describe('topCombos', () => {
  // A,B,C,D,E start (+4 in 10 min); then E is replaced by F (+6 in 5 min); then D by G (-2 in 3 min)
  const lineups = [
    L(['A', 'B', 'C', 'D', 'E'], 10, 4),
    L(['A', 'B', 'C', 'D', 'F'], 5, 6),
    L(['A', 'B', 'C', 'G', 'F'], 3, -2),
  ];

  test('a group\'s net adds the lineups that contained all of it', () => {
    const t = topCombos(lineups, { limit: 100 });
    const abc = t[3].find((c) => c.names.join('') === 'ABC');
    expect(abc).toMatchObject({ net: 8, minutes: 18, lineups: 3 }); // all three lineups
    const abcd = t[4].find((c) => c.names.join('') === 'ABCD');
    expect(abcd).toMatchObject({ net: 10, minutes: 15, lineups: 2 });
    const fg = t[2].find((c) => c.names.join('') === 'FG');
    expect(fg).toMatchObject({ net: -2, minutes: 3, lineups: 1 });
  });

  test('five-man results are the lineups themselves, best net first', () => {
    const t = topCombos(lineups, { sizes: [5] });
    expect(t[5].map((c) => c.names.join(''))).toEqual(['ABCDF', 'ABCDE', 'ABCFG']);
  });

  test('limit and ties: more minutes first, then names', () => {
    const t = topCombos(lineups, { sizes: [2], limit: 3 });
    expect(t[2]).toHaveLength(3);
    expect(t[2][0].net).toBeGreaterThanOrEqual(t[2][1].net);
    const tie = topCombos([L(['A', 'B', 'C', 'D', 'E'], 4, 3), L(['F', 'G', 'H', 'I', 'J'], 6, 3)], { sizes: [5] });
    expect(tie[5][0].names.join('')).toBe('FGHIJ'); // same net, more minutes
  });
});
