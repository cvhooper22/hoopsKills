import { buildParts, assemblePrompt, sectionTokens, DEFAULT_INCLUDE, NO_QUESTION, fillIdea } from './askAiPrompt';

const A = ['A1', 'A2', 'A3', 'A4', 'A5'];
const B = ['B1', 'B2', 'B3', 'B4', 'B5'];

function game() {
  return {
    header: { gameId: 'g', date: '2026-01-02', venue: null, focus: 'byu', teams: { byu: 'BYU', opp: 'Utah' }, final: { byu: 5, opp: 2 } },
    plays: [{ lu: { byu: A, opp: B } }],
    split: { byu: { poss: 10 }, opp: { poss: 9 } },
    players: [{ name: 'unattributed', side: 'byu', min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }, { name: 'A1', side: 'byu', min: 20.04, pts: 5, fgm: 2, fga: 4, tpm: 1, tpa: 2, ftm: 0, fta: 0, oreb: 1, dreb: 2, ast: 1, stl: 0, blk: 0, tov: 1, pf: 2 }],
    events: [
      { per: 1, rem: 2380, side: 'byu', player: 'A1', cat: 'shot_attempt', type: 'jumpshot', sub: null, made: true, val: 3, sc: [3, 0], ast: 'A2' },
      { per: 1, rem: 2380, side: 'byu', player: 'A2', cat: 'assist', type: null, sub: null, made: null, val: null, sc: [3, 0], of: { player: 'A1' } },
      { per: 1, rem: 2100, side: 'byu', player: 'A5', cat: 'substitution', type: null, sub: 'out', made: null, val: null, sc: [3, 2] },
      { per: 1, rem: 2100, side: 'byu', player: 'A6', cat: 'substitution', type: null, sub: 'in', made: null, val: null, sc: [3, 2] },
      { per: 1, rem: 2090, side: 'opp', player: 'B1', cat: 'free_throw', type: 'free_throw', sub: '1of2', made: false, val: null, sc: [3, 2] },
    ],
  };
}

describe('buildParts', () => {
  it('folds the assist into the shot row', () => {
    const rows = buildParts(game()).pbp.split('\n');
    expect(rows).toContain('1H 19:40 | BYU | A1 | 3PT jumpshot MAKE (ast A2) | 3-0');
    expect(rows.filter((r) => r.includes('| A2 |'))).toHaveLength(0);
  });

  it('shows the first half clock as time left in the half, and the second half as is', () => {
    const g = game();
    g.events.push({ per: 2, rem: 600, side: 'opp', player: 'B2', cat: 'steal', type: null, sub: null, made: null, val: null, sc: [3, 2] });
    const rows = buildParts(g).pbp.split('\n');
    expect(rows).toContain('1H 19:40 | BYU | A1 | 3PT jumpshot MAKE (ast A2) | 3-0');
    expect(rows).toContain('2H 10:00 | Utah | B2 | STEAL | 3-2');
  });

  it('emits starters, then one LINEUP row per substitution batch with the right five', () => {
    const rows = buildParts(game()).pbp.split('\n').filter((r) => r.includes('| LINEUP |'));
    expect(rows[0]).toBe('1H 20:00 | LINEUP | BYU | A1, A2, A3, A4, A5 | 0-0');
    expect(rows).toContain('1H 15:00 | LINEUP | BYU | A1, A2, A3, A4, A6 | 3-2');
    expect(rows).toHaveLength(3);
  });

  it('leaves out lineups and substitutions in the bare variant', () => {
    const bare = buildParts(game()).pbpBare;
    expect(bare).not.toContain('LINEUP |');
    expect(bare).not.toContain('SUBSTITUTION');
  });

  it('marks starters in the player box', () => {
    const box = buildParts(game()).playerBox;
    expect(box).toContain('BYU,A1,Y,20,5,2-4,1-2,0-0,1,2,1,0,0,1,2');
    expect(box).not.toContain('unattributed');
  });
});

describe('assemblePrompt', () => {
  const parts = buildParts(game());

  it('ends with the question, or a default when blank', () => {
    expect(assemblePrompt(parts, DEFAULT_INCLUDE, ' Who won? ').endsWith('# My question\nWho won?')).toBe(true);
    expect(assemblePrompt(parts, DEFAULT_INCLUDE, '').endsWith(NO_QUESTION)).toBe(true);
  });

  it('drops sections that are switched off', () => {
    const lean = assemblePrompt(parts, { lineups: false, playerBox: false, definitions: false }, '');
    expect(lean).not.toContain('# How to compute things');
    expect(lean).not.toContain('# Final player stats');
    expect(lean).not.toContain('| LINEUP |');
  });

  it('reports a positive cost for lineups', () => {
    expect(sectionTokens(parts).lineups).toBeGreaterThan(0);
  });
});

it('fills the team name into a question idea', () => {
  expect(fillIdea("{team}'s bench vs {team}", 'BYU')).toBe("BYU's bench vs BYU");
});
