// PROTOTYPE: the custom-metric suite for ONE game (handoff §2-§8 plus the Havoc doc), computed from the
// normalized plays in the local pbp db. In-memory only: no tables written, nothing exported or uploaded.
// Usage: node derivations/game-box-prototype.js [gameId]            -> out/box-<gameId>.md + .json
//        node derivations/game-box-prototype.js --validate          -> compares the segmenter to the §10.1 hand counts (Feb 7 Houston game)
// Win probability / WPA / free-throw WP cost come from wp-prototype.js (computeWp, called in-process).
// computeBox() is pure (no database, no files) so the live service can call it on every update; main() is the CLI wrapper.
const fs = require('fs');
const path = require('path');
const { connect } = require('../db/client');
const { computeWp, loadWpInput } = require('./wp-prototype');
const { loadPriors, expectedMargin } = require('./priors');

// ---- parameters (named, per handoff ground rules; not hard-coded below) ----
const P = {
  TRANSITION_WINDOW_SEC: 5, QUICK_WINDOW_SEC: 5, QUICK_MAKE_WINDOW_SEC: 8, LATE_GAME_EXCLUDE_SEC: 120,
  MIN_N_FOR_RATE: 10, LEAGUE_FT_PCT: 0.72, SHRINK_K: 20,
  SHOT_CLOCK_LEN: 30, SQUEEZE_REMAINING_SEC: 5, LAG_AFTER_MAKE_SEC: 3, // estimated shot clock (no real one in the data)
  CONVERT_WINDOW_SEC: 8,
  HAVOC_W_LATE: 0.5, HAVOC_W_EARLY: 0.25, // PLACEHOLDERS: one game cannot fit these
  TRIP_RIM_TYPES: ['layup', 'dunk', 'tip', 'alleyoop'],
};
const FORCED_TO = new Set(['offensive', 'shotclock', '5sec', '10sec']);
const args = process.argv.slice(2);
const VALIDATE = args.includes('--validate');
const GAME_ID = VALIDATE ? '2026-02-07-houston-at-byu' : args.find((a) => !a.startsWith('--')) || '2026-03-12-byu-at-houston';
const FOCUS = 'byu';
const sides = ['byu', 'opp'];
const other = (s) => (s === 'byu' ? 'opp' : s === 'opp' ? 'byu' : null);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '–');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '–');
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '–');
const pct1 = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '–');
const sgnf = (x, d = 1) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
const div = (a, b) => (b ? a / b : NaN);
const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);

async function load(client, gameId) {
  const { rows: [game] } = await client.query('SELECT * FROM games WHERE game_id = $1', [gameId]);
  const { rows } = await client.query(
    `SELECT p.play_id, p.sequence_number sn, p.period_number per, p.clock_seconds_remaining clk, p.team_id, p.player_id,
            pl.name, p.play_category cat, p.play_type type, p.play_subtype sub, p.is_made made, p.shot_value val,
            p.home_score_after hs, p.away_score_after as_, p.play_qualifiers quals, p.linked_play_id linked,
            p.lineup_home lh, p.lineup_away la
       FROM plays p LEFT JOIN players pl USING (player_id) WHERE p.game_id = $1 ORDER BY p.sequence_number`, [gameId]);
  const { rows: parts } = await client.query(
    `SELECT p.sequence_number sn, pp.role, pl.name FROM play_participants pp JOIN plays p USING (play_id)
       JOIN players pl ON pl.player_id = pp.player_id WHERE p.game_id = $1`, [gameId]);
  const roles = {};
  for (const r of parts) (roles[r.sn] ||= {})[r.role] = r.name;
  const { rows: pn } = await client.query('SELECT player_id, name FROM players');
  const names = Object.fromEntries(pn.map((r) => [r.player_id, r.name]));
  const homeIsFocus = game.home_team_id === FOCUS;
  const evs = rows.map((r, i) => ({
    ...r, i, side: r.team_id === FOCUS ? 'byu' : r.team_id ? 'opp' : null,
    rem: r.per <= 2 ? (2 - r.per) * 1200 + (r.clk ?? 0) : (r.clk ?? 0),
    lead: homeIsFocus ? r.hs - r.as_ : r.as_ - r.hs,
    lineupByu: (homeIsFocus ? r.lh : r.la) || [], lineupOpp: (homeIsFocus ? r.la : r.lh) || [],
    quals: r.quals || [],
  }));
  const finalByu = homeIsFocus ? game.final_score_home : game.final_score_away;
  const finalOpp = homeIsFocus ? game.final_score_away : game.final_score_home;
  return { game, evs, roles, names, finalByu, finalOpp, oppId: homeIsFocus ? game.away_team_id : game.home_team_id };
}

// ---------------------------------------------------------------------------------------------------------
// §2 possession / play segmentation (in memory). Plays and possessions per the handoff definitions.
// ---------------------------------------------------------------------------------------------------------
// live: the game is still in progress, so the last possession is open: it ends where the data does, not at 0:00.
function segment(evs, live = false) {
  const poss = [];
  const techPts = { byu: 0, opp: 0 };
  let cur = null, awaitReb = null, pendingTO = null, restart = null; // restart: {rem, held} set at period start / held ball; the first actor takes the ball
  const hasLiveSteal = (i) => evs.some((x, j) => Math.abs(j - i) <= 3 && x.cat === 'steal' && x.per === evs[i].per && x.clk === evs[i].clk && x.side !== evs[i].side);
  const newPlay = (kind, rem, i) => {
    const pl = { kind, startRem: rem, startIdx: i, events: [], shots: [], points: 0, endRem: null, endReason: null, action: false, timeoutBefore: pendingTO || 'none', poss: cur };
    pendingTO = null; cur.plays.push(pl); cur.play = pl; return pl;
  };
  const newPoss = (team, type, rem, i, extra = {}) => {
    cur = { id: poss.length, team, startType: type, startRem: rem, startIdx: i, startSn: evs[i].sn, period: evs[i].per, plays: [], endReason: null, endRem: null, ...extra };
    poss.push(cur); newPlay('poss', rem, i); return cur;
  };
  const closePlay = (reason, rem, i, force = false) => { const pl = cur && cur.play; if (pl && (pl.endReason == null || force)) { pl.endReason = reason; pl.endRem = rem; pl.endIdx = i; } };
  const closePoss = (reason, rem) => { if (cur) { cur.endReason = reason; cur.endRem = rem; } };
  const ftFollows = (i, shooter) => {
    const e = evs[i];
    for (let j = i + 1; j < Math.min(evs.length, i + 14); j++) {
      const x = evs[j];
      if (x.per !== e.per || Math.abs(x.clk - e.clk) > 1) break;
      if (x.cat === 'free_throw' && x.side === shooter) return true;
      if (x.cat === 'shot_attempt' || x.cat === 'turnover' || x.cat === 'rebound') break;
    }
    return false;
  };
  const recentTech = (i) => evs.slice(Math.max(0, i - 6), i).some((x) => x.cat === 'foul' && /technical/i.test(x.type));
  const preferTO = (a, b) => (a === 'none' || a === 'media' ? b : a);
  const ensurePoss = (s, i, rem) => {
    if (!cur || cur.team !== s) {
      if (cur) { const why = restart && restart.held ? 'held_ball' : 'glitch'; closePlay(why, restart ? restart.rem : rem, i); closePoss(why, restart ? restart.rem : rem); }
      newPoss(s, 'after_other_dead_ball', restart ? restart.rem : rem, i);
    }
    restart = null;
  };

  for (let i = 0; i < evs.length; i++) {
    const e = evs[i], s = e.side;
    if (restart && ['rebound', 'turnover'].includes(e.cat)) restart = null;
    if (e.cat === 'jumpball') {
      if (e.type === 'won' && !poss.length) newPoss(s, 'after_other_dead_ball', e.rem, i);
      else if (e.type === 'heldball') { restart = { rem: e.rem, held: true }; awaitReb = null; }
    } else if (e.cat === 'period_admin' && e.type === 'period') {
      if (e.sub === 'start' && e.per >= 2) restart = { rem: e.rem, held: false };
      if (e.sub === 'end') { if (cur) { closePlay('period_end', e.rem, i); closePoss('period_end', e.rem); } cur = null; awaitReb = null; }
    } else if (e.cat === 'shot_attempt') {
      ensurePoss(s, i, e.rem); awaitReb = null;
      const pl = cur.play; pl.events.push(i); pl.shots.push(i); pl.action = true;
      if (e.made) {
        pl.points += e.val;
        if (!ftFollows(i, s)) { closePlay('made_fg', e.rem, i); closePoss('made_fg', e.rem); newPoss(other(s), 'after_made_FG', e.rem, i); }
      } else if (!ftFollows(i, s)) { closePlay('missed_fg', e.rem, i); awaitReb = { team: s, ft: false }; }
    } else if (e.cat === 'free_throw') {
      const [n, m] = e.sub.split('of').map(Number);
      if (recentTech(i)) { techPts[s] += e.made ? 1 : 0; continue; }
      ensurePoss(s, i, e.rem);
      const pl = cur.play; pl.events.push(i); pl.action = true; pl.points += e.made ? 1 : 0;
      if (n === m) {
        if (e.made) { closePlay('ft', e.rem, i, true); closePoss('ft', e.rem); newPoss(other(s), 'after_made_FT', e.rem, i); awaitReb = null; }
        else { closePlay('ft_miss', e.rem, i, true); awaitReb = { team: s, ft: true }; }
      }
    } else if (e.cat === 'rebound') {
      if (e.sub === 'deadball') continue;
      if (awaitReb) {
        if (s === awaitReb.team) { const pl = newPlay('oreb', e.rem, i); pl.rebIdx = i; }
        else { closePoss('def_rebound', e.rem); newPoss(s, 'after_def_rebound', e.rem, i, { ftMiss: awaitReb.ft }); }
        awaitReb = null;
      }
    } else if (e.cat === 'turnover') {
      if (awaitReb && s === awaitReb.team) { newPlay('oreb', e.rem, i); awaitReb = null; }
      ensurePoss(s, i, e.rem);
      cur.play.events.push(i); cur.play.action = true;
      closePlay('turnover', e.rem, i, true); closePoss('turnover', e.rem);
      const live = hasLiveSteal(i);
      newPoss(other(s), live ? 'after_live_ball_TO' : 'after_dead_ball_TO', e.rem, i, { liveTO: live });
      awaitReb = null;
    } else if (e.cat === 'timeout') {
      const who = e.type === 'commercial' ? 'media' : e.side;
      if (cur && !awaitReb && !cur.play.action && cur.play.endReason == null) cur.play.timeoutBefore = preferTO(cur.play.timeoutBefore, who);
      else pendingTO = preferTO(pendingTO || 'none', who);
    }
  }
  if (cur) { const endRem = live ? evs[evs.length - 1].rem : 0; closePlay(live ? 'in_progress' : 'end', endRem, evs.length - 1); closePoss(live ? 'in_progress' : 'end', endRem); }
  // drop zero-length phantom possessions (e.g. the "ball" after a buzzer-beater make)
  const real = poss.filter((p) => p.plays.some((pl) => pl.action) || p.startRem - (p.endRem ?? 0) >= 2);
  real.forEach((p, k) => { p.id = k; p.pts = sum(p.plays, (pl) => pl.points); });
  return { poss: real, techPts };
}

function labelPlays(poss) {
  const plays = [];
  for (const p of poss) {
    p.plays.forEach((pl, k) => {
      const dur = pl.startRem - (pl.endRem ?? pl.startRem);
      pl.dur = dur; pl.offense = p.team; pl.k = k; pl.sub = null;
      if (k === 0) {
        const fastStart = p.startType === 'after_def_rebound' || p.startType === 'after_live_ball_TO';
        if (fastStart && pl.action && dur <= P.TRANSITION_WINDOW_SEC) pl.label = 'transition';
        else {
          pl.label = 'initial_halfcourt';
          const late = p.period >= 2 && pl.startRem <= P.LATE_GAME_EXCLUDE_SEC;
          pl.sub = p.startType === 'after_made_FG' && pl.action && dur <= P.QUICK_MAKE_WINDOW_SEC && !late ? 'quick_off_make' : pl.timeoutBefore === p.team ? 'ato_own' : 'standard';
        }
      } else pl.label = dur <= P.QUICK_WINDOW_SEC && pl.action ? 'quick_putback' : 'reset';
      pl.bucket = pl.label === 'initial_halfcourt' ? pl.sub : pl.label;
      plays.push(pl);
    });
  }
  return plays;
}

const BUCKETS = [
  ['transition', 'Transition'], ['quick_off_make', 'Quick off a make'], ['ato_own', 'After own timeout'],
  ['standard', 'Half-court (first shot)'], ['quick_putback', 'Quick putbacks'], ['reset', 'Reset second chances'],
];
const bucketAgg = (plays, side) => Object.fromEntries(BUCKETS.map(([k]) => {
  const ps = plays.filter((pl) => pl.offense === side && pl.bucket === k);
  return [k, { pts: sum(ps, (x) => x.points), n: ps.length }];
}));


// §10.1 hand counts: [poss, pts, quick 2nd-ch pts, FB pts, reset trips, 2nd-ch pts, FB poss]
const HAND = {
  '2026-02-07-houston-at-byu': { opp: [59, 77, 7, 4, 8, 17, 3], byu: [58, 66, 8, 5, 7, 11, 7] },
  '2026-01-31-byu-at-kansas': { opp: [66, 90, 7, 11, 0, 7, 9], byu: [66, 82, 10, 2, 4, 13, 3] },
  '2026-01-26-arizona-at-byu': { opp: [72, 86, 1, 18, 4, 6, 17], byu: [75, 83, 9, 6, 6, 14, 4] },
  '2026-02-28-byu-at-west-virginia': { opp: [61, 79, 12, 7, 9, 15, 3], byu: [64, 71, 8, 13, 4, 8, 15] },
};
async function validate(client) {
  const loaded = {};
  for (const id of Object.keys(HAND)) { const D = await load(client, id); loaded[id] = { D, seg: segment(D.evs) }; }
  const stat = (id, s) => {
    const { seg } = loaded[id]; const plays = labelPlays(seg.poss), ps = plays.filter((p) => p.offense === s), pts = (a) => sum(a, (x) => x.points);
    const tr = ps.filter((p) => p.label === 'transition'), qp = ps.filter((p) => p.label === 'quick_putback'), rs = ps.filter((p) => p.label === 'reset');
    return [seg.poss.filter((p) => p.team === s).length, pts(ps) + (seg.techPts[s] || 0), pts(qp), pts(tr), rs.length, pts(qp) + pts(rs), tr.length];
  };
  const names = ['poss', 'pts', 'quick 2nd-ch pts', 'FB pts', 'reset trips', '2nd-ch pts', 'FB poss'];
  console.log('TRANSITION_WINDOW_SEC sweep: total |mine − hand| over 4 games × 2 teams (FB possessions, FB points)');
  const tw0 = P.TRANSITION_WINDOW_SEC;
  for (const w of [3, 4, 5, 6, 7, 8, 10]) {
    P.TRANSITION_WINDOW_SEC = w; let ep = 0, ef = 0;
    for (const id of Object.keys(HAND)) for (const s of sides) { const m = stat(id, s), h = HAND[id][s]; ep += Math.abs(m[6] - h[6]); ef += Math.abs(m[3] - h[3]); }
    console.log(`  ${String(w).padStart(2)}s   FB poss err ${ep}   FB pts err ${ef}`);
  }
  P.TRANSITION_WINDOW_SEC = Number(args.find((a) => a.startsWith('--tw='))?.slice(5) || tw0);
  console.log(`\nDetail at TRANSITION_WINDOW_SEC=${P.TRANSITION_WINDOW_SEC} (tolerance ±3 poss / ±5 pts per bucket)`);
  for (const id of Object.keys(HAND)) for (const s of sides) {
    const m = stat(id, s), h = HAND[id][s], D = loaded[id].D;
    const bad = names.map((n, k) => [n, h[k], m[k], Math.abs(m[k] - h[k]) > ([0, 4, 6].includes(k) ? 3 : 5)]).filter((x) => x[3]);
    const fm = (() => { const x = loaded[id].D.evs.filter((e) => e.side === s); const c = (f) => x.filter(f).length; return c((e) => e.cat === 'shot_attempt') - c((e) => e.cat === 'rebound' && e.type === 'offensive' && e.sub !== 'deadball') + c((e) => e.cat === 'turnover') + 0.44 * c((e) => e.cat === 'free_throw'); })();
    console.log(`  ${id.padEnd(33)} ${s === 'byu' ? 'BYU' : 'opp'} off [formula poss ${fm.toFixed(1)}] ${names.map((n, k) => `${n} ${h[k]}/${m[k]}`).join('  ')}${bad.length ? '   OUTSIDE: ' + bad.map((x) => x[0]).join(', ') : ''}`);
  }
}

async function loadRim(client) {
  const { rows: [rim] } = await client.query(
    `SELECT count(*)::int att, sum(is_made::int)::int made FROM plays WHERE play_category = 'shot_attempt' AND play_type = ANY($1)`, [P.TRIP_RIM_TYPES]);
  return rim;
}

// WP inputs for a game: the prior comes from config/game-priors.csv; with no row it is an even matchup, and says so.
async function loadWp(client, gameId, game) {
  const mu = expectedMargin(loadPriors(), game);
  const input = await loadWpInput(client, gameId);
  const R = computeWp(input, { mu: mu === null ? 0 : mu, prior: mu === null ? 'none (even matchup)' : 'config/game-priors.csv' });
  return R && JSON.parse(JSON.stringify(R.json)); // same shape the old child-process JSON file had
}

async function main() {
  const client = await connect();
  if (VALIDATE) { await validate(client); await client.end(); return; }
  const D = await load(client, GAME_ID);
  const rim = await loadRim(client);
  const W = await loadWp(client, GAME_ID, D.game);
  await client.end();
  const { L, payload, checks } = computeBox({ D, rim, W });
  const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `box-${GAME_ID}.md`), L.join('\n'));
  fs.writeFileSync(path.join(outDir, `box-${GAME_ID}.json`), JSON.stringify(payload, null, 1));
  // local front-end preview: the stat_explorer app reads public/data/box (see assetUrls.boxGame)
  const pub = path.join(__dirname, '..', '..', 'stat_explorer', 'public', 'data', 'box');
  fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(path.join(pub, `${GAME_ID}.json`), JSON.stringify(payload));
  const index = fs.readdirSync(pub).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => { const h = JSON.parse(fs.readFileSync(path.join(pub, f), 'utf8')).header; return { gameId: h.gameId, date: h.date, label: `${h.teams.byu} ${h.final.byu}, ${h.teams.opp} ${h.final.opp}` }; }).sort((a, b) => (a.date < b.date ? 1 : -1));
  fs.writeFileSync(path.join(pub, 'index.json'), JSON.stringify(index));
  console.log(L.join('\n'));
  console.log('\nFAILED CHECKS:', checks.filter((c) => !c.ok).map((c) => c.name + ' ' + c.detail).join(' | ') || 'none');
}

/**
 * The whole custom-metric suite for one game, from already-loaded data. D = load(); rim = loadRim(); W = the WP
 * result (see loadWp). Returns { L: markdown lines, payload, checks }. A game with status 'live' is handled:
 * the running score stands in for the final, the open possession is left out of the possession counts unless
 * it has already produced an action, and the headline reads "Leading/Trailing".
 */
function computeBox({ D, rim, W }) {
  const { evs, roles, names, game } = D;
  const live = game.status === 'live';
  const { poss, techPts } = segment(evs, live);
  const plays = labelPlays(poss);
  const teamName = { byu: 'BYU', opp: D.oppId[0].toUpperCase() + D.oppId.slice(1) };
  const finalPts = { byu: D.finalByu, opp: D.finalOpp };

  // ----- identities / checks -----
  const checks = [];
  const chk = (name, ok, detail) => checks.push({ name, ok, detail });
  for (const s of sides) chk(`${teamName[s]} points: plays + tech FT = final`, sum(plays.filter((p) => p.offense === s), (p) => p.points) + techPts[s] === finalPts[s], `${sum(plays.filter((p) => p.offense === s), (p) => p.points)} + ${techPts[s]} vs ${finalPts[s]}`);

  // ----- §3 defense split, per offense -----
  const split = {};
  for (const s of sides) {
    const ps = plays.filter((p) => p.offense === s), pos = poss.filter((p) => p.team === s);
    const A = (f) => ps.filter(f);
    const pts = (a) => sum(a, (x) => x.points);
    const ih = A((p) => p.label === 'initial_halfcourt'), tr = A((p) => p.label === 'transition'), qp = A((p) => p.label === 'quick_putback'), rs = A((p) => p.label === 'reset');
    const ihNoQ = ih.filter((p) => p.sub !== 'quick_off_make');
    const oreb = evs.filter((e) => e.side === s && e.cat === 'rebound' && e.type === 'offensive' && e.sub !== 'deadball').length;
    const dreb = evs.filter((e) => e.side === other(s) && e.cat === 'rebound' && e.type === 'defensive' && e.sub !== 'deadball').length;
    split[s] = {
      poss: pos.length, plays: ps.length, pts: pts(ps), ppp: div(pts(ps), pos.length), playsPerPoss: div(ps.length, pos.length), ppPlay: div(pts(ps), ps.length),
      firstShot: { n: ih.length, pts: pts(ih), ppp: div(pts(ih), ih.length) },
      firstShotNoQuick: { n: ihNoQ.length, pts: pts(ihNoQ), ppp: div(pts(ihNoQ), ihNoQ.length) },
      setHC: { n: ih.length + rs.length, pts: pts(ih) + pts(rs), ppp: div(pts(ih) + pts(rs), ih.length + rs.length) },
      transition: { n: tr.length, pts: pts(tr), ppp: div(pts(tr), tr.length) },
      quickPutback: { n: qp.length, pts: pts(qp), ppp: div(pts(qp), qp.length) },
      reset: { n: rs.length, pts: pts(rs), ppp: div(pts(rs), rs.length) },
      secondChancePts: pts(qp) + pts(rs), orebRate: div(oreb, oreb + dreb), oreb, dreb,
    };
    const x = split[s];
    chk(`${teamName[s]} identity: points = sum of labels`, x.pts === x.transition.pts + x.firstShot.pts + x.quickPutback.pts + x.reset.pts, '');
    chk(`${teamName[s]} identity: possessions = transition + initial plays`, x.poss === x.transition.n + x.firstShot.n, `${x.poss} vs ${x.transition.n}+${x.firstShot.n}`);
    chk(`${teamName[s]} identity: PPP = pts/play × plays/poss`, Math.abs(x.ppp - x.ppPlay * x.playsPerPoss) < 1e-9, '');
  }
  const formulaPoss = (s) => { const m = evs.filter((e) => e.side === s); const fga = m.filter((e) => e.cat === 'shot_attempt').length, fta = m.filter((e) => e.cat === 'free_throw').length, orb = m.filter((e) => e.cat === 'rebound' && e.type === 'offensive' && e.sub !== 'deadball').length, tov = m.filter((e) => e.cat === 'turnover').length; return { fga, fta, orb, tov, poss: fga - orb + tov + 0.44 * fta }; };

  // ----- WP / WPA / FT trips from the other prototype -----

  // ----- §8.1 margin breakdown -----
  const agg = { byu: bucketAgg(plays, 'byu'), opp: bucketAgg(plays, 'opp') };
  for (const s of sides) agg[s].other = { pts: techPts[s], n: 0 };
  const bucketRows = [...BUCKETS, ['other', 'Other (technical FTs)']].map(([k, label]) => ({ k, label, byu: agg.byu[k], opp: agg.opp[k], net: agg.byu[k].pts - agg.opp[k].pts }));
  chk('§8.1 nets sum to final margin', sum(bucketRows, (r) => r.net) === D.finalByu - D.finalOpp, `${sum(bucketRows, (r) => r.net)} vs ${D.finalByu - D.finalOpp}`);
  const margin = D.finalByu - D.finalOpp;
  const headline = (() => {
    const r = bucketRows.filter((x) => x.k !== 'other').map((x) => ({ ...x })); // group second chances when same sign
    const qp = r.find((x) => x.k === 'quick_putback'), rs = r.find((x) => x.k === 'reset');
    let items = r.filter((x) => x.k !== 'quick_putback' && x.k !== 'reset').map((x) => ({ label: x.label.toLowerCase().replace(' (first shot)', ''), net: x.net }));
    if (Math.sign(qp.net) === Math.sign(rs.net) || qp.net === 0 || rs.net === 0) items.push({ label: 'second chances', net: qp.net + rs.net });
    else items.push({ label: 'quick putbacks', net: qp.net }, { label: 'reset second chances', net: rs.net });
    const bad = items.filter((x) => (margin < 0 ? x.net < 0 : x.net > 0)).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 2);
    const good = items.filter((x) => (margin < 0 ? x.net > 0 : x.net < 0)).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 1);
    return `${live && margin === 0 ? 'Tied' : (live ? (margin < 0 ? 'Trailing' : 'Leading') : margin < 0 ? 'Lost' : 'Won') + ' by ' + Math.abs(margin)}: ${[...bad, ...good].map((x) => `${x.net > 0 ? '+' : '−'}${Math.abs(x.net)} ${x.label}`).join(', ')}.`;
  })();

  // ----- §6 situational: quick off a make, ATO -----
  const lateStart = (pl) => pl.poss.period >= 2 && pl.startRem <= P.LATE_GAME_EXCLUDE_SEC;
  const afterMake = {};
  for (const s of sides) {
    const pop = poss.filter((p) => p.team === s && p.startType === 'after_made_FG' && !(p.period >= 2 && p.startRem <= P.LATE_GAME_EXCLUDE_SEC));
    const q = pop.filter((p) => p.plays[0].sub === 'quick_off_make'), nq = pop.filter((p) => p.plays[0].sub !== 'quick_off_make');
    afterMake[s] = { pop: pop.length, quick: q.length, quickPts: sum(q, (p) => p.pts), quickPPP: div(sum(q, (p) => p.pts), q.length), pushRate: div(q.length, pop.length), nonQuickPPP: div(sum(nq, (p) => p.pts), nq.length), nonQuickN: nq.length };
  }
  const ato = {};
  for (const s of sides) {
    ato[s] = {};
    for (const kind of ['own', 'opponent', 'media']) {
      const ps = plays.filter((pl) => pl.offense === s && pl.timeoutBefore !== 'none' && (kind === 'media' ? pl.timeoutBefore === 'media' : kind === 'own' ? pl.timeoutBefore === s : pl.timeoutBefore === other(s)));
      const first = ps.filter((pl) => pl.k === 0 || pl.kind === 'poss');
      ato[s][kind] = { n: ps.length, scored: ps.filter((pl) => pl.points > 0).length, pts: sum(ps, (pl) => pl.points), posPts: sum([...new Set(ps.map((pl) => pl.poss))], (p) => p.pts) };
    }
  }

  // ----- §4 possession value (count + EPA) -----
  const E = {};
  for (const s of sides) {
    const pos = poss.filter((p) => p.team === s);
    const norm = div(sum(pos, (p) => p.pts), pos.length);
    const live = pos.filter((p) => p.startType === 'after_live_ball_TO');
    const orebPlays = plays.filter((pl) => pl.offense === s && pl.kind === 'oreb');
    const restPts = (pl) => sum(pl.poss.plays.slice(pl.poss.plays.indexOf(pl)), (x) => x.points);
    const ftMissDef = pos.filter((p) => p.startType === 'after_def_rebound' && p.ftMiss), madeFT = pos.filter((p) => p.startType === 'after_made_FT');
    E[s] = {
      norm, liveN: live.length, liveRaw: div(sum(live, (p) => p.pts), live.length),
      live: (sum(live, (p) => p.pts) + P.SHRINK_K * norm) / (live.length + P.SHRINK_K), // shrunk toward the team's own normal PPP
      orebN: orebPlays.length, oreb: div(sum(orebPlays, restPts), orebPlays.length), restPts,
      ftMissDefN: ftMissDef.length, afterMadeFTN: madeFT.length,
      afterFtMiss: (sum(ftMissDef, (p) => p.pts) + P.SHRINK_K * norm) / (ftMissDef.length + P.SHRINK_K),
      afterMadeFT: (sum(madeFT, (p) => p.pts) + P.SHRINK_K * norm) / (madeFT.length + P.SHRINK_K),
    };
  }
  const posByStart = new Map(poss.map((p) => [p.startSn, p]));
  const wpaBySn = {};
  for (const ev of W.events) (wpaBySn[ev.sn + ':' + ev.kind] = ev.wpa);
  const pv = []; // possession-value events
  const pairedTO = (e) => evs.find((x, j) => Math.abs(j - e.i) <= 3 && x.cat === 'turnover' && x.per === e.per && x.clk === e.clk && x.side !== e.side);
  for (const e of evs) {
    const s = e.side, o = other(s), nm = e.name || 'TEAM';
    if (e.cat === 'steal') {
      const to = pairedTO(e), nxt = to && posByStart.get(to.sn);
      pv.push({ sn: e.sn, kind: 'steal', name: nm, side: s, exp: E[o].norm + (E[s].live - E[s].norm), act: nxt ? E[o].norm + (nxt.pts - E[s].norm) : NaN, ptsAfter: nxt ? nxt.pts : NaN, nxtPoss: nxt });
    } else if (e.cat === 'rebound' && e.type === 'offensive' && e.sub !== 'deadball') {
      const pl = plays.find((x) => x.rebIdx === e.i), act = pl ? E[s].restPts(pl) : NaN;
      pv.push({ sn: e.sn, kind: 'oreb', name: nm, side: s, exp: E[s].oreb, act, ptsAfter: act, orebPlay: pl });
    } else if (e.cat === 'block') {
      const nxtReb = evs.slice(e.i + 1).find((x) => x.cat === 'rebound' || x.cat === 'shot_attempt' || x.cat === 'turnover');
      if (nxtReb && nxtReb.cat === 'rebound' && nxtReb.type === 'defensive' && nxtReb.side === s) { const nxt = posByStart.get(nxtReb.sn); pv.push({ sn: e.sn, kind: 'recovered_block', name: nm, side: s, exp: E[o].norm, act: nxt ? E[o].norm + (nxt.pts - E[s].norm) : NaN, ptsAfter: nxt ? nxt.pts : NaN, nxtPoss: nxt }); }
    } else if (e.cat === 'turnover') {
      const nxt = posByStart.get(e.sn), live = nxt && nxt.liveTO;
      const exp = live ? -(E[s].norm + (E[o].live - E[o].norm)) : -E[s].norm;
      const act = live ? -(E[s].norm + (nxt.pts - E[o].norm)) : exp;
      pv.push({ sn: e.sn, kind: live ? 'tov_live' : 'tov_dead', name: nm, side: s, exp, act, ptsAfter: nxt ? nxt.pts : NaN, nxtPoss: nxt, tovType: e.type });
      if (e.type === 'offensive') {
        const foul = evs.slice(Math.max(0, e.i - 3), e.i).find((x) => x.cat === 'foul' && x.type === 'offensive');
        const drawer = foul && roles[foul.sn] && roles[foul.sn].fouled;
        pv.push({ sn: e.sn, kind: 'charge_drawn', name: drawer || 'unattributed', side: o, exp: E[s].norm, act: nxt ? E[s].norm + (nxt.pts - E[o].norm) : NaN, ptsAfter: nxt ? nxt.pts : NaN, nxtPoss: nxt });
      }
    }
  }

  // ----- minutes (from lineups) and on/off -----
  const mins = { byu: {}, opp: {} };
  for (let i = 1; i < evs.length; i++) {
    const a = evs[i - 1], b = evs[i];
    if (a.per !== b.per) continue;
    const dt = a.rem - b.rem; if (dt <= 0) continue;
    for (const id of a.lineupByu) mins.byu[names[id]] = (mins.byu[names[id]] || 0) + dt;
    for (const id of a.lineupOpp) mins.opp[names[id]] = (mins.opp[names[id]] || 0) + dt;
  }
  const lineupAt = (p) => { const e = evs[p.startIdx]; return { byu: new Set(e.lineupByu.map((id) => names[id])), opp: new Set(e.lineupOpp.map((id) => names[id])) }; };

  // ----- §7 player box -----
  const pl = {};
  const row = (name, side) => (pl[name === 'TEAM' || name === 'unattributed' ? `${name}:${side}` : name] ||= { name, side, min: (mins[side][name] || 0) / 60, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
    pts_ft: 0, pts_assisted: 0, pts_putback: 0, pts_early: 0, pts_self_created_hc: 0, pts_produced: 0, assist_pts: 0, pts_and1_assisted: 0,
    opp_pts_off_to_live: 0, opp_pts_off_to_dead: 0, pts_off_steal: 0, pts_off_charge: 0, pts_off_block: 0, pts_off_oreb_quick: 0, pts_off_oreb_reset: 0, opp_pts_off_fouls: 0,
    pts_left_ft_league: 0, pts_left_ft_own: 0, pts_left_rim: 0, rimMiss: 0,
    gains: 0, losses: 0, epaExp: 0, epaAct: 0, wpaGain: 0, wpaLoss: 0, wpaScoring: 0, cnt: { stl: 0, oreb: 0, recBlk: 0, chg: 0, tovL: 0, tovD: 0 } });
  // An and-one: the made free throw right after a made basket (same side, same clock, a 1-of-1 trip). It belongs to the
  // basket, so when the basket was assisted the free throw counts toward the passer's assist points too.
  const andOneFt = (e) => {
    for (let j = e.i + 1; j < Math.min(evs.length, e.i + 14); j++) {
      const x = evs[j];
      if (x.per !== e.per || Math.abs(x.clk - e.clk) > 1) break;
      if (x.cat === 'free_throw' && x.side === e.side && x.sub === '1of1') return x.made ? x : null;
      if (['shot_attempt', 'turnover', 'rebound'].includes(x.cat)) break;
    }
    return null;
  };
  // anyone who was on the floor gets a row, even with no counting stats yet (a starter early in a game, or a minutes-only player)
  for (const side of sides) for (const nm of Object.keys(mins[side])) row(nm, side);
  const assistedBy = {}; // shot play_id -> assister name
  for (const e of evs) if (e.cat === 'assist' && e.linked) assistedBy[e.linked] = e.name;
  const unlinked = evs.filter((e) => e.cat === 'assist' && !e.linked).length;
  const shotPlay = new Map(); for (const p of plays) for (const i of p.events) shotPlay.set(i, p);
  const rimPct = rim.made / rim.att;
  for (const e of evs) {
    // team-credited turnovers (shot-clock violations etc.) and team rebounds go on a TEAM row, never on a player
    const who = e.name || (e.side && (e.cat === 'turnover' || (e.cat === 'rebound' && e.sub !== 'deadball')) ? 'TEAM' : null);
    if (!who || !e.side) continue;
    const r = row(who, e.side);
    if (e.cat === 'shot_attempt') {
      r.fga++; if (e.val === 3) r.tpa++; r.rimMiss += (P.TRIP_RIM_TYPES.includes(e.type) && !e.made) ? 1 : 0;
      if (e.made) {
        r.fgm++; r.pts += e.val; if (e.val === 3) r.tpm++;
        const asst = assistedBy[e.play_id], lab = shotPlay.get(e.i);
        if (asst) { r.pts_assisted += e.val; const a = row(asst, e.side); a.assist_pts += e.val; if (andOneFt(e)) { a.assist_pts += 1; a.pts_and1_assisted += 1; } }
        else {
          if (lab && lab.label === 'quick_putback') r.pts_putback += e.val;
          else if (lab && (lab.label === 'transition' || lab.sub === 'quick_off_make')) r.pts_early += e.val;
          else r.pts_self_created_hc += e.val;
        }
      }
    } else if (e.cat === 'free_throw') { r.fta++; if (e.made) { r.ftm++; r.pts++; r.pts_ft++; } }
    else if (e.cat === 'rebound') { if (e.type === 'offensive') r.oreb++; else r.dreb++; }
    else if (e.cat === 'assist') r.ast++;
    else if (e.cat === 'steal') r.stl++;
    else if (e.cat === 'block') r.blk++;
    else if (e.cat === 'turnover') r.tov++;
    else if (e.cat === 'foul' && (e.type === 'personal' || e.type === 'offensive')) r.pf++;
  }
  // fouls -> opponent FT points on trips they caused
  for (const e of evs) {
    if (e.cat !== 'foul' || !e.name || e.type === 'technical') continue;
    let pts = 0;
    for (let j = e.i + 1; j < Math.min(evs.length, e.i + 14); j++) {
      const x = evs[j];
      if (x.cat === 'free_throw' && x.side !== e.side && x.per === e.per && Math.abs(x.clk - e.clk) <= 1) pts += x.made ? 1 : 0;
      else if (['foul', 'shot_attempt', 'turnover', 'rebound'].includes(x.cat) && x.sn !== e.sn && x.cat !== 'rebound') break;
      else if (x.cat === 'rebound' && x.sub !== 'deadball') break;
    }
    row(e.name, e.side).opp_pts_off_fouls += pts;
  }
  for (const t of W.trips) { const r = row(t.shooter, t.team); r.pts_left_ft_league += t.league.shortfall; r.pts_left_ft_own += t.own.shortfall; r.ftWpLeague = (r.ftWpLeague || 0) + t.league.wpCost; r.ftWpOwn = (r.ftWpOwn || 0) + t.own.wpCost; }
  for (const v of pv) {
    const r = row(v.name, v.side);
    const wpa = wpaBySn[v.sn + ':' + v.kind] ?? 0;
    const isGain = ['steal', 'oreb', 'recovered_block', 'charge_drawn'].includes(v.kind);
    if (isGain) { r.gains++; r.wpaGain += wpa; } else { r.losses++; r.wpaLoss += wpa; }
    r.epaExp += v.exp; r.epaAct += Number.isFinite(v.act) ? v.act : v.exp;
    if (v.kind === 'steal') { r.cnt.stl++; r.pts_off_steal += v.ptsAfter || 0; }
    if (v.kind === 'oreb') { r.cnt.oreb++; const first = v.orebPlay; if (first) { if (first.label === 'quick_putback') r.pts_off_oreb_quick += v.ptsAfter; else r.pts_off_oreb_reset += v.ptsAfter; } }
    if (v.kind === 'recovered_block') { r.cnt.recBlk++; r.pts_off_block += v.ptsAfter || 0; }
    if (v.kind === 'charge_drawn') { r.cnt.chg++; r.pts_off_charge += v.ptsAfter || 0; }
    if (v.kind === 'tov_live') { r.cnt.tovL++; r.opp_pts_off_to_live += v.ptsAfter || 0; }
    if (v.kind === 'tov_dead') { r.cnt.tovD++; r.opp_pts_off_to_dead += v.ptsAfter || 0; }
  }
  for (const r of Object.values(pl)) r.rimLeft = r.rimMiss * 2 * rimPct;
  for (const [nm, wp] of Object.entries(W.players)) if (pl[nm]) pl[nm].wpaScoring = wp.scoring;
  for (const r of Object.values(pl)) {
    r.possCreated = r.stl + r.oreb + r.cnt.chg + r.cnt.recBlk - r.tov; r.ptsCreated = r.pts + r.assist_pts; r.pts_produced = r.pts + r.assist_pts; // every point he had a hand in: scored plus assisted (a basket he scored off a teammate's pass counts for both)
    r.tovRate = div(r.tov, r.fga + 0.44 * r.fta + r.tov); r.per40 = r.min ? 40 / r.min : NaN;
    // on / off (possession-level, lineup at the possession's first event)
    const on = { off: [], def: [] }, offc = { off: [], def: [] };
    for (const p of poss) { const L = lineupAt(p)[r.side]; const isOff = p.team === r.side; (L.has(r.name) ? on : offc)[isOff ? 'off' : 'def'].push(p); }
    const ppp = (a) => div(sum(a, (p) => p.pts), a.length);
    r.onoff = { onN: on.off.length + on.def.length, net: (ppp(on.off) - ppp(on.def)) * 100, offNet: (ppp(offc.off) - ppp(offc.def)) * 100, offN: offc.off.length + offc.def.length };
  }
  const roster = (s) => Object.values(pl).filter((r) => r.side === s);
  for (const s of sides) {
    const R = roster(s);
    chk(`${teamName[s]} player PTS sum = final`, sum(R, (r) => r.pts) === finalPts[s], `${sum(R, (r) => r.pts)} vs ${finalPts[s]}`);
    chk(`${teamName[s]} §7.1 buckets sum to PTS (every player)`, R.every((r) => Math.abs(r.pts_ft + r.pts_assisted + r.pts_putback + r.pts_early + r.pts_self_created_hc - r.pts) < 1e-9), '');
    chk(`${teamName[s]} assist points = points on assisted baskets + their and-one FTs`, sum(R, (r) => r.assist_pts) === sum(R, (r) => r.pts_assisted) + sum(R, (r) => r.pts_and1_assisted), `${sum(R, (r) => r.assist_pts)} vs ${sum(R, (r) => r.pts_assisted)} + ${sum(R, (r) => r.pts_and1_assisted)}`);
    const lastEv = evs[evs.length - 1], elapsedMin = lastEv.per <= 2 ? ((lastEv.per - 1) * 1200 + 1200 - lastEv.clk) / 60 : 40; // live: five on the floor for the time played so far
    const wantMin = live ? 5 * elapsedMin : 200;
    chk(`${teamName[s]} minutes sum ≈ ${live ? f1(wantMin) : 200}`, Math.abs(sum(R, (r) => r.min) - wantMin) < 3, `${f1(sum(R, (r) => r.min))}`);
  }

  // ----- Havoc / squeeze (credited to the defending team) -----
  const havoc = {};
  const estElapsed = (p) => { const lag = p.k === 0 && p.poss.startType === 'after_made_FG' ? P.LAG_AFTER_MAKE_SEC : 0; return p.dur - lag; };
  for (const d of sides) {
    const o = other(d), offPoss = poss.filter((p) => p.team === o).length;
    const ev = []; // {kind, group, weight, live, nxt}
    for (const e of evs) {
      if (e.cat === 'steal' && e.side === d) { const to = pairedTO(e); ev.push({ sn: e.sn, kind: 'steal', group: 'full', live: true, nxt: to && posByStart.get(to.sn) }); }
      else if (e.cat === 'block' && e.side === d) { const rb = evs.slice(e.i + 1).find((x) => x.cat === 'rebound' || x.cat === 'shot_attempt' || x.cat === 'turnover'); const rec = rb && rb.cat === 'rebound' && rb.type === 'defensive' && rb.side === d; ev.push({ sn: e.sn, kind: 'block', group: 'full', live: true, recovered: rec, nxt: rec ? posByStart.get(rb.sn) : null }); }
      else if (e.cat === 'turnover' && e.side === o && !evs.some((x, j) => Math.abs(j - e.i) <= 3 && x.cat === 'steal' && x.per === e.per && x.clk === e.clk && x.side === d)) {
        const nxt = posByStart.get(e.sn);
        if (FORCED_TO.has(e.type)) ev.push({ sn: e.sn, kind: 'forced_to:' + e.type, group: 'full', live: false, nxt });
        else {
          const play = plays.find((x) => x.events.includes(e.i)), elapsed = play ? estElapsed(play) : NaN;
          const late = elapsed >= P.SHOT_CLOCK_LEN - P.SQUEEZE_REMAINING_SEC;
          ev.push({ sn: e.sn, kind: 'other_to:' + e.type, group: late ? 'late' : 'early', live: false, nxt, elapsed: +elapsed.toFixed(1) });
        }
      }
    }
    const full = ev.filter((x) => x.group === 'full'), lateTO = ev.filter((x) => x.group === 'late'), earlyTO = ev.filter((x) => x.group === 'early');
    const h = (wl, we) => full.length + wl * lateTO.length + we * earlyTO.length;
    const conv = (arr) => {
      const rows = arr.filter((x) => x.nxt && !(x.kind === 'block' && !x.recovered));
      const fast = rows.filter((x) => { const pl0 = x.nxt.plays[0]; return pl0.action && pl0.dur <= P.CONVERT_WINDOW_SEC && ['made_fg', 'missed_fg', 'ft', 'ft_miss'].includes(pl0.endReason); });
      return { n: rows.length, quick: fast.length, rate: div(fast.length, rows.length), pts: sum(rows, (x) => x.nxt.pts), ppe: div(sum(rows, (x) => x.nxt.pts), rows.length) };
    };
    const liveEv = ev.filter((x) => x.live), deadEv = ev.filter((x) => !x.live);
    const offPlays = plays.filter((p) => p.offense === o);
    const squeezedPoss = new Set(offPlays.filter((p) => p.endReason !== 'period_end' && p.endReason !== 'held_ball' && estElapsed(p) >= P.SHOT_CLOCK_LEN - P.SQUEEZE_REMAINING_SEC).map((p) => p.poss));
    const sq = [...squeezedPoss], nsq = poss.filter((p) => p.team === o && !squeezedPoss.has(p));
    havoc[d] = {
      otherTOs: ev.filter((x) => x.kind.startsWith('other_to')).map((x) => `${x.kind.slice(9)}@${x.elapsed}s`), oppPoss: offPoss, steals: ev.filter((x) => x.kind === 'steal').length, blocks: ev.filter((x) => x.kind === 'block').length, recBlocks: ev.filter((x) => x.kind === 'block' && x.recovered).length,
      forced: full.filter((x) => x.kind.startsWith('forced')).length, lateTO: lateTO.length, earlyTO: earlyTO.length,
      strict: full.length, broad: full.length + lateTO.length + earlyTO.length, mid: h(P.HAVOC_W_LATE, P.HAVOC_W_EARLY),
      rate: { strict: div(full.length, offPoss), broad: div(full.length + lateTO.length + earlyTO.length, offPoss), mid: div(h(P.HAVOC_W_LATE, P.HAVOC_W_EARLY), offPoss) },
      convLive: conv(liveEv), convDead: conv(deadEv), convAll: conv(ev),
      squeeze: { n: sq.length, rate: div(sq.length, offPoss), ppp: div(sum(sq, (p) => p.pts), sq.length), otherPPP: div(sum(nsq, (p) => p.pts), nsq.length) },
    };
  }

  // ----- possession battle, advantage possessions, FT line -----
  const battle = {};
  for (const s of sides) {
    const to = evs.filter((e) => e.side === s && e.cat === 'turnover');
    const liveTO = pv.filter((v) => v.side === s && v.kind === 'tov_live').length, deadTO = pv.filter((v) => v.side === s && v.kind === 'tov_dead').length;
    const adv = plays.filter((p) => p.offense === s && (p.label === 'transition' || p.sub === 'quick_off_make'));
    const advPPP = div(sum(adv, (p) => p.points), adv.length);
    const scoreless = adv.filter((p) => p.points === 0);
    battle[s] = { poss: poss.filter((p) => p.team === s).length, tov: to.length, liveTO, deadTO, advN: adv.length, advScoreless: scoreless.length, advPPP, advLost: scoreless.length * advPPP, rimLeft: sum(roster(s), (r) => r.rimLeft), formula: formulaPoss(s) };
  }
  const trips = W.trips;
  const lineBy = (s) => {
    const T = trips.filter((t) => t.team === s);
    const missedFinal = T.filter((t) => t.finalMissed);
    const oppPtsAfter = sum(missedFinal.filter((t) => t.reb === 'defense'), (t) => { const e = evs.find((x) => x.sn === t.sn); const lastFt = evs.slice(e.i).find((x) => x.cat === 'free_throw' && x.sub.split('of')[0] === x.sub.split('of')[1] && x.side === s); const rb = lastFt && evs.slice(lastFt.i + 1).find((x) => x.cat === 'rebound' && x.sub !== 'deadball'); const nx = rb && posByStart.get(rb.sn); return nx ? nx.pts : 0; });
    const poseff = (t) => (t.reb === 'defense' ? E[other(s)].afterFtMiss - E[other(s)].afterMadeFT : t.reb === 'offense' ? -E[s].oreb : 0);
    const cost = (b) => sum(T, (t) => t[b].shortfall) + sum(missedFinal, poseff);
    return { trips: T.length, shortLeague: sum(T, (t) => t.league.shortfall), shortOwn: sum(T, (t) => t.own.shortfall), costLeague: cost('league'), costOwn: cost('own'), front: T.filter((t) => t.type === 'one_and_one' && t.finalMissed && t.of === 1).length, wpLeague: sum(T, (t) => t.league.wpCost), wpOwn: sum(T, (t) => t.own.wpCost), oppPtsAfter, missedFinal: missedFinal.length };
  };
  const line = { byu: lineBy('byu'), opp: lineBy('opp') };
  const flag = line.byu.costLeague > -margin && margin < 0;

  // ----- shooting: how the points were taken. 3-point rate = 3PA / FGA; free-throw rate = FTA / FGA (the standard
  // definitions). Every FG and FT event counts, blocked shots included as attempts and technical FTs as attempts.
  const shootingBy = (s) => {
    const m = evs.filter((e) => e.side === s);
    const sh = m.filter((e) => e.cat === 'shot_attempt'), ft = m.filter((e) => e.cat === 'free_throw');
    const fgm = sh.filter((e) => e.made).length, fga = sh.length;
    const tpa = sh.filter((e) => e.val === 3).length, tpm = sh.filter((e) => e.val === 3 && e.made).length;
    const ftm = ft.filter((e) => e.made).length, fta = ft.length;
    return {
      fgm, fga, fgPct: div(fgm, fga), tpm, tpa, tpPct: div(tpm, tpa), tpRate: div(tpa, fga),
      twoM: fgm - tpm, twoA: fga - tpa, twoPct: div(fgm - tpm, fga - tpa),
      ftm, fta, ftPct: div(ftm, fta), ftRate: div(fta, fga),
      efg: div(fgm + 0.5 * tpm, fga), ts: div(2 * (fgm - tpm) + 3 * tpm + ftm, 2 * (fga + 0.44 * fta)),
    };
  };
  const shooting = { byu: shootingBy('byu'), opp: shootingBy('opp') };

  // ================= render =================
  const L = [];
  const tbl = (head, rows) => { L.push('| ' + head.join(' | ') + ' |', '|' + head.map((h, i) => (i ? '---:' : ':---')).join('|') + '|'); rows.forEach((r) => L.push('| ' + r.join(' | ') + ' |')); L.push(''); };
  const rate = (pts, n) => (n >= P.MIN_N_FOR_RATE ? f2(pts / n) : n ? `${pts} on ${n}` : '–');
  const T = teamName;
  L.push(`# ${T.byu} ${D.finalByu}, ${T.opp} ${D.finalOpp} — ${game.game_date.toISOString().slice(0, 10)} (${game.season_type}${game.is_neutral_site ? ', neutral' : ''})`, '');
  L.push(`**${headline}**`, '');
  L.push(`*Prototype, single game. Season averages, league baselines and "net vs expected" are not shown because only this game is loaded; ratings come from the KenPom snapshot you supplied. Rates under ${P.MIN_N_FOR_RATE} chances show points on chances.*`, '');
  const bs = battle.byu, bo = battle.opp, sb = split.byu, so = split.opp;
  tbl(['', T.byu, T.opp], [
    ['Final', D.finalByu, D.finalOpp], ['Possessions (event count)', sb.poss, so.poss], ['Possessions (box formula)', f1(bs.formula.poss), f1(bo.formula.poss)],
    ['Chances (possessions + OREB)', f1(bs.formula.poss + bs.formula.orb), f1(bo.formula.poss + bo.formula.orb)], ['Plays (segmented)', sb.plays, so.plays],
    ['Points per possession', f2(sb.ppp), f2(so.ppp)], ['Points per chance (formula)', f3(D.finalByu / (bs.formula.poss + bs.formula.orb)), f3(D.finalOpp / (bo.formula.poss + bo.formula.orb))], ['Points per play (segmented)', f3(sb.ppPlay), f3(so.ppPlay)],
  ]);

  L.push('## Points by source (what decided the game)', '');
  tbl(['Source', `${T.byu} pts`, `${T.byu} chances`, `${T.byu} PPP`, `${T.opp} pts`, `${T.opp} chances`, `${T.opp} PPP`, 'Net'], bucketRows.map((r) => [r.label, r.byu.pts, r.byu.n, rate(r.byu.pts, r.byu.n), r.opp.pts, r.opp.n, rate(r.opp.pts, r.opp.n), sgnf(r.net, 0)]).concat([['**Total**', D.finalByu, sb.plays, f2(sb.ppPlay), D.finalOpp, so.plays, f2(so.ppPlay), `**${sgnf(margin, 0)}**`]]));

  L.push('## Shooting', '');
  const sh = shooting;
  tbl(['', T.byu, T.opp], [
    ['FG (made-att, %)', ...sides.map((x) => `${sh[x].fgm}-${sh[x].fga} (${pct1(sh[x].fgPct)})`)],
    ['3PT (made-att, %)', ...sides.map((x) => `${sh[x].tpm}-${sh[x].tpa} (${pct1(sh[x].tpPct)})`)],
    ['3-point rate (3PA / FGA)', ...sides.map((x) => pct1(sh[x].tpRate))],
    ['FT (made-att, %)', ...sides.map((x) => `${sh[x].ftm}-${sh[x].fta} (${pct1(sh[x].ftPct)})`)],
    ['Free-throw rate (FTA / FGA)', ...sides.map((x) => pct1(sh[x].ftRate))],
    ['eFG%', ...sides.map((x) => pct1(sh[x].efg))],
    ['True shooting %', ...sides.map((x) => pct1(sh[x].ts))],
  ]);
  L.push('## Defense split (each team on offense; BYU defense = Houston row)', '');
  const dr = (label, g) => [label, ...sides.map((s) => g(split[s]))];
  tbl(['Metric (unit)', `${T.byu} offense`, `${T.opp} offense`], [
    dr('Possessions', (x) => x.poss), dr('Plays', (x) => x.plays), dr('Total PPP (per possession)', (x) => f2(x.ppp)), dr('Plays per possession', (x) => f2(x.playsPerPoss)), dr('Points per play', (x) => f2(x.ppPlay)),
    dr('First-shot half-court (per play)', (x) => `${rate(x.firstShot.pts, x.firstShot.n)} (${x.firstShot.n})`), dr('  …without quick-off-make (per play)', (x) => `${rate(x.firstShotNoQuick.pts, x.firstShotNoQuick.n)} (${x.firstShotNoQuick.n})`),
    dr('Set half-court incl. resets (per play)', (x) => `${rate(x.setHC.pts, x.setHC.n)} (${x.setHC.n})`), dr('Transition (per play)', (x) => `${x.transition.pts} pts on ${x.transition.n}`),
    dr('Quick putbacks', (x) => `${x.quickPutback.pts} pts on ${x.quickPutback.n}`), dr('Resets', (x) => `${x.reset.pts} pts on ${x.reset.n}`), dr('Second-chance points', (x) => x.secondChancePts),
    dr('Offensive rebound rate (live misses)', (x) => `${f1(100 * x.orebRate)}% (${x.oreb} OREB, ${x.dreb} opp DREB)`),
  ]);

  L.push('## Possession battle & situational', '');
  tbl(['', T.byu, T.opp], [
    ['Turnovers (live / dead)', `${bs.tov} (${bs.liveTO} / ${bs.deadTO})`, `${bo.tov} (${bo.liveTO} / ${bo.deadTO})`],
    ['Push after a make: quick / chances (rate)', ...sides.map((s) => `${afterMake[s].quick} / ${afterMake[s].pop} (${f1(100 * afterMake[s].pushRate)}%)`)],
    [`Quick-off-make points (window ${P.QUICK_MAKE_WINDOW_SEC}s, placeholder)`, ...sides.map((s) => `${afterMake[s].quickPts} on ${afterMake[s].quick}`)],
    ['Non-quick after makes (per possession)', ...sides.map((s) => `${rate(Math.round(afterMake[s].nonQuickPPP * afterMake[s].nonQuickN), afterMake[s].nonQuickN)} (${afterMake[s].nonQuickN})`)],
    ['After own timeout: scored on', ...sides.map((s) => `${ato[s].own.scored} of ${ato[s].own.n} (${ato[s].own.pts} pts)`)],
    ['After opponent timeout: scored on', ...sides.map((s) => `${ato[s].opponent.scored} of ${ato[s].opponent.n} (${ato[s].opponent.pts} pts)`)],
    ['After media timeout: scored on', ...sides.map((s) => `${ato[s].media.scored} of ${ato[s].media.n} (${ato[s].media.pts} pts)`)],
  ]);

  L.push('## Points left on the table', '');
  tbl(['', T.byu, T.opp], [
    ['Missed rim attempts × 2 × rim FG% (pooled db rate ' + f1(100 * rimPct) + '%)', f1(bs.rimLeft), f1(bo.rimLeft)],
    ['Advantage plays (transition + quick-off-make): scoreless / total', `${bs.advScoreless} / ${bs.advN}`, `${bo.advScoreless} / ${bo.advN}`],
    ['…valued at the team’s own advantage PPP this game', f1(bs.advLost), f1(bo.advLost)],
  ]);

  L.push('## At the line', '');
  tbl(['', T.byu, T.opp], [
    ['Trips (made/att)', `${line.byu.trips} (${sum(roster('byu'), (r) => r.ftm)}/${sum(roster('byu'), (r) => r.fta)})`, `${line.opp.trips} (${sum(roster('opp'), (r) => r.ftm)}/${sum(roster('opp'), (r) => r.fta)})`],
    ['FT shortfall vs league 72% / vs own (points; negative = above baseline)', `${sgnf(line.byu.shortLeague, 2)} / ${sgnf(line.byu.shortOwn, 2)}`, `${sgnf(line.opp.shortLeague, 2)} / ${sgnf(line.opp.shortOwn, 2)}`],
    ['FT cost incl. possession effect: league / own', `${sgnf(line.byu.costLeague, 2)} / ${sgnf(line.byu.costOwn, 2)}`, `${sgnf(line.opp.costLeague, 2)} / ${sgnf(line.opp.costOwn, 2)}`],
    ['Front-end 1-and-1 misses', line.byu.front, line.opp.front],
    ['Win probability lost at the line: league / own (points of WP)', `${sgnf(100 * line.byu.wpLeague, 1)} / ${sgnf(100 * line.byu.wpOwn, 1)}`, `${sgnf(100 * line.opp.wpLeague, 1)} / ${sgnf(100 * line.opp.wpOwn, 1)}`],
    ['Opponent points after missed final FT (context only)', line.byu.oppPtsAfter, line.opp.oppPtsAfter],
  ]);
  L.push(`*Negative = shot better than the baseline (a credit). Opponent players have almost no season FT history in the database, so their “own” baseline is close to the league average.*${flag ? ' **Flag: the FT line cost more than the losing margin.**' : ''}`, '');

  L.push('## Havoc, conversion and squeeze (credited to the defense named in the column)', '');
  const H = havoc;
  tbl(['', `${T.byu} defense`, `${T.opp} defense`], [
    ['Opponent possessions', H.byu.oppPoss, H.opp.oppPoss],
    ['Steals / blocks (recovered) / forced TOs', ...sides.map((s) => `${H[s].steals} / ${H[s].blocks} (${H[s].recBlocks}) / ${H[s].forced}`)],
    ['Other turnovers: late-clock est. / early', ...sides.map((s) => `${H[s].lateTO} / ${H[s].earlyTO}`)],
    ['Havoc rate, strict (per opp possession)', ...sides.map((s) => `${f1(100 * H[s].rate.strict)}% (${H[s].strict})`)],
    [`Havoc rate, weighted (w_late ${P.HAVOC_W_LATE}, w_early ${P.HAVOC_W_EARLY}: placeholders)`, ...sides.map((s) => `${f1(100 * H[s].rate.mid)}% (${f1(H[s].mid)})`)],
    ['Havoc rate, broad (all turnovers)', ...sides.map((s) => `${f1(100 * H[s].rate.broad)}% (${H[s].broad})`)],
    [`Live-ball havoc → shot/FT within ${P.CONVERT_WINDOW_SEC}s`, ...sides.map((s) => `${H[s].convLive.quick} of ${H[s].convLive.n}`)],
    ['↳ points on the possessions that followed (per event)', ...sides.map((s) => `${H[s].convLive.pts} (${f2(H[s].convLive.ppe)})`)],
    [`Dead-ball havoc → shot/FT within ${P.CONVERT_WINDOW_SEC}s`, ...sides.map((s) => `${H[s].convDead.quick} of ${H[s].convDead.n}`)],
    ['↳ points on the possessions that followed (per event)', ...sides.map((s) => `${H[s].convDead.pts} (${f2(H[s].convDead.ppe)})`)],
    [`Squeeze rate (est. ≤${P.SQUEEZE_REMAINING_SEC}s on shot clock)`, ...sides.map((s) => `${f1(100 * H[s].squeeze.rate)}% (${H[s].squeeze.n} of ${H[s].oppPoss})`)],
    ['Opp PPP squeezed vs other possessions', ...sides.map((s) => `${f2(H[s].squeeze.ppp)} vs ${f2(H[s].squeeze.otherPPP)}`)],
  ]);
  L.push(`*Shot clock is not in the data: late-clock/squeeze use game-clock time since the play started (minus ${P.LAG_AFTER_MAKE_SEC}s after made baskets). Approximate; a single game cannot fit the weights.*`, '');

  L.push('## Possession value (count and expected points)', '');
  tbl(['Baseline (this game only)', T.byu, T.opp], [
    ['E_norm: PPP all possessions', f2(E.byu.norm), f2(E.opp.norm)], ['E_liveTO: PPP after live-ball TO (raw, n) → shrunk K=' + P.SHRINK_K, `${f2(E.byu.liveRaw)} (${E.byu.liveN}) → ${f2(E.byu.live)}`, `${f2(E.opp.liveRaw)} (${E.opp.liveN}) → ${f2(E.opp.live)}`],
    ['E_oreb: points left in possession after an OREB (n)', `${f2(E.byu.oreb)} (${E.byu.orebN})`, `${f2(E.opp.oreb)} (${E.opp.orebN})`],
  ]);
  const pvTeam = (s) => ({ gains: sum(roster(s), (r) => r.gains), losses: sum(roster(s), (r) => r.losses), exp: sum(roster(s), (r) => r.epaExp), act: sum(roster(s), (r) => r.epaAct) });
  const pt = { byu: pvTeam('byu'), opp: pvTeam('opp') };
  tbl(['', T.byu, T.opp], [['Possession gains / losses (count)', `${pt.byu.gains} / ${pt.byu.losses}`, `${pt.opp.gains} / ${pt.opp.losses}`], ['EPA expected / actual (points)', `${sgnf(pt.byu.exp, 1)} / ${sgnf(pt.byu.act, 1)}`, `${sgnf(pt.opp.exp, 1)} / ${sgnf(pt.opp.act, 1)}`]]);

  const playerTable = (s) => {
    L.push(`### ${T[s]} player table`, '');
    const R = roster(s).filter((r) => r.min > 0 || r.pts || r.fga || r.gains || r.losses || r.tov || r.oreb || r.dreb).sort((a, b) => (b.epaAct + b.wpaGain + b.wpaLoss) - (a.epaAct + a.wpaGain + a.wpaLoss));
    tbl(['Player', 'MIN', 'PTS', 'FG', '3P', 'FT', 'OR', 'DR', 'A', 'S', 'B', 'TO', 'PF', 'Poss +/−', 'EPA exp', 'EPA act', 'WPA poss (pts WP)', 'WPA scoring'],
      R.map((r) => [r.name, f1(r.min), r.pts, `${r.fgm}-${r.fga}`, `${r.tpm}-${r.tpa}`, `${r.ftm}-${r.fta}`, r.oreb, r.dreb, r.ast, r.stl, r.blk, r.tov, r.pf, `+${r.gains}/−${r.losses} (${sgnf(r.possCreated, 0)})`, sgnf(r.epaExp, 1), sgnf(r.epaAct, 1), sgnf(100 * (r.wpaGain + r.wpaLoss), 1), sgnf(100 * r.wpaScoring, 1)]));
    L.push('*How the points were scored (these five sum to PTS), then PTS, assists (count), assist points, and points produced = PTS + assist points (every point he had a hand in; one basket can count for both scorer and passer, so it does not total to the team total).*', '');
    tbl(['Player', 'FT', 'Putback', 'Early (trans/quick)', 'Self-created HC', 'Assisted', 'PTS', 'AST', 'Assist pts', 'Pts produced'], R.map((r) => [r.name, r.pts_ft, r.pts_putback, r.pts_early, r.pts_self_created_hc, r.pts_assisted, r.pts, r.ast, r.assist_pts, `${r.pts_produced} (${pct1(div(r.pts_produced, finalPts[s]))})`]));
    L.push('*Context columns (overlap by design; never total them across players):*', '');
    tbl(['Player', 'Opp pts off his TO (live/dead)', 'Team pts off steal/charge/block', 'Pts after his OREB (quick/reset)', 'Opp FT pts off his fouls', 'Pts left at FT (league / own)', 'Pts left at rim', 'TO rate', 'On/off net per 100 (poss on/off)'],
      R.map((r) => [r.name, `${r.opp_pts_off_to_live} / ${r.opp_pts_off_to_dead}`, `${r.pts_off_steal} / ${r.pts_off_charge} / ${r.pts_off_block}`, `${r.pts_off_oreb_quick} / ${r.pts_off_oreb_reset}`, r.opp_pts_off_fouls, `${sgnf(r.pts_left_ft_league, 2)} / ${sgnf(r.pts_left_ft_own, 2)}`, f1(r.rimLeft), Number.isFinite(r.tovRate) ? f1(100 * r.tovRate) + '%' : '–', Number.isFinite(r.onoff.net) && Number.isFinite(r.onoff.offNet) ? `${sgnf(r.onoff.net, 0)} (${r.onoff.onN}/${r.onoff.offN})` : `${Number.isFinite(r.onoff.net) ? sgnf(r.onoff.net, 0) : '–'} (${r.onoff.onN}/${r.onoff.offN})`]));
  };
  L.push('## Player box', '');
  playerTable('byu'); playerTable('opp');

  L.push('## Win probability', '');
  const top = [...W.timeline].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5);
  tbl(['Clock', 'Score (BYU lead)', 'Swing (WP pts)', 'Play'], top.map((t) => { const e = evs.find((x) => x.sn === t.sn); return [`H${t.period} ${Math.floor(t.clock / 60)}:${String(Math.floor(t.clock % 60)).padStart(2, '0')}`, sgnf(t.lead, 0), sgnf(100 * t.d, 1), `${e.team_id} ${e.type || e.cat} ${e.name || ''} ${e.made ? '(made)' : ''}`]; }));
  L.push(`Model: pregame BYU WP 20.0% from expected margin ${f2(W.params.MU)}, σ ${W.params.SIGMA}, possession swing ${W.params.POSS_SWING}. WP in the last 60s is low-confidence.`, '');

  L.push('## Checks', '');
  tbl(['Check', 'Result', 'Detail'], checks.map((c) => [c.name, c.ok ? 'pass' : '**FAIL**', c.detail]));
  L.push(`Assists unlinked to a shot: ${unlinked}. Possessions: ${poss.length}; plays: ${plays.length}; timeouts by type: media ${evs.filter((e) => e.cat === 'timeout' && e.type === 'commercial').length}, team ${evs.filter((e) => e.cat === 'timeout' && e.type !== 'commercial').length}.`);

  const header = {
    gameId: game.game_id, date: game.game_date.toISOString().slice(0, 10), venue: game.venue, seasonType: game.season_type, neutral: !!game.is_neutral_site,
    focus: 'byu', teams: { byu: T.byu, opp: T.opp }, oppId: D.oppId, final: { byu: D.finalByu, opp: D.finalOpp }, margin, headline,
    minutes: { byuTotal: sum(roster('byu'), (r) => r.min), oppTotal: sum(roster('opp'), (r) => r.min) },
  };
  const notes = { unlinkedAssists: unlinked, rimPct, rimAttemptsInDb: rim.att, leagueFtPct: P.LEAGUE_FT_PCT, possessionsFormula: { byu: battle.byu.formula, opp: battle.opp.formula } };
  const payload = { schema: 1, header, params: P, notes, split, shooting, margin: bucketRows, afterMake, ato, E: { byu: { ...E.byu, restPts: undefined }, opp: { ...E.opp, restPts: undefined } }, havoc, battle, line, players: Object.values(pl), checks, plays: plays.map((p) => ({ offense: p.offense, per: p.poss.period, startRem: p.startRem, dur: p.dur, label: p.label, sub: p.sub, pts: p.points, start: p.poss.startType, end: p.endReason, timeoutBefore: p.timeoutBefore })) };
  return { L, payload, checks, header };
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { computeBox, load, loadRim, loadWp, segment };
