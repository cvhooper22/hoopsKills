// Parses StatBroadcast's "Split Box" view (two table.teambox tables, one per team) into player rows.
// The starters carry a "*" after the jersey number (<span class="gs">), which is the one thing the
// play-by-play never says and lineups need. Minutes and the stat line are kept so the derived lineups
// and the play-by-play totals can be cross-checked.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&(\w+);/g, (m, n) => ENT[n] ?? m);
const text = html => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const STAT_KEYS = ['pts', 'fg', 'fg3', 'ft', 'oreb', 'dreb', 'reb', 'ast', 'pf', 'tov', 'blk', 'stl', 'min', 'plusMinus'];

// "WRIGHT III,ROBERT" -> "wright iii, robert", the form the play-by-play text uses.
const pbpName = checkname => checkname.toLowerCase().replace(/,\s*/, ', ');

/** -> { home: Player[], away: Player[] } where Player = {jersey, starter, checkname, name, stats} (team row excluded). */
function parseBox(html) {
  const out = { home: [], away: [] };
  for (const m of html.matchAll(/<tr checkname="([^"]*)" team="([VH])"[^>]*>(.*?)<\/tr>/gs)) {
    const [, checkname, team, body] = m;
    if (checkname === 'TEAM') continue;
    const cells = [...body.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(c => c[1]);
    const stats = {};
    STAT_KEYS.forEach((k, i) => { const v = text(cells[i + 2] ?? ''); stats[k] = /^-?\d+$/.test(v) ? Number(v) : v || null; });
    (team === 'H' ? out.home : out.away).push({
      jersey: text(cells[0]).replace('*', '').trim(),
      starter: /class="gs"/.test(cells[0]),
      checkname: decode(checkname),
      name: pbpName(decode(checkname)),
      stats,
    });
  }
  return out;
}

module.exports = { parseBox, pbpName };
