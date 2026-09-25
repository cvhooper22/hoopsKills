// Usage:
//   node ingest/wmt/ingest.js --file fixtures/wmt/6490506.json
//   node ingest/wmt/ingest.js --id 6490506
//   node ingest/wmt/ingest.js --ids-file config/wmt_game_ids.txt
const fs = require('fs');
const fetch = require('node-fetch');
const { connect } = require('../../db/client');
const { seedTeamsFromConfig, resolveTeams, resolvePlayer, resolveGame, seasonYear, drainNotes } = require('../lib/entities');
const { insertRaw, upsertGame, linkSourceGame, storeGamePlays } = require('../lib/store');
const { extractHeader, normalizePlays } = require('./normalize');
const { checkGame } = require('./check');

const API = id =>
  `https://api.wmt.games/api/statistics/games/${id}?with[0]=actions&with[1]=players&with[2]=plays&with[3]=drives&with[4]=penalties`;

async function ingestPayload(client, payload) {
  const header = extractHeader(payload);
  await client.query('BEGIN');
  try {
    await seedTeamsFromConfig(client);
    const rawId = await insertRaw(client, 'wmt', header.wmtGameId, 'game', payload);

    const teams = await resolveTeams(client, 'wmt',
      header.competitors.map(c => ({ externalId: c.schoolId, name: c.name })), header.date);
    const teamByCompetitor = new Map();
    const teamByWmtTeamId = new Map();
    let homeTeamId, awayTeamId;
    for (const c of header.competitors) {
      c.teamId = teams.get(c.schoolId);
      teamByCompetitor.set(c.competitorId, { teamId: c.teamId, side: c.isHome ? 'home' : 'away' });
      teamByWmtTeamId.set(c.wmtTeamId, c.teamId);
      if (c.isHome) homeTeamId = c.teamId; else awayTeamId = c.teamId;
    }
    const playerByGamePlayer = new Map();
    for (const p of header.players) {
      playerByGamePlayer.set(p.gamePlayerId,
        await resolvePlayer(client, 'wmt', p.wmtPlayerId, p.name, teamByWmtTeamId.get(p.teamWmtId)));
    }

    const match = await resolveGame(client, 'wmt', header.wmtGameId, { date: header.date, homeTeamId, awayTeamId });
    const gameId = match.gameId;
    const home = header.competitors.find(c => c.isHome), away = header.competitors.find(c => !c.isHome);

    await upsertGame(client, {
      gameId, date: header.date, tipoffLocal: header.tipoffLocal, venueTz: header.venueTz,
      seasonYear: seasonYear(header.date), homeTeamId, awayTeamId, isNeutralSite: header.isNeutralSite,
      isConferenceGame: header.isConferenceGame, venue: header.venue, attendance: header.attendance,
      finalScoreHome: home.score, finalScoreAway: away.score,
      winnerTeamId: home.score === away.score ? null : (home.score > away.score ? home.teamId : away.teamId),
      status: header.isFinal ? 'final' : 'live', source: 'wmt',
    });
    await linkSourceGame(client, 'wmt', header.wmtGameId, gameId, match.matchedBy);

    const { plays, participants, unmapped } = normalizePlays(payload, { gameId, rawId, teamByCompetitor, playerByGamePlayer });
    const removed = await storeGamePlays(client, { gameId, source: 'wmt', plays, participants });
    await client.query('COMMIT');

    console.log(`\n${gameId}  (wmt ${header.wmtGameId}, raw ${rawId})` +
      `${match.created ? '  [new game]' : ''}${match.flagged ? '  [FLAGGED: date differs by a day]' : ''}`);
    console.log(`  ${plays.length} plays, ${participants.length} participants, ${removed} stale plays removed`);
    drainNotes().forEach(n => console.log('  note: ' + n));
    if (Object.keys(unmapped).length) console.log('  UNMAPPED action types:', unmapped);
    return { gameId, header };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function loadPayload(arg) {
  if (arg.file) return JSON.parse(fs.readFileSync(arg.file, 'utf8'));
  const res = await fetch(API(arg.id));
  if (!res.ok) throw new Error(`WMT ${arg.id}: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
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
        const payload = await loadPayload(job);
        const { gameId, header } = await ingestPayload(client, payload);
        if (!(await checkGame(client, gameId, payload, header))) failed++;
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
