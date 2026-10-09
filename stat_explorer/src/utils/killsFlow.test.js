import { detectKills } from './kills';
import { scoreSeries, stepPoints, flowSpans } from './killsFlow';

const sample = require('../../../data/sampleGame.json');

describe('killsFlow', () => {
  const plays = Array.isArray(sample) ? sample : sample.plays;
  it('builds spans for every kill and potential kill', () => {
    if (!plays || !plays[0] || plays[0].game_seconds_elapsed === undefined) return; // sample is not a normalized game
    const result = detectKills(plays, 'home');
    const series = scoreSeries(plays, 'home');
    const spans = flowSpans(plays, series, result, 'home');
    expect(spans).toHaveLength(result.kills.length + result.potentialKills.length);
    spans.forEach((s) => expect(s.t1).toBeGreaterThanOrEqual(s.t0));
    expect(stepPoints(series, 'byu')[0]).toEqual({ t: 0, score: 0 });
  });
});
