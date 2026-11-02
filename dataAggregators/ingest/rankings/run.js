// Collects ratings snapshots into Postgres. Safe to run as often as you like: a snapshot already stored with the
// same content is skipped. This is also what the admin page's "run" button executes.
//
//   node ingest/rankings/run.js                              latest snapshot of every system (KenPom opens a browser window briefly)
//   node ingest/rankings/run.js --systems torvik,net         just these
//   node ingest/rankings/run.js --backfill torvik --from 2025-10-27 --to 2026-04-14     one Torvik snapshot per day
//   add --trigger admin to label the run in rating_runs; --json prints the run result as one JSON line (for the admin page)
//
// Every system's team names are matched to the app's canonical list (config/rating-teams.json); unmatched ones are reported.
const { connect } = require('../../db/client');
const { ensureSystems, writeSnapshot } = require('./lib/store');
const { syncCanonical } = require('./lib/canonical');
const torvik = require('./torvik');

const COLLECTORS = {
  torvik: { latest: () => torvik.fetchLatest().then((g) => g.snap) },
};
// Registered as they are built (net, haslam, kenpom, evanmiya).
try { Object.assign(COLLECTORS, { net: { latest: () => require('./net').fetchLatest() } }); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
try { Object.assign(COLLECTORS, { haslam: { latest: () => require('./haslam').fetchLatest() } }); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
// the two browser-driven systems (Playwright); KenPom opens a visible window for a few seconds
try { Object.assign(COLLECTORS, { kenpom: { browser: true, latest: () => require('./kenpom').fetchLatest() }, evanmiya: { browser: true, latest: () => require('./evanmiya').fetchLatest() } }); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
const ORDER = ['torvik', 'net', 'haslam', 'kenpom', 'evanmiya'];

const args = process.argv.slice(2);
const opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const log = (...a) => { if (!flag('--json')) console.log(...a); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// BYU's record is in every snapshot, so it doubles as a check that the snapshot's through-date is what we think:
// compare it with the games table (skipped when the database has no games for that season).
async function focusRecordNote(client, snap, throughDate, season) {
  const row = snap.rows.find((r) => r.name === 'BYU');
  if (!row || !row.record) return null;
  // Exhibitions are not in any system's record: leave out games tagged 'exhibition' and anything before Nov 1 of the season.
  const { rows: [g] } = await client.query(
    `SELECT count(*) FILTER (WHERE winner_team_id = 'byu')::int w, count(*) FILTER (WHERE winner_team_id <> 'byu')::int l
     FROM games g WHERE (home_team_id = 'byu' OR away_team_id = 'byu') AND season_year = $1 AND game_date <= $2 AND game_date >= make_date($1, 11, 1) AND status = 'final'
       AND NOT EXISTS (SELECT 1 FROM game_tags t WHERE t.game_id = g.game_id AND t.tag = 'exhibition')`, [season, throughDate]);
  if (!g || g.w + g.l === 0) return null;   // no games stored for that stretch (earlier seasons): nothing to compare with
  const ours = `${g.w}-${g.l}`;
  return ours === row.record ? null : { focusRecordMismatch: { snapshot: row.record, games: ours } };
}

async function storeOne(client, system, snap) {
  const season = require('./lib/store').seasonOf(snap.throughDate);
  const note = await focusRecordNote(client, snap, snap.throughDate, season);
  if (note) snap.notes = { ...(snap.notes || {}), ...note };
  return writeSnapshot(client, snap);
}

async function main() {
  const client = await connect();
  await ensureSystems(client);
  await syncCanonical(client);   // config/rating-teams.json -> rating_teams
  const { rows: [{ run_id }] } = await client.query('INSERT INTO rating_runs (trigger) VALUES ($1) RETURNING run_id', [opt('--trigger', 'cli')]);
  const results = {};
  try {
    if (opt('--backfill')) {
      const system = opt('--backfill');
      if (system !== 'torvik') throw new Error('only torvik can be backfilled (it publishes dated history)');
      const from = opt('--from'), to = opt('--to', torvik.iso(new Date()));
      if (!from) throw new Error('--backfill needs --from YYYY-MM-DD');
      const tally = { inserted: 0, replaced: 0, unchanged: 0, missing: 0, mismatches: [], unresolved: new Set() };
      for (let d = from; d <= to; d = torvik.addDays(d, 1)) {
        const got = await torvik.fetchDate(d);
        if (!got) { tally.missing++; log(`${d}: no file`); continue; }
        const r = await storeOne(client, 'torvik', got.snap);
        tally[r.status]++;
        (r.unresolved || []).forEach((n) => tally.unresolved.add(n));
        const note = got.snap.notes && got.snap.notes.focusRecordMismatch;
        if (note) tally.mismatches.push(`${d}: snapshot ${note.snapshot} vs games ${note.games}`);
        log(`${d}: ${r.status}${r.covered ? ` (${r.covered} teams)` : ''}${note ? `  RECORD MISMATCH ${note.snapshot} vs ${note.games}` : ''}`);
        await sleep(250); // one small file per day; no need to hurry a free site
      }
      results.torvik = { status: 'ok', ...tally, unresolved: [...tally.unresolved] };
    } else {
      const wanted = (opt('--systems') ? opt('--systems').split(',') : ORDER).filter((s) => COLLECTORS[s] || opt('--systems'));
      for (const system of ORDER.filter((s) => wanted.includes(s))) {
        const c = COLLECTORS[system];
        if (!c) { results[system] = { status: 'not built yet' }; continue; }
        try {
          const snap = await c.latest();
          const r = await storeOne(client, system, snap);
          results[system] = { status: r.status, throughDate: snap.throughDate, teams: r.covered ?? null, unresolved: r.unresolved || [] };
          log(`${system}: ${r.status}, through ${snap.throughDate}${r.covered ? `, ${r.covered}/${snap.rows.length} teams` : ''}${r.unresolved && r.unresolved.length ? `, UNRESOLVED: ${r.unresolved.join('; ')}` : ''}`);
        } catch (err) {
          results[system] = { status: 'error', error: err.message };
          console.error(`${system}: ${err.message}`);
        }
      }
    }
  } finally {
    await client.query('UPDATE rating_runs SET finished_at = now(), results = $2 WHERE run_id = $1', [run_id, JSON.stringify(results)]);
    await client.end();
  }
  if (flag('--json')) console.log(JSON.stringify({ runId: run_id, results }));
  if (opt('--backfill')) { const t = results.torvik; log(`\ndone: ${t.inserted} inserted, ${t.replaced} replaced, ${t.unchanged} unchanged, ${t.missing} missing${t.mismatches.length ? `, ${t.mismatches.length} record mismatches` : ''}${t.unresolved.length ? `, unresolved: ${t.unresolved.join('; ')}` : ''}`); }
}

main().catch((err) => { console.error(err); process.exit(1); });
