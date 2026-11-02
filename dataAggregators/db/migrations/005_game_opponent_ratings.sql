-- Joins games to their teams' ratings. Rank is constant within a game, so this is a game-level fact; plays and
-- players inherit it by joining to the game. Three views:
--   team_ratings_std           every team rating row plus common-scale columns (percentile, points above the D-I average)
--   game_rating_snapshots      which snapshot each (game, system, basis) uses
--   game_opponent_ratings      BYU's opponent (and BYU itself) in each game, per system and basis
-- Bases:
--   at_game  the latest snapshot of the game's season whose through_date is BEFORE the game date. A snapshot's
--            through_date includes games played that day, so this is always the pre-game picture.
--   latest   the latest snapshot of the game's season (the final ratings for a finished season). It is deliberately
--            not "latest overall": for a 2025-26 game, next season's preseason ratings would mean nothing.
-- A missing snapshot gives no row (not a guess), so coverage is visible: only Torvik has 2025-26 history today.
-- A game's team joins to its rating team through rating_teams.team_id (ids are equal where the team exists in `teams`).
BEGIN;

CREATE OR REPLACE VIEW team_ratings_std AS
SELECT
  t.snapshot_id, s.system, s.season_year, s.through_date, t.rating_team_id,
  t.overall_rank, t.overall_rating, t.off_rank, t.off_rating, t.def_rank, t.def_rating, t.conference, t.record, t.metrics,
  count(*) OVER w AS n_teams,
  -- 1 = best team, 0 = worst, by rank within the snapshot
  1 - (t.overall_rank - 1)::real / NULLIF(count(t.overall_rank) OVER w - 1, 0) AS overall_pctile,
  1 - (t.off_rank - 1)::real / NULLIF(count(t.off_rank) OVER w - 1, 0) AS off_pctile,
  1 - (t.def_rank - 1)::real / NULLIF(count(t.def_rank) OVER w - 1, 0) AS def_pctile,
  -- points per 100 possessions above the average team in that snapshot, signed so that higher is always better
  m.margin - avg(m.margin) OVER w AS margin_vs_avg,
  (t.off_rating - avg(t.off_rating) OVER w) * CASE WHEN (sys.metric_meta->'off'->>'higher_is_better')::boolean THEN 1 ELSE -1 END AS off_vs_avg,
  (t.def_rating - avg(t.def_rating) OVER w) * CASE WHEN (sys.metric_meta->'def'->>'higher_is_better')::boolean THEN 1 ELSE -1 END AS def_vs_avg
FROM team_ratings t
JOIN rating_snapshots s USING (snapshot_id)
JOIN rating_systems sys ON sys.system = s.system
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN sys.metric_meta->'overall' ? 'margin_metric' THEN (t.metrics->>(sys.metric_meta->'overall'->>'margin_metric'))::real
    WHEN (sys.metric_meta->'overall'->>'margin_is_rating')::boolean THEN t.overall_rating
  END AS margin
) m
WINDOW w AS (PARTITION BY t.snapshot_id);

CREATE OR REPLACE VIEW game_rating_snapshots AS
SELECT g.game_id, sys.system, 'at_game'::text AS basis, pick.snapshot_id
FROM games g CROSS JOIN rating_systems sys
CROSS JOIN LATERAL (
  SELECT s.snapshot_id FROM rating_snapshots s
  WHERE s.system = sys.system AND s.season_year = g.season_year AND s.through_date < g.game_date
  ORDER BY s.through_date DESC LIMIT 1
) pick
UNION ALL
SELECT g.game_id, sys.system, 'latest'::text, pick.snapshot_id
FROM games g CROSS JOIN rating_systems sys
CROSS JOIN LATERAL (
  SELECT s.snapshot_id FROM rating_snapshots s
  WHERE s.system = sys.system AND s.season_year = g.season_year
  ORDER BY s.through_date DESC LIMIT 1
) pick;

CREATE OR REPLACE VIEW game_opponent_ratings AS
SELECT
  g.game_id, g.game_date, g.season_year,
  EXISTS (SELECT 1 FROM game_tags t WHERE t.game_id = g.game_id AND t.tag = 'exhibition') AS is_exhibition,
  opp.team_id AS opponent_team_id,
  gs.system, gs.basis, o.snapshot_id, o.through_date,
  (g.game_date - o.through_date) AS snapshot_age_days,
  o.n_teams,
  o.overall_rank AS opp_overall_rank, o.overall_rating AS opp_overall_rating, o.overall_pctile AS opp_overall_pctile, o.margin_vs_avg AS opp_margin_vs_avg,
  o.off_rank AS opp_off_rank, o.off_rating AS opp_off_rating, o.off_pctile AS opp_off_pctile, o.off_vs_avg AS opp_off_vs_avg,
  o.def_rank AS opp_def_rank, o.def_rating AS opp_def_rating, o.def_pctile AS opp_def_pctile, o.def_vs_avg AS opp_def_vs_avg,
  o.conference AS opp_conference, o.record AS opp_record, o.metrics AS opp_metrics,
  f.overall_rank AS byu_overall_rank, f.off_rank AS byu_off_rank, f.def_rank AS byu_def_rank, f.margin_vs_avg AS byu_margin_vs_avg
FROM games g
CROSS JOIN LATERAL (SELECT CASE WHEN g.home_team_id = 'byu' THEN g.away_team_id ELSE g.home_team_id END AS team_id) opp
JOIN game_rating_snapshots gs ON gs.game_id = g.game_id
JOIN team_ratings_std o ON o.snapshot_id = gs.snapshot_id AND o.rating_team_id = opp.team_id
LEFT JOIN team_ratings_std f ON f.snapshot_id = gs.snapshot_id AND f.rating_team_id = 'byu'
WHERE 'byu' IN (g.home_team_id, g.away_team_id);

COMMIT;
