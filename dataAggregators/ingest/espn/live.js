// Live ESPN capture: re-fetches one in-progress game every few seconds and re-ingests it, so the live box server
// (derivations/live-box-server.js) and the app's /live page update as the game goes. ESPN revises plays in place
// (a shooter-less "team misses shot" is filled in a poll or two later); the normal ingest already upserts by play id
// and removes plays that disappeared, so each cycle is just a full re-ingest whenever the plays changed.
//
//   node ingest/espn/live.js --id <espnGameId> [--every 15] [--save-fixture <dir>]     (DATABASE_URL picks the database)
//
// Stops on its own once ESPN reports the game final (after one last ingest).
const fs = require('fs');
const path = require('path');
const { connect } = require('../../db/client');
const { fetchBundle } = require('./fetch');
const { ingestBundle } = require('./ingest');

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const id = opt('--id');
const everyMs = (Number(opt('--every')) || 15) * 1000;
const saveDir = opt('--save-fixture');
if (!id) { console.error('Give --id <espnGameId>'); process.exit(1); }

const stamp = () => new Date().toISOString().slice(11, 19);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Anything in a play that a revision could change, plus the game status.
const signature = b => JSON.stringify([b.competition.status && b.competition.status.$ref, b.plays.map(p =>
  [p.id, p.text, p.type && p.type.text, p.awayScore, p.homeScore, p.valid, (p.participants || []).map(x => x.athlete && x.athlete.$ref)])]);

async function cycle(client, state) {
  const bundle = await fetchBundle(id);
  const status = bundle.refs[bundle.competition.status && bundle.competition.status.$ref];
  const type = status && status.type;
  const final = !!(type && type.completed);
  // The game clock comes from ESPN's status, not the newest play: a break (halftime, end of period) has a play stamped at
  // the last clock a player acted on (e.g. 0:32), while the status says 0:00 / "Halftime".
  const clock = status && status.displayClock != null ? { period: status.period || null, display: status.displayClock } : null;
  const sig = signature(bundle) + (type ? type.name : '');
  if (sig === state.sig && !final) {
    // Nothing new: still tell the live page the feed is being polled, or it flags a quiet stretch as stalled.
    // The live server only recomputes on a NOTIFY, and the page's stall check reads last_polled_at from that payload.
    if (state.gameId) {
      await client.query(
        `UPDATE live_game_state SET last_polled_at = now(), status_text = COALESCE($2, status_text),
           period_number = COALESCE($3, period_number), clock_display = COALESCE($4, clock_display) WHERE game_id = $1`,
        [state.gameId, type ? type.description : null, clock && clock.period, clock && clock.display]);
      await client.query('SELECT pg_notify($1, $2)', ['live_game_updated', JSON.stringify({ gameId: state.gameId, playCount: bundle.plays.length, final: false })]);
    }
    return { final: false, changed: false, plays: bundle.plays.length };
  }

  const result = await ingestBundle(client, bundle);
  if (result.skipped) throw new Error('game has a WMT source; ESPN plays were not normalized');
  const { gameId, header } = result;
  const home = header.competitors.find(c => c.isHome), away = header.competitors.find(c => !c.isHome);
  const last = [...bundle.plays].sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber)).pop();

  await client.query(
    `INSERT INTO live_game_state (game_id, source, source_game_id, status_text, period_number, clock_display, home_score,
       away_score, play_count, last_polled_at, last_changed_at, consecutive_failures, last_error)
     VALUES ($1,'espn',$2,$3,$4,$5,$6,$7,$8, now(), now(), 0, NULL)
     ON CONFLICT (game_id) DO UPDATE SET status_text = EXCLUDED.status_text, period_number = EXCLUDED.period_number,
       clock_display = EXCLUDED.clock_display, home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score,
       play_count = EXCLUDED.play_count, last_polled_at = now(), last_changed_at = now(), consecutive_failures = 0, last_error = NULL`,
    [gameId, String(id), type ? type.description : null, clock ? clock.period : last ? last.period.number : null, clock ? clock.display : last ? last.clock.displayValue : null,
      home.score, away.score, bundle.plays.length]);
  await client.query('SELECT pg_notify($1, $2)', ['live_game_updated',
    JSON.stringify({ gameId, playCount: bundle.plays.length, final })]);
  // Each cycle stores a full raw bundle; keep only the newest so a 2-hour game doesn't leave hundreds of copies.
  await client.query(`DELETE FROM raw_payloads WHERE source = 'espn' AND source_game_id = $1 AND kind = 'bundle'
    AND raw_id < (SELECT max(raw_id) FROM raw_payloads WHERE source = 'espn' AND source_game_id = $1 AND kind = 'bundle')`, [String(id)]);
  if (saveDir) {
    fs.mkdirSync(saveDir, { recursive: true });
    fs.writeFileSync(path.join(saveDir, `${id}.bundle.json`), JSON.stringify(bundle));
  }
  state.sig = sig;
  state.gameId = gameId;
  console.log(`${stamp()} ${gameId}: ${bundle.plays.length} plays, ${away.score}-${home.score}, ${type ? type.description : '?'} ${clock ? `P${clock.period} ${clock.display}` : ''}`);
  return { final, changed: true, plays: bundle.plays.length };
}

async function main() {
  const client = await connect();
  const state = { sig: null };
  let failures = 0;
  console.log(`${stamp()} ESPN live capture of ${id} every ${everyMs / 1000}s`);
  try {
    for (;;) {
      try {
        const r = await cycle(client, state);
        failures = 0;
        if (r.final) { console.log(`${stamp()} game final; stopping`); break; }
      } catch (err) {
        failures++;
        console.error(`${stamp()} cycle failed (${failures}): ${err.message}`);
        try { await client.query('ROLLBACK'); } catch (_) {}
        if (failures >= 20) { console.error('too many consecutive failures; stopping'); process.exitCode = 1; break; }
      }
      await sleep(everyMs);
    }
  } finally {
    await client.end();
  }
}

main();
