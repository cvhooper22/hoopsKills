// Live relay. The laptop pushes (outbound only, bearer token); viewers read. It mirrors the local
// derivations/live-box-server.js API so the front end only changes its base URL:
//
//   GET /games                      games the laptop has pushed (newest first); a game still marked live that has not been
//                                   pushed for STALL_AFTER_MS is reported as 'stalled'
//   GET /box/:gameId                latest box payload
//   GET /plays/:gameId              latest {meta, plays}
//   GET /box/:gameId/stream         server-sent events: `event: box` and `event: plays`, same as the local server
//   PUT /game/:gameId               (auth) body {box, plays, summary}: store the snapshot and send it to watchers; `summary`
//                                   is the game's row from the local /games and is what the list above is built from
//
// One Durable Object ("hub") holds everything. A game is a few hundred plays, so snapshots are small, and plays are
// always replaced whole because the ingest deletes and renumbers them.
const GAME_TTL_MS = 36 * 60 * 60 * 1000; // a game's data is dropped this long after its last push
const STALL_AFTER_MS = 5 * 60 * 1000;    // a 'live' game with no push for this long is listed as 'stalled'

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...CORS } });

function sameToken(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method === 'PUT') {
      const given = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
      if (!env.PUSH_TOKEN || !sameToken(given, env.PUSH_TOKEN)) return json(401, { error: 'unauthorized' });
    } else if (req.method !== 'GET') {
      return json(405, { error: 'GET only' });
    }
    return env.HUB.get(env.HUB.idFromName('hub')).fetch(req);
  },
};

export class Hub {
  constructor(state) {
    this.state = state;
    this.watchers = new Map(); // gameId -> Set(writer)
    this.latest = new Map();   // gameId -> { box, plays } (memory copy of storage)
  }

  async game(id) {
    if (!this.latest.has(id)) {
      const g = await this.state.storage.get(`game:${id}`);
      if (g) this.latest.set(id, g);
    }
    return this.latest.get(id) || null;
  }

  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'PUT') {
      const pm = /^\/game\/([^/]+)$/.exec(url.pathname);
      if (!pm) return json(404, { error: 'not found' });
      const id = decodeURIComponent(pm[1]);
      const { box, plays, summary } = await req.json();
      if (!box || !plays || !summary) return json(400, { error: 'need box, plays and summary' });
      const g = { box, plays, at: Date.now() };
      this.latest.set(id, g);
      await this.state.storage.put(`game:${id}`, g);
      await this.state.storage.put(`sum:${id}`, { summary, at: g.at }); // kept apart so listing games never loads the big snapshots
      await this.state.storage.setAlarm(Date.now() + GAME_TTL_MS);
      await this.broadcast(id, g);
      return json(200, { ok: true, watchers: (this.watchers.get(id) || new Set()).size });
    }

    if (url.pathname === '/games') {
      const now = Date.now();
      const rows = [...(await this.state.storage.list({ prefix: 'sum:' })).values()]
        .filter((r) => now - r.at < GAME_TTL_MS)
        .map((r) => (r.summary.status === 'live' && now - r.at > STALL_AFTER_MS ? { ...r.summary, status: 'stalled' } : r.summary));
      rows.sort((a, b) => String(b.last_changed_at).localeCompare(String(a.last_changed_at)));
      return json(200, rows);
    }

    const m = /^\/(box|plays)\/([^/]+)(\/stream)?$/.exec(url.pathname);
    if (!m) return json(404, { error: 'not found' });
    const id = decodeURIComponent(m[2]);
    const g = await this.game(id);

    if (!m[3]) {
      if (!g) return json(404, { error: 'no plays for that game yet' });
      return json(200, m[1] === 'plays' ? g.plays : g.box);
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    if (!this.watchers.has(id)) this.watchers.set(id, new Set());
    const set = this.watchers.get(id);
    set.add(writer);
    const drop = () => { clearInterval(ping); set.delete(writer); writer.close().catch(() => {}); };
    const ping = setInterval(() => writer.write(new TextEncoder().encode(': ping\n\n')).catch(drop), 20000);
    req.signal.addEventListener('abort', drop);
    if (g) this.send(writer, g).catch(drop);
    return new Response(readable, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', ...CORS } });
  }

  send(writer, g) {
    const enc = new TextEncoder();
    return writer.write(enc.encode(`event: box\ndata: ${JSON.stringify(g.box)}\n\nevent: plays\ndata: ${JSON.stringify(g.plays)}\n\n`));
  }

  async broadcast(id, g) {
    for (const w of [...(this.watchers.get(id) || [])]) {
      this.send(w, g).catch(() => this.watchers.get(id).delete(w));
    }
  }

  // drop games that haven't been pushed for GAME_TTL_MS
  async alarm() {
    const all = await this.state.storage.list({ prefix: 'sum:' });
    let next = null;
    for (const [k, r] of all) {
      const expires = (r.at || 0) + GAME_TTL_MS;
      if (expires <= Date.now()) { const id = k.slice(4); await this.state.storage.delete([k, `game:${id}`]); this.latest.delete(id); }
      else next = Math.min(next ?? expires, expires);
    }
    if (next) await this.state.storage.setAlarm(next);
  }
}
