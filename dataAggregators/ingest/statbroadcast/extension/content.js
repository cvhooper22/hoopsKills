// Runs inside a StatBroadcast game tab. While capture is on, it keeps the page on the latest period's
// play-by-play view, reads the rendered page, and hands it to the background worker for the local receiver.
//
// The page's own JavaScript renders each period when its tab button (rel="pxp1", "pxp2", ...) is clicked,
// so the capture clicks the buttons rather than calling anything of the site's. The tab it runs in is
// dedicated to capture: it will keep switching to the play-by-play view.
(() => {
  if (window.__sbCapture) return;
  const params = new URLSearchParams(location.search);
  const eventId = params.get('id');
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const periodButtons = () => [...document.querySelectorAll('button[rel^="pxp"]')]
    .map(b => ({ b, m: /^pxp(\d+)$/.exec(b.getAttribute('rel')) })).filter(x => x.m)
    .map(x => ({ period: Number(x.m[1]), button: x.b }));
  const shownPeriod = () => {
    const t = [...document.querySelectorAll('.card-title')].map(e => /Period (\d+) Plays/i.exec(e.textContent)).find(Boolean);
    return t ? Number(t[1]) : null;
  };
  const tbody = () => document.querySelector('#stats tbody.text-start');
  const pageHtml = () => '<html>' + document.documentElement.innerHTML + '</html>';

  // Click a period's tab and wait for its table to be (re)rendered. If the period is already showing, the
  // old table node must be replaced before we trust it as fresh; if the page won't re-render, accept what's
  // shown after a few seconds.
  async function showPeriod(period, buttons) {
    const target = buttons.find(x => x.period === period);
    if (!target) throw new Error(`no tab for period ${period}`);
    const before = tbody();
    target.button.click();
    const deadline = Date.now() + 8000;
    let softDeadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      await sleep(150);
      const now = tbody();
      if (shownPeriod() === period && now && now !== before) return;
      if (shownPeriod() === period && now && Date.now() > softDeadline) return;
    }
    if (shownPeriod() !== period) throw new Error(`period ${period} did not load`);
  }

  // The site reopens on whichever view was open last (box score, on court, ...), and the period tabs only exist
  // on the play-by-play view, so switch to it first when they're missing.
  async function ensurePlayByPlay() {
    if (periodButtons().length) return;
    const nav = [...document.querySelectorAll('button[rel="pxp"]')].find(b => /play by play/i.test(b.textContent));
    if (!nav) throw new Error('no Play By Play tab on the page');
    nav.click();
    for (let i = 0; i < 50 && !periodButtons().length; i++) await sleep(150);
  }

  // The box score view (the "Split Box" tab) is the only place the starting five appears, and it carries the
  // minutes and stat lines used to cross-check the play-by-play. Read it, then the caller goes back to a period.
  async function captureBox() {
    const btn = document.querySelector('button[rel="box"]');
    if (!btn) throw new Error('no box score tab on the page');
    const before = document.querySelector('#stats table.teambox');
    btn.click();
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      await sleep(150);
      const now = document.querySelector('#stats table.teambox');
      if (now && now !== before) return pageHtml();
    }
    throw new Error('box score did not load');
  }

  // periods: which to read. Returns {period: html}.
  async function capture(periods) {
    await ensurePlayByPlay();
    const buttons = periodButtons();
    if (!buttons.length) throw new Error('no period tabs on the page (game not started?)');
    const out = {};
    for (const p of periods) {
      await showPeriod(p, buttons);
      out[p] = pageHtml();
    }
    return out;
  }

  // ---- capture loop (only the extension's start/stop messages and storage drive this) ----
  let timer = null, running = false, busy = false;
  let lastSent = {}, lastFull = 0, lastKnownPeriods = 0, config = null;
  const status = { running: false, lastOk: null, lastError: null, plays: null, final: false, sent: 0 };

  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; };
  const send = msg => new Promise(resolve => chrome.runtime.sendMessage(msg, r => resolve(r || { ok: false, error: chrome.runtime.lastError?.message || 'no response' })));

  async function tick(forceAll = false) {
    if (busy) return;
    busy = true;
    try {
      await ensurePlayByPlay();
      const all = periodButtons().map(x => x.period).sort((a, b) => a - b);
      if (!all.length) throw new Error('no period tabs on the page (game not started?)');
      const latest = all[all.length - 1];
      const now = Date.now();
      // Latest period every tick; earlier periods on start, when a new period appears, when asked, and every 2 min.
      const full = forceAll || all.length !== lastKnownPeriods || now - lastFull > 120000;
      const wanted = full ? all : [latest];
      // box first, so the page ends on a period view (capture() clicks back to a period)
      const boxHtml = full ? await captureBox().catch(e => { status.lastError = 'box: ' + e.message; return null; }) : null;
      const grabbed = await capture(wanted);
      lastKnownPeriods = all.length;
      if (full) lastFull = now;
      const periods = {};
      for (const [p, html] of Object.entries(grabbed)) {
        const h = hash(html);
        if (lastSent[p] !== h) { periods[p] = html; lastSent[p] = h; }
      }
      let box = null;
      if (boxHtml) { const h = hash(boxHtml); if (lastSent.box !== h) { box = boxHtml; lastSent.box = h; } }
      let res = await send({ type: 'snapshot', eventId, context: config, periods, box });
      if (res.ok && res.need && res.need.length) { // receiver is missing periods (e.g. it restarted): resend them
        const extra = await capture(res.need);
        res = await send({ type: 'snapshot', eventId, context: config, periods: extra });
        for (const [p, html] of Object.entries(extra)) lastSent[p] = hash(html);
      }
      if (!res.ok) throw new Error(res.error || 'receiver error');
      status.lastOk = new Date().toISOString(); status.lastError = null; status.sent++;
      if (res.playCount != null) status.plays = res.playCount;
      if (res.final) { status.final = true; stop(); }
    } catch (err) {
      status.lastError = err.message;
      lastSent = {}; // resend everything after a failure, in case the receiver missed a snapshot
    } finally { busy = false; }
  }

  function start(cfg) {
    config = cfg; running = true; status.running = true; status.final = false; lastSent = {}; lastFull = 0; lastKnownPeriods = 0;
    clearInterval(timer);
    tick(true);
    timer = setInterval(tick, Math.max(2, Number(cfg.intervalSec) || 5) * 1000);
  }
  function stop() { running = false; status.running = false; clearInterval(timer); timer = null; }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'start') { start(msg.config); chrome.storage.local.set({ ['running:' + eventId]: true }); reply({ ok: true }); }
    else if (msg.type === 'stop') { stop(); chrome.storage.local.set({ ['running:' + eventId]: false }); reply({ ok: true }); }
    else if (msg.type === 'status') reply({ eventId, ...status });
    else if (msg.type === 'capture-once') capture(msg.periods).then(p => reply({ ok: true, periods: p }), e => reply({ ok: false, error: e.message }));
    else return false;
    return true;
  });

  // Resume after a reload of this tab, if capture was on for this game.
  chrome.storage.local.get(['config', 'running:' + eventId], v => {
    if (v['running:' + eventId] && v.config) start(v.config);
  });

  window.__sbCapture = { capture, captureBox, ensurePlayByPlay, periodButtons, shownPeriod, eventId };
})();
