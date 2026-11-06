// Haslametrics' team pages chart each team's offense / defense / overall rank by day. That history is in ratings.xml itself:
// <trd data="11/1,,,,,,,11/8,..."> labels the days (one entry per day, only every seventh is printed) and every team has
// <otr t=".." data="19,19,5"> (offense), <dtr> (defense) and <tr> (all-play, the overall) with one rank per day, computed
// by the site with its own offense / defense formula. An entry labelled D is the ratings published on D, which include
// games through D-1 (checked: the latest entry equals the current snapshot, stamped through the day before its label).
//
//   node ingest/rankings/haslam-history.js              show which stored snapshots the history covers
//   node ingest/rankings/haslam-history.js --repair     fix stored snapshots flagged off_def_valid = false that the history covers
//
// A repaired snapshot gets the site's own off / def ranks for every team, its off / def ratings are cleared (the stored
// ones came from the xml's oe / de, not the site's numbers, and the history carries ranks only), and it is marked valid
// again with notes.offDefFrom = 'site history'. Snapshots from before the history starts cannot be repaired.
const fetch = require('node-fetch');
const { spawnSync } = require('child_process');
const path = require('path');
const { connect } = require('../../db/client');
const { makeResolver, seasonOf } = require('./lib/store');
const { parseMd } = require('./haslam');
const { syncCanonical } = require('./lib/canonical');

const URL = 'https://haslametrics.com/ratings.xml';
const UA = 'Mozilla/5.0 (hoopsKills personal stats project)';
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (isoDate, n) => { const d = new Date(isoDate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** xml -> { firstDay: 'YYYY-MM-DD' of the first entry, throughDates: [...], off: Map(name -> ranks), def, overall } */
function parseHistory(xml) {
  const labels = /<trd\s+data="([^"]*)"/.exec(xml);
  if (!labels) throw new Error('haslam history: no <trd> element');
  const first = /^(\d{1,2})\/(\d{1,2})$/.exec(labels[1].split(',')[0].trim());
  if (!first) throw new Error(`haslam history: unreadable first label "${labels[1].split(',')[0]}"`);
  // the label has no year: the season is the one the xml's own date (<dt>, or today when it says preseason) falls in
  const [dm, dd, dy] = parseMd((/<dt\s+[^>]*md="([^"]*)"/.exec(xml) || [])[1]);
  const season = seasonOf(dy > 2000 ? `${dy}-${String(dm).padStart(2, '0')}-${String(dd).padStart(2, '0')}` : iso(new Date()));
  const m = Number(first[1]);
  const firstLabel = `${m >= 8 ? season : season + 1}-${String(m).padStart(2, '0')}-${String(first[2]).padStart(2, '0')}`;
  const series = (tag) => new Map([...xml.matchAll(new RegExp(`<${tag}\\s+t="([^"]*)"\\s+data="([^"]*)"`, 'g'))].map((x) => [decode(x[1]), x[2].split(',').map((v) => (v === '' ? null : Number(v)))]));
  const off = series('otr'), def = series('dtr'), overall = series('tr');
  if (!off.size || !def.size) throw new Error('haslam history: no <otr> / <dtr> rows');
  const days = Math.max(...[...off.values()].map((a) => a.length));
  return { throughDates: Array.from({ length: days }, (_, i) => addDays(firstLabel, i - 1)), off, def, overall };
}

async function main() {
  const repair = process.argv.includes('--repair');
  const xml = await (await fetch(URL, { headers: { 'user-agent': UA } })).text();
  const h = parseHistory(xml);
  console.log(`history covers games through ${h.throughDates[0]} .. ${h.throughDates[h.throughDates.length - 1]} (${h.off.size} teams)`);
  const client = await connect();
  const seasons = new Set();
  try {
    await syncCanonical(client);
    const resolver = await makeResolver(client, 'haslam');
    const { rows: snaps } = await client.query(
      `SELECT snapshot_id, to_char(through_date, 'YYYY-MM-DD') AS d, season_year, off_def_valid FROM rating_snapshots WHERE system = 'haslam' ORDER BY through_date`);
    for (const s of snaps) {
      const i = h.throughDates.indexOf(s.d);
      const state = s.off_def_valid ? 'ok' : 'off/def hidden';
      if (i < 0) { console.log(`${s.d}: ${state}; not in the site's history`); continue; }
      if (s.off_def_valid || !repair) { console.log(`${s.d}: ${state}; the history has it (entry ${i + 1})`); continue; }
      await client.query('BEGIN');
      try {
        let n = 0;
        for (const [name, offRanks] of h.off) {
          const id = await resolver.resolve(name);
          const defRank = (h.def.get(name) || [])[i];
          if (!id || offRanks[i] == null || defRank == null) continue;
          const r = await client.query(
            'UPDATE team_ratings SET off_rank = $3, def_rank = $4, off_rating = NULL, def_rating = NULL WHERE snapshot_id = $1 AND rating_team_id = $2', [s.snapshot_id, id, offRanks[i], defRank]);
          n += r.rowCount;
        }
        await client.query(
          `UPDATE rating_snapshots SET off_def_valid = true, notes = notes || '{"offDefFrom":"site history"}'::jsonb WHERE snapshot_id = $1`, [s.snapshot_id]);
        await client.query('COMMIT');
        console.log(`${s.d}: repaired ${n} teams from history entry ${i + 1}`);
        seasons.add(s.season_year);
      } catch (err) { await client.query('ROLLBACK'); throw err; }
    }
  } finally {
    await client.end();
  }
  for (const season of [...seasons]) {
    const r = spawnSync(process.execPath, [path.join(__dirname, '../tools/export-rankings-timeline.js'), '--season', String(season)], { encoding: 'utf8' });
    console.log(r.status === 0 ? r.stdout.trim() : `timeline export for ${season} failed: ${(r.stderr || r.stdout).trim()}`);
  }
}

module.exports = { parseHistory };
if (require.main === module) main().catch((err) => { console.error(err.message); process.exit(1); });
