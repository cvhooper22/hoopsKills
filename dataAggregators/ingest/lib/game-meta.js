// One game's header facts and player headshots (the stat_explorer ".meta.json" shape). Shared by
// ingest/tools/export-game-meta.js and the live box server, so both produce the same object.
async function fetchGameMeta(client, gameId) {
  const { rows: [g] } = await client.query(
    `SELECT g.game_id, to_char(g.game_date, 'YYYY-MM-DD') AS game_date, g.venue, g.is_neutral_site, g.status,
            g.home_team_id, g.away_team_id, g.final_score_home, g.final_score_away
     FROM games g WHERE g.game_id = $1`,
    [gameId]
  );
  if (!g) return null;
  const { rows: teams } = await client.query(
    `SELECT team_id, name, abbrev FROM teams WHERE team_id = ANY($1)`,
    [[g.home_team_id, g.away_team_id]]
  );
  const { rows: images } = await client.query(
    `SELECT pi.player_id, pi.hosted_url FROM player_images pi
     WHERE pi.player_id IN (SELECT DISTINCT player_id FROM plays WHERE game_id = $1 AND player_id IS NOT NULL)`,
    [gameId]
  );
  return {
    gameId: g.game_id,
    date: g.game_date,
    venue: g.venue,
    neutralSite: g.is_neutral_site,
    status: g.status,
    homeId: g.home_team_id,
    awayId: g.away_team_id,
    final: { [g.home_team_id]: g.final_score_home, [g.away_team_id]: g.final_score_away },
    teams: Object.fromEntries(teams.map((t) => [t.team_id, { name: t.name, abbrev: t.abbrev }])),
    headshots: Object.fromEntries(images.map((i) => [i.player_id, i.hosted_url])),
  };
}

module.exports = { fetchGameMeta };
