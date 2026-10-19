// Local ingest endpoint for the StatBroadcast Chrome extension (see ./extension). The extension reads the
// rendered play-by-play pages out of the user's own Chrome tab and POSTs them here; this runs the same
// parse + incremental store the poller uses. Bound to 127.0.0.1 only.
//
//   node ingest/statbroadcast/receiver.js [--port 4600]        (DATABASE_URL picks the database)
//
//   POST /snapshot   {eventId, context:{date,home,away,homeName?,awayName?}, periods:{"1":html,"2":html}, box?: html}
//                    -> {ok, changed, playCount, final, need:[periods still missing], ...}
//                    An empty `periods` is a heartbeat (extension is alive, nothing new on the page).
//   GET  /status     what the receiver has seen per event
//
// The custom X-SB-Ingest header is required: a browser page on another origin can't send it without a CORS
// preflight (which this server never approves), so only the extension (host_permissions) can post.
const http = require('http');
const crypto = require('crypto');
const { connect } = require('../../db/client');
const { syncSnapshot, titleCaseSlug } = require('./live-store');

const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || 4600;
const stamp = () => new Date().toISOString().slice(11, 19);

const events = new Map(); // eventId -> { ctx, pages: Map(period -> html), lastHash, last: {...} }
let client;
let queue = Promise.resolve();

function eventState(eventId, context) {
  if (!events.has(eventId)) {
    for (const k of ['date', 'home', 'away']) if (!context || !context[k]) throw Object.assign(new Error(`context.${k} is required`), { status: 400 });
    events.set(eventId, {
      ctx: { eventId, date: context.date, homeTeamId: context.home, awayTeamId: context.away,
        homeName: context.homeName || titleCaseSlug(context.home), awayName: context.awayName || titleCaseSlug(context.away),
        state: { playerCache: new Map(), gameId: null } },
      pages: new Map(), box: null, lastHash: null, last: null,
    });
  }
  return events.get(eventId);
}

async function handleSnapshot(body) {
  const eventId = String(body.eventId || '');
  if (!/^\d+$/.test(eventId)) throw Object.assign(new Error('eventId must be numeric'), { status: 400 });
  const ev = eventState(eventId, body.context);
  for (const [p, html] of Object.entries(body.periods || {})) {
    if (!/^\d+$/.test(p) || typeof html !== 'string') throw Object.assign(new Error('bad periods payload'), { status: 400 });
    ev.pages.set(Number(p), html);
  }

  if (typeof body.box === 'string') ev.box = body.box;
  const have = [...ev.pages.keys()].sort((a, b) => a - b);
  const need = [];
  for (let p = 1; p <= (have[have.length - 1] || 0); p++) if (!ev.pages.has(p)) need.push(p);
  if (!have.length || need.length) {
    if (!have.length) need.push(1);
    return { ok: true, waiting: true, need };
  }

  const pages = have.map(p => ev.pages.get(p));
  const hash = crypto.createHash('sha1').update(pages.join('\0') + '\0' + (ev.box || '')).digest('hex');
  if (hash === ev.lastHash && ev.ctx.state.gameId) {
    await client.query('UPDATE live_game_state SET last_polled_at = now() WHERE game_id = $1', [ev.ctx.state.gameId]);
    return { ok: true, changed: false, playCount: ev.last.playCount, final: ev.last.final, need: [] };
  }

  const r = await syncSnapshot(client, ev.ctx, pages, { boxHtml: ev.box });
  ev.lastHash = hash;
  ev.last = { playCount: r.playCount, final: r.header.isFinal, at: new Date().toISOString(), gameId: r.gameId };
  if (r.changed) {
    console.log(`${stamp()} ${r.gameId}: ${r.playCount} plays (+${r.inserted} new, ${r.updated} changed, ${r.deleted} removed)  ` +
      `${r.header.awayName} ${r.header.awayScore ?? '-'} @ ${r.header.homeName} ${r.header.homeScore ?? '-'}  [${r.header.statusText}]`);
    r.warnings.forEach(w => console.log('  warning:', w));
    r.checks.forEach(c => console.log('  CHECK:', c));
    r.unmapped.forEach(u => console.log('  unmapped play:', u));
  }
  return { ok: true, changed: r.changed, playCount: r.playCount, final: r.header.isFinal, status: r.header.statusText,
    score: { away: r.header.awayScore, home: r.header.homeScore }, need: [], warnings: r.warnings.length, checks: r.checks.length };
}

const server = http.createServer((req, res) => {
  const send = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && req.url === '/status') {
    return send(200, Object.fromEntries([...events].map(([id, e]) => [id, { periods: [...e.pages.keys()], ...e.last }])));
  }
  if (req.method !== 'POST' || req.url !== '/snapshot') return send(404, { ok: false, error: 'not found' });
  if (req.headers['x-sb-ingest'] !== '1' || !/application\/json/.test(req.headers['content-type'] || '')) {
    return send(403, { ok: false, error: 'missing X-SB-Ingest header or JSON content type' });
  }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400, { ok: false, error: 'invalid JSON' }); }
    // one snapshot at a time: syncSnapshot runs a transaction on the shared client
    queue = queue.then(() => handleSnapshot(body)).then(
      r => send(200, r),
      err => { console.error(`${stamp()} snapshot failed: ${err.message}`); send(err.status || 500, { ok: false, error: err.message }); });
  });
});

(async () => {
  client = await connect();
  server.listen(port, '127.0.0.1', () => console.log(`receiver on http://127.0.0.1:${port}  (POST /snapshot, GET /status)`));
  process.on('SIGINT', async () => { server.close(); await client.end(); process.exit(0); });
})().catch(err => { console.error(err); process.exit(1); });
