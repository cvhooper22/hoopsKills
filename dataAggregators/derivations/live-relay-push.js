// Pushes live games from the local live-box-server to the public relay (live-relay/). Outbound only: it reads
// from the local server and PUTs to the relay with a bearer token, so nothing on the internet can reach this machine.
// Run it next to live-box-server.js when you want a game public; stop it and the local view is unaffected.
//
//   node derivations/live-relay-push.js     (asks for the relay URL, defaulting to DEFAULT_RELAY, and the token; RELAY_URL / RELAY_TOKEN skip the questions)
//   options: --local http://127.0.0.1:4610   --game <id> (repeatable; default: every game with status 'live' that changed in the last 10 minutes)
//
// For each game it follows the local /box/:id/stream, keeps the latest box + plays, and sends both to the relay
// (debounced, skipped when nothing changed) along with the game's own row from the local /games, which is what the relay's
// public games list is built from: only games pushed here ever appear there. A game is dropped once it is final.
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const local = (arg('--local') || 'http://127.0.0.1:4610').replace(/\/$/, '');
const DEFAULT_RELAY = 'https://live.byuhoopstats-live-relay.workers.dev';
let relay = process.env.RELAY_URL || arg('--url') || '';
let token = process.env.RELAY_TOKEN || '';
const fixed = args.flatMap((a, i) => (a === '--game' ? [args[i + 1]] : []));
const SCAN_MS = 15000, DEBOUNCE_MS = 200, RECENT_MS = 10 * 60 * 1000; // by default only follow live games that changed in the last RECENT_MS
const stamp = () => new Date().toISOString().slice(11, 19);

// Ask on the terminal for whatever the environment did not provide; the token is not echoed.
function ask(question, hidden = false) {
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (t) => { if (t.includes(question)) process.stdout.write(question); };
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); }));
}

const put = (path, body) => fetch(relay + path, {
  method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body,
}).then((r) => { if (!r.ok) throw new Error(`${path} -> ${r.status}`); });

const following = new Map(); // gameId -> AbortController
const getGames = async () => (await fetch(`${local}/games`)).json();

async function follow(gameId) {
  const ctl = new AbortController();
  following.set(gameId, ctl);
  let box = null, plays = null, lastSent = '', timer = null;
  const flush = async () => {
    if (!box || !plays) return;
    let summary;
    try { summary = (await getGames()).find((g) => g.game_id === gameId); } catch (e) { console.error(`${stamp()} ${gameId}: local /games failed: ${e.message}`); return; }
    if (!summary) return;
    const body = JSON.stringify({ box, plays, summary });
    if (body === lastSent) return;
    try { await put(`/game/${encodeURIComponent(gameId)}`, body); lastSent = body; console.log(`${stamp()} ${gameId}: pushed ${plays.plays.length} plays (${Math.round(body.length / 1024)} KB)`); }
    catch (e) { console.error(`${stamp()} ${gameId}: push failed: ${e.message}`); }
    if (box.live && box.live.status === 'final') { ctl.abort(); console.log(`${stamp()} ${gameId}: final, no longer following`); }
  };
  const onEvent = (event, data) => {
    try { if (event === 'box') box = JSON.parse(data); else if (event === 'plays') plays = JSON.parse(data); } catch { return; }
    clearTimeout(timer); timer = setTimeout(flush, DEBOUNCE_MS);
  };
  while (!ctl.signal.aborted) {
    try {
      const res = await fetch(`${local}/box/${encodeURIComponent(gameId)}/stream`, { signal: ctl.signal });
      const dec = new TextDecoder(); let buf = '';
      for await (const chunk of res.body) {
        buf += dec.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /^event: (.*)$/m.exec(block), d = /^data: (.*)$/m.exec(block);
          if (ev && d) onEvent(ev[1], d[1]);
        }
      }
    } catch (e) { if (ctl.signal.aborted) break; console.error(`${stamp()} ${gameId}: local stream dropped (${e.message}), retrying`); }
    if (!ctl.signal.aborted) await new Promise((r) => setTimeout(r, 3000));
  }
  following.delete(gameId);
}

async function scan() {
  try {
    const games = await getGames();
    const wanted = fixed.length ? fixed : games.filter((g) => g.status === 'live' && Date.now() - Date.parse(g.last_changed_at) < RECENT_MS).map((g) => g.game_id);
    for (const id of wanted) if (!following.has(id)) { console.log(`${stamp()} following ${id}`); follow(id); }
  } catch (e) { console.error(`${stamp()} scan failed: ${e.message}`); }
}

(async () => {
  if (!relay) relay = (await ask(`Relay URL [${DEFAULT_RELAY}]: `)) || DEFAULT_RELAY;
  if (!token) token = await ask('Relay token: ', true);
  relay = relay.replace(/\/$/, '');
  if (!token) { console.error('A relay token is required (the PUSH_TOKEN secret set on the Worker).'); process.exit(1); }
  console.log(`pushing ${local} -> ${relay}`);
  scan();
  setInterval(scan, SCAN_MS);
})();
process.on('SIGINT', () => process.exit(0));
