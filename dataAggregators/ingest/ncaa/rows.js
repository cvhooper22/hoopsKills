// Canonical NCAA plays (canonical.js) -> rows for the `plays` / `play_participants` tables. Pure: player and team ids come in
// through `ids`, so the same code backs the database ingest and the no-database check.
const PLAY_CATEGORIES = new Set(['shot_attempt', 'free_throw', 'rebound', 'turnover', 'steal', 'block', 'foul', 'assist', 'substitution',
  'timeout', 'jumpball', 'challenge', 'period_admin', 'other']);
const ROLES = new Set(['shooter', 'assister', 'blocker', 'rebounder', 'turned_over_by', 'stealer', 'fouler', 'fouled', 'sub_in', 'sub_out',
  'jumpball_home', 'jumpball_away', 'jumpball_won_by']);

/**
 * ids: { teamBySide: {home, away}, playerId: ({side, name}) -> player_id (sync; resolve them first) }
 */
function toDbRows(canon, { teamBySide, playerId }) {
  const lineup = list => (list ? list.map(playerId).filter(Boolean).sort() : null);
  const plays = canon.plays.map(p => ({
    play_id: p.play_id, game_id: p.game_id, sequence_number: p.sequence_number, source: 'ncaa', source_play_id: p.source_play_id,
    source_play_ref: p.synthetic ? null : `ncaa:${p.period_number}:${p.clock_display}`,
    period_number: p.period_number, period_type: p.period_type,
    clock_seconds_remaining: p.clock_seconds_remaining, clock_display: p.clock_display, game_seconds_elapsed: p.game_seconds_elapsed, wallclock_utc: null,
    team_id: p.team_side ? teamBySide[p.team_side] : null, team_side: p.team_side || null, is_neutral_event: !p.team_side,
    player_id: p.player ? playerId(p.player) : null,
    play_category: p.play_category, play_type: p.play_type || null, play_subtype: p.play_subtype || null, play_description: p.play_description,
    home_score_after: p.home_score_after, away_score_after: p.away_score_after,
    shot_value: p.shot_value || null, is_shot_attempt: !!p.is_shot_attempt, is_made: p.is_made == null ? null : p.is_made,
    made_is_inferred: !!p.shot_value_inferred, is_assisted: p.is_assisted == null ? null : p.is_assisted, linked_play_id: p.linked_play_id || null,
    court_x: null, court_y: null, raw_x: null, raw_y: null, goal_side: null, area_of_action: null, has_valid_location: false,
    play_qualifiers: null, shot_clock_seconds: null, lineup_home: lineup(p.lineup_home), lineup_away: lineup(p.lineup_away), win_probability_home: null,
    sources: { ncaa: { period: p.period_number, clock: p.clock_display } },
    extra: { drawn_by: p.drawn_by || null, score_repaired: p.score_repaired || undefined },
  }));
  const seen = new Set();
  const participants = [];
  for (const q of canon.participants) {
    const player_id = playerId(q.player);
    const k = `${q.play_id}|${q.role}|${player_id}`;
    if (player_id && !seen.has(k)) { seen.add(k); participants.push({ play_id: q.play_id, player_id, role: q.role }); }
  }
  return { plays, participants };
}

// The table's CHECK / NOT NULL / UNIQUE rules, so a row set can be vetted without a database.
function validateRows({ plays, participants }) {
  const errors = [];
  const ids = new Set(), seqs = new Set();
  for (const p of plays) {
    const bad = m => errors.push(`${p.play_id}: ${m}`);
    if (ids.has(p.play_id)) bad('duplicate play_id'); ids.add(p.play_id);
    if (seqs.has(p.sequence_number)) bad('duplicate sequence_number'); seqs.add(p.sequence_number);
    if (!PLAY_CATEGORIES.has(p.play_category)) bad(`bad category ${p.play_category}`);
    if (!['regulation', 'ot'].includes(p.period_type)) bad('bad period_type');
    if (p.shot_value != null && ![1, 2, 3].includes(p.shot_value)) bad(`bad shot_value ${p.shot_value}`);
    if (p.home_score_after == null || p.away_score_after == null) bad('null score');
    if (p.is_shot_attempt && p.is_made == null) bad('shot without made flag');
    if (p.is_shot_attempt && p.play_category === 'shot_attempt' && p.is_made && !p.shot_value) bad('made shot without value');
    for (const k of ['lineup_home', 'lineup_away']) if (p[k] && p[k].length !== 5) bad(`${k} has ${p[k].length} players`);
    if (p.linked_play_id && !plays.some(q => q.play_id === p.linked_play_id)) bad(`dangling linked_play_id ${p.linked_play_id}`);
  }
  for (const q of participants) {
    if (!ROLES.has(q.role)) errors.push(`${q.play_id}: bad role ${q.role}`);
    if (!ids.has(q.play_id)) errors.push(`participant on unknown play ${q.play_id}`);
  }
  for (let i = 1; i < plays.length; i++) {
    const a = plays[i - 1], b = plays[i];
    if (b.home_score_after < a.home_score_after || b.away_score_after < a.away_score_after) errors.push(`${b.play_id}: score goes backwards`);
  }
  return errors;
}

module.exports = { toDbRows, validateRows };
