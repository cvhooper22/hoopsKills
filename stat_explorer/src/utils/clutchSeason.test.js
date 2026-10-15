import { buildGameClutchSummary, CLUTCH_RULES_VERSION } from './clutchSummary';
import { buildSeason, foldRows, filterRows, gameRow } from './clutchSeason';

// Minimal plays: BYU home, tied 50-50 with 4:00 left in the 2nd half, so the game is in clutch.
let seq = 0;
function play(over) {
  seq += 1;
  return {
    sequence_number: seq, period_number: 2, clock_seconds_remaining: 240, clock_display: '4:00', team_id: 'byu', team_side: 'home',
    player_id: 'ann-ace', player_name: 'Ann Ace', play_category: 'period_admin', play_type: null, shot_value: null, is_made: null,
    home_score_after: 50, away_score_after: 50, lineup_home: ['ann-ace'], lineup_away: ['bob-opp'], ...over,
  };
}
const opp = { team_id: 'opp', team_side: 'away', player_id: 'bob-opp', player_name: 'Bob Opp' };

function gamePlays() {
  seq = 0;
  return [
    play({ period_number: 1, clock_seconds_remaining: 600 }),
    play({ clock_seconds_remaining: 290 }), // enters clutch at 50-50
    play({ clock_seconds_remaining: 200, play_category: 'shot_attempt', shot_value: 3, is_made: true, home_score_after: 53, away_score_after: 50 }),
    play({ ...opp, clock_seconds_remaining: 150, play_category: 'shot_attempt', shot_value: 2, is_made: true, home_score_after: 53, away_score_after: 52 }),
    play({ clock_seconds_remaining: 100, play_category: 'turnover', home_score_after: 53, away_score_after: 52 }),
    play({ ...opp, clock_seconds_remaining: 60, play_category: 'free_throw', shot_value: 1, is_made: true, home_score_after: 53, away_score_after: 53 }),
    play({ clock_seconds_remaining: 0, play_category: 'period_admin', home_score_after: 53, away_score_after: 53 }),
  ];
}

const game = (over = {}) => ({
  gameId: '2025-12-01-opp-at-byu', date: '2025-12-01', seasonYear: 2025, homeTeamId: 'byu', awayTeamId: 'opp',
  finalScoreHome: 80, finalScoreAway: 79, isNeutralSite: false, isConferenceGame: false, seasonType: 'regular', ...over,
});

describe('buildGameClutchSummary', () => {
  it('keeps BYU player lines and team totals for both sides', () => {
    const s = buildGameClutchSummary({ plays: gamePlays(), game: game(), generatedAt: 'now' });
    expect(s.rulesVersion).toBe(CLUTCH_RULES_VERSION);
    expect(s.game).toMatchObject({ oppTeamId: 'opp', location: 'home', result: 'W', margin: 1 });
    expect(s.team.for).toMatchObject({ pts: 3, fgm: 1, tpm: 1, tov: 1 });
    expect(s.team.against).toMatchObject({ pts: 3, fgm: 1, ftm: 1 });
    expect(s.players['ann-ace']).toMatchObject({ name: 'Ann Ace', pts: 3, tov: 1 });
    expect(s.players['bob-opp']).toBeUndefined(); // opponent player lines are not stored
  });

  it('classifies the stretch by how BYU entered it and splits points by period', () => {
    const s = buildGameClutchSummary({ plays: gamePlays(), game: game() });
    expect(s.stretches).toBe(1);
    expect(s.entries.tied).toMatchObject({ stretches: 1, ptsFor: 3, ptsAgainst: 3 });
    expect(s.entries.leading.stretches).toBe(0);
    expect(s.periods['2']).toMatchObject({ stretches: 1, ptsFor: 3, ptsAgainst: 3 });
    expect(s.periods.OT.seconds).toBe(0);
    expect(s.outcomes).toEqual({ won: 0, lost: 0, even: 1 });
    expect(s.seconds).toBe(290); // from the 4:50 play to 0:00
  });

  it('tallies the last 2:00 of regulation on its own', () => {
    const s = buildGameClutchSummary({ plays: gamePlays(), game: game() });
    // from the 1:40 turnover to 0:00: BYU scored nothing, the opponent's free throw tied it
    expect(s.last2).toEqual({ stretches: 1, seconds: 120, ptsFor: 0, ptsAgainst: 1 });
  });

  it('reads the entry situation from the focus team when it is the away side', () => {
    const away = buildGameClutchSummary({
      plays: gamePlays().map((p) => ({ ...p, team_side: p.team_side === 'home' ? 'away' : 'home', home_score_after: p.away_score_after, away_score_after: p.home_score_after })),
      game: game({ homeTeamId: 'opp', awayTeamId: 'byu', finalScoreHome: 79, finalScoreAway: 80 }),
    });
    expect(away.game.location).toBe('away');
    expect(away.team.for.pts + away.team.against.pts).toBeGreaterThan(0);
  });

  it('is empty, not an error, for a game that never reaches clutch', () => {
    seq = 0;
    const plays = [play({ period_number: 1, clock_seconds_remaining: 600, home_score_after: 40, away_score_after: 20 }), play({ clock_seconds_remaining: 100, home_score_after: 70, away_score_after: 40 })];
    const s = buildGameClutchSummary({ plays, game: game() });
    expect(s.seconds).toBe(0);
    expect(s.stretches).toBe(0);
    expect(s.players).toEqual({});
  });
});

const summary = (id, over = {}) => ({ ...buildGameClutchSummary({ plays: gamePlays(), game: game({ gameId: id, date: id.slice(0, 10) }) }), ...over });

describe('foldRows', () => {
  it('sums additive facts and derives rates from the sums', () => {
    const rows = [gameRow(summary('2025-12-01-a')), gameRow(summary('2025-12-02-b'))];
    const { totals, derived, players } = foldRows(rows);
    expect(totals.clutchGames).toBe(2);
    expect(totals.for.pts).toBe(6);
    expect(derived.net).toBe(0);
    expect(derived.forRates.efg).toBeCloseTo(1.5); // 1 FGM, 1 3PM, 1 FGA per game
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ id: 'ann-ace', gp: 2, pts: 6 });
  });

  it('counts a game with no clutch time as played but not as a clutch game', () => {
    const idle = { ...summary('2025-12-03-c'), seconds: 0, stretches: 0, players: {}, outcomes: { won: 0, lost: 0, even: 0 } };
    const { totals, derived } = foldRows([gameRow(summary('2025-12-01-a')), gameRow(idle)]);
    expect(totals.games).toBe(2);
    expect(totals.clutchGames).toBe(1);
    expect(derived.record).toEqual({ w: 1, l: 0 });
  });

  it('estimates possessions and points per possession from the team lines', () => {
    const row = gameRow(summary('2025-12-01-a'));
    row.team = {
      for: { pts: 12, fgm: 4, fga: 10, tpm: 1, tpa: 3, ftm: 3, fta: 5, oreb: 2, tov: 1, reb: 0, ast: 0, stl: 0, blk: 0, pf: 0 },
      against: { pts: 6, fgm: 2, fga: 8, tpm: 0, tpa: 2, ftm: 2, fta: 0, oreb: 1, tov: 0, reb: 0, ast: 0, stl: 0, blk: 0, pf: 0 },
    };
    const { forRates, againstRates } = foldRows([row]).derived;
    expect(forRates.poss).toBeCloseTo(10 + 0.44 * 5 - 2 + 1); // 11.2
    expect(forRates.ppp).toBeCloseTo(12 / 11.2);
    expect(forRates.twoPct).toBeCloseTo(3 / 7);
    expect(forRates.tsPct).toBeCloseTo(12 / (2 * (10 + 0.44 * 5)));
    expect(againstRates.ppp).toBeCloseTo(6 / 7);
  });

  it('folds the last 2:00 and the all-clutch total, and tolerates rows without them', () => {
    const a = gameRow(summary('2025-12-01-a'));
    const old = { ...gameRow(summary('2025-12-02-b')) };
    delete old.last2;
    const { last2, all, periods } = foldRows([a, old]).derived;
    expect(last2).toMatchObject({ games: 1, stretches: 1, seconds: 120, net: -1 });
    expect(all).toMatchObject({ games: 2, stretches: 2, ptsFor: 6, ptsAgainst: 6 });
    expect(periods.OT.games).toBe(0);
  });

  it('divides the entry and period splits by the games that had that kind of clutch', () => {
    const a = gameRow(summary('2025-12-01-a'));
    const b = gameRow(summary('2025-12-02-b'));
    // game b has two stretches that began trailing, which still counts as one game
    b.entries = { ...b.entries, tied: { games: 0, stretches: 0, seconds: 0, ptsFor: 0, ptsAgainst: 0 }, trailing: { stretches: 2, seconds: 100, ptsFor: 4, ptsAgainst: 10 } };
    const { entries } = foldRows([a, b]).derived;
    expect(entries.tied.games).toBe(1);
    expect(entries.trailing).toMatchObject({ games: 1, stretches: 2, net: -6 });
    expect(entries.trailing.perGame.net).toBe(-6);
    expect(entries.tied.perGame.net).toBe(0);
    expect(entries.leading.perGame.net).toBeNull(); // no game began leading
  });
});

describe('filterRows and buildSeason', () => {
  it('reuses the kills game filters', () => {
    const rows = [
      gameRow(summary('2025-12-01-a')),
      gameRow({ ...summary('2025-12-02-b'), game: { ...summary('2025-12-02-b').game, location: 'away', result: 'L' } }),
    ];
    expect(filterRows(rows, { location: 'away' })).toHaveLength(1);
    expect(filterRows(rows, { result: 'W' })[0].gameId).toBe('2025-12-01-a');
  });

  it('keeps headshots only for players who appear in the season', () => {
    const season = buildSeason({
      season: 2025, team: 'byu', summaries: [summary('2025-12-01-a')],
      headshots: { 'ann-ace': 'http://x/ann.png', 'never-played': 'http://x/other.png' },
    });
    expect(season.headshots).toEqual({ 'ann-ace': 'http://x/ann.png' });
  });

  it('refuses to mix rule versions and sorts games by date', () => {
    expect(() => buildSeason({ season: 2025, team: 'byu', summaries: [summary('2025-12-01-a'), summary('2025-12-02-b', { rulesVersion: 99 })] })).toThrow(/versions differ/);
    const season = buildSeason({ season: 2025, team: 'byu', summaries: [summary('2025-12-02-b'), summary('2025-12-01-a')] });
    expect(season.byGame.map((r) => r.gameId)).toEqual(['2025-12-01-a', '2025-12-02-b']);
    expect(season.gamesIncluded).toBe(2);
  });
});
