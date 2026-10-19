const $ = id => document.getElementById(id);
const fields = ['date', 'home', 'away', 'intervalSec', 'receiverUrl'];
let tabId = null, running = false;

const readConfig = () => Object.fromEntries(fields.map(f => [f, $(f).value.trim()]));
const ask = msg => new Promise(res => chrome.tabs.sendMessage(tabId, msg, r => res(chrome.runtime.lastError ? null : r)));

async function refresh() {
  const s = await ask({ type: 'status' });
  if (!s) { $('status').innerHTML = '<span class="err">Open a stats.statbroadcast.com game tab (and reload it once after installing the extension).</span>'; return; }
  running = s.running; $('toggle').textContent = running ? 'Stop capture' : 'Start capture';
  $('status').textContent = [running ? 'Capturing' : s.final ? 'Game final: capture stopped' : 'Stopped',
    s.plays != null ? `${s.plays} plays stored` : '', s.lastOk ? `last ok ${new Date(s.lastOk).toLocaleTimeString()}` : '',
    s.lastError ? `error: ${s.lastError}` : ''].filter(Boolean).join('\n');
  $('status').classList.toggle('err', !!s.lastError);
}

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab.id;
  $('ev').textContent = 'Game: ' + (/[?&]id=(\d+)/.exec(tab.url || '') || [, 'not a game tab'])[1];
  const { config } = await chrome.storage.local.get('config');
  for (const f of fields) if (config && config[f]) $(f).value = config[f];
  await refresh();
  setInterval(refresh, 1500);
})();

$('toggle').onclick = async () => {
  if (running) { await ask({ type: 'stop' }); return refresh(); }
  const config = readConfig();
  const missing = ['date', 'home', 'away'].filter(f => !config[f]);
  if (missing.length) { $('status').innerHTML = `<span class="err">Fill in: ${missing.join(', ')}</span>`; return; }
  await chrome.storage.local.set({ config });
  await ask({ type: 'start', config });
  refresh();
};
