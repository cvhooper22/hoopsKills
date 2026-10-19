// Live custom-metric service. Whenever the ingest side stores new plays for a game (Postgres NOTIFY
// 'live_game_updated', sent by ingest/statbroadcast/live-store.js) it recomputes the whole box-score suite with
// computeBox() and pushes the result to anyone watching. A game is a few hundred plays, so recomputing from scratch
// is cheap and there is no incremental state to get wrong. Postgres stays the source of truth: a restart just
// recomputes from the plays. Bound to 127.0.0.1.
//
//   node derivations/live-box-server.js [--port 4610]       (DATABASE_URL picks the database)
//
//   GET /games                      games with a live_game_state row, newest update first
//   GET /box/:gameId                latest computed payload (what the batch script writes), plus a `live` block
//   GET /box/:gameId/stream         server-sent events on every update: `event: box` (that payload) and `event: plays`
//   GET /plays/:gameId              {meta, plays}: the game's normalized plays and header facts, exactly what the app's Kills view
//                                   loads for a finished game (pbp JSON + meta JSON), so detectKills can run in the browser on live data
//
// Pregame priors come from config/game-priors.csv (re-read on every compute); a game with no row is modelled as an
// even matchup and the payload says so (params.prior in the WP block).
const http = require('http');
const { Client } = require('pg');
const { connect } = require('../db/client');
const { computeBox, load, loadRim, loadWp } = require('./game-box-prototype');
const { fetchGamePlays } = require('../ingest/lib/game-plays');
const { fetchGameMeta } = require('../ingest/lib/game-meta');

const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || 4610;
const DEBOUNCE_MS = 300;
const stamp = () => new Date().toISOString().slice(11, 19);

const latest = new Map();   // gameId -> { payload, computedAt, playCount }
const watchers = new Map(); // gameId -> Set(res)
const timers = new Map();
let db, rim = null, rimAt = 0;
const RIM_REFRESH_MS = 5 * 60 * 1000;
// the pooled rim FG% spans every game in the database, so a long-running server refreshes it now and then
async function getRim() { if (!rim || Date.now() - rimAt > RIM_REFRESH_MS) { rim = await loadRim(db); rimAt = Date.now(); } return rim; }

// Whether play is stopped for a timeout right now, from the plays: the latest play that is not a substitution (subs happen
// during the timeout) is a timeout row. The feed has no "timeout over" event, so this ends when the next play is logged,
// which can be a few seconds after play actually resumes.
function timeoutNow(evs, teams, final) {
  if (final) return null;
  let i = evs.length - 1;
  while (i >= 0 && evs[i].cat === 'substitution') i--;
  const e = evs[i];
  if (!e || e.cat !== 'timeout') return null;
  const team = e.side ? teams[e.side] : null;
  if (e.type === 'commercial') return { kind: 'media', team: null, label: 'Media timeout' };
  const length = e.type === 'short' ? '30-second ' : '';
  return { kind: 'team', team, label: team ? `${team} ${length}timeout` : 'Timeout' };
}

async function compute(gameId) {
  const D = await load(db, gameId);
  if (!D.game || !D.evs.length) return null;
  const W = await loadWp(db, gameId, D.game);
  const { payload, checks } = computeBox({ D, rim: await getRim(), W });
  const { rows: [st] } = await db.query('SELECT * FROM live_game_state WHERE game_id = $1', [gameId]);
  payload.live = {
    status: D.game.status, statusText: st ? st.status_text : null, period: st ? st.period_number : null, clock: st ? st.clock_display : null,
    playCount: D.evs.length, lastChangedAt: st ? st.last_changed_at : null, lastPolledAt: st ? st.last_polled_at : null,
    failedChecks: checks.filter((c) => !c.ok).map((c) => c.name),
    timeout: timeoutNow(D.evs, payload.header.teams, D.game.status === 'final'),
  };
  const entry = {
    payload, computedAt: new Date().toISOString(), playCount: D.evs.length,
    playsPayload: { meta: await fetchGameMeta(db, gameId), plays: await fetchGamePlays(db, gameId) },
  };
  latest.set(gameId, entry);
  return entry;
}

// one update = both events, so a page that shows either view stays in step
const sendAll = (res, e) => {
  res.write(`event: box\ndata: ${JSON.stringify(e.payload)}\n\n`);
  res.write(`event: plays\ndata: ${JSON.stringify(e.playsPayload)}\n\n`);
};

async function recompute(gameId) {
  try {
    const t0 = Date.now();
    const e = await compute(gameId);
    if (!e) return;
    console.log(`${stamp()} ${gameId}: ${e.playCount} plays -> box in ${Date.now() - t0}ms${e.payload.live.failedChecks.length ? '  FAILED CHECKS: ' + e.payload.live.failedChecks.join('; ') : ''}`);
    for (const res of watchers.get(gameId) || []) sendAll(res, e);
  } catch (err) {
    console.error(`${stamp()} ${gameId}: compute failed: ${err.stack || err.message}`);
  }
}

function schedule(gameId) {
  clearTimeout(timers.get(gameId));
  timers.set(gameId, setTimeout(() => recompute(gameId), DEBOUNCE_MS));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const json = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(obj)); };
  if (req.method !== 'GET') return json(405, { error: 'GET only' });
  if (url.pathname === '/games') {
    const { rows } = await db.query(
      `SELECT s.game_id, g.status, g.game_date, s.status_text, s.period_number, s.clock_display, s.home_score, s.away_score, s.play_count, s.last_changed_at
       FROM live_game_state s JOIN games g USING (game_id) ORDER BY s.last_changed_at DESC NULLS LAST`);
    return json(200, rows);
  }
  const m = /^\/(box|plays)\/([^/]+)(\/stream)?$/.exec(url.pathname);
  if (!m) return json(404, { error: 'not found' });
  const gameId = decodeURIComponent(m[2]);
  if (!latest.has(gameId)) await compute(gameId).catch(() => null);
  if (!m[3]) {
    if (!latest.has(gameId)) return json(404, { error: 'no plays for that game yet' });
    return json(200, m[1] === 'plays' ? latest.get(gameId).playsPayload : latest.get(gameId).payload);
  }
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
  if (latest.has(gameId)) sendAll(res, latest.get(gameId));
  if (!watchers.has(gameId)) watchers.set(gameId, new Set());
  watchers.get(gameId).add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => { clearInterval(ping); watchers.get(gameId).delete(res); });
});

(async () => {
  db = await connect();
  const listener = new Client({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5544/pbp' });
  await listener.connect();
  await listener.query('LISTEN live_game_updated');
  listener.on('notification', (n) => { try { schedule(JSON.parse(n.payload).gameId); } catch (e) { console.error('bad notification', n.payload); } });
  const { rows } = await db.query(`SELECT game_id FROM live_game_state s JOIN games g USING (game_id) WHERE g.status = 'live'`);
  for (const r of rows) schedule(r.game_id);
  server.listen(port, '127.0.0.1', () => console.log(`live box server on http://127.0.0.1:${port}  (GET /games, /box/:gameId, /box/:gameId/stream)`));
  process.on('SIGINT', async () => { server.close(); await listener.end(); await db.end(); process.exit(0); });
})().catch((err) => { console.error(err); process.exit(1); });
