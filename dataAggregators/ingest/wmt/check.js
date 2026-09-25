// Compares stored plays for one game against WMT's own box score and against basic structure rules.
async function checkGame(client, gameId, payload, header) {
  const failures = [];
  const expect = (label, actual, wanted) => {
    if (Number(actual) !== Number(wanted)) failures.push(`${label}: plays say ${actual}, box score says ${wanted}`);
  };

  const box = {};
  for (const c of payload.data.competitors) {
    const total = c.teamStats.find(e => e.period === 0);
    box[String(c.schoolId)] = total ? total.statistic : {};
  }

  for (const c of header.competitors) {
    const s = box[c.schoolId];
    const r = (await client.query(
      `SELECT
         COALESCE(SUM(shot_value) FILTER (WHERE is_made), 0)                                AS pts,
         COUNT(*) FILTER (WHERE play_category = 'shot_attempt' AND is_made)                 AS fgm,
         COUNT(*) FILTER (WHERE play_category = 'shot_attempt')                             AS fga,
         COUNT(*) FILTER (WHERE play_category = 'shot_attempt' AND shot_value = 3 AND is_made) AS tpm,
         COUNT(*) FILTER (WHERE play_category = 'shot_attempt' AND shot_value = 3)          AS tpa,
         COUNT(*) FILTER (WHERE play_category = 'free_throw' AND is_made)                   AS ftm,
         COUNT(*) FILTER (WHERE play_category = 'free_throw')                               AS fta,
         COUNT(*) FILTER (WHERE play_category = 'assist')                                   AS ast,
         COUNT(*) FILTER (WHERE play_category = 'steal')                                    AS stl,
         COUNT(*) FILTER (WHERE play_category = 'block')                                    AS blk,
         COUNT(*) FILTER (WHERE play_category = 'turnover')                                 AS tov,
         COUNT(*) FILTER (WHERE play_category = 'foul')                                     AS pf,
         COUNT(*) FILTER (WHERE play_category = 'rebound' AND play_subtype IS DISTINCT FROM 'deadball') AS reb,
         COUNT(*) FILTER (WHERE play_category = 'rebound' AND play_type = 'offensive' AND play_subtype IS DISTINCT FROM 'deadball') AS oreb
       FROM plays WHERE game_id = $1 AND team_id = $2`, [gameId, c.teamId])).rows[0];
    const t = c.name;
    expect(`${t} points`, r.pts, c.score);
    expect(`${t} FGM`, r.fgm, s.sFieldGoalsMade);
    expect(`${t} FGA`, r.fga, s.sFieldGoalsAttempted);
    expect(`${t} 3PM`, r.tpm, s.sThreePointFieldGoalsMade);
    expect(`${t} 3PA`, r.tpa, s.sThreePointFieldGoalsAttempted);
    expect(`${t} FTM`, r.ftm, s.sFreeThrowsMade);
    expect(`${t} FTA`, r.fta, s.sFreeThrowsAttempted);
    expect(`${t} assists`, r.ast, s.sAssists);
    expect(`${t} steals`, r.stl, s.sSteals);
    expect(`${t} blocks`, r.blk, s.sBlockedShots);
    expect(`${t} turnovers`, r.tov, s.sTurnovers);
    expect(`${t} fouls`, r.pf, s.sPersonalFouls);
    expect(`${t} rebounds`, r.reb, s.sTotalRebounds);
    expect(`${t} offensive rebounds`, r.oreb, Number(s.sOffensiveRebounds || 0));
  }

  const last = (await client.query(
    'SELECT home_score_after h, away_score_after a FROM plays WHERE game_id = $1 ORDER BY sequence_number DESC LIMIT 1', [gameId])).rows[0];
  const home = header.competitors.find(c => c.isHome), away = header.competitors.find(c => !c.isHome);
  expect('final home score on last play', last.h, home.score);
  expect('final away score on last play', last.a, away.score);

  const backwards = (await client.query(
    `SELECT COUNT(*) n FROM (
       SELECT home_score_after - LAG(home_score_after) OVER w AS dh, away_score_after - LAG(away_score_after) OVER w AS da
       FROM plays WHERE game_id = $1 WINDOW w AS (ORDER BY sequence_number)) x WHERE dh < 0 OR da < 0`, [gameId])).rows[0].n;
  if (Number(backwards)) failures.push(`score goes backwards on ${backwards} plays (ordering problem)`);

  const dangling = (await client.query(
    `SELECT COUNT(*) n FROM plays p WHERE game_id = $1 AND linked_play_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM plays q WHERE q.play_id = p.linked_play_id)`, [gameId])).rows[0].n;
  if (Number(dangling)) failures.push(`${dangling} linked_play_id values point at no play`);

  const assistMismatch = (await client.query(
    `SELECT (SELECT COUNT(*) FROM plays WHERE game_id = $1 AND is_assisted) AS flagged,
            (SELECT COUNT(*) FROM plays WHERE game_id = $1 AND play_category = 'assist') AS assists`, [gameId])).rows[0];
  expect('assisted shots vs assist rows', assistMismatch.flagged, assistMismatch.assists);

  const badLineups = (await client.query(
    `SELECT COUNT(*) n FROM plays WHERE game_id = $1 AND lineup_home IS NOT NULL
       AND play_category <> 'substitution'
       AND (cardinality(lineup_home) <> 5 OR cardinality(lineup_away) <> 5 OR NULL = ANY(lineup_home) OR NULL = ANY(lineup_away))`, [gameId])).rows[0].n;
  if (Number(badLineups)) failures.push(`${badLineups} non-substitution plays have a lineup that is not 5 known players per side (mid-substitution rows can legitimately show fewer)`);

  if (failures.length) {
    console.log(`  CHECK FAILED (${failures.length}):`);
    failures.forEach(f => console.log('   - ' + f));
    return false;
  }
  console.log('  check passed: scores, box score totals, ordering, links, lineups');
  return true;
}

module.exports = { checkGame };
