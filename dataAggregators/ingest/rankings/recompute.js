// Re-derives stored snapshots from the raw data kept at collection time, after a collector's parsing has been fixed.
//   node ingest/rankings/recompute.js --system haslam [--dry-run]
// Only snapshots whose raw payload is still there can be re-derived (haslam keeps the XML from the fix on). Each one is
// re-parsed, rewritten in place and marked off_def_valid again; snapshots without raw data are reported and left as they
// are. Rewrites the front end's timeline file for the seasons it changed, like run.js.
const { spawnSync } = require('child_process');
const path = require('path');
const { connect } = require('../../db/client');
const { ensureSystems, writeSnapshot } = require('./lib/store');
const { syncCanonical } = require('./lib/canonical');

const PARSERS = {
  haslam: (raw, throughDate) => ({ system: 'haslam', ...require('./haslam').parseHaslam(raw.xml, throughDate) }),
};

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

async function main() {
  const system = opt('--system');
  if (!PARSERS[system]) throw new Error(`--system must be one of: ${Object.keys(PARSERS).join(', ')} (the ones that keep raw data)`);
  const dry = args.includes('--dry-run');
  const client = await connect();
  const seasons = new Set();
  try {
    await ensureSystems(client);
    await syncCanonical(client);
    const { rows } = await client.query(
      `SELECT s.snapshot_id, to_char(s.through_date, 'YYYY-MM-DD') AS through_date, s.season_year, s.off_def_valid, r.payload
       FROM rating_snapshots s LEFT JOIN raw_payloads r ON r.raw_id = s.raw_id WHERE s.system = $1 ORDER BY s.through_date`, [system]);
    for (const row of rows) {
      if (!row.payload || !row.payload.xml) { console.log(`${row.through_date}: no raw data kept${row.off_def_valid ? '' : ' (offense / defense stay hidden)'}`); continue; }
      const snap = PARSERS[system](row.payload, row.through_date);
      if (dry) { console.log(`${row.through_date}: would re-derive ${snap.rows.length} teams`); continue; }
      const res = await writeSnapshot(client, snap);   // no raw on purpose: the stored payload stays
      console.log(`${row.through_date}: ${res.status}${res.covered ? `, ${res.covered} teams` : ''}`);
      if (res.status !== 'unchanged') seasons.add(row.season_year);
    }
  } finally {
    await client.end();
  }
  for (const season of [...seasons].sort()) {
    const r = spawnSync(process.execPath, [path.join(__dirname, '../tools/export-rankings-timeline.js'), '--season', String(season)], { encoding: 'utf8' });
    console.log(r.status === 0 ? r.stdout.trim() : `timeline export for ${season} failed: ${(r.stderr || r.stdout).trim()}`);
  }
}
main().catch((err) => { console.error(err.message); process.exit(1); });
