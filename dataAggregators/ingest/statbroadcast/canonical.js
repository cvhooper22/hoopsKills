// Everything StatBroadcast-specific that turns its play-by-play into the canonical vocabulary the derivations
// read (the WMT feed's vocabulary is the reference). Kept here, not in the parser or in the derivations, so
// that other sources get their own adapter and nothing source-specific leaks into shared code.
//
// Canonical conventions applied to the parsed plays:
//   free throws       play_subtype = "{n}of{m}"                       (StatBroadcast: only "(1OF2)" in the text)
//   timeouts          play_type = 'commercial' | 'short' | 'full'     (StatBroadcast: 'media' | '30s' | other)
//   foul qualifiers   play_qualifiers 'shooting' / 'oneandone'        (StatBroadcast: text after the foul)
//   held ball         play_category 'jumpball', play_type 'heldball'  (StatBroadcast: category 'other')
//   period boundaries 'period_admin' rows, type 'period', subtype 'start' / 'end' (StatBroadcast has none)
//   lineups           lineup_home / lineup_away = who is on the floor AFTER the row, with whole substitution
//                     runs applied together (the page logs OUT and IN as separate rows)
// Lineups need the starting five, which only the box score view has (see box.js).
const { gameSecondsElapsed, REGULATION_PERIODS } = require('../wmt/normalize');

const PERIOD_SECONDS = 1200, OT_SECONDS = 300;
const TIMEOUT_TYPE = { media: 'commercial', '30s': 'short' };
const FOUL_QUALIFIER = { shooting: 'shooting', bonus_one_and_one: 'oneandone' };
const START_ROW = 0, END_ROW = 100000; // positions in the period; real rows are 1..n

function renameVocabulary(p) {
  if (p.play_category === 'free_throw' && p.extra && p.extra.ft_number) p.play_subtype = `${p.extra.ft_number}of${p.extra.ft_total}`;
  if (p.play_category === 'timeout') p.play_type = TIMEOUT_TYPE[p.play_type] || 'full';
  if (p.play_category === 'other' && p.play_type === 'heldball') p.play_category = 'jumpball';
  // the derivations read foul qualifiers ('oneandone', 'shooting') the way the WMT feed spells them
  if (p.play_category === 'foul' && p.extra && p.extra.foul_detail) {
    const q = p.extra.foul_detail.map(d => FOUL_QUALIFIER[d]).filter(Boolean);
    if (q.length) p.play_qualifiers = q;
  }
}

function periodRow(period, kind, ctx) {
  const length = period > REGULATION_PERIODS ? OT_SECONDS : PERIOD_SECONDS;
  const remaining = kind === 'start' ? length : 0;
  const mins = Math.floor(remaining / 60), secs = String(remaining % 60).padStart(2, '0');
  return {
    play_id: null, game_id: ctx.gameId || null, sequence_number: null, source: 'statbroadcast',
    source_play_id: `p${period}-${kind}`,
    period_number: period, period_type: period > REGULATION_PERIODS ? 'ot' : 'regulation',
    clock_seconds_remaining: remaining, clock_display: `${String(mins).padStart(2, '0')}:${secs}`,
    game_seconds_elapsed: gameSecondsElapsed(period, remaining),
    team_abbrev: null, team_side: null, is_neutral_event: true, player: null,
    play_category: 'period_admin', play_type: 'period', play_subtype: kind, play_description: `Period ${period} ${kind}`,
    home_score_after: null, away_score_after: null, shot_value: null, is_shot_attempt: false, is_made: null,
    made_is_inferred: false, is_assisted: null, linked_play_id: null, play_qualifiers: null,
    sources: { statbroadcast: { period, row: kind === 'start' ? START_ROW : END_ROW, synthetic: true } }, extra: {},
  };
}

// A period's end is only known once the next period has started or the game is final.
function addPeriodRows(plays, header, ctx) {
  const periods = [...new Set(plays.map(p => p.period_number))].sort((a, b) => a - b);
  const last = periods[periods.length - 1];
  const out = [];
  for (const period of periods) {
    out.push(periodRow(period, 'start', ctx), ...plays.filter(p => p.period_number === period));
    if (period < last || header.isFinal) out.push(periodRow(period, 'end', ctx));
  }
  return out;
}

// Lineups from the starting five plus substitutions. Entries are {side, jersey, name}; the live store resolves
// them to player ids. Returns warnings for substitutions that contradict the tracked floor.
function addLineups(plays, box) {
  const warnings = [];
  const roster = { home: new Map(), away: new Map() };
  for (const side of ['home', 'away']) for (const b of box[side]) roster[side].set(b.jersey, b);
  // The box score only lists players who have entered the game, and it is read every couple of minutes, so a player who
  // subbed in since then is missing from it. Every substitution row names its own player, so learn names from the plays too.
  for (const p of plays) {
    if (p.player && p.team_side && !roster[p.team_side].has(p.player.jersey)) roster[p.team_side].set(p.player.jersey, { jersey: p.player.jersey, name: p.player.name });
  }
  const onFloor = { home: new Set(box.home.filter(b => b.starter).map(b => b.jersey)), away: new Set(box.away.filter(b => b.starter).map(b => b.jersey)) };
  if (onFloor.home.size !== 5 || onFloor.away.size !== 5) {
    return { warnings: [`box score lists ${onFloor.home.size} home / ${onFloor.away.size} away starters; lineups skipped`], derived: false };
  }
  const snapshot = side => [...onFloor[side]].sort((a, b) => Number(a) - Number(b))
    .map(j => ({ side, jersey: j, name: roster[side].get(j) ? roster[side].get(j).name : null }));

  for (let i = 0; i < plays.length;) {
    if (plays[i].play_category === 'substitution') {
      let j = i;
      for (; j < plays.length && plays[j].play_category === 'substitution'; j++) {
        const p = plays[j], jersey = p.player && p.player.jersey;
        if (!p.team_side || !jersey) continue;
        if (p.play_subtype === 'out') {
          if (!onFloor[p.team_side].delete(jersey)) warnings.push(`${p.source_play_id}: ${p.team_side} #${jersey} subbed out but was not on the floor`);
        } else onFloor[p.team_side].add(jersey);
      }
      for (const side of ['home', 'away']) if (onFloor[side].size !== 5) warnings.push(`${plays[j - 1].source_play_id}: ${side} has ${onFloor[side].size} on the floor after substitutions`);
      for (let k = i; k < j; k++) { plays[k].lineup_home = snapshot('home'); plays[k].lineup_away = snapshot('away'); }
      i = j;
    } else {
      plays[i].lineup_home = snapshot('home'); plays[i].lineup_away = snapshot('away');
      i++;
    }
  }
  return { warnings, derived: true };
}

// Derived minutes vs the box score's MIN column. The two views are read at slightly different moments while a game
// is live, so only large gaps are reported.
function minutesWarnings(plays, box, toleranceMin = 2) {
  const secs = { home: {}, away: {} };
  for (let i = 1; i < plays.length; i++) {
    const a = plays[i - 1], b = plays[i];
    if (a.period_number !== b.period_number) continue;
    const dt = a.clock_seconds_remaining - b.clock_seconds_remaining;
    if (dt <= 0 || !a.lineup_home) continue;
    for (const side of ['home', 'away']) for (const e of a[`lineup_${side}`]) secs[side][e.jersey] = (secs[side][e.jersey] || 0) + dt;
  }
  const out = [];
  for (const side of ['home', 'away']) for (const b of box[side]) {
    if (typeof b.stats.min !== 'number') continue;
    const derived = (secs[side][b.jersey] || 0) / 60;
    if (Math.abs(derived - b.stats.min) > toleranceMin) out.push(`${side} #${b.jersey} ${b.name}: ${derived.toFixed(1)} min from the plays vs ${b.stats.min} in the box score`);
  }
  return out;
}

/** plays: parser output, in play order. box: parseBox() result or null. Returns { plays, warnings }. */
function toCanonical({ plays, header, box }, ctx = {}) {
  plays.forEach(renameVocabulary);
  const withPeriods = addPeriodRows(plays, header, ctx);
  const warnings = [];
  if (box) {
    const r = addLineups(withPeriods, box);
    warnings.push(...r.warnings);
    if (r.derived) warnings.push(...minutesWarnings(withPeriods, box).map(w => `minutes: ${w}`));
  }
  return { plays: withPeriods, warnings };
}

module.exports = { toCanonical, addPeriodRows, addLineups, renameVocabulary };
