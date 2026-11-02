import { buildSeries, pointAt, allDates, envelope, gameImpact, rankDomain, toIso, toTime } from './rankingsTimeline';

const days = (start, n) => Array.from({ length: n }, (_, i) => toIso(toTime(start) + i * 86400000));
const dailyTorvik = (ranks, start = '2025-11-01') => ({
  name: 'Torvik', points: ranks.map((r, i) => ({ date: days(start, ranks.length)[i], overallRank: r, offRank: r + 2, defRank: r - 1, metrics: { wab: i * 0.5, wab_rank: 30 - i } })),
});
const manualSystem = (name, rows) => ({ name, points: rows.map(([date, overallRank]) => ({ date, overallRank, offRank: overallRank, defRank: overallRank })) });

describe('buildSeries', () => {
  const timeline = { season: 2025, systems: { torvik: dailyTorvik([6, 7, 5, 9, 12]) } };
  const manual = { season: 2025, systems: { kenpom: manualSystem('KenPom', [['2025-11-01', 18], ['2025-11-03', 17], ['2025-11-05', 16]]) } };

  it('adds the hand-tracked systems for the season they cover, tagged as manual', () => {
    const s = buildSeries({ timeline, manual });
    expect(s.map((x) => [x.system, x.source])).toEqual([['torvik', 'collected'], ['kenpom', 'manual']]);
    expect(buildSeries({ timeline: { ...timeline, season: 2026 }, manual }).map((x) => x.system)).toEqual(['torvik']);
  });

  it('never replaces a collected system with the hand-tracked one', () => {
    const both = { season: 2025, systems: { ...timeline.systems, kenpom: dailyTorvik([20, 21, 22]) } };
    const s = buildSeries({ timeline: both, manual });
    expect(s.filter((x) => x.system === 'kenpom')).toHaveLength(1);
    expect(s.find((x) => x.system === 'kenpom').source).toBe('collected');
  });

  it('knows which series are daily', () => {
    const s = buildSeries({ timeline, manual });
    expect(s[0].daily).toBe(true);
    expect(s[1].daily).toBe(false);
  });

  it('flattens WAB out of the metrics', () => {
    const t = buildSeries({ timeline, manual: null })[0];
    expect(t.points[2]).toMatchObject({ wab: 1, wabRank: 28 });
  });
});

describe('pointAt and allDates', () => {
  const s = buildSeries({ timeline: { season: 2025, systems: { torvik: dailyTorvik([6, 7, 5]) } }, manual: null })[0];
  it('finds the latest point at or before a date, within an age limit', () => {
    expect(pointAt(s, '2025-11-02').overallRank).toBe(7);
    expect(pointAt(s, '2025-11-10').overallRank).toBe(5);
    expect(pointAt(s, '2025-11-10', 3)).toBeNull();
    expect(pointAt(s, '2025-10-30')).toBeNull();
  });
  it('lists every date once', () => {
    const k = buildSeries({ timeline: { season: 2025, systems: { torvik: dailyTorvik([6, 7, 5]) } }, manual: { season: 2025, systems: { kenpom: manualSystem('KenPom', [['2025-11-02', 17], ['2025-11-09', 16], ['2025-11-12', 15]]) } } });
    expect(allDates(k)).toEqual(['2025-11-01', '2025-11-02', '2025-11-03', '2025-11-09', '2025-11-12']);
  });
});

describe('envelope', () => {
  const series = buildSeries({
    timeline: { season: 2025, systems: { torvik: dailyTorvik([6, 7, 5, 9, 12, 13, 14]) } },
    manual: { season: 2025, systems: { kenpom: manualSystem('KenPom', [['2025-11-01', 18], ['2025-11-03', 17], ['2025-11-05', 16]]) } },
  });
  it('averages the systems at each date and carries a sparse system between its points', () => {
    const [d1, d2, d3] = envelope(series, 'overall', ['2025-11-01', '2025-11-02', '2025-11-03']);
    expect(d1).toMatchObject({ n: 2, avg: 12, min: 6, max: 18 });
    expect(d2).toMatchObject({ n: 2, min: 7, max: 18 });          // KenPom's 11-01 value carried to 11-02
    expect(d3).toMatchObject({ avg: 11, min: 5, max: 17 });
  });
  it('stops using a sparse system after its last point has gone stale', () => {
    const e = envelope(series, 'overall', ['2025-11-05', '2025-11-30']);
    expect(e[0].n).toBe(2);
    expect(e[1]).toMatchObject({ n: 0, avg: null });
  });
  it('needs at least two systems for an average, and ignores a single-snapshot system', () => {
    const lone = buildSeries({ timeline: { season: 2025, systems: { torvik: dailyTorvik([6, 7, 5]), net: { name: 'NET', points: [{ date: '2025-11-02', overallRank: 23 }] } } }, manual: null });
    expect(envelope(lone, 'overall', ['2025-11-02'])[0]).toMatchObject({ n: 1, avg: null });
  });
});

describe('gameImpact', () => {
  const [t, k] = buildSeries({
    timeline: { season: 2025, systems: { torvik: dailyTorvik([10, 8, 12, 12]) } },
    manual: { season: 2025, systems: { kenpom: manualSystem('KenPom', [['2025-11-01', 18], ['2025-11-03', 17], ['2025-11-05', 16]]) } },
  });
  it('compares the day before with the game day, positive when BYU moved up', () => {
    const win = gameImpact(t, { date: '2025-11-02' });
    expect(win.overall).toEqual({ before: 10, after: 8, change: 2 });
    expect(win.wab.change).toBe(0.5);
    expect(gameImpact(t, { date: '2025-11-03' }).overall).toEqual({ before: 8, after: 12, change: -4 });
  });
  it('says nothing for a sparse series or a game outside the data', () => {
    expect(gameImpact(k, { date: '2025-11-03' })).toBeNull();
    expect(gameImpact(t, { date: '2025-11-01' })).toBeNull();   // no day before
  });
});

describe('rankDomain', () => {
  it('runs from the worst rank drawn down to 1 so the best team sits on top', () => {
    const s = buildSeries({ timeline: { season: 2025, systems: { torvik: dailyTorvik([6, 7, 31]) } }, manual: null });
    expect(rankDomain(s, 'overall')).toEqual([40, 1]);
    const small = buildSeries({ timeline: { season: 2025, systems: { torvik: dailyTorvik([3, 4]) } }, manual: null });
    expect(rankDomain(small, 'overall')).toEqual([15, 1]);
  });
});
