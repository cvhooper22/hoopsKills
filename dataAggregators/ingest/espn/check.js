// Validates stored ESPN plays against ESPN's own team box score and basic structure rules.
const { snapshots } = require('./normalize');

async function checkGame(client, gameId, bundle, header, ctx) {
  const failures = [];
  const expect = (label, actual, wanted) => {
    if (Number(actual) !== Number(wanted)) failures.push(`${label}: plays say ${actual}, ESPN says ${wanted}`);
  };
  const stat = (body, name) => {
    for (const cat of body.splits.categories) {
      const s = cat.stats.find(x => x.name === name);
      if (s) return s.value;
    }
    return undefined;
  };

  for (const c of header.competitors) {
    const teamId = ctx.teamByEspnId.get(c.espnTeamId).teamId;
    const box = bundle.teamStats[c.espnTeamId];
    const r = (await client.query(
      `SELECT
         COALESCE(SUM(shot_value) FILTER (WHERE is_made), 0)                                   AS pts,
         COUNT(*) FILTER (WHERE play_category = 'shot_attempt' AND is_made)                    AS fgm,
         COUNT(*) FILTER (WHERE play_category = 'shot_attempt')                                AS fga,
         COUNT(*) FILTER (WHERE play_category = 'shot_attempt' AND shot_value = 3 AND is_made) AS tpm,
         COUNT(*) FILTER (WHERE play_category = 'shot_attempt' AND shot_value = 3)             AS tpa,
         COUNT(*) FILTER (WHERE play_category = 'free_throw' AND is_made)                      AS ftm,
         COUNT(*) FILTER (WHERE play_category = 'free_throw')                                  AS fta,
         COUNT(*) FILTER (WHERE is_assisted)                                                   AS ast,
         COUNT(*) FILTER (WHERE play_category = 'steal')                                       AS stl,
         COUNT(*) FILTER (WHERE play_category = 'block')                                       AS blk,
         COUNT(*) FILTER (WHERE play_category = 'turnover')                                    AS tov,
         COUNT(*) FILTER (WHERE play_category = 'foul')                                        AS pf,
         COUNT(*) FILTER (WHERE play_category = 'rebound' AND play_subtype IS DISTINCT FROM 'deadball') AS reb,
         COUNT(*) FILTER (WHERE play_category = 'rebound' AND play_type = 'offensive')         AS oreb
       FROM plays WHERE game_id = $1 AND team_id = $2`, [gameId, teamId])).rows[0];
    const t = c.name;
    expect(`${t} points`, r.pts, c.score);
    expect(`${t} points (box)`, r.pts, stat(box, 'points'));
    expect(`${t} FGM`, r.fgm, stat(box, 'fieldGoalsMade'));
    expect(`${t} FGA`, r.fga, stat(box, 'fieldGoalsAttempted'));
    expect(`${t} 3PM`, r.tpm, stat(box, 'threePointFieldGoalsMade'));
    expect(`${t} 3PA`, r.tpa, stat(box, 'threePointFieldGoalsAttempted'));
    expect(`${t} FTM`, r.ftm, stat(box, 'freeThrowsMade'));
    expect(`${t} FTA`, r.fta, stat(box, 'freeThrowsAttempted'));
    expect(`${t} assists`, r.ast, stat(box, 'assists'));
    expect(`${t} steals`, r.stl, stat(box, 'steals'));
    expect(`${t} blocks`, r.blk, stat(box, 'blocks'));
    expect(`${t} turnovers`, r.tov, stat(box, 'turnovers'));
    expect(`${t} fouls`, r.pf, stat(box, 'fouls'));
    expect(`${t} rebounds`, r.reb, stat(box, 'totalRebounds'));
    expect(`${t} offensive rebounds`, r.oreb, stat(box, 'offensiveRebounds'));
  }

  const backwards = (await client.query(
    `SELECT COUNT(*) n FROM (
       SELECT home_score_after - LAG(home_score_after) OVER w AS dh, away_score_after - LAG(away_score_after) OVER w AS da
       FROM plays WHERE game_id = $1 WINDOW w AS (ORDER BY sequence_number)) x WHERE dh < 0 OR da < 0`, [gameId])).rows[0].n;
  if (Number(backwards)) failures.push(`score goes backwards on ${backwards} plays (ordering problem)`);

  const deltas = (await client.query(
    `SELECT COUNT(*) n FROM (
       SELECT (home_score_after + away_score_after) - LAG(home_score_after + away_score_after) OVER w AS d,
              CASE WHEN is_made THEN shot_value ELSE 0 END AS pts
       FROM plays WHERE game_id = $1 WINDOW w AS (ORDER BY sequence_number)) x
     WHERE d IS NOT NULL AND d <> pts`, [gameId])).rows[0].n;
  if (Number(deltas)) failures.push(`${deltas} plays where the score change does not match the made shot/free throw`);

  const unlinked = (await client.query(
    `SELECT play_category, COUNT(*) n FROM plays WHERE game_id = $1 AND play_category IN ('steal','block') AND linked_play_id IS NULL GROUP BY 1`, [gameId])).rows;
  const info = unlinked.map(u => `${u.n} ${u.play_category} row(s) without a parent`);

  const badLineups = (await client.query(
    `SELECT COUNT(*) n FROM plays WHERE game_id = $1 AND play_category <> 'substitution'
       AND (lineup_home IS NULL OR lineup_away IS NULL OR cardinality(lineup_home) <> 5 OR cardinality(lineup_away) <> 5)`, [gameId])).rows[0].n;
  if (Number(badLineups)) failures.push(`${badLineups} non-substitution plays with a lineup that is not 5 per side`);

  // lineup reconstruction vs extra snapshots fetched only for verification
  const snaps = snapshots(bundle);
  let agree = 0, differ = 0;
  for (const id of bundle.verify || []) {
    const snap = snaps.get(id);
    const row = (await client.query('SELECT lineup_home, lineup_away, team_side FROM plays WHERE game_id = $1 AND source_play_id = $2', [gameId, id])).rows[0];
    if (!snap || !row) continue;
    for (const [espnTeamId, set] of Object.entries(snap)) {
      const side = ctx.teamByEspnId.get(espnTeamId).side;
      const mine = new Set(row[side === 'home' ? 'lineup_home' : 'lineup_away'] || []);
      const theirs = new Set([...set].map(a => ctx.playerByAthlete.get(a)));
      if (mine.size === theirs.size && [...mine].every(x => theirs.has(x))) agree++; else differ++;
    }
  }
  if (differ) failures.push(`lineup reconstruction disagrees with ESPN's own snapshot on ${differ} of ${agree + differ} sampled team-plays`);
  if (agree + differ) info.push(`lineup snapshots agreeing: ${agree}/${agree + differ}`);

  info.forEach(i => console.log('  info: ' + i));
  if (failures.length) {
    console.log(`  CHECK FAILED (${failures.length}):`);
    failures.forEach(f => console.log('   - ' + f));
    return false;
  }
  console.log('  check passed: scores, ESPN box score totals, ordering, score deltas, lineups');
  return true;
}

module.exports = { checkGame };
