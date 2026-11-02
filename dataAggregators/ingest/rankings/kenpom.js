// KenPom. The ratings table is public but sits behind a Cloudflare check: a plain HTTP request gets "Just a moment...",
// and so does headless Chromium. A normal (headed) Chromium window gets through on its own, so this opens a visible
// browser window for a few seconds per run. If the check ever turns that away too, the collector says so and the
// answer is the Chrome extension approach, not tricks.
// The page states no "through" date, so a pull counts games through the day before collection (pull before tip-off);
// run.js checks that against BYU's record in the games table.
const { withBrowser, yesterday } = require('./lib/browser');

const URL = 'https://kenpom.com/';
const num = (v) => { const n = Number(String(v).replace(/^\+/, '')); return v === '' || Number.isNaN(n) ? null : n; };
const int = (v) => (/^\d+$/.test(v) ? Number(v) : null);

/** rows: array of arrays of cell text, as scraped from #ratings-table tbody (21 cells each). */
function parseKenPom(rows, collectedOn) {
  if (!rows.length || rows.some((r) => r.length !== 21)) throw new Error(`kenpom: unexpected table layout (${rows[0] ? rows[0].length : 0} cells per row, expected 21)`);
  return {
    throughDate: yesterday(collectedOn), asofLabel: `KenPom as pulled ${collectedOn} (games through ${yesterday(collectedOn)}, assumed)`, teamsExpected: rows.length,
    rows: rows.map((c) => ({
      name: c[1], conference: c[2], record: c[3],
      overall: { rank: int(c[0]), rating: num(c[4]) },     // NetRtg (AdjEM)
      off: { rank: int(c[6]), rating: num(c[5]) },          // ORtg (AdjO)
      def: { rank: int(c[8]), rating: num(c[7]) },          // DRtg (AdjD)
      metrics: { adjt: num(c[9]), adjt_rank: int(c[10]), luck: num(c[11]), luck_rank: int(c[12]), sos_netrtg: num(c[13]), sos_netrtg_rank: int(c[14]),
        sos_ortg: num(c[15]), sos_ortg_rank: int(c[16]), sos_drtg: num(c[17]), sos_drtg_rank: int(c[18]), ncsos_netrtg: num(c[19]), ncsos_netrtg_rank: int(c[20]) },
    })),
  };
}

async function fetchLatest(collectedOn = new Date().toISOString().slice(0, 10)) {
  const rows = await withBrowser({ headless: false }, async (page) => {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForSelector('#ratings-table tbody tr', { timeout: 30000 });
    } catch (e) {
      const title = await page.title();
      throw new Error(/just a moment/i.test(title) ? 'kenpom: Cloudflare check turned the browser away; use the Chrome extension fallback' : `kenpom: ratings table not found (page "${title}")`);
    }
    return page.evaluate(() => [...document.querySelectorAll('#ratings-table tbody tr')]
      .map((tr) => [...tr.children].map((c) => c.textContent.trim().replace(/\s+/g, ' ')))
      .filter((r) => r.length === 21 && /^\d+$/.test(r[0])));   // drops the repeated header rows
  });
  return { system: 'kenpom', ...parseKenPom(rows, collectedOn), raw: { url: URL, rows: rows.length } };
}

module.exports = { parseKenPom, fetchLatest };
