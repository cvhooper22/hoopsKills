// Test-only source of rendered period pages (the real site is read by the Chrome extension in ./extension,
// which posts to receiver.js). A fetcher exposes
//   getPeriodPages() -> Promise<string[]>   (HTML, one per period that exists, in period order)
//   close()
const fetch = require('node-fetch');

// Plain HTTP against the local simulator (sim-server.js): /?period=N, 404 once periods run out.
function simFetcher(baseUrl) {
  return {
    async getPeriodPages() {
      const pages = [];
      for (let period = 1; ; period++) {
        const res = await fetch(`${baseUrl}/?period=${period}`);
        if (res.status === 404) break;
        if (!res.ok) throw new Error(`sim server: HTTP ${res.status} for period ${period}`);
        pages.push(await res.text());
      }
      if (!pages.length) throw new Error('sim server returned no periods');
      return pages;
    },
    async getBox() {
      const res = await fetch(`${baseUrl}/?view=box`);
      return res.ok ? res.text() : null;
    },
    async close() {},
  };
}

module.exports = { simFetcher };
