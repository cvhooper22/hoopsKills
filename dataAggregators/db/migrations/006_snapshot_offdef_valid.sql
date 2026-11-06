-- A snapshot's offense / defense numbers can be known to be wrong while its overall rank is fine (Haslametrics snapshots
-- collected before the collector used the site's own offense and defense formula). `off_def_valid` says whether the
-- offense and defense columns of a snapshot can be trusted. The ratings views hide them (NULL) when it is false, so
-- nothing downstream (the opponent joins, the timeline export, the app) needs to know. Collectors can set it with
-- `offDefValid: false` on a snapshot, and recompute.js sets it back to true after re-deriving a snapshot from its raw data.
BEGIN;

ALTER TABLE rating_snapshots ADD COLUMN off_def_valid BOOLEAN NOT NULL DEFAULT true;

-- Haslametrics snapshots written before the fix carry no `xml_oe` in their metrics (the fixed collector stores it);
-- their raw data was not kept, so they cannot be re-derived.
UPDATE rating_snapshots s SET off_def_valid = false
WHERE s.system = 'haslam'
  AND NOT EXISTS (SELECT 1 FROM team_ratings t WHERE t.snapshot_id = s.snapshot_id AND t.metrics ? 'xml_oe');

-- Same columns as before, in the same order; offense and defense are masked in invalid snapshots, before the
-- percentile and average columns are computed from them.
CREATE OR REPLACE VIEW team_ratings_std AS
SELECT
  t.snapshot_id, s.system, s.season_year, s.through_date, t.rating_team_id,
  t.overall_rank, t.overall_rating, t.off_rank, t.off_rating, t.def_rank, t.def_rating, t.conference, t.record, t.metrics,
  count(*) OVER w AS n_teams,
  1 - (t.overall_rank - 1)::real / NULLIF(count(t.overall_rank) OVER w - 1, 0) AS overall_pctile,
  1 - (t.off_rank - 1)::real / NULLIF(count(t.off_rank) OVER w - 1, 0) AS off_pctile,
  1 - (t.def_rank - 1)::real / NULLIF(count(t.def_rank) OVER w - 1, 0) AS def_pctile,
  m.margin - avg(m.margin) OVER w AS margin_vs_avg,
  (t.off_rating - avg(t.off_rating) OVER w) * CASE WHEN (sys.metric_meta->'off'->>'higher_is_better')::boolean THEN 1 ELSE -1 END AS off_vs_avg,
  (t.def_rating - avg(t.def_rating) OVER w) * CASE WHEN (sys.metric_meta->'def'->>'higher_is_better')::boolean THEN 1 ELSE -1 END AS def_vs_avg
FROM (
  SELECT r.snapshot_id, r.rating_team_id, r.conference, r.record, r.overall_rank, r.overall_rating, r.metrics,
    CASE WHEN sn.off_def_valid THEN r.off_rank END AS off_rank, CASE WHEN sn.off_def_valid THEN r.off_rating END AS off_rating,
    CASE WHEN sn.off_def_valid THEN r.def_rank END AS def_rank, CASE WHEN sn.off_def_valid THEN r.def_rating END AS def_rating
  FROM team_ratings r JOIN rating_snapshots sn USING (snapshot_id)
) t
JOIN rating_snapshots s USING (snapshot_id)
JOIN rating_systems sys ON sys.system = s.system
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN sys.metric_meta->'overall' ? 'margin_metric' THEN (t.metrics->>(sys.metric_meta->'overall'->>'margin_metric'))::real
    WHEN (sys.metric_meta->'overall'->>'margin_is_rating')::boolean THEN t.overall_rating
  END AS margin
) m
WINDOW w AS (PARTITION BY t.snapshot_id);

COMMIT;
