import { evaluate, findRecords, recordSentence, restSentence } from './killsRecords';

const row = (kills, result, extra = {}) => ({ kills, stops: 20, completion: 0.5, efficiency: 1, avoidableBreakers: 5, result, ...extra });
const games = (kills, result, n) => Array.from({ length: n }, () => row(kills, result));

describe('evaluate', () => {
  it('counts W-L over the games meeting every condition, and the rest separately', () => {
    const rows = [row(8, 'W'), row(9, 'W'), row(8, 'L'), row(3, 'L')];
    const res = evaluate(rows, [{ metric: 'kills', op: '>=', value: 8 }]);
    expect(res).toMatchObject({ games: 3, wins: 2, losses: 1, winPct: 2 / 3, coverage: 0.75 });
    expect(res.rest).toEqual({ games: 1, wins: 0, losses: 1, winPct: 0 });
  });
  it('supports <= and skips rows missing the value', () => {
    const rows = [row(1, 'W', { avoidableBreakers: 1 }), row(1, 'L', { avoidableBreakers: null })];
    expect(evaluate(rows, [{ metric: 'avoidableBreakers', op: '<=', value: 2 }]).games).toBe(1);
  });
  it('gives a small p only when the matched games do much better than the rest', () => {
    const strong = evaluate([...games(8, 'W', 8), ...games(2, 'L', 8)], [{ metric: 'kills', op: '>=', value: 8 }]);
    const flat = evaluate([...games(8, 'W', 4), ...games(8, 'L', 4), ...games(2, 'W', 4), ...games(2, 'L', 4)], [{ metric: 'kills', op: '>=', value: 8 }]);
    expect(strong.p).toBeLessThan(0.01);
    expect(flat.p).toBeGreaterThan(0.5);
  });
});

describe('findRecords', () => {
  it('shows a record whose other games do clearly worse', () => {
    const rows = [...games(8, 'W', 7), row(8, 'L'), ...games(2, 'L', 6), ...games(2, 'W', 1)];
    const rec = findRecords(rows).find((r) => r.conditions[0].metric === 'kills');
    expect(recordSentence(rec)).toBe('BYU is 7-1 when they get 3 or more kills');
    expect(restSentence(rec)).toBe('1-6 when they don\'t');
  });
  it('drops a record that describes most of the season', () => {
    // 80%+ wins, but 8 of 10 games meet it and the other two also win
    const rows = [...games(8, 'W', 7), row(8, 'L'), ...games(2, 'W', 2)];
    expect(findRecords(rows).filter((r) => r.conditions[0].metric === 'kills')).toEqual([]);
  });
  it('drops a record when the games outside it do about as well', () => {
    const rows = [...games(8, 'W', 5), ...games(2, 'W', 4), ...games(2, 'L', 1)];
    expect(findRecords(rows)).toEqual([]);
  });
  it('picks the threshold that splits wins from losses cleanly, not a looser one that lets losses in', () => {
    const rows = [...games(9, 'W', 6), ...games(6, 'W', 1), ...games(6, 'L', 3), ...games(2, 'L', 5)];
    const rec = findRecords(rows).find((r) => r.conditions[0].metric === 'kills');
    expect(rec.conditions[0].value).toBe(7);
  });
  it('never uses a threshold looser than the configured impressive limit', () => {
    const rows = [0, 1, 1, 2, 2, 2].map((a) => row(5, 'W', { avoidableBreakers: a })).concat(games(5, 'L', 0)).concat([row(5, 'L', { avoidableBreakers: 6 }), row(5, 'L', { avoidableBreakers: 7 }), row(5, 'L', { avoidableBreakers: 8 })]);
    findRecords(rows).flatMap((r) => r.conditions).filter((c) => c.metric === 'avoidableBreakers')
      .forEach((c) => expect(c.value).toBeLessThanOrEqual(3));
  });
  it('ranks fewer avoidable breakers as better', () => {
    const rows = [0, 1, 1, 2, 2, 2].map((a) => row(5, 'W', { avoidableBreakers: a })).concat(games(5, 'L', 0)).concat([row(5, 'L', { avoidableBreakers: 6 }), row(5, 'L', { avoidableBreakers: 7 }), row(5, 'L', { avoidableBreakers: 8 })]);
    const rec = findRecords(rows).find((r) => r.conditions[0].metric === 'avoidableBreakers');
    expect(rec.conditions[0].op).toBe('<=');
    expect(rec.conditions[0].value).toBeLessThanOrEqual(3);
  });
});
