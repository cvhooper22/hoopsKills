// Turns a school athletics-site box score link into the WMT game id the API wants.
//   node ingest/wmt/resolve-id.js https://byucougars.com/boxscore/25257    -> 6630265
// The number in the athletics-site URL is the site's own id; the page embeds the real WMT stats
// game as wmt.games/<school>/stats/match/[full/]<wmtGameId> (also exposed as wmt_stats2_game_id).
const fetch = require('node-fetch');

async function resolveWmtId(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  // The embed URL appears plain in the markup and JSON-escaped (/) in the page's data blob.
  const html = (await res.text()).replace(/\\u002F/gi, '/');
  const ids = [...new Set([...html.matchAll(/wmt\.games\/[\w-]+\/stats\/match\/(?:full\/)?(\d+)/g)].map(m => m[1]))];
  if (!ids.length) throw new Error(`${url}: no wmt.games stats link found (game may not have a WMT box yet)`);
  if (ids.length > 1) throw new Error(`${url}: several WMT ids found (${ids.join(', ')})`);
  return ids[0];
}

module.exports = { resolveWmtId };

if (require.main === module) {
  const url = process.argv[2];
  if (!url) { console.error('usage: resolve-id.js <athletics box score url>'); process.exit(1); }
  resolveWmtId(url).then(id => console.log(id), err => { console.error(err.message); process.exit(1); });
}
