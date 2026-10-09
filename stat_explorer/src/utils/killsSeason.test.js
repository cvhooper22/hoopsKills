import { buildGameSummary } from './killsSummary';
import { KILLS_RULES_VERSION } from './kills';
import { buildSeason, foldRows, filterRows, gameRow, mergeCredit } from './killsSeason';

const PERIODS = (over = {}) => ({
  1: { kills: 0, potential: 0, stops: 0, pure: 0, dirty: 0 },
  2: { kills: 0, potential: 0, stops: 0, pure: 0, dirty: 0 },
  OT: { kills: 0, potential: 0, stops: 0, pure: 0, dirty: 0 },
  ...over,
});

// A per-game summary with sane zeros; `byu` / `game` overrides are shallow-merged.
function summary(gameId, { game = {}, byu = {}, oppKills = 0, rulesVersion = KILLS_RULES_VERSION } = {}) {
  return {
    gameId,
    source: 'wmt',
    rulesVersion,
    generatedAt: '2026-01-01T00:00:00.000Z',
    game: {
      date: gameId.slice(0, 10), seasonYear: 2025, oppTeamId: 'opp', location: 'home', isConferenceGame: false,
      seasonType: 'regular', tournamentRound: null, result: 'W', scoreFor: 70, scoreAgainst: 60, margin: 10, ...game,
    },
    byu: {
      kills: 0, potential: 0, stops: 0, pure: 0, dirty: 0, byPeriod: PERIODS(), gainSum: 0, gainCount: 0,
      gaps: [], durations: [], killTimes: [], streakLengths: { 2: 0, 3: 0, 4: 0, '5plus': 0 },
      longestStreak: null, buckets: { critical: 0, garbage: 0, clutch: 0, adjacent: 0 },
      stopMix: { rebound: 0, turnover: 0, steal: 0, block: 0, charge: 0, tie_up: 0 }, credit: {}, avoidableBreakers: 0,
      ...byu,
    },
    oppKills,
  };
}

const streak = (length, period = 1) => ({ length, period, startSeconds: 100, endSeconds: 160, converted: Math.floor(length / 3) });

describe('foldRows', () => {
  it('weights completion and efficiency by counts, not by game', () => {
    // Game A: 1 kill, 0 potential, +4 gain. Game B: 1 kill, 3 potential, +0 gain.
    const rows = [
      gameRow(summary('2025-11-01-a', { byu: { kills: 1, potential: 0, gainSum: 4, gainCount: 1 } })),
      gameRow(summary('2025-11-02-b', { byu: { kills: 1, potential: 3, gainSum: 0, gainCount: 1 } })),
    ];
    const { totals, derived } = foldRows(rows);
    expect(totals.kills).toBe(2);
    expect(totals.potential).toBe(3);
    expect(derived.completion).toBeCloseTo(2 / 5); // not the mean of 1.0 and 0.25
    expect(derived.efficiency).toBe(2); // 4 / 2 kills
  });

  it('computes kill differential, per-game averages and gap stats from pooled arrays', () => {
    const rows = [
      gameRow(summary('2025-11-01-a', { oppKills: 1, byu: { kills: 3, gaps: [100, 300], durations: [20, 40] } })),
      gameRow(summary('2025-11-02-b', { oppKills: 0, byu: { kills: 1, gaps: [200], durations: [10] } })),
    ];
    const { derived } = foldRows(rows);
    expect(derived.diff).toBe(3);
    expect(derived.perGame.kills).toBe(2);
    expect(derived.gaps).toEqual({ avg: 200, longest: 300, shortest: 100, count: 3 });
    expect(derived.durations.shortest).toBe(10);
  });

  it('returns nulls, not NaN, for an empty set', () => {
    const { derived, totals } = foldRows([]);
    expect(totals.games).toBe(0);
    expect(derived.completion).toBeNull();
    expect(derived.efficiency).toBeNull();
    expect(derived.gaps).toBeNull();
    expect(derived.longestStreak).toBeNull();
  });

  it('lists every game that ties for the longest streak', () => {
    const rows = [
      gameRow(summary('2025-11-01-a', { game: { oppTeamId: 'x' }, byu: { longestStreak: streak(6) } })),
      gameRow(summary('2025-11-02-b', { game: { oppTeamId: 'y' }, byu: { longestStreak: streak(4) } })),
      gameRow(summary('2025-11-03-c', { game: { oppTeamId: 'z' }, byu: { longestStreak: streak(6, 2) } })),
    ];
    const { longestStreak } = foldRows(rows).derived;
    expect(longestStreak.length).toBe(6);
    expect(longestStreak.games.map((g) => g.oppTeamId)).toEqual(['x', 'z']);
  });
});

describe('filterRows', () => {
  const rows = [
    gameRow(summary('2025-11-01-a', { game: { location: 'neutral' } })),
    gameRow(summary('2025-11-05-b', { game: { location: 'home' } })),
    gameRow(summary('2026-01-05-c', { game: { location: 'away', isConferenceGame: true } })),
    gameRow(summary('2026-03-11-d', { game: { location: 'neutral', isConferenceGame: true, seasonType: 'conf_tourney' } })),
    gameRow(summary('2026-03-19-e', { game: { location: 'neutral', seasonType: 'postseason' } })),
  ];
  const ids = (rs) => rs.map((r) => r.gameId.slice(0, 10));

  it('keeps neutral games out of home and away', () => {
    expect(ids(filterRows(rows, { location: 'home' }))).toEqual(['2025-11-05']);
    expect(ids(filterRows(rows, { location: 'away' }))).toEqual(['2026-01-05']);
    expect(ids(filterRows(rows, { location: 'neutral' }))).toEqual(['2025-11-01', '2026-03-11', '2026-03-19']);
  });

  it('stacks conference with postseason to leave only the conference tournament', () => {
    expect(ids(filterRows(rows, { postseasonOnly: true }))).toEqual(['2026-03-11', '2026-03-19']);
    expect(ids(filterRows(rows, { postseasonOnly: true, conferenceOnly: true }))).toEqual(['2026-03-11']);
  });

  it('keeps only wins or only losses, and last N then counts those', () => {
    const mixed = [
      gameRow(summary('2025-11-01-a', { game: { result: 'W' } })),
      gameRow(summary('2025-11-05-b', { game: { result: 'L' } })),
      gameRow(summary('2026-01-05-c', { game: { result: 'W' } })),
      gameRow(summary('2026-03-11-d', { game: { result: 'L' } })),
    ];
    expect(ids(filterRows(mixed, { result: 'W' }))).toEqual(['2025-11-01', '2026-01-05']);
    expect(ids(filterRows(mixed, { result: 'L' }))).toEqual(['2025-11-05', '2026-03-11']);
    expect(ids(filterRows(mixed, { result: 'W', lastN: 1 }))).toEqual(['2026-01-05']);
  });

  it('applies last N after the other filters', () => {
    expect(ids(filterRows(rows, { conferenceOnly: true, lastN: 1 }))).toEqual(['2026-03-11']);
  });
});

describe('buildSeason', () => {
  const summaries = [
    summary('2025-11-01-a', { byu: { kills: 2, potential: 1, stops: 9, gainSum: 6, gainCount: 2, credit: { 'A B': { steals: 2, blocks: 0 } } } }),
    summary('2026-01-05-b', { game: { isConferenceGame: true }, byu: { kills: 1, potential: 1, stops: 5, gainSum: 1, gainCount: 1, credit: { 'A B': { steals: 1, blocks: 1 } } } }),
    summary('2026-02-05-c', { game: { isConferenceGame: true }, byu: { kills: 4, potential: 0, stops: 14, gainSum: 8, gainCount: 4 } }),
  ];

  it('equals folding the filtered rows (filter parity)', () => {
    const full = buildSeason({ season: 2025, team: 'byu', summaries });
    const confOnly = buildSeason({ season: 2025, team: 'byu', summaries: summaries.filter((s) => s.game.isConferenceGame) });
    const refolded = foldRows(filterRows(full.byGame, { conferenceOnly: true }));
    expect(refolded.totals).toEqual(confOnly.totals);
    expect(refolded.derived).toEqual(confOnly.derived);
  });

  it('sorts byGame by date and merges credit by player', () => {
    const full = buildSeason({ season: 2025, team: 'byu', summaries: [...summaries].reverse() });
    expect(full.byGame.map((r) => r.gameId)).toEqual(summaries.map((s) => s.gameId));
    expect(mergeCredit(summaries)).toEqual([{ name: 'A B', steals: 3, blocks: 1, gamesWithCredit: 2 }]);
    expect(full.players[0].steals).toBe(3);
  });

  it('refuses to mix rules versions and names the games', () => {
    const mixed = [summaries[0], summary('2026-01-05-b', { rulesVersion: KILLS_RULES_VERSION + 1 })];
    expect(() => buildSeason({ season: 2025, team: 'byu', summaries: mixed })).toThrow(/2026-01-05-b/);
  });

  it('carries skipped games through and leaves them out of the totals', () => {
    const season = buildSeason({ season: 2025, team: 'byu', summaries, skipped: [{ gameId: 'x', reason: 'no summary' }] });
    expect(season.gamesSkipped).toEqual([{ gameId: 'x', reason: 'no summary' }]);
    expect(season.gamesIncluded).toBe(3);
    expect(season.totals.games).toBe(3);
  });
});

// Hand-built plays, BYU home. Home steals are BYU stops: 3 in a row (a kill), then the away team
// scores; 2 more (a potential kill), then away scores again. Then away steals 3 times (an
// opponent kill) before the home team scores.
describe('buildGameSummary', () => {
  let seq = 0;
  const play = (over) => {
    seq += 1;
    return {
      sequence_number: seq, period_number: 1, period_type: 'regulation', clock_display: '10:00',
      clock_seconds_remaining: 600, game_seconds_elapsed: 600 + seq * 10, team_id: null, team_side: null,
      player_id: null, player_name: null, play_category: 'other', play_type: null, play_subtype: null,
      play_description: '', home_score_after: 0, away_score_after: 0, shot_value: null, is_made: null, ...over,
    };
  };
  const steal = (side, name, scores) => play({ play_category: 'steal', team_side: side, player_name: name, ...scores });
  const basket = (side, scores) => play({ play_category: 'shot_attempt', team_side: side, shot_value: 2, is_made: true, ...scores });

  const plays = [
    play({ play_category: 'period_admin' }),
    steal('home', 'Al', {}), steal('home', 'Al', {}), steal('home', 'Bo', {}),
    basket('away', { away_score_after: 2 }),
    steal('home', 'Bo', { away_score_after: 2 }), steal('home', 'Cy', { away_score_after: 2 }),
    basket('away', { away_score_after: 4 }),
    steal('away', 'Dee', { away_score_after: 4 }), steal('away', 'Dee', { away_score_after: 4 }), steal('away', 'Eli', { away_score_after: 4 }),
    basket('home', { home_score_after: 2, away_score_after: 4 }),
  ];
  const game = {
    gameId: '2025-11-01-opp-at-byu', date: '2025-11-01', seasonYear: 2025, homeTeamId: 'byu', awayTeamId: 'opp',
    finalScoreHome: 80, finalScoreAway: 70, isNeutralSite: false, isConferenceGame: false, primarySource: 'wmt',
  };

  it('counts kills, potential kills, stops, and the opponent kills', () => {
    const s = buildGameSummary({ plays, game, generatedAt: 'now' });
    expect(s.byu).toMatchObject({ kills: 1, potential: 1, stops: 5, pure: 1, dirty: 0, gainCount: 1 });
    expect(s.oppKills).toBe(1);
    expect(s.rulesVersion).toBe(KILLS_RULES_VERSION);
    expect(s.byu.byPeriod[1]).toMatchObject({ kills: 1, potential: 1, stops: 5 });
    expect(s.byu.streakLengths).toEqual({ 2: 1, 3: 1, 4: 0, '5plus': 0 });
    expect(s.byu.longestStreak).toMatchObject({ length: 3, period: 1, converted: 1 });
    expect(s.byu.stopMix.steal).toBe(5);
    expect(s.byu.credit).toEqual({ Al: { steals: 2, blocks: 0 }, Bo: { steals: 2, blocks: 0 }, Cy: { steals: 1, blocks: 0 } });
    expect(s.byu.killTimes).toHaveLength(1);
  });

  it('derives location and result from the focus team, not the home label', () => {
    const away = { ...game, homeTeamId: 'opp', awayTeamId: 'byu', finalScoreHome: 70, finalScoreAway: 80 };
    expect(buildGameSummary({ plays, game: away }).game).toMatchObject({ location: 'away', result: 'W', margin: 10, oppTeamId: 'opp' });
    expect(buildGameSummary({ plays, game: { ...game, isNeutralSite: true } }).game.location).toBe('neutral');
  });

  it('throws when the focus team did not play', () => {
    expect(() => buildGameSummary({ plays, game: { ...game, homeTeamId: 'x' }, focusTeamId: 'byu' })).toThrow(/did not play/);
  });
});
