// PROTOTYPE: in-game win probability and WPA for one game, from the normalized plays in the local pbp db.
// Not wired into the app or any export. Usage: node derivations/wp-prototype.js [gameId] [--json out.json]
//
// Model (handoff §5.2, Stern-style random walk), all from BYU's side of the ledger:
//   f   = seconds remaining / 2400
//   adj = lead + possession bonus (+/- POSS_SWING/2 for who has the ball, 0 while a miss is live)
//   WP  = Phi((adj + MU * f) / (SIGMA * sqrt(f)))
const fs = require('fs');
const { connect } = require('../db/client');
const { fetchGamePlays } = require('../ingest/lib/game-plays');
const { loadPriors, expectedMargin } = require('./priors');

// ---- parameters (named, per handoff ground rules) ----
const GAME_ID = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '2026-03-12-byu-at-houston';
const FOCUS = 'byu';
// The pregame prior (expected BYU margin) is per game, from config/game-priors.csv (see priors.js).
// With no row for a game the model runs with an even prior (mu = 0) and the output says so.
const EXPECTED_POSS = (63.3 + 69.8) / 2;
const SIGMA = 11;                  // handoff default; optionally scale by sqrt(EXPECTED_POSS / 68)
const POSS_SWING = 1.0;            // total margin swing between "I have the ball" and "they have it" (+/- half each)
const REG_SECONDS = 2400;
const LEAGUE_FT_PCT = 0.72;
const FT_SHRINK_K = 20;
const LOW_CONFIDENCE_SEC = 60;

const erf = (x) => { // Abramowitz-Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
};
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

// lead = BYU - opp; poss = 'byu' | 'opp' | null; rem = regulation seconds left
function wpModel(lead, poss, rem, mu = 0) {
  const f = Math.max(rem, 1) / REG_SECONDS;
  const bonus = poss === 'byu' ? POSS_SWING / 2 : poss === 'opp' ? -POSS_SWING / 2 : 0;
  return Phi((lead + bonus + mu * f) / (SIGMA * Math.sqrt(f)));
}

async function loadWpInput(c, gameId) {
  const { rows: [game] } = await c.query('SELECT * FROM games WHERE game_id = $1', [gameId]);
  const plays = await fetchGamePlays(c, gameId);
  const { rows: parts } = await c.query(
    `SELECT p.sequence_number sn, pp.role, pl.name FROM play_participants pp
     JOIN plays p USING (play_id) JOIN players pl ON pl.player_id = pp.player_id WHERE p.game_id = $1`, [gameId]);
  const roles = {};
  for (const r of parts) (roles[r.sn] ||= {})[r.role] = r.name;
  // season-to-date FT history for the "own" baseline (games strictly before this one)
  const { rows: ftHist } = await c.query(
    `SELECT pl.name, count(*)::int att, sum(p.is_made::int)::int made FROM plays p
     JOIN games g USING (game_id) JOIN players pl USING (player_id)
     WHERE p.play_category = 'free_throw' AND g.game_date < $1 GROUP BY pl.name`, [game.game_date]);
  const { rows: qrows } = await c.query('SELECT sequence_number sn, play_qualifiers q FROM plays WHERE game_id = $1', [gameId]);
  const quals = Object.fromEntries(qrows.map((r) => [r.sn, r.q || []]));
  return { game, plays, roles, ftHist, quals };
}

// Pure: no database, no files. `mu` is the pregame expected BYU margin; `prior` says where it came from.
function computeWp({ game, plays, roles, ftHist, quals }, { mu = 0, prior = 'none' } = {}) {
  if (!plays.length) return null;
  const wp = (lead, poss, rem) => wpModel(lead, poss, rem, mu);
  const ftOwn = (name) => {
    const h = ftHist.find((x) => x.name === name) || { att: 0, made: 0 };
    return { p: (h.made + FT_SHRINK_K * LEAGUE_FT_PCT) / (h.att + FT_SHRINK_K), att: h.att };
  };

  const oppId = game.home_team_id === FOCUS ? game.away_team_id : game.home_team_id;
  const side = (teamId) => (teamId === FOCUS ? 'byu' : teamId ? 'opp' : null);
  const other = (s) => (s === 'byu' ? 'opp' : s === 'opp' ? 'byu' : null);
  const sgn = (s) => (s === 'byu' ? 1 : -1);
  const homeIsByu = game.home_team_id === FOCUS;
  const leadOf = (p) => (homeIsByu ? p.home_score_after - p.away_score_after : p.away_score_after - p.home_score_after);
  const remOf = (p) => (p.period_number <= 2 ? (2 - p.period_number) * 1200 + (p.clock_seconds_remaining ?? 0) : 0);

  // ---- walk the game: possession state after every event ----
  let poss = null, tipWinner = null, arrow = null, prevLead = 0;
  const ev = [];
  for (let i = 0; i < plays.length; i++) {
    const p = plays[i];
    const s = side(p.team_id);
    const before = { lead: prevLead, poss };
    const nextSameClock = (cat) => plays.slice(i + 1, i + 6).find((q) => q.play_category === cat && q.clock_seconds_remaining === p.clock_seconds_remaining);
    const cat = p.play_category;
    if (cat === 'jumpball' && p.play_type === 'won') { poss = s; if (!tipWinner) { tipWinner = s; arrow = other(s); } }
    else if (cat === 'jumpball' && p.play_type === 'heldball') { poss = arrow; arrow = other(arrow); } // alternating possession (assumed)
    else if (cat === 'period_admin' && p.play_type === 'period' && p.play_subtype === 'start' && p.period_number === 2) poss = other(tipWinner);
    else if (cat === 'shot_attempt') poss = p.is_made ? other(s) : null;
    else if (cat === 'free_throw') {
      const [n, m] = p.play_subtype.split('of').map(Number);
      poss = n === m ? (p.is_made ? other(s) : null) : s;
    } else if (cat === 'rebound') { if (p.play_subtype !== 'deadball') poss = s; }
    else if (cat === 'turnover') poss = other(s);
    else if (cat === 'foul') { const ft = nextSameClock('free_throw'); if (ft) poss = side(ft.team_id); }
    const lead = leadOf(p);
    prevLead = lead;
    const rem = remOf(p);
    ev.push({ i, p, s, rem, before, after: { lead, poss }, wpBefore: wp(before.lead, before.poss, rem), wpAfter: wp(lead, poss, rem) });
  }
  // game end: pin the final result
  const last = ev[ev.length - 1];
  if (game.status === 'final') last.wpAfter = last.after.lead > 0 ? 1 : last.after.lead < 0 ? 0 : 0.5; // a live game has no result yet
  for (const e of ev) e.d = e.wpAfter - e.wpBefore; // BYU-view WP change caused by the event itself (clock held fixed)

  // ---- checks ----
  const sanity = Phi((3 + 4 * 0.25) / (11 * Math.sqrt(0.25)));
  const start = ev.find((e) => e.p.sequence_number === 4) || ev[0];
  const pregame = wp(0, null, REG_SECONDS);
  const eventSum = ev.reduce((a, e) => a + e.d, 0);
  let drift = 0;
  for (let k = 1; k < ev.length; k++) drift += ev[k].wpBefore - ev[k - 1].wpAfter;

  // ---- WPA for possession-value events ----
  const swing = (e, team) => sgn(team) * (wp(e.after.lead, team, e.rem) - wp(e.after.lead, other(team), e.rem)); // acting-team view
  const tov = new Map(); // pair steals / charges to the turnover at the same clock
  for (const e of ev) if (e.p.play_category === 'turnover') tov.set(e.i, e);
  const pairedTO = (e) => ev.slice(Math.max(0, e.i - 3), e.i + 4).find((x) => x.p.play_category === 'turnover' && x.p.clock_seconds_remaining === e.p.clock_seconds_remaining && x.s !== e.s);
  const players = {};
  const P = (name, team) => (players[name] ||= { team, steals: 0, oreb: 0, recBlk: 0, charges: 0, tovLive: 0, tovDead: 0, gain: 0, loss: 0, scoring: 0, scoringEvents: 0 });
  const eventsOut = [];
  for (const e of ev) {
    const p = e.p, cat = p.play_category, name = p.player_name;
    const viewSign = e.s === 'byu' ? 1 : -1;
    if (cat === 'steal' && name) { const v = swing(e, e.s); const r = P(name, e.s); r.steals++; r.gain += v; eventsOut.push({ sn: p.sequence_number, kind: 'steal', name, wpa: v }); }
    if (cat === 'rebound' && p.play_type === 'offensive' && p.play_subtype !== 'deadball' && name) { const v = swing(e, e.s); const r = P(name, e.s); r.oreb++; r.gain += v; eventsOut.push({ sn: p.sequence_number, kind: 'oreb', name, wpa: v }); }
    if (cat === 'block' && name) {
      const nxt = ev.slice(e.i + 1).find((x) => x.p.play_category === 'rebound' || x.p.play_category === 'shot_attempt' || x.p.play_category === 'turnover');
      if (nxt && nxt.p.play_category === 'rebound' && nxt.p.play_type === 'defensive' && nxt.s === e.s) { const v = swing(nxt, e.s); const r = P(name, e.s); r.recBlk++; r.gain += v; eventsOut.push({ sn: p.sequence_number, kind: 'recovered_block', name, wpa: v }); }
    }
    if (cat === 'turnover' && name) {
      const live = ev.some((x) => x.p.play_category === 'steal' && x.p.clock_seconds_remaining === p.clock_seconds_remaining && x.s !== e.s && Math.abs(x.i - e.i) <= 3);
      const v = -swing(e, other(e.s)); // acting-team view: negative
      const r = P(name, e.s); live ? r.tovLive++ : r.tovDead++; r.loss += v;
      eventsOut.push({ sn: p.sequence_number, kind: live ? 'tov_live' : 'tov_dead', name, wpa: v });
      if (p.play_type === 'offensive') { // charge drawn: credit the defender named on the foul row
        const foul = ev.slice(Math.max(0, e.i - 3), e.i).find((x) => x.p.play_category === 'foul' && x.p.play_type === 'offensive');
        const drawer = foul && roles[foul.p.sequence_number] && roles[foul.p.sequence_number].fouled;
        if (drawer) { const rr = P(drawer, other(e.s)); rr.charges++; rr.gain += swing(e, other(e.s)); eventsOut.push({ sn: p.sequence_number, kind: 'charge_drawn', name: drawer, wpa: swing(e, other(e.s)) }); }
      }
    }
    // scoring (context): made FG / FT, acting-team view
    if ((cat === 'shot_attempt' && p.is_made) || (cat === 'free_throw' && p.is_made)) { const r = P(name, e.s); r.scoring += viewSign * e.d; r.scoringEvents++; }
  }

  // ---- free-throw trips and wp_cost (handoff §7.5, both baselines) ----
  const trips = [];
  let cur = null;
  for (const e of ev) {
    if (e.p.play_category !== 'free_throw') continue;
    const [n, m] = e.p.play_subtype.split('of').map(Number);
    if (n === 1) cur = { shooter: e.p.player_name, team: e.s, m, shots: [], start: e };
    if (!cur) continue;
    cur.shots.push(e);
    if (n === m) {
      // trip type comes from the foul that caused it (WMT labels a missed 1-and-1 front end "1of1" and a made one "1of2/2of2")
      const foul = ev.slice(Math.max(0, cur.start.i - 10), cur.start.i).reverse().find((x) => x.p.play_category === 'foul' && x.s !== cur.team);
      const fq = foul ? quals[foul.p.sequence_number] : [];
      const type = fq.includes('oneandone') ? 'one_and_one' : fq.includes('shooting') && fq.includes('1freethrow') ? 'one_shot_and_one' : m === 1 ? 'one_shot_other' : m === 2 ? 'two_shot' : 'three_shot';
      const made = cur.shots.filter((x) => x.p.is_made).length;
      const own = ftOwn(cur.shooter);
      const exp = (p) => (type === 'one_and_one' ? p + p * p : m * p);
      const fin = e; // last attempt
      let possAfter, rb = null;
      if (fin.p.is_made) possAfter = other(cur.team);
      else { rb = ev.slice(fin.i + 1).find((x) => x.p.play_category === 'rebound' && x.p.play_subtype !== 'deadball'); possAfter = rb ? rb.s : null; }
      const leadAfter = fin.after.lead;
      const wpActual = wp(leadAfter, possAfter, fin.rem);
      const cost = (p) => {
        const shortfall = exp(p) - made;
        const wpCf = wp(leadAfter + sgn(cur.team) * shortfall, other(cur.team), fin.rem);
        return { shortfall, wpCost: sgn(cur.team) * (wpCf - wpActual) };
      };
      trips.push({
        sn: cur.start.p.sequence_number, period: cur.start.p.period_number, clock: cur.start.p.clock_seconds_remaining, team: cur.team, shooter: cur.shooter, type, made, of: m,
        finalMissed: !fin.p.is_made, reb: fin.p.is_made ? 'n/a' : rb ? (rb.s === cur.team ? 'offense' : 'defense') : 'none',
        league: cost(LEAGUE_FT_PCT), own: cost(own.p), ownP: +own.p.toFixed(3), ownAtt: own.att,
        late: cur.start.rem <= 120,
      });
      cur = null;
    }
  }

  // ---- chances: possessions + OREB (formula version) ----
  const teamLine = (s) => {
    const mine = ev.filter((e) => e.s === s).map((e) => e.p);
    const fga = mine.filter((p) => p.play_category === 'shot_attempt').length;
    const fta = mine.filter((p) => p.play_category === 'free_throw').length;
    const oreb = mine.filter((p) => p.play_category === 'rebound' && p.play_type === 'offensive' && p.play_subtype !== 'deadball').length;
    const tov = mine.filter((p) => p.play_category === 'turnover').length;
    const poss = fga - oreb + tov + 0.44 * fta;
    const lastPlay = plays[plays.length - 1]; // running score: equals the final score once the game is over
    const pts = (s === 'byu') === homeIsByu ? lastPlay.home_score_after : lastPlay.away_score_after;
    return { fga, fta, oreb, tov, poss: +poss.toFixed(1), chances: +(poss + oreb).toFixed(1), pts, ppp: +(pts / poss).toFixed(3), ppc: +(pts / (poss + oreb)).toFixed(3) };
  };

  const tl = { byu: teamLine('byu'), opp: teamLine('opp') };
  const timeline = ev.map((e) => ({ sn: e.p.sequence_number, period: e.p.period_number, clock: e.p.clock_seconds_remaining, lead: e.after.lead, wp: e.wpAfter, d: e.d }));
  return {
    ev, last, start, pregame, sanity, eventSum, drift, players, trips, tl, homeIsByu, oppId, game,
    json: { game: game.game_id, params: { MU: mu, SIGMA, POSS_SWING, prior }, timeline, players, trips, team: tl, events: eventsOut },
  };
}

function printWp(R) {
  const { ev, last, start, pregame, sanity, eventSum, drift, players, trips, tl, homeIsByu, oppId, game } = R;
  // ---- output ----
  const pct = (x) => (100 * x).toFixed(1).padStart(5);
  const mmss = (e) => `${e.p.period_number === 1 ? 'H1' : 'H2'} ${String(Math.floor(e.p.clock_seconds_remaining / 60)).padStart(2)}:${String(Math.floor(e.p.clock_seconds_remaining % 60)).padStart(2, '0')}`;
  console.log(`GAME ${game.game_id}  final BYU ${last.after.lead > 0 ? '' : ''}${homeIsByu ? last.p.home_score_after : last.p.away_score_after}-${homeIsByu ? last.p.away_score_after : last.p.home_score_after} ${oppId}`);
  console.log(`\nCHECKS\n  handoff sanity (4-pt fav, +3, 10:00, no bonus): ${pct(sanity)}% (target ~77)\n  pregame BYU WP (no ball): ${pct(pregame)}%   after opening tip: ${pct(start.wpAfter)}%`);
  console.log(`  telescoping: start ${pct(pregame)} + events ${pct(eventSum)} + clock drift ${pct(drift)} = ${pct(pregame + eventSum + drift)} (final ${pct(last.wpAfter)})`);

  console.log('\nWP TIMELINE (BYU, after last event of each ~3 min; * = last 60s, low confidence)');
  let mark = Infinity;
  for (const e of ev) { if (e.rem <= mark - 180 || e === last) { mark = e.rem; console.log(`  ${mmss(e)}  ${String(e.after.lead).padStart(3)} ${pct(e.wpAfter)}%${e.rem <= LOW_CONFIDENCE_SEC ? ' *' : ''}`); } }

  console.log('\nLARGEST SINGLE-EVENT SWINGS (BYU WP)');
  [...ev].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 8).forEach((e) => console.log(`  ${mmss(e)}  ${(e.d >= 0 ? '+' : '') + pct(e.d)}  ${e.p.team_id} ${e.p.play_category}/${e.p.play_type || ''} ${e.p.player_name || ''} (${e.p.is_made === true ? 'made' : e.p.is_made === false ? 'miss' : ''}) ${e.after.lead >= 0 ? '+' : ''}${e.after.lead}`));

  console.log('\nPLAYER WPA (percentage points of own-team WP; possession events only, then scoring for context)');
  console.log('  player              tm  stl oreb rBlk chg  tovL tovD   gain   loss    net | scoringWPA');
  Object.entries(players).filter(([, r]) => r.gain || r.loss).sort((a, b) => (b[1].gain + b[1].loss) - (a[1].gain + a[1].loss)).forEach(([n, r]) =>
    console.log(`  ${n.slice(0, 18).padEnd(18)}  ${r.team === 'byu' ? 'BYU' : 'HOU'}  ${String(r.steals).padStart(3)} ${String(r.oreb).padStart(4)} ${String(r.recBlk).padStart(4)} ${String(r.charges).padStart(3)}  ${String(r.tovLive).padStart(4)} ${String(r.tovDead).padStart(4)}  ${pct(r.gain)}  ${pct(r.loss)}  ${pct(r.gain + r.loss)} | ${pct(r.scoring)}`));
  const tg = (t) => Object.values(players).filter((r) => r.team === t).reduce((a, r) => ({ gain: a.gain + r.gain, loss: a.loss + r.loss }), { gain: 0, loss: 0 });
  console.log(`  team BYU gain ${pct(tg('byu').gain)} loss ${pct(tg('byu').loss)} | HOU gain ${pct(tg('opp').gain)} loss ${pct(tg('opp').loss)}`);

  console.log('\nFREE-THROW TRIPS (shooter-team view; shortfall in points, wpCost in WP pts; league / own baseline)');
  trips.forEach((t) => console.log(`  ${t.team === 'byu' ? 'BYU' : 'HOU'} H${t.period} ${Math.floor(t.clock / 60)}:${String(Math.floor(t.clock % 60)).padStart(2, '0')} ${t.shooter.slice(0, 16).padEnd(16)} ${t.type.padEnd(17)} ${t.made}/${t.of}  short L ${t.league.shortfall.toFixed(2).padStart(5)} O ${t.own.shortfall.toFixed(2).padStart(5)} (p=${t.ownP}, n=${t.ownAtt})  wpCost L ${pct(t.league.wpCost)} O ${pct(t.own.wpCost)}${t.finalMissed ? '  missedFinal/' + t.reb : ''}${t.late ? '  LATE' : ''}`));
  const sumT = (team, k, b) => trips.filter((t) => t.team === team).reduce((a, t) => a + t[b][k], 0);
  for (const team of ['byu', 'opp']) console.log(`  ${team === 'byu' ? 'BYU' : 'HOU'}: trips ${trips.filter((t) => t.team === team).length}, shortfall league ${sumT(team, 'shortfall', 'league').toFixed(2)} own ${sumT(team, 'shortfall', 'own').toFixed(2)}, WP lost at line league ${pct(sumT(team, 'wpCost', 'league'))} own ${pct(sumT(team, 'wpCost', 'own'))}`);
  const byType = {}; trips.forEach((t) => (byType[t.type] = (byType[t.type] || 0) + 1)); console.log('  trips by type:', JSON.stringify(byType));

  console.log('\nPOSSESSIONS vs CHANCES (formula: poss = FGA - OREB + TOV + 0.44 FTA; chances = poss + OREB)');
  for (const t of ['byu', 'opp']) { const x = tl[t]; console.log(`  ${t === 'byu' ? 'BYU' : 'HOU'}  pts ${x.pts}  FGA ${x.fga} FTA ${x.fta} OREB ${x.oreb} TOV ${x.tov}  poss ${x.poss}  chances ${x.chances}  PPP ${x.ppp}  PPC ${x.ppc}`); }
}

async function main() {
  const c = await connect();
  const input = await loadWpInput(c, GAME_ID);
  await c.end();
  const mu = expectedMargin(loadPriors(), input.game);
  const R = computeWp(input, { mu: mu === null ? 0 : mu, prior: mu === null ? 'none (even matchup)' : 'config/game-priors.csv' });
  printWp(R);
  const jsonIdx = process.argv.indexOf('--json');
  if (jsonIdx > 0) fs.writeFileSync(process.argv[jsonIdx + 1], JSON.stringify(R.json, null, 1));
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { computeWp, loadWpInput, wpModel };
