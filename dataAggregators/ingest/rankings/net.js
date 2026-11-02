// NCAA NET rankings, from the ncaa.com page: one plain HTML table (all D-I teams) stamped "Through Games Apr. 06 2026".
// NET is a rank plus resume data (record splits, Quad 1-4 records), with no efficiency numbers. The NCAA publishes no
// archive, so NET history only exists from the day we start collecting it.
const fetch = require('node-fetch');

const URL = 'https://www.ncaa.com/rankings/basketball-men/d1/ncaa-mens-basketball-net-rankings';
const UA = 'Mozilla/5.0 (hoopsKills personal stats project)';
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&(\w+);/g, (m, n) => ENT[n] ?? m).replace(/\s+/g, ' ').trim();
const int = (v) => (/^\d+$/.test(v) ? Number(v) : null);

function parseThrough(html) {
  const m = /Through Games\s+([A-Za-z]+)\.?\s+(\d{1,2})\s+(\d{4})/.exec(html);
  if (!m) throw new Error('NET page has no "Through Games <date>" stamp');
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) throw new Error(`NET page date has an unknown month: ${m[1]}`);
  return { iso: `${m[3]}-${String(month).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`, label: `Through Games ${m[1]}. ${m[2]} ${m[3]}` };
}

/** html: the rankings page. Returns { throughDate, asofLabel, rows, teamsExpected }. */
function parseNet(html) {
  const through = parseThrough(html);
  const table = /<table[^>]*>.*?<\/table>/s.exec(html);
  if (!table) throw new Error('NET page has no table');
  const head = [...table[0].matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((m) => text(m[1]));
  const want = ['Rank', 'School', 'Record', 'Conf', 'Road', 'Neutral', 'Home', 'Non-Div I', 'Prev', 'Quad 1', 'Quad 2', 'Quad 3', 'Quad 4'];
  if (want.some((w, i) => head[i] !== w)) throw new Error(`NET table columns changed: ${head.join(', ')}`);
  const rows = [...table[0].matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((m) => [...m[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => text(c[1]))).filter((c) => c.length === want.length);
  return {
    throughDate: through.iso, asofLabel: through.label, teamsExpected: rows.length,
    rows: rows.map((c) => ({
      name: c[1], conference: c[3], record: c[2],
      overall: { rank: int(c[0]), rating: null },
      metrics: { prev_rank: int(c[8]), road: c[4], neutral: c[5], home: c[6], non_div_i: c[7], quad1: c[9], quad2: c[10], quad3: c[11], quad4: c[12] },
    })),
    tableHtml: table[0],
  };
}

async function fetchLatest() {
  const res = await fetch(URL, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`NET page: HTTP ${res.status}`);
  const parsed = parseNet(await res.text());
  const { tableHtml, ...rest } = parsed;
  return { system: 'net', ...rest, raw: { url: URL, tableHtml } };
}

module.exports = { parseNet, fetchLatest };
