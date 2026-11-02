// Prints, as one JSON object, what the ratings tables hold: the latest snapshot per system (with BYU's row for a quick
// look), snapshot counts, and the last few collection runs. Read-only; the admin page calls this.
//   node ingest/rankings/status.js
const { connect } = require('../../db/client');

async function main() {
  const client = await connect();
  try {
    const { rows: systems } = await client.query(`
      SELECT sys.system, sys.name, sys.kind, sys.access,
             (SELECT count(*)::int FROM rating_snapshots s WHERE s.system = sys.system) AS snapshots,
             l.snapshot_id, l.season_year, l.through_date::text AS through_date, l.captured_at, l.teams_covered, l.teams_expected, l.asof_label, l.notes,
             b.overall_rank, b.off_rank, b.def_rank, b.overall_rating, b.off_rating, b.def_rating, b.metrics AS byu_metrics
      FROM rating_systems sys
      LEFT JOIN LATERAL (SELECT * FROM rating_snapshots s WHERE s.system = sys.system ORDER BY s.through_date DESC, s.snapshot_id DESC LIMIT 1) l ON true
      LEFT JOIN team_ratings b ON b.snapshot_id = l.snapshot_id AND b.rating_team_id = 'byu'
      WHERE sys.active ORDER BY sys.system`);
    const { rows: runs } = await client.query('SELECT run_id, started_at, finished_at, trigger, results FROM rating_runs ORDER BY run_id DESC LIMIT 8');
    console.log(JSON.stringify({ now: new Date().toISOString(), systems, runs }));
  } finally {
    await client.end();
  }
}
main().catch((err) => { console.error(err.message); process.exit(1); });
