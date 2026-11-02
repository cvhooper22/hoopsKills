// Playwright helper for the two systems that need a real browser (KenPom, EvanMiya). Nothing here tries to hide
// that it is automated: if a site's bot check turns the browser away, the collector fails with a clear message and
// the fallback is the Chrome-extension approach used for StatBroadcast (see ingest/statbroadcast/extension).
async function withBrowser({ headless = true } = {}, fn) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
}

const yesterday = (collectedOn) => { const d = new Date(collectedOn + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

module.exports = { withBrowser, yesterday };
