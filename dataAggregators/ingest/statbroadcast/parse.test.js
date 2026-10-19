// node --test ingest/statbroadcast/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { normalizeGame, extractHeader } = require('./parse');
const { parseBox } = require('./box');
const { addLineups } = require('./canonical');

const fx = f => fs.readFileSync(path.join(__dirname, '../../fixtures/statbroadcast', f), 'utf8');
const pages = [fx('610232-period1.html'), fx('610232-period2.html')];
const box = fx('610232-box.html');
const box_ = box;
const game = normalizeGame(pages, {}, { boxHtml: box });
const by = cat => game.plays.filter(p => p.play_category === cat);

test('reconciles to the final score with no check failures', () => {
  assert.deepStrictEqual(game.checks, []);
  const real = game.plays.filter(p => p.play_category !== 'period_admin');
  assert.strictEqual(real.length, 513);
  const last = game.plays[game.plays.length - 1];
  assert.deepStrictEqual([last.away_score_after, last.home_score_after], [66, 71]);
});

test('box score: starters flagged, team row skipped', () => {
  const b = parseBox(box);
  assert.deepStrictEqual(b.away.filter(p => p.starter).map(p => p.jersey), ['4', '5', '24', '33', '55']);
  assert.deepStrictEqual(b.home.filter(p => p.starter).map(p => p.jersey), ['1', '3', '13', '15', '30']);
  assert.strictEqual(b.home.length, 10);
  assert.strictEqual(b.home[0].name, 'wright iii, robert');
  assert.strictEqual(b.home[1].stats.pts, 21);
});

test('canonical vocabulary', () => {
  const ft = by('free_throw');
  assert.ok(ft.length > 0 && ft.every(p => /^\dof\d$/.test(p.play_subtype)));
  assert.deepStrictEqual([...new Set(by('timeout').map(p => p.play_type))].sort(), ['commercial', 'short']);
  const held = game.plays.filter(p => p.play_type === 'heldball');
  assert.strictEqual(held.length, 1);
  assert.strictEqual(held[0].play_category, 'jumpball');
});

test('foul qualifiers use the WMT spelling', () => {
  const q = by('foul').flatMap(p => p.play_qualifiers || []);
  assert.ok(q.includes('shooting') && q.includes('oneandone'));
});

test('period admin rows: a start per period, an end per period once final, in order', () => {
  const admin = by('period_admin').map(p => `${p.period_number}:${p.play_subtype}`);
  assert.deepStrictEqual(admin, ['1:start', '1:end', '2:start', '2:end']);
  const seq = game.plays.map(p => p.period_number * 1e6 + (p.sources.statbroadcast.row));
  assert.deepStrictEqual(seq, [...seq].sort((a, b) => a - b));
});

test('period end is not emitted for an unfinished last period', () => {
  const live = normalizeGame(pages.map(p => p.replace('completedGame = true', 'completedGame = false').replace(/(font-size-300[^>]*>)Final</g, '$1In Progress<')), {}, { boxHtml: box });
  assert.deepStrictEqual(live.plays.filter(p => p.play_category === 'period_admin').map(p => `${p.period_number}:${p.play_subtype}`), ['1:start', '1:end', '2:start']);
});

test('lineups: five a side on every row, starters first, minutes agree with the box', () => {
  assert.ok(game.plays.every(p => p.lineup_home.length === 5 && p.lineup_away.length === 5));
  assert.deepStrictEqual(game.plays[0].lineup_away.map(e => e.jersey), ['4', '5', '24', '33', '55']);
  assert.deepStrictEqual(game.warnings.filter(w => /subbed|floor|starters|minutes/.test(w)), []);
});

test('without the box score there are no lineups', () => {
  const nobox = normalizeGame(pages, {});
  assert.ok(nobox.plays.every(p => p.lineup_home === undefined));
});

test('header of a live page: icon before the team name, period and clock in separate divs', () => {
  const live = '<div class="sb-teamname sb-teamnameV"><i class="fas fa-arrow-right"></i><span class="seed"></span>Nebraska</div>' +
    '<span class="sb-teamscore sb-teamscoreV">8</span><div class="sb-teamname sb-teamnameH"><span class="seed"></span>BYU</div><span class="sb-teamscore sb-teamscoreV">7</span>' +
    '<div class="row sb-statusbar-clock mb-0"><div class="h-100"><div class="lead"><div class="x">1st</div><div class="y">15:35</div></div></div></div><div class="z"></div>' +
    '<script>completedGame = false; window._sbe="677129"</script>';
  assert.deepStrictEqual(extractHeader(live), { sbEventId: '677129', awayName: 'Nebraska', homeName: 'BYU', awayScore: 8, homeScore: 7, statusText: '1st 15:35', isFinal: false });
});

test('lineups: a player who subbed in after the box score was read still gets a name', () => {
  const box = parseBox(box_);
  const sub = (jersey, name, kind, seq) => ({ source_play_id: `p1-${seq}`, play_category: 'substitution', play_subtype: kind, team_side: 'home', player: { team: 'BYU', jersey, name } });
  // BYU #99 is not in the box fixture
  const plays = [sub('1', 'wright iii, robert', 'out', 1), sub('99', 'newguy, nate', 'in', 2)];
  const { warnings } = addLineups(plays, box);
  assert.deepStrictEqual(warnings, []);
  assert.ok(plays[1].lineup_home.some(e => e.jersey === '99' && e.name === 'newguy, nate'));
  assert.ok(plays[1].lineup_home.every(e => e.name));
});
