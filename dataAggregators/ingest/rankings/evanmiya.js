// EvanMiya. The team ratings page (server-rendered, no login for the table) shows 50 rows with a client-side page-size
// selector; choosing the largest size shows all 365 teams. Ratings are "points above average" (higher is better for
// both offense and defense). The page states no "through" date, so a pull counts games through the day before
// collection (pull before tip-off); run.js checks that against BYU's record in the games table.
const { withBrowser, yesterday } = require('./lib/browser');

const URL = 'https://evanmiya.com/team-ratings';
const num = (v) => { const n = Number(v); return v === undefined || v === '' || Number.isNaN(n) ? null : n; };

/** rows: array of {col: text} objects, one per table row (data-col names as on the page). */
function parseEvanMiya(rows, collectedOn) {
  rows = rows.filter((r) => /^\d+$/.test(r.rank || ''));   // drops the header row, whose cells carry the same data-col names
  if (!rows.length || rows.some((r) => !r.team || r.bpr === undefined)) throw new Error('evanmiya: unexpected table layout');
  return {
    throughDate: yesterday(collectedOn), asofLabel: `EvanMiya as pulled ${collectedOn} (games through ${yesterday(collectedOn)}, assumed)`, teamsExpected: rows.length,
    rows: rows.map((r) => ({
      name: r.team, conference: null, record: `${r.wins ?? 0}-${r.losses ?? 0}`,
      overall: { rank: num(r.rank), rating: num(r.bpr) },
      off: { rank: num(r.offRank), rating: num(r.obpr) },
      def: { rank: num(r.defRank), rating: num(r.dbpr) },
      metrics: { rank_excl_ineligible: num(r.rankInj), tempo: num(r.tempo), tempo_rank: num(r.tempoRank), opponent_adjust: num(r.opponentAdjust), pace_adjust: num(r.paceAdjust),
        home_rank: num(r.homeRank), preseason_roster_rank: num(r.preRosterRank), preseason_team_rank: num(r.preseasonRank),
        kill_shots_per_game: num(r.runsPerGame), kill_shots_conceded_per_game: num(r.runsConcededPerGame), kill_shots_margin_per_game: num(r.runsMargin),
        kill_shots_total: num(r.runsTotal), kill_shots_conceded_total: num(r.runsConcededTotal) },
    })),
  };
}

async function fetchLatest(collectedOn = new Date().toISOString().slice(0, 10)) {
  const rows = await withBrowser({ headless: true }, async (page) => {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('[data-col="team"] a', { timeout: 30000 });
    const total = Number(await page.getAttribute('[data-testid="stattable-total"]', 'data-total'));
    const select = page.locator('select[class*="pageSizeSelect"]');
    await select.selectOption({ index: (await select.locator('option').count()) - 1 });
    await page.waitForFunction((n) => document.querySelectorAll('[data-col="team"] a').length >= n, total, { timeout: 30000 });
    return page.evaluate(() => [...document.querySelectorAll('[role="row"]')].map((row) => {
      const o = {};
      row.querySelectorAll('[data-col]').forEach((c) => { if (!(c.dataset.col in o)) o[c.dataset.col] = c.textContent.trim().replace(/\s+/g, ' '); });
      return o;
    }).filter((o) => o.team));
  });
  return { system: 'evanmiya', ...parseEvanMiya(rows, collectedOn), raw: { url: URL, rows: rows.length } };
}

module.exports = { parseEvanMiya, fetchLatest };
