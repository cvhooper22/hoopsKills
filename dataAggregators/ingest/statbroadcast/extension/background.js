// Relays snapshots from the content script to the local receiver. The fetch is made here, not in the page,
// so it goes out with the extension's host permission rather than the page's origin.
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== 'snapshot') return false;
  chrome.storage.local.get('config', async ({ config }) => {
    const base = (config && config.receiverUrl) || 'http://127.0.0.1:4600';
    try {
      const res = await fetch(`${base}/snapshot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-sb-ingest': '1' },
        body: JSON.stringify({ eventId: msg.eventId, context: msg.context, periods: msg.periods, box: msg.box }),
      });
      reply(await res.json());
    } catch (err) {
      reply({ ok: false, error: `receiver unreachable at ${base}: ${err.message}` });
    }
  });
  return true; // async reply
});
