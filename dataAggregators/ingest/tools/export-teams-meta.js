// Dumps the team lookup (name, abbreviation, short name, logo key) as one JSON object keyed by
// team id, for the stat_explorer to resolve opponent labels and logos. Shaped like the teams
// table it will become. Usage: node ingest/tools/export-teams-meta.js [out_path]
//   then: node ingest/tools/upload.js <out_path> meta/teams.json
// color is the opponent accent (ingest/lib/teamColor.js picks ESPN's primary or alternate, see tools/fetch-team-colors.js).
// logoKey is the team id when assets/logos/<team_id>.png exists (the app loads it from the
// data CloudFront's assets/logos/), otherwise null. Fill missing abbreviations by hand in
// config/team-labels.json ({ "<team_id>": { "abbrev": "...", "shortName": "..." } }).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { connect } = require('../../db/client');
const { teamLabel, loadLabels } = require('../lib/team-labels');

const LOGOS = path.join(__dirname, '../../assets/logos');

async function main() {
  const out = process.argv[2] || path.join(os.tmpdir(), 'meta', 'teams.json');
  const labels = loadLabels();
  const client = await connect();
  try {
    const { rows } = await client.query('SELECT team_id, name, abbrev FROM teams ORDER BY team_id');
    const teams = {};
    rows.forEach(t => { teams[t.team_id] = teamLabel(t, labels); });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(teams, null, 1));
    const noLogo = Object.keys(teams).filter(k => !teams[k].logoKey);
    console.log(`wrote ${rows.length} teams -> ${out}`);
    if (noLogo.length) console.log(`no logo file for: ${noLogo.join(', ')}`);
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
