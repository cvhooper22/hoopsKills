// Storage steps shared by every source adapter.
const PLAY_COLUMNS = [
  'play_id', 'game_id', 'sequence_number', 'source', 'source_play_id', 'source_play_ref',
  'period_number', 'period_type', 'clock_seconds_remaining', 'clock_display', 'game_seconds_elapsed', 'wallclock_utc',
  'team_id', 'team_side', 'is_neutral_event', 'player_id',
  'play_category', 'play_type', 'play_subtype', 'play_description',
  'home_score_after', 'away_score_after', 'shot_value', 'is_shot_attempt', 'is_made', 'made_is_inferred',
  'is_assisted', 'linked_play_id', 'court_x', 'court_y', 'raw_x', 'raw_y', 'goal_side', 'area_of_action',
  'has_valid_location', 'play_qualifiers', 'shot_clock_seconds', 'lineup_home', 'lineup_away',
  'win_probability_home', 'sources', 'extra',
];
const JSON_COLUMNS = new Set(['sources', 'extra']);

const UPSERT_PLAY = `INSERT INTO plays (${PLAY_COLUMNS.join(',')}) VALUES (${PLAY_COLUMNS.map((_, i) => '$' + (i + 1)).join(',')})
  ON CONFLICT (play_id) DO UPDATE SET ${PLAY_COLUMNS.slice(1).map(c => `${c} = EXCLUDED.${c}`).join(',')}`;

async function insertRaw(client, source, sourceGameId, kind, payload) {
  const r = await client.query(
    `INSERT INTO raw_payloads (source, source_game_id, kind, page, payload) VALUES ($1, $2, $3, 0, $4) RETURNING raw_id`,
    [source, sourceGameId, kind, JSON.stringify(payload)]);
  return r.rows[0].raw_id;
}

async function upsertGame(client, g) {
  await client.query(
    `INSERT INTO games (game_id, game_date, tipoff_local, venue_tz, season_year, home_team_id, away_team_id,
       is_neutral_site, is_conference_game, venue, attendance, final_score_home, final_score_away,
       winner_team_id, status, primary_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (game_id) DO UPDATE SET
       tipoff_local = COALESCE(EXCLUDED.tipoff_local, games.tipoff_local),
       venue_tz = COALESCE(EXCLUDED.venue_tz, games.venue_tz),
       is_neutral_site = EXCLUDED.is_neutral_site, is_conference_game = EXCLUDED.is_conference_game,
       venue = EXCLUDED.venue, attendance = EXCLUDED.attendance,
       final_score_home = EXCLUDED.final_score_home, final_score_away = EXCLUDED.final_score_away,
       winner_team_id = EXCLUDED.winner_team_id, status = EXCLUDED.status, primary_source = EXCLUDED.primary_source`,
    [g.gameId, g.date, g.tipoffLocal, g.venueTz, g.seasonYear, g.homeTeamId, g.awayTeamId, g.isNeutralSite,
      g.isConferenceGame, g.venue, g.attendance, g.finalScoreHome, g.finalScoreAway, g.winnerTeamId, g.status, g.source]);
}

async function linkSourceGame(client, source, sourceGameId, gameId, matchedBy) {
  await client.query(
    `INSERT INTO source_games (source, source_game_id, game_id, matched_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (source, source_game_id) DO NOTHING`,
    [source, sourceGameId, gameId, matchedBy === 'existing' ? 'auto' : matchedBy]);
}

// Only the primary source's plays are kept for a game: upsert this source's plays, drop plays the
// feed no longer has, drop any other source's plays, rebuild participants, and clear derivations.
async function storeGamePlays(client, { gameId, source, plays, participants }) {
  for (const p of plays) {
    await client.query(UPSERT_PLAY, PLAY_COLUMNS.map(c => (JSON_COLUMNS.has(c) ? JSON.stringify(p[c]) : p[c])));
  }
  const removed = await client.query(
    `DELETE FROM plays WHERE game_id = $1 AND (source <> $2 OR NOT (source_play_id = ANY($3)))`,
    [gameId, source, plays.map(p => p.source_play_id)]);
  await client.query('DELETE FROM play_participants WHERE play_id IN (SELECT play_id FROM plays WHERE game_id = $1)', [gameId]);
  for (const q of participants) {
    await client.query(
      'INSERT INTO play_participants (play_id, player_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [q.play_id, q.player_id, q.role]);
  }
  await client.query('DELETE FROM derivation_runs WHERE game_id = $1', [gameId]);
  return removed.rowCount;
}

module.exports = { insertRaw, upsertGame, linkSourceGame, storeGamePlays };
