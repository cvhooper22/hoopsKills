// NCAA-specific step that turns normalize.js output into the canonical row set the other sources produce (ESPN is the
// reference): same categories, one row per event (assists folded into the shot, as ESPN does), participants, free-throw
// trip subtypes, period start/end rows, and lineups. Pure: players are {side, name} refs, resolved to ids by ingest.js.
//
// Conventions matched:
//   assists           no 'assist' rows; the shot gets is_assisted and an 'assister' participant
//   steal / block     own rows, linked_play_id -> the turnover / missed shot; their participants hang on that parent row
//   free throws       play_subtype "{n}of{m}" (m = size of the run of free throws the feed shows)
//   period boundaries 'period_admin' rows, type 'period', subtype 'start' / 'end'
//   lineups           who is on the floor AFTER the row, whole substitution runs applied together (as StatBroadcast)
//   source_play_id    built from period, clock, kind, player and an occurrence count, so ids survive plays being appended
const { normalizePlays } = require('./normalize');

const PERIOD_SECONDS = 1200, OT_SECONDS = 300, REGULATION_PERIODS = 2;
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// --- lineups -------------------------------------------------------------------------------------------------------

// The feed has no starting five (the box score has no players while a game is live), so infer it: anyone whose first
// appearance is not a "subbing in" row was on the floor at tip. Returns { starters, warnings } per side.
function inferStarters(plays) {
  const seen = { home: new Set(), away: new Set() }, starters = { home: [], away: [] };
  for (const p of plays) {
    if (!p.player || !p.team_side || p.period_number > 1 && starters[p.team_side].length >= 5) continue;
    const s = p.team_side, name = p.player.name;
    if (seen[s].has(name)) continue;
    seen[s].add(name);
    const enteredByBench = p.play_category === 'substitution' && p.play_subtype === 'in';
    if (!enteredByBench) starters[s].push(name);
  }
  return starters;
}

function addLineups(plays) {
  const warnings = [];
  const starters = inferStarters(plays);
  for (const side of ['home', 'away']) {
    if (starters[side].length !== 5) {
      warnings.push(`${side}: ${starters[side].length} starters inferred (need 5: the missing ones haven't acted or been subbed yet); lineups skipped`);
      return { warnings, derived: false };
    }
  }
  const onFloor = { home: new Set(starters.home), away: new Set(starters.away) };
  const snap = side => [...onFloor[side]].sort().map(name => ({ side, name }));
  for (let i = 0; i < plays.length;) {
    if (plays[i].play_category === 'substitution') {
      let j = i;
      for (; j < plays.length && plays[j].play_category === 'substitution'; j++) {
        const p = plays[j];
        if (!p.team_side || !p.player) continue;
        const set = onFloor[p.team_side];
        if (p.play_subtype === 'out') { if (!set.delete(p.player.name)) warnings.push(`${p.source_play_id}: ${p.player.name} subbed out but was not on the floor`); }
        else set.add(p.player.name);
      }
      for (const side of ['home', 'away']) if (onFloor[side].size !== 5) warnings.push(`${plays[j - 1].source_play_id}: ${side} has ${onFloor[side].size} on the floor after substitutions`);
      for (let k = i; k < j; k++) { plays[k].lineup_home = snap('home'); plays[k].lineup_away = snap('away'); }
      i = j;
    } else { plays[i].lineup_home = snap('home'); plays[i].lineup_away = snap('away'); i++; }
  }
  return { warnings, derived: true };
}

// --- the rest ------------------------------------------------------------------------------------------------------

function foldAssists(plays, warnings) {
  const byId = new Map(plays.map(p => [p.play_id, p]));
  const out = [];
  for (const p of plays) {
    if (p.play_category !== 'assist') { out.push(p); continue; }
    const shot = p.linked_play_id && byId.get(p.linked_play_id);
    if (shot) { shot.is_assisted = true; shot._assister = p.player_name ? { side: p.team_side, name: p.player_name } : null; }
    else warnings.push(`assist at ${p.period_number}:${p.clock_display} by ${p.player_name} has no shot to attach to; dropped`);
  }
  for (const p of out) {
    if (typeof p._assister === 'string') { p.is_assisted = true; p._assister = { side: p.team_side, name: p._assister }; }
    if (p.is_shot_attempt && p.is_made && p.is_assisted == null) p.is_assisted = false;
  }
  return out;
}

// Free throws in one trip: same team and period, nothing between them but rebounds / subs / timeouts / dead-ball rows.
function tagFreeThrows(plays) {
  let run = [];
  const flush = () => { run.forEach((p, i) => { p.play_subtype = `${i + 1}of${run.length}`; }); run = []; };
  for (const p of plays) {
    const last = run[run.length - 1];
    if (p.play_category === 'free_throw') {
      if (last && (last.team_side !== p.team_side || last.period_number !== p.period_number)) flush();
      run.push(p);
    } else if (run.length && !['substitution', 'timeout', 'rebound', 'foul', 'period_admin'].includes(p.play_category)) flush();
    else if (run.length && p.play_category === 'rebound' && p.clock_seconds_remaining !== last.clock_seconds_remaining) flush();
  }
  flush();
}

function periodRow(period, kind, prev) {
  const length = period > REGULATION_PERIODS ? OT_SECONDS : PERIOD_SECONDS;
  const rem = kind === 'start' ? length : 0;
  return {
    period_number: period, period_type: period > REGULATION_PERIODS ? 'ot' : 'regulation',
    clock_seconds_remaining: rem, clock_display: `${String(Math.floor(rem / 60)).padStart(2, '0')}:${String(rem % 60).padStart(2, '0')}`,
    game_seconds_elapsed: period <= REGULATION_PERIODS ? (period - 1) * PERIOD_SECONDS + (length - rem) : REGULATION_PERIODS * PERIOD_SECONDS + (period - REGULATION_PERIODS - 1) * OT_SECONDS + (length - rem),
    team_side: null, is_neutral_event: true, player: null, player_name: null, play_category: 'period_admin', play_type: 'period',
    play_subtype: kind, play_description: `Period ${period} ${kind}`, home_score_after: kind === 'start' ? (prev ? prev.home_score_after : 0) : prev.home_score_after,
    away_score_after: kind === 'start' ? (prev ? prev.away_score_after : 0) : prev.away_score_after, shot_value: null, is_shot_attempt: false, is_made: null,
    is_assisted: null, linked_play_id: null, synthetic: true,
  };
}

function addPeriodRows(plays, isFinal) {
  const periods = [...new Set(plays.map(p => p.period_number))].sort((a, b) => a - b);
  const out = [];
  let prev = null;
  periods.forEach((period, i) => {
    const rows = plays.filter(p => p.period_number === period);
    out.push(periodRow(period, 'start', prev), ...rows);
    prev = rows[rows.length - 1];
    if (i < periods.length - 1 || isFinal) out.push(periodRow(period, 'end', prev));
  });
  return out;
}

function assignIds(plays, gameId) {
  const counts = new Map();
  plays.forEach((p, i) => {
    const base = p.synthetic ? `p${p.period_number}-${p.play_subtype}`
      : `p${p.period_number}-${p.clock_display}-${p.play_category}-${slug(p.player_name || p.team_side) || 'x'}${p.play_subtype && p.play_category === 'substitution' ? '-' + p.play_subtype : ''}`;
    const n = (counts.get(base) || 0) + 1;
    counts.set(base, n);
    p.source_play_id = n === 1 ? base : `${base}-${n}`;
    p.play_id = `${gameId}-${p.source_play_id}`;
    p.sequence_number = i + 1;
    p.game_id = gameId;
  });
  // linked ids were positional until now
  return plays;
}

/** pbp: NCAA playbyplay object. Returns { plays, participants, warnings, dropped, unmapped }. */
function toCanonical(pbp, { gameId = `ncaa-${pbp.contestId}`, isFinal = pbp.status === 'final' } = {}) {
  const warnings = [];
  const { plays: raw, unmapped } = normalizePlays(pbp, { gameId });
  const dropped = raw.filter(p => p.suspect);
  dropped.forEach(p => warnings.push(`dropped suspect row (bad running score) ${p.period_number}:${p.clock_display} ${p.play_description}`));
  let plays = raw.filter(p => !p.suspect);
  const oldIds = new Map(plays.map(p => [p.play_id, p]));
  plays = foldAssists(plays, warnings);
  plays.forEach(p => { p.player = p.player_name && p.team_side ? { side: p.team_side, name: p.player_name } : null; p.source = 'ncaa'; });
  tagFreeThrows(plays);
  plays = addPeriodRows(plays, isFinal);
  assignIds(plays, gameId);
  // positional play_ids from normalize.js -> the stable ones
  const newId = new Map();
  oldIds.forEach((p, id) => newId.set(id, p.play_id));
  plays.forEach(p => { if (p.linked_play_id) p.linked_play_id = newId.get(p.linked_play_id) || null; });

  const lineup = addLineups(plays);
  warnings.push(...lineup.warnings);

  const participants = [];
  const byId = new Map(plays.map(p => [p.play_id, p]));
  for (const p of plays) {
    const add = (target, role, who) => { if (who && target) participants.push({ play_id: target.play_id, player: who, role }); };
    const parent = p.linked_play_id && byId.get(p.linked_play_id);
    const me = p.player;
    switch (p.play_category) {
      case 'shot_attempt': case 'free_throw': add(p, 'shooter', me); add(p, 'assister', p._assister); break;
      case 'rebound': add(p, 'rebounder', me); break;
      case 'turnover': add(p, 'turned_over_by', me); break;
      case 'foul': add(p, 'fouler', me); break;
      case 'steal': add(parent || p, 'stealer', me); break;
      case 'block': add(parent || p, 'blocker', me); break;
      case 'substitution': add(p, p.play_subtype === 'in' ? 'sub_in' : 'sub_out', me); break;
      case 'jumpball': add(p, 'jumpball_won_by', me); break;
    }
  }
  return { plays, participants, warnings, unmapped, lineupsDerived: lineup.derived };
}

module.exports = { toCanonical, inferStarters, addLineups };
