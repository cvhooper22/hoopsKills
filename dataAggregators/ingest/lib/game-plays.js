// The normalized-plays query shared by the plays export and the kills summary export, so both
// feed the app's derivations exactly the same rows.
const PLAY_COLUMNS = `
  p.sequence_number, p.period_number, p.period_type, p.clock_display,
  p.clock_seconds_remaining, p.game_seconds_elapsed,
  p.team_id, p.team_side, p.player_id, pl.name AS player_name,
  p.play_category, p.play_type, p.play_subtype, p.play_description,
  p.home_score_after, p.away_score_after, p.shot_value, p.is_made,
  p.lineup_home, p.lineup_away`;

async function fetchGamePlays(client, gameId) {
  const { rows } = await client.query(
    `SELECT ${PLAY_COLUMNS} FROM plays p LEFT JOIN players pl USING (player_id)
     WHERE p.game_id = $1 ORDER BY p.sequence_number`,
    [gameId]
  );
  return rows;
}

module.exports = { fetchGamePlays };
