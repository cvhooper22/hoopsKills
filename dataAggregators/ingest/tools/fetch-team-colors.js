// Writes config/team-colors.json ({ "<team_id>": { color, altColor } }) from ESPN's team endpoint, using the ESPN ids in
// config/team-logos.json and config/teams.json. Existing entries are kept (hand edits win) unless --refresh.
//   node ingest/tools/fetch-team-colors.js [--refresh]
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const logos = require('../../config/team-logos.json');

const OUT = path.join(__dirname, '../../config/team-colors.json');
const hex = (h) => (h && /^[0-9a-f]{6}$/i.test(h) ? `#${h.toLowerCase()}` : null);

async function main() {
  const existing = fs.existsSync(OUT) && !process.argv.includes('--refresh') ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const out = { ...existing };
  for (const [id, t] of Object.entries(logos)) {
    if (out[id]) continue;
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${t.espnId}`);
    if (!res.ok) { console.log(`${id}: HTTP ${res.status}`); continue; }
    const team = (await res.json()).team;
    out[id] = { color: hex(team.color), altColor: hex(team.alternateColor) };
  }
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(OUT, `{\n${Object.entries(sorted).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n}\n`);
  console.log(`wrote ${Object.keys(sorted).length} teams -> ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
