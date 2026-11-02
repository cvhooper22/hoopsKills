// BYU's ratings over a season, plus its games, as one JSON file for the rankings timeline page (stat_explorer /rankings).
//   node ingest/tools/export-rankings-timeline.js [--season 2025] [out_path]
// Default out: stat_explorer/public/data/rankings/timeline-<season>.json (the page reads it locally for now).
// Systems without snapshots for the season are left out; the page adds the hand-tracked 2025-26 KenPom / EvanMiya /
// Haslametrics values from its own constants. Each point is as of its `date` (games through that day, inclusive).
const fs = require('fs');
const path = require('path');
const { connect } = require('../../db/client');

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const season = Number(opt('--season') || 2025);
const outArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--season');
const out = outArg || path.join(__dirname, '../../../stat_explorer/public/data/rankings', `timeline-${season}.json`);

const num = (v) => (v === null || v === undefined ? null : Number(v));
const day = (d) => (d.toISOString ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

async function main() {
  const client = await connect();
  try {
    const { rows: sys } = await client.query('SELECT system, name, kind, metric_meta FROM rating_systems WHERE active ORDER BY system');
    const { rows: pts } = await client.query(
      `SELECT s.system, s.through_date, t.record, t.overall_rank, t.overall_rating, t.off_rank, t.off_rating, t.def_rank, t.def_rating, t.metrics,
              std.margin_vs_avg, std.n_teams
       FROM team_ratings t JOIN rating_snapshots s USING (snapshot_id) JOIN team_ratings_std std ON std.snapshot_id = t.snapshot_id AND std.rating_team_id = t.rating_team_id
       WHERE t.rating_team_id = 'byu' AND s.season_year = $1 ORDER BY s.system, s.through_date`, [season]);
    const systems = {};
    for (const s of sys) {
      const mine = pts.filter((p) => p.system === s.system);
      if (!mine.length) continue;
      systems[s.system] = {
        name: s.name, kind: s.kind,
        parts: Object.fromEntries(Object.entries(s.metric_meta).map(([part, m]) => [part, { label: m.label, unit: m.unit, higherIsBetter: m.higher_is_better }])),
        points: mine.map((p) => ({
          date: day(p.through_date), record: p.record, teams: num(p.n_teams),
          overallRank: p.overall_rank, overallRating: num(p.overall_rating), marginVsAvg: num(p.margin_vs_avg),
          offRank: p.off_rank, offRating: num(p.off_rating), defRank: p.def_rank, defRating: num(p.def_rating),
          metrics: p.metrics,
        })),
      };
    }

    const { rows: games } = await client.query(
      `SELECT g.game_id, to_char(g.game_date, 'YYYY-MM-DD') AS date, g.season_type, g.home_team_id, g.away_team_id, g.final_score_home, g.final_score_away,
              g.is_neutral_site, g.is_conference_game, g.status,
              EXISTS (SELECT 1 FROM game_tags t WHERE t.game_id = g.game_id AND t.tag = 'exhibition') AS is_exhibition
       FROM games g WHERE 'byu' IN (g.home_team_id, g.away_team_id) AND g.season_year = $1 ORDER BY g.game_date`, [season]);
    const { rows: teams } = await client.query('SELECT team_id, name FROM teams');
    const names = Object.fromEntries(teams.map((t) => [t.team_id, t.name]));
    const { rows: opp } = await client.query(
      `SELECT game_id, system, basis, opp_overall_rank, opp_off_rank, opp_def_rank, opp_overall_rating, opp_def_rating, opp_off_rating, through_date
       FROM game_opponent_ratings WHERE season_year = $1`, [season]);
    const oppByGame = {};
    for (const r of opp) {
      ((oppByGame[r.game_id] ||= {})[r.system] ||= {})[r.basis === 'at_game' ? 'atGame' : 'latest'] = {
        throughDate: day(r.through_date), overallRank: r.opp_overall_rank, offRank: r.opp_off_rank, defRank: r.opp_def_rank,
        overallRating: num(r.opp_overall_rating), offRating: num(r.opp_off_rating), defRating: num(r.opp_def_rating),
      };
    }
    const gameRows = games.map((g) => {
      const home = g.home_team_id === 'byu';
      const scoreFor = home ? g.final_score_home : g.final_score_away, scoreAgainst = home ? g.final_score_away : g.final_score_home;
      const opponentId = home ? g.away_team_id : g.home_team_id;
      return {
        gameId: g.game_id, date: g.date, opponentId, opponentName: names[opponentId] || opponentId,
        location: g.is_neutral_site ? 'neutral' : home ? 'home' : 'away', isConferenceGame: !!g.is_conference_game, seasonType: g.season_type || 'regular',
        isExhibition: g.is_exhibition, result: g.status === 'final' ? (scoreFor > scoreAgainst ? 'W' : 'L') : null,
        scoreFor: g.status === 'final' ? scoreFor : null, scoreAgainst: g.status === 'final' ? scoreAgainst : null,
        opponentRatings: oppByGame[g.game_id] || {},
      };
    });

    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ season, team: 'byu', generatedAt: new Date().toISOString(), systems, games: gameRows }));
    console.log(`wrote ${Object.entries(systems).map(([k, v]) => `${k} ${v.points.length}`).join(', ')}; ${gameRows.length} games -> ${out}`);
  } finally {
    await client.end();
  }
}
main().catch((err) => { console.error(err.message); process.exit(1); });
