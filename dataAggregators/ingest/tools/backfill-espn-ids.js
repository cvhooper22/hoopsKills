// Live games come from StatBroadcast, so their players have no ESPN id and collect-headshots.js skips them.
// This matches a game's players against the teams' ESPN rosters by name and records the ESPN id in player_external_ids.
//   node ingest/tools/backfill-espn-ids.js <gameId> [--team <teamId>] [--espn-team <teamId>=<espnTeamId>] [--apply]
// Dry run unless --apply. --team limits it to one side. ESPN team ids come from config/teams.json and
// config/team-logos.json; pass --espn-team for a team in neither.
const fetch = require('node-fetch');
const { connect } = require('../../db/client');
const teams = require('../../config/teams.json');
const logos = require('../../config/team-logos.json');

const norm = s => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
const flagValues = (args, flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));

async function rosterFor(espnTeamId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${espnTeamId}/roster`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN roster ${espnTeamId}: HTTP ${res.status}`);
  return (await res.json()).athletes.map(a => ({ id: a.id, name: a.fullName }));
}

async function main() {
  const args = process.argv.slice(2);
  const gameId = args[0];
  if (!gameId || gameId.startsWith('--')) {
    console.error('usage: backfill-espn-ids.js <gameId> [--team <teamId>] [--espn-team <teamId>=<espnTeamId>] [--apply]');
    process.exit(1);
  }
  const apply = args.includes('--apply');
  const onlyTeam = flagValues(args, '--team')[0];
  const overrides = Object.fromEntries(flagValues(args, '--espn-team').map(s => s.split('=')));
  const espnTeamId = t => overrides[t] || (teams[t] && teams[t].external.espn) || (logos[t] && logos[t].espnId);

  const client = await connect();
  try {
    const { rows: [g] } = await client.query('SELECT home_team_id, away_team_id FROM games WHERE game_id = $1', [gameId]);
    if (!g) throw new Error(`no game ${gameId}`);
    const teamIds = [g.home_team_id, g.away_team_id].filter(t => !onlyTeam || t === onlyTeam);
    if (!teamIds.length) throw new Error(`${onlyTeam} is not in ${gameId}`);

    const roster = new Map();
    for (const t of teamIds) {
      const id = espnTeamId(t);
      if (!id) throw new Error(`no ESPN team id for ${t}; pass --espn-team ${t}=<id>`);
      (await rosterFor(id)).forEach(a => roster.set(norm(a.name), a.id));
    }

    // Everyone in the game's plays (actor or participant) who has no ESPN id yet.
    const { rows: players } = await client.query(
      `SELECT DISTINCT p.player_id, p.name
         FROM plays pl
         JOIN play_participants pp ON pp.play_id = pl.play_id
         JOIN players p ON p.player_id = pp.player_id
        WHERE pl.game_id = $1
          AND NOT EXISTS (SELECT 1 FROM player_external_ids e WHERE e.player_id = p.player_id AND e.source = 'espn')
        ORDER BY p.name`, [gameId]);

    let matched = 0;
    for (const p of players) {
      const id = roster.get(norm(p.name));
      if (!id) { if (!onlyTeam) console.log(`  no match  ${p.player_id}`); continue; }
      const { rows: [clash] } = await client.query(
        `SELECT player_id FROM player_external_ids WHERE source = 'espn' AND external_id = $1`, [id]);
      if (clash) { console.log(`  CLASH     ${p.player_id}: espn ${id} already on ${clash.player_id}`); continue; }
      console.log(`  ${apply ? 'added    ' : 'would add'} ${p.player_id} <- espn ${id}`);
      if (apply) await client.query(`INSERT INTO player_external_ids (player_id, source, external_id) VALUES ($1, 'espn', $2)`, [p.player_id, id]);
      matched++;
    }
    console.log(`${matched} ${apply ? 'added' : 'to add (dry run, pass --apply)'}`);
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
