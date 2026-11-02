// Looks at the game -> opponent rating join (views in migration 005): one line per BYU game with the opponent's overall
// rank at tip-off (at_game) and in the season's latest snapshot, per system, and checks the join is sound.
//   node ingest/rankings/game-ratings.js                 table of every BYU game
//   node ingest/rankings/game-ratings.js --season 2025   one season
//   node ingest/rankings/game-ratings.js --check         invariants and coverage (exit 1 if one fails)
const { connect } = require('../../db/client');

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

async function table(client) {
  const season = opt('--season');
  const { rows: systems } = await client.query('SELECT system FROM rating_systems WHERE active ORDER BY system');
  const { rows } = await client.query(
    `SELECT g.game_id, to_char(g.game_date, 'YYYY-MM-DD') AS d, g.season_year,
            CASE WHEN g.home_team_id = 'byu' THEN g.away_team_id ELSE g.home_team_id END AS opp,
            EXISTS (SELECT 1 FROM game_tags t WHERE t.game_id = g.game_id AND t.tag = 'exhibition') AS exh,
            (SELECT jsonb_object_agg(r.system || ':' || r.basis, r.opp_overall_rank) FROM game_opponent_ratings r WHERE r.game_id = g.game_id) AS ranks
     FROM games g WHERE 'byu' IN (g.home_team_id, g.away_team_id) AND ($1::int IS NULL OR g.season_year = $1) ORDER BY g.game_date`, [season]);
  const cell = (r, s) => `${r.ranks && r.ranks[`${s}:at_game`] != null ? String(r.ranks[`${s}:at_game`]).padStart(3) : '  -'}/${r.ranks && r.ranks[`${s}:latest`] != null ? String(r.ranks[`${s}:latest`]).padEnd(3) : '-  '}`;
  console.log(`opponent overall rank, at tip-off / latest in season\n${'date'.padEnd(11)}${'opponent'.padEnd(22)}${systems.map((s) => s.system.padEnd(10)).join('')}`);
  for (const r of rows) console.log(`${r.d.padEnd(11)}${(r.opp + (r.exh ? ' (exh)' : '')).padEnd(22)}${systems.map((s) => cell(r, s.system).padEnd(10)).join('')}`);
}

async function check(client) {
  const failures = [];
  const fail = (m) => { failures.push(m); console.log('FAIL', m); };
  const { rows: [leak] } = await client.query(
    `SELECT count(*)::int n FROM game_opponent_ratings WHERE basis = 'at_game' AND through_date >= game_date`);
  leak.n ? fail(`${leak.n} at_game rows use a snapshot that includes the game day`) : console.log('ok   no at_game row uses a snapshot from the game day or later');
  const { rows: [wrongSeason] } = await client.query(
    `SELECT count(*)::int n FROM game_opponent_ratings r JOIN rating_snapshots s USING (snapshot_id) WHERE s.season_year <> r.season_year`);
  wrongSeason.n ? fail(`${wrongSeason.n} rows join a snapshot from another season`) : console.log('ok   every row uses a snapshot of the game\'s own season');
  const { rows: [dups] } = await client.query(
    `SELECT count(*)::int n FROM (SELECT game_id, system, basis FROM game_opponent_ratings GROUP BY 1, 2, 3 HAVING count(*) > 1) x`);
  dups.n ? fail(`${dups.n} (game, system, basis) combinations appear twice`) : console.log('ok   one row per game, system and basis');
  const { rows: noTeam } = await client.query(
    `SELECT DISTINCT CASE WHEN g.home_team_id = 'byu' THEN g.away_team_id ELSE g.home_team_id END AS opp
     FROM games g WHERE 'byu' IN (g.home_team_id, g.away_team_id)
       AND NOT EXISTS (SELECT 1 FROM rating_teams t WHERE t.rating_team_id = CASE WHEN g.home_team_id = 'byu' THEN g.away_team_id ELSE g.home_team_id END)`);
  noTeam.length ? fail(`opponents with no canonical rating team (add or rename one on /admin/rankings): ${noTeam.map((r) => r.opp).join(', ')}`) : console.log('ok   every BYU opponent is a canonical rating team');
  const { rows: cov } = await client.query(
    `SELECT s.system, g.season_year, count(*) FILTER (WHERE a.game_id IS NOT NULL)::int AS at_game, count(*) FILTER (WHERE l.game_id IS NOT NULL)::int AS latest, count(*)::int AS games
     FROM rating_systems s CROSS JOIN games g
     LEFT JOIN game_opponent_ratings a ON a.game_id = g.game_id AND a.system = s.system AND a.basis = 'at_game'
     LEFT JOIN game_opponent_ratings l ON l.game_id = g.game_id AND l.system = s.system AND l.basis = 'latest'
     WHERE 'byu' IN (g.home_team_id, g.away_team_id) GROUP BY 1, 2 ORDER BY 2, 1`);
  console.log('\ncoverage (BYU games with a rating, per system and season):');
  for (const c of cov) console.log(`  ${String(c.season_year)} ${c.system.padEnd(9)} at_game ${String(c.at_game).padStart(2)}/${c.games}  latest ${String(c.latest).padStart(2)}/${c.games}`);
  return failures.length;
}

async function main() {
  const client = await connect();
  try {
    if (args.includes('--check')) process.exitCode = (await check(client)) ? 1 : 0;
    else await table(client);
  } finally {
    await client.end();
  }
}
main().catch((err) => { console.error(err.message); process.exit(1); });
