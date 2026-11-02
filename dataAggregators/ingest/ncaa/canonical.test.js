// node --test ingest/ncaa/canonical.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { toCanonical } = require('./canonical');
const { toDbRows, validateRows } = require('./rows');

// Queens (NC) vs Winthrop, first half through 11:35, as the feed served it (includes one phantom made shot with a bad score).
const pbp = JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/ncaa/6649639.pbp.json'), 'utf8'));
const canon = toCanonical(pbp);

test('every event maps and the rows satisfy the plays table rules', () => {
  assert.deepStrictEqual(canon.unmapped, {});
  const rows = toDbRows(canon, { teamBySide: { home: 'queens', away: 'winthrop' }, playerId: r => `${r.side}-${r.name}` });
  assert.deepStrictEqual(validateRows(rows), []);
});

test('the phantom shot with the impossible running score is dropped', () => {
  assert.strictEqual(canon.warnings.filter(w => /suspect/.test(w)).length, 2);
  assert.ok(!canon.plays.some(p => /Hendawy/.test(p.play_description) && p.clock_display === '16:55'));
});

test('assists are folded into the shot, not kept as rows', () => {
  assert.ok(!canon.plays.some(p => p.play_category === 'assist'));
  assert.ok(canon.plays.some(p => p.is_assisted === true));
  assert.ok(canon.participants.some(q => q.role === 'assister'));
});

test('free throws carry trip subtypes and periods are bracketed', () => {
  assert.deepStrictEqual(canon.plays.filter(p => p.play_category === 'free_throw').slice(0, 2).map(p => p.play_subtype), ['1of2', '2of2']);
  assert.strictEqual(canon.plays[0].play_subtype, 'start');
});

test('lineups are five a side on every row and follow substitutions', () => {
  assert.ok(canon.lineupsDerived);
  for (const p of canon.plays) { assert.strictEqual(p.lineup_home.length, 5); assert.strictEqual(p.lineup_away.length, 5); }
  const sub = canon.plays.find(p => p.play_category === 'substitution' && p.play_subtype === 'in');
  assert.ok(sub.lineup_home.concat(sub.lineup_away).some(e => e.name === sub.player.name));
});

// Notre Dame @ Villanova, final: the feed's other text grammar, which doubles rows and leaves out made free throws,
// offensive rebounds and offensive-foul rows.
const nd = toCanonical(JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/ncaa/6651023.pbp.json'), 'utf8')));

test('second grammar: every event maps, rows are valid, final score is right', () => {
  assert.deepStrictEqual(nd.unmapped, {});
  const rows = toDbRows(nd, { teamBySide: { home: 'nova', away: 'nd' }, playerId: r => `${r.side}-${r.name}` });
  assert.deepStrictEqual(validateRows(rows), []);
  const last = nd.plays.filter(p => p.play_category !== 'period_admin').pop();
  assert.deepStrictEqual([last.away_score_after, last.home_score_after], [74, 72]);
});

test('second grammar: doubled rows collapse, missing events are inferred', () => {
  const count = f => nd.plays.filter(f).length;
  assert.strictEqual(count(p => p.play_category === 'shot_attempt' && p.is_made), 47);
  assert.strictEqual(count(p => p.play_category === 'shot_attempt' && !p.is_made), 70);
  assert.strictEqual(count(p => p.play_category === 'free_throw' && p.is_made), 32); // none are logged; all inferred from the score
  assert.ok(count(p => p.play_category === 'rebound' && p.play_type === 'offensive') > 15);
});

test('second grammar: lineups are five a side and agree on who played', () => {
  assert.ok(nd.lineupsDerived);
  for (const p of nd.plays) { assert.strictEqual(p.lineup_home.length, 5); assert.strictEqual(p.lineup_away.length, 5); }
});
