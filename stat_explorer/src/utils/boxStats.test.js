import fs from 'fs';
import path from 'path';
import { eventLines, playerContext, complementSpans } from './boxStats';
import { buildLineupModel } from './lineupModel';

const DIR = path.join(__dirname, '../../public/data/box');
const games = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json');

describe.each(games)('%s', (file) => {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));

  test('whole-game event totals match the box score points and the possession-battle rebounds', () => {
    if (!data.events?.length) return;
    const { team, opp } = eventLines(data.events, 'byu', () => true);
    const last = [...data.events].reverse().find((e) => e.sc && e.sc[0] !== null);
    expect([team.pts, opp.pts]).toEqual(last.sc);
    const sum = (m, k) => [...m.values()].reduce((t, l) => t + l[k], 0);
    const { players } = eventLines(data.events, 'byu', () => true);
    expect(sum(players.team, 'pts')).toBe(team.pts);
    expect(sum(players.opp, 'pts')).toBe(opp.pts);
    expect(team.oreb).toBeGreaterThanOrEqual(data.battle.byu.formula.orb);
    expect(opp.oreb).toBeGreaterThanOrEqual(data.battle.opp.formula.orb);
  });

  test('player minutes over the whole game add to five times the game length, and a slice and its complement add to the whole', () => {
    const model = buildLineupModel(data.events, data.plays);
    if (!model) return;
    const stints = { byu: model.stints('byu'), opp: model.stints('opp') };
    const end = model.gameEnd;
    const sum = (m) => [...m.values()].reduce((t, x) => t + x, 0);
    const whole = playerContext({ plays: data.plays, luOf: (p, s) => model.lineupOfPlay(s, p), side: 'byu', stints, spans: [[0, end]] });
    expect(sum(whole.mins.team)).toBeCloseTo(5 * end, 4);
    expect(sum(whole.mins.opp)).toBeCloseTo(5 * end, 4);
    const spans = [[3, 11.5]];
    const part = playerContext({ plays: [], side: 'byu', stints, spans });
    const rest = playerContext({ plays: [], side: 'byu', stints, spans: complementSpans(spans, end) });
    expect(sum(part.mins.team) + sum(rest.mins.team)).toBeCloseTo(5 * end, 4);
  });
});
