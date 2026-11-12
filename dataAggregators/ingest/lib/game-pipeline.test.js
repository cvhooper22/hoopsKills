// node --test ingest/lib/game-pipeline.test.js
const test = require('node:test');
const assert = require('node:assert');
const { classify, rollupGameIds } = require('./game-pipeline');

const base = { live: false, filesPresent: [true, true, true], inIndex: true, missingRollups: [], ingestedAt: 100, uploadedAt: 200 };

test('classify: a game with everything uploaded after its ingest is deployed', () => {
  assert.strictEqual(classify(base), 'deployed');
});

test('classify: nothing on S3 is not-deployed, a gap is partial', () => {
  assert.strictEqual(classify({ ...base, filesPresent: [false, false, false] }), 'not-deployed');
  assert.strictEqual(classify({ ...base, filesPresent: [true, false, true] }), 'partial');
  assert.strictEqual(classify({ ...base, inIndex: false }), 'partial');
  assert.strictEqual(classify({ ...base, missingRollups: ['kills'] }), 'partial');
});

test('classify: an ingest newer than the newest upload is stale; live wins over everything', () => {
  assert.strictEqual(classify({ ...base, ingestedAt: 300 }), 'stale');
  assert.strictEqual(classify({ ...base, live: true, filesPresent: [false] }), 'live');
});

test('rollupGameIds reads byGame[] (kills, clutch) and games{} (lineups)', () => {
  assert.deepStrictEqual([...rollupGameIds({ byGame: [{ gameId: 'a' }, { gameId: 'b' }] })], ['a', 'b']);
  assert.deepStrictEqual([...rollupGameIds({ games: { a: {}, b: {} } })], ['a', 'b']);
  assert.strictEqual(rollupGameIds(null), null);
  assert.strictEqual(rollupGameIds({}), null);
});
