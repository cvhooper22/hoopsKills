-- Hosted headshots. One row per player; source_url is where the copy came from,
-- hosted_url is the stable S3/CloudFront copy the app should use.
CREATE TABLE player_images (
  player_id   TEXT PRIMARY KEY REFERENCES players (player_id),
  source      TEXT NOT NULL REFERENCES sources (source),
  source_url  TEXT NOT NULL,
  hosted_url  TEXT NOT NULL,
  s3_key      TEXT NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
