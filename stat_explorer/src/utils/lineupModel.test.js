import fs from 'fs';
import path from 'path';
import { buildLineupModel } from './lineupModel';
import { lineupStints } from './lineupTimeline';

const DIR = path.join(__dirname, '../../public/data/box');
const games = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json');

describe.each(games)('%s', (file) => {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  const model = buildLineupModel(data.events, data.plays);

  test('replay lands on five for both teams and matches every chance snapshot', () => {
    if (!model) return;
    const summary = model.anomalies.reduce((m, a) => ({ ...m, [a.type]: (m[a.type] ?? 0) + 1 }), {});
    // eslint-disable-next-line no-console
    console.log(file, 'changes', model.changes.length, 'anomalies', JSON.stringify(summary), JSON.stringify(model.anomalies.slice(0, 4)));
    expect(model.anomalies).toEqual([]);
  });

  test('stints are contiguous, five deep, and account for every point', () => {
    if (!model) return;
    for (const side of ['byu', 'opp']) {
      const st = model.stints(side);
      st.forEach((s, i) => { expect(s.names).toHaveLength(5); if (i) expect(s.startMin).toBeCloseTo(st[i - 1].endMin, 6); });
      expect(st[0].startMin).toBe(0);
      expect(st[st.length - 1].endMin).toBeCloseTo(model.gameEnd, 6);
      const pts = data.plays.filter((p) => p.offense === side).reduce((s, p) => s + p.pts, 0);
      expect(st.reduce((s, x) => s + x.scored, 0)).toBe(pts);
    }
  });

  test('old vs new', () => {
    if (!model) return;
    const out = [];
    for (const side of ['byu', 'opp']) {
      const o = lineupStints(data.plays, side), n = model.stints(side);
      const drift = n.filter((s) => { const m = o.find((x) => x.key === s.key && Math.abs(x.startMin - s.startMin) < 3); return m && Math.abs(m.startMin - s.startMin) > 1e-6; });
      const shifts = n.map((s) => { const m = o.find((x) => x.key === s.key && Math.abs(x.startMin - s.startMin) < 3); return m ? Math.abs(m.startMin - s.startMin) * 60 : null; }).filter((x) => x !== null);
      out.push(`${side}: stints old ${o.length} new ${n.length}; edges moved ${drift.length}, median shift ${shifts.sort((a, b) => a - b)[shifts.length >> 1]?.toFixed(0)}s, max ${Math.max(...shifts).toFixed(0)}s`);
    }
    // eslint-disable-next-line no-console
    console.log(file, '\n' + out.join('\n'));
  });
});
