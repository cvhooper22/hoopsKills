// NCAA.com as a fallback play source. Same shape as ingest/espn/ingest.js: resolve teams / players / game, upsert the
// game row, store the plays. The NCAA plays only become a game's plays when no other source (ESPN, WMT, StatBroadcast) is
// already linked to it, or with force=true, since ESPN is the preferred live source.
//
//   node ingest/ncaa/ingest.js --id <contestId>                 vet only: fetch, build every row, check it, touch no database
//   node ingest/ncaa/ingest.js --id <contestId> --write [--force-primary]    (DATABASE_URL picks the database)
const { fetchBundle } = require('./fetch');
const { toCanonical } = require('./canonical');
const { toDbRows, validateRows } = require('./rows');

// Same local-date rule as ESPN: US tip-offs before 10:00 UTC belong to the previous day.
function localDate(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  if (d.getUTCHours() < 10) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function header(bundle) {
  const { pbp, game } = bundle;
  const home = pbp.teams.find(t => t.isHome), away = pbp.teams.find(t => !t.isHome);
  return {
    contestId: String(pbp.contestId), home, away,
    date: game && game.startTimeEpoch ? localDate(game.startTimeEpoch) : null,
    venue: game && game.location ? game.location.venue : null,
    isFinal: pbp.status === 'final',
    status: pbp.status === 'final' ? 'final' : pbp.status === 'live' ? 'live' : 'scheduled',
  };
}

// Every distinct {side, name} the rows mention, with the team it belongs to.
function playerRefs(canon) {
  const refs = new Map();
  const add = r => { if (r) refs.set(`${r.side}:${r.name}`, r); };
  canon.plays.forEach(p => { add(p.player); (p.lineup_home || []).forEach(add); (p.lineup_away || []).forEach(add); });
  canon.participants.forEach(q => add(q.player));
  return [...refs.values()];
}

async function ingestBundle(client, bundle, { force = false } = {}) {
  const { seedTeamsFromConfig, resolveTeams, resolvePlayer, resolveGame, seasonYear, drainNotes } = require('../lib/entities');
  const { insertRaw, upsertGame, linkSourceGame, storeGamePlays } = require('../lib/store');
  const h = header(bundle);
  if (!h.date) throw new Error('no game start time from NCAA; cannot place the game on a date');
  await client.query('BEGIN');
  try {
    await seedTeamsFromConfig(client);
    const rawId = await insertRaw(client, 'ncaa', h.contestId, 'pbp', bundle.pbp);
    const teams = await resolveTeams(client, 'ncaa', [h.home, h.away].map(t => ({ externalId: String(t.teamId), name: t.nameShort })), h.date);
    const teamBySide = { home: teams.get(String(h.home.teamId)), away: teams.get(String(h.away.teamId)) };
    const match = await resolveGame(client, 'ncaa', h.contestId, { date: h.date, homeTeamId: teamBySide.home, awayTeamId: teamBySide.away });
    const gameId = match.gameId;

    const other = await client.query(`SELECT source FROM source_games WHERE game_id = $1 AND source <> 'ncaa'`, [gameId]);
    if (other.rows.length && !force) {
      await linkSourceGame(client, 'ncaa', h.contestId, gameId, match.matchedBy);
      await client.query('COMMIT');
      return { skipped: true, gameId, reason: `game already has ${other.rows.map(r => r.source).join(', ')} as a source` };
    }

    const canon = toCanonical(bundle.pbp, { gameId, isFinal: h.isFinal });
    const ids = new Map();
    for (const r of playerRefs(canon)) {
      const key = `${r.side}:${r.name}`;
      const team = teamBySide[r.side];
      ids.set(key, await resolvePlayer(client, 'ncaa', `${(r.side === 'home' ? h.home : h.away).teamId}:${r.name}`, r.name, team));
    }
    const rows = toDbRows(canon, { teamBySide, playerId: r => ids.get(`${r.side}:${r.name}`) || null });
    const errors = validateRows(rows);
    if (errors.length) throw new Error(`NCAA rows failed validation:\n  ${errors.slice(0, 10).join('\n  ')}`);

    const last = rows.plays.filter(p => !p.is_neutral_event || p.play_category !== 'period_admin').pop() || { home_score_after: 0, away_score_after: 0 };
    await upsertGame(client, {
      gameId, date: h.date, tipoffLocal: null, venueTz: null, seasonYear: seasonYear(h.date), homeTeamId: teamBySide.home, awayTeamId: teamBySide.away,
      isNeutralSite: null, isConferenceGame: null, venue: h.venue, attendance: null,
      finalScoreHome: last.home_score_after, finalScoreAway: last.away_score_after,
      winnerTeamId: h.isFinal && last.home_score_after !== last.away_score_after ? (last.home_score_after > last.away_score_after ? teamBySide.home : teamBySide.away) : null,
      status: h.status, source: 'ncaa',
    });
    await linkSourceGame(client, 'ncaa', h.contestId, gameId, match.matchedBy);
    rows.plays.forEach(p => { if (p.source_play_ref) p.source_play_ref = `raw:${rawId}:${p.source_play_ref}`; });
    const removed = await storeGamePlays(client, { gameId, source: 'ncaa', plays: rows.plays, participants: rows.participants });
    await client.query('COMMIT');
    return { gameId, plays: rows.plays.length, participants: rows.participants.length, removed, warnings: canon.warnings, notes: drainNotes(), rows };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

// No database: build and vet the rows with stand-in ids.
function dryRun(bundle) {
  const h = header(bundle);
  const canon = toCanonical(bundle.pbp, { isFinal: h.isFinal });
  const teamBySide = { home: `team-${h.home.teamId}`, away: `team-${h.away.teamId}` };
  const rows = toDbRows(canon, { teamBySide, playerId: r => `${r.side}-${r.name.toLowerCase().replace(/[^a-z]+/g, '-')}` });
  return { header: h, canon, rows, errors: validateRows(rows) };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const id = opt('--id');
  if (!id) { console.error('Give --id <contestId>'); process.exit(1); }
  const bundle = await fetchBundle(id);
  if (!args.includes('--write')) {
    const r = dryRun(bundle);
    const lined = r.rows.plays.filter(p => p.lineup_home).length;
    console.log(`${r.header.away.nameShort} @ ${r.header.home.nameShort}  ${r.header.date}  ${r.header.status}`);
    console.log(`${r.rows.plays.length} plays (${lined} with lineups), ${r.rows.participants.length} participants`);
    r.canon.warnings.forEach(w => console.log('  warning: ' + w));
    if (Object.keys(r.canon.unmapped).length) console.log('  UNMAPPED:', r.canon.unmapped);
    console.log(r.errors.length ? `VALIDATION FAILED:\n  ${r.errors.slice(0, 15).join('\n  ')}` : 'rows valid; database not touched (add --write to store them)');
    process.exit(r.errors.length ? 1 : 0);
  }
  const { connect } = require('../../db/client');
  const client = await connect();
  try {
    const r = await ingestBundle(client, bundle, { force: args.includes('--force-primary') });
    console.log(r.skipped ? `skipped ${r.gameId}: ${r.reason}` : `${r.gameId}: ${r.plays} plays, ${r.participants} participants, ${r.removed} stale removed`);
    (r.warnings || []).forEach(w => console.log('  warning: ' + w));
    (r.notes || []).forEach(n => console.log('  note: ' + n));
  } finally { await client.end(); }
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { ingestBundle, dryRun, header, localDate };
