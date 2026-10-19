// Local stand-in for a live StatBroadcast game. Replays saved period pages, revealing plays as a simulated
// game clock advances, and serves them in the same HTML shape as the real page (header scores and status
// updated to match what has been revealed). No dependencies.
//
//   node ingest/statbroadcast/sim-server.js [--period-files a.html,b.html] [--speed 30] [--port 4577] [--paused] [--start-at 0]
//
//   GET /?period=1            period page (what the scraper fetches); 404 until that period has started
//   GET /?view=box            the box score view (starters; minutes blanked)
//   GET /sim/state            JSON: revealed count, clock, speed, paused
//   GET /sim/pause | /sim/resume | /sim/reset
//   GET /sim/speed?x=60       game seconds per wall second
//   GET /sim/step?n=5         reveal n more plays (pauses auto-advance)
//   GET /sim/seek?plays=200   jump to exactly this many revealed plays
const fs = require('fs');
const http = require('http');
const path = require('path');
const { normalizeGame } = require('./parse');

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i === -1 ? dflt : args[i + 1]; };
const here = path.join(__dirname, '..', '..');
const files = opt('--period-files', path.join(here, 'byuvillanovah1.html') + ',' + path.join(here, 'byuvillanovah2.html')).split(',');
const port = Number(opt('--port', 4577));
const BOX_FIXTURE = path.join(here, 'fixtures', 'statbroadcast', '610232-box.html');

// ---- load: split each page into head / rows / tail ---------------------------------------------------
const TBODY = '<tbody class="text-start">';
const pages = files.map(f => {
  const html = fs.readFileSync(f, 'utf8');
  const start = html.indexOf(TBODY) + TBODY.length;
  const end = html.indexOf('</tbody>', start);
  return {
    head: html.slice(0, start),
    rows: [...html.slice(start, end).matchAll(/<tr[^>]*>.*?<\/tr>/gs)].map(m => m[0]),
    tail: html.slice(end),
    period: Number(/Period (\d+) Plays/.exec(html)[1]),
  };
}).sort((a, b) => a.period - b.period);

// Per-play game time and running score, from the parser itself so the sim and the scraper agree on the data.
const game = normalizeGame(files.map(f => fs.readFileSync(f, 'utf8')));
const simPlays = game.plays.filter(p => !p.sources.statbroadcast.synthetic); // the page's own rows, not the canonical period rows
const total = simPlays.length;
if (pages.reduce((n, p) => n + p.rows.length, 0) !== total) throw new Error('row count != parsed play count');
const finalHeader = game.header;

// ---- sim state ---------------------------------------------------------------------------------------
let speed = Number(opt('--speed', 30)); // game seconds per wall second
let paused = args.includes('--paused');
let revealed = 0;
let simClock = Number(opt('--start-at', 0)); // game seconds elapsed
let lastTick = Date.now();

function advanceTo(clock) {
  simClock = clock;
  while (revealed < total && simPlays[revealed].game_seconds_elapsed <= simClock) revealed++;
}
function tick() {
  const now = Date.now();
  if (!paused) advanceTo(simClock + ((now - lastTick) / 1000) * speed);
  lastTick = now;
}
advanceTo(simClock);
setInterval(tick, 250);

function setRevealed(n) {
  revealed = Math.max(0, Math.min(total, n));
  simClock = revealed ? simPlays[revealed - 1].game_seconds_elapsed : 0;
}

// ---- render ------------------------------------------------------------------------------------------
function renderPeriod(period) {
  const page = pages.find(p => p.period === period);
  if (!page) return null;
  const before = pages.filter(p => p.period < period).reduce((n, p) => n + p.rows.length, 0);
  const shown = Math.max(0, Math.min(page.rows.length, revealed - before));
  if (revealed <= before && period !== pages[0].period) return null; // period hasn't started
  const last = revealed ? simPlays[revealed - 1] : null;
  const away = last ? last.away_score_after : 0, home = last ? last.home_score_after : 0;
  const done = revealed >= total;

  let n = 0;
  let head = page.head.replace(/(sb-teamscore[^"]*">)\d+(<)/g, (_, a, b) => `${a}${n++ % 2 === 0 ? away : home}${b}`);
  head = head.replace(/(font-size-300[^>]*>)Final</g, `$1${done ? 'Final' : 'In Progress'}<`);
  if (!done) head = head.replace(/completedGame = true;/g, 'completedGame = false;').replace(/bbt \+= "FINAL";/g, 'bbt += "LIVE";');
  return head + page.rows.slice(0, shown).join('') + page.tail;
}

// The box view the sim serves has the real starters but blank minutes: the finished-game minutes would disagree
// with a half-played game, and the box's own numbers aren't what is being simulated.
function renderBox() {
  return fs.readFileSync(BOX_FIXTURE, 'utf8').replace(/(<tr checkname="(?!TEAM")[^>]*>)(.*?)(<\/tr>)/gs, (_, open, body, close) => {
    let i = 0;
    return open + body.replace(/<td([^>]*)>(.*?)<\/td>/gs, (m, a, v) => (++i === 15 || i === 16 ? `<td${a}></td>` : m)) + close;
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const json = o => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o, null, 2)); };
  tick();
  switch (url.pathname) {
    case '/sim/pause': paused = true; return json(state());
    case '/sim/resume': paused = false; lastTick = Date.now(); return json(state());
    case '/sim/reset': setRevealed(0); return json(state());
    case '/sim/speed': speed = Number(url.searchParams.get('x')) || speed; return json(state());
    case '/sim/step': paused = true; setRevealed(revealed + (Number(url.searchParams.get('n')) || 1)); return json(state());
    case '/sim/seek': setRevealed(Number(url.searchParams.get('plays')) || 0); return json(state());
    case '/sim/state': return json(state());
    case '/': {
      if (url.searchParams.get('view') === 'box') { res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' }); return res.end(renderBox()); }
      const html = renderPeriod(Number(url.searchParams.get('period')) || pages[0].period);
      if (!html) { res.writeHead(404); return res.end('period not started'); }
      res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' });
      return res.end(html);
    }
    default: res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log(`sim server on http://localhost:${port}/?period=1  (${total} plays, ${speed}x, ${paused ? 'paused' : 'running'})`));

function state() {
  return { revealed, total, simClockSeconds: Math.round(simClock), speed, paused, final: revealed >= total, event: finalHeader.sbEventId };
}
