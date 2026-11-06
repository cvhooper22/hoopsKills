// Haslametrics. The ratings page is built in the browser from one plain XML file (ratings.xml, all D-I teams), so no
// browser is needed: GET the XML. <dt md="..."> says which games are in it; the date 10/31/1974 means "no games yet"
// (preseason), in which case the snapshot is stamped with the collection date, since nothing could have changed.
// Each <mr> is a team. id is the team's ESPN id (a precise key we keep in metrics for later crosswalking).
// Off/def rank are computed here: the site derives them from sorting oe and de in the page.
const fetch = require('node-fetch');

const URL = 'https://haslametrics.com/ratings.xml';
const UA = 'Mozilla/5.0 (hoopsKills personal stats project)';
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&(\w+);/g, (m, n) => ENT[n] ?? m);
const num = (v) => { const n = Number(v); return v === undefined || v === '' || Number.isNaN(n) || n === -999 || n === 999 ? null : n; };

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w]+)="([^"]*)"/g)) out[m[1]] = decode(m[2]);
  return out;
}

// The team pages do not show the XML's oe / de: haslam.js recomputes both from the component fields (its own `OE=` / `DE=`
// lines, with the oe / de attributes commented out) and ranks every team on those, so the site's offense and defense
// ranks follow these numbers. (BYU, Nov 2026: oe 126.45 is 10th, the page's 126.75 is 5th.) Falls back to the XML's own
// value when a component is missing.
const has = (...v) => v.every((x) => x !== null);
function offense(t) {
  const [ft, tar, fgmr, tpmr] = [num(t.ftpct), num(t.oftar), num(t.ofgmr), num(t.otpmr)];
  return has(ft, tar, fgmr, tpmr) ? (ft * tar) / 100 + 2 * (fgmr - tpmr) + 3 * tpmr : num(t.oe);
}
function defense(t) {
  const [ft, tar, fgmr, tpmr] = [num(t.dftpct), num(t.dftar), num(t.dfgmr), num(t.dtpmr)];
  return has(ft, tar, fgmr, tpmr) ? (ft * tar) / 100 + 2 * (fgmr - tpmr) + 3 * tpmr : num(t.de);
}

const rankBy = (rows, get, descending) => {
  const sorted = rows.filter((r) => get(r) !== null).sort((a, b) => (descending ? get(b) - get(a) : get(a) - get(b)));
  sorted.forEach((r, i) => { r.__rank = (r.__rank || {}); });
  const out = new Map(); sorted.forEach((r, i) => out.set(r, i + 1));
  return out;
};

// the site has written md as "10/31/1974" and as "November 1, 2026"
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function parseMd(md) {
  const text = /^\s*([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})\s*$/.exec(md || '');
  if (text) return [MONTHS.findIndex((n) => n.startsWith(text[1].toLowerCase().slice(0, 3))) + 1, Number(text[2]), Number(text[3])];
  return (md || '').split('/').map(Number);
}

/** xml: the text of ratings.xml; collectedOn: 'YYYY-MM-DD' used for the preseason stamp. */
function parseHaslam(xml, collectedOn) {
  const dt = /<dt\s+([^>]*?)\/?>/.exec(xml);
  if (!dt) throw new Error('haslam: no <dt> element');
  const md = attrs(dt[1]).md;
  const [m, d, y] = parseMd(md);
  if (!y) throw new Error(`haslam: unreadable date ${md}`);
  const preseason = y < 2000;
  const throughDate = preseason ? collectedOn : `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const teams = [...xml.matchAll(/<mr\s+([^>]*?)\/>/g)].map((x) => attrs(x[1]));
  if (teams.length < 300) throw new Error(`haslam: only ${teams.length} teams in ratings.xml`);
  teams.forEach((t) => { t.__oe = offense(t); t.__de = defense(t); });
  const rows = teams.map((t) => ({
    name: t.t, conference: t.c, record: `${t.w}-${t.l}`,
    overall: { rank: num(t.rk), rating: t.__oe !== null && t.__de !== null ? +(t.__oe - t.__de).toFixed(3) : null },
    off: { rank: null, rating: t.__oe },
    def: { rank: null, rating: t.__de },
    metrics: {
      espn_id: t.id, xml_oe: num(t.oe), xml_de: num(t.de), tempo: num(t.ou) !== null && num(t.du) !== null ? +((num(t.ou) + num(t.du)) / 2).toFixed(3) : null,
      sos: num(t.sos), momentum: num(t.mom), ap_score: num(t.ap), win_rating: num(t.wr), rpi: num(t.rpi),
      quad1: t.r_q1, quad2: t.r_q2, quad3: t.r_q3, quad4: t.r_q4,
      vs_1_50: t.r_1_50, vs_51_100: t.r_51_100, vs_101_150: t.r_101_150, vs_151_200: t.r_151_200, vs_201_250: t.r_201_250, vs_251_300: t.r_251_300, vs_301_up: t.r_301_up,
    },
  }));
  const offRank = rankBy(rows, (r) => r.off.rating, true), defRank = rankBy(rows, (r) => r.def.rating, false);
  rows.forEach((r) => { r.off.rank = offRank.get(r) ?? null; r.def.rank = defRank.get(r) ?? null; });
  return { throughDate, asofLabel: preseason ? 'Haslametrics preseason (no games yet)' : `Includes games through ${md}`, teamsExpected: rows.length, rows };
}

async function fetchLatest(collectedOn = new Date().toISOString().slice(0, 10)) {
  const res = await fetch(URL, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`haslam ratings.xml: HTTP ${res.status}`);
  const xml = await res.text();
  const parsed = parseHaslam(xml, collectedOn);
  // the whole XML is kept: the site only serves today's file, and off / def are derived from its component fields,
  // so a later fix to the derivation can be re-run on it (ingest/rankings/recompute.js)
  return { system: 'haslam', ...parsed, raw: { url: URL, xml } };
}

module.exports = { parseHaslam, fetchLatest, parseMd };
