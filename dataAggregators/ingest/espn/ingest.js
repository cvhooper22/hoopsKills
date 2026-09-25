// Usage:
//   node ingest/espn/ingest.js --id 401830886 [--save-fixture fixtures/espn] [--verify-lineups 8]
//   node ingest/espn/ingest.js --file fixtures/espn/401830886.bundle.json
//   node ingest/espn/ingest.js --ids-file config/espn_game_ids.txt
const fs = require('fs');
const path = require('path');
const { connect } = require('../../db/client');
const { seedTeamsFromConfig, resolveTeams, resolvePlayer, resolveGame, seasonYear, drainNotes } = require('../lib/entities');
const { insertRaw, upsertGame, linkSourceGame, storeGamePlays } = require('../lib/store');
const { fetchBundle } = require('./fetch');
const { extractHeader, normalizePlays } = require('./normalize');
const { checkGame } = require('./check');

// ESPN is a game's primary source only when no WMT id is linked to that game.
async function ingestBundle(client, bundle) {
  const header = extractHeader(bundle);
  await client.query('BEGIN');
  try {
    await seedTeamsFromConfig(client);
    const rawId = await insertRaw(client, 'espn', header.espnGameId, 'bundle', bundle);

    const teams = await resolveTeams(client, 'espn',
      header.competitors.map(c => ({ externalId: c.espnTeamId, name: c.name })), header.date);
    const teamByEspnId = new Map();
    let homeTeamId, awayTeamId;
    for (const c of header.competitors) {
      c.teamId = teams.get(c.espnTeamId);
      teamByEspnId.set(c.espnTeamId, { teamId: c.teamId, side: c.isHome ? 'home' : 'away' });
      if (c.isHome) homeTeamId = c.teamId; else awayTeamId = c.teamId;
    }
    const playerByAthlete = new Map();
    for (const a of header.athletes) {
      const team = teamByEspnId.get(a.espnTeamId);
      playerByAthlete.set(a.athleteId, await resolvePlayer(client, 'espn', a.athleteId, a.name, team && team.teamId));
    }

    const match = await resolveGame(client, 'espn', header.espnGameId, { date: header.date, homeTeamId, awayTeamId });
    const gameId = match.gameId;
    const hasWmt = (await client.query(
      `SELECT 1 FROM source_games WHERE game_id = $1 AND source = 'wmt'`, [gameId])).rows.length > 0;

    const tag = `${match.created ? '  [new game]' : ''}${match.flagged ? '  [FLAGGED: date differs by a day]' : ''}`;
    if (hasWmt) {
      await linkSourceGame(client, 'espn', header.espnGameId, gameId, match.matchedBy);
      await client.query('COMMIT');
      console.log(`\n${gameId}  (espn ${header.espnGameId}, raw ${rawId})${tag}`);
      console.log('  raw stored and linked; plays not normalized because the game already has a WMT source');
      drainNotes().forEach(n => console.log('  note: ' + n));
      return { skipped: true };
    }

    const home = header.competitors.find(c => c.isHome), away = header.competitors.find(c => !c.isHome);
    await upsertGame(client, {
      gameId, date: header.date, tipoffLocal: null, venueTz: null, seasonYear: seasonYear(header.date),
      homeTeamId, awayTeamId, isNeutralSite: header.isNeutralSite, isConferenceGame: header.isConferenceGame,
      venue: header.venue, attendance: header.attendance, finalScoreHome: home.score, finalScoreAway: away.score,
      winnerTeamId: home.score === away.score ? null : (home.score > away.score ? home.teamId : away.teamId),
      status: header.status, source: 'espn',
    });
    await linkSourceGame(client, 'espn', header.espnGameId, gameId, match.matchedBy);

    const ctx = { gameId, rawId, teamByEspnId, playerByAthlete };
    const { plays, participants, unmapped } = normalizePlays(bundle, ctx);
    const removed = await storeGamePlays(client, { gameId, source: 'espn', plays, participants });
    await client.query('COMMIT');

    console.log(`\n${gameId}  (espn ${header.espnGameId}, raw ${rawId})${tag}`);
    console.log(`  ${plays.length} plays, ${participants.length} participants, ${removed} stale plays removed`);
    drainNotes().forEach(n => console.log('  note: ' + n));
    if (Object.keys(unmapped).length) console.log('  UNMAPPED play types:', unmapped);
    return { gameId, header, ctx };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const saveDir = opt('--save-fixture');
  const verifySamples = Number(opt('--verify-lineups') || 0);
  let jobs = [];
  if (opt('--file')) jobs = [{ file: opt('--file') }];
  else if (opt('--id')) jobs = [{ id: opt('--id') }];
  else if (opt('--ids-file')) {
    jobs = fs.readFileSync(opt('--ids-file'), 'utf8').split('\n')
      .map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(id => ({ id }));
  } else { console.error('Give --file, --id or --ids-file'); process.exit(1); }

  const client = await connect();
  let failed = 0;
  try {
    for (const job of jobs) {
      try {
        const bundle = job.file ? JSON.parse(fs.readFileSync(job.file, 'utf8')) : await fetchBundle(job.id, { verifySamples });
        if (saveDir && !job.file) {
          fs.mkdirSync(saveDir, { recursive: true });
          fs.writeFileSync(path.join(saveDir, `${bundle.gameId}.bundle.json`), JSON.stringify(bundle));
        }
        const result = await ingestBundle(client, bundle);
        if (!result.skipped && !(await checkGame(client, result.gameId, bundle, result.header, result.ctx))) failed++;
      } catch (err) {
        failed++;
        console.error(`FAILED ${job.file || job.id}: ${err.message}`);
      }
    }
  } finally {
    await client.end();
  }
  if (failed) process.exit(1);
}

main();
