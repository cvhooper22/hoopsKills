-- Team rankings / ratings from several systems (Torvik, NET, Haslametrics, KenPom, EvanMiya, ...), snapshotted
-- over time so a game can be joined to its opponent's rank either as of tip-off or as of the latest snapshot.
-- All D-I teams are stored, but in their own table: `teams` is the games universe (it feeds meta/teams.json),
-- and ~365 teams from a ratings table should not land there. A rating team links to `teams` when it plays BYU.
BEGIN;

INSERT INTO sources (source) VALUES ('torvik'), ('net'), ('haslam'), ('kenpom'), ('evanmiya') ON CONFLICT DO NOTHING;

CREATE TABLE rating_systems (
  system       TEXT PRIMARY KEY REFERENCES sources (source),
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('efficiency', 'resume', 'poll')),
  source_url   TEXT,
  access       TEXT,                                -- how it is collected: http | browser | extension | manual
  active       BOOLEAN NOT NULL DEFAULT true,
  -- Per part (overall / off / def): label, unit, higher_is_better. Rating scales differ (EvanMiya is points above
  -- average, KenPom/Torvik defense is points allowed per 100), so a filter on a native value needs the direction.
  metric_meta  JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE rating_teams (
  rating_team_id  TEXT PRIMARY KEY,                 -- slug of the canonical name
  name            TEXT NOT NULL,
  team_id         TEXT REFERENCES teams (team_id)   -- set for teams that appear in the games table
);

-- One row per (system, spelling) -> canonical team. Each site spells teams its own way.
CREATE TABLE rating_team_aliases (
  system          TEXT NOT NULL REFERENCES rating_systems (system),
  alias           TEXT NOT NULL,                    -- the name as the site prints it
  rating_team_id  TEXT NOT NULL REFERENCES rating_teams (rating_team_id),
  PRIMARY KEY (system, alias)
);

CREATE TABLE rating_snapshots (
  snapshot_id     BIGSERIAL PRIMARY KEY,
  system          TEXT NOT NULL REFERENCES rating_systems (system),
  season_year     INTEGER NOT NULL,                 -- year the season started
  -- Games through this date (inclusive) are in the ratings. This is the source's own statement, never the
  -- collection date: a snapshot pulled after tip-off already contains that game. A game on date G is
  -- "as of tip-off" against the latest snapshot with through_date < G.
  through_date    DATE NOT NULL,
  asof_label      TEXT,                             -- the source's wording ("Through Games Apr. 06 2026")
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  teams_covered   INTEGER NOT NULL,
  teams_expected  INTEGER,                          -- rows the source claimed / D-I size, to spot partial pulls
  content_hash    TEXT,
  raw_id          BIGINT REFERENCES raw_payloads (raw_id),
  notes           JSONB NOT NULL DEFAULT '{}',      -- validation results, unresolved names, ...
  UNIQUE (system, season_year, through_date)
);
CREATE INDEX rating_snapshots_lookup ON rating_snapshots (system, through_date);

CREATE TABLE team_ratings (
  snapshot_id     BIGINT NOT NULL REFERENCES rating_snapshots (snapshot_id) ON DELETE CASCADE,
  rating_team_id  TEXT NOT NULL REFERENCES rating_teams (rating_team_id),
  conference      TEXT,
  record          TEXT,
  overall_rank    INTEGER,
  overall_rating  REAL,
  off_rank        INTEGER,
  off_rating      REAL,
  def_rank        INTEGER,
  def_rating      REAL,
  metrics         JSONB NOT NULL DEFAULT '{}',      -- everything else the system offers: wab, wab_rank, barthag, sos, tempo, quad records, ...
  PRIMARY KEY (snapshot_id, rating_team_id)
);
CREATE INDEX team_ratings_team ON team_ratings (rating_team_id);

-- A log of collection runs, so the admin page can show what the last "run all" did.
CREATE TABLE rating_runs (
  run_id       BIGSERIAL PRIMARY KEY,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  trigger      TEXT NOT NULL DEFAULT 'cli',         -- cli | admin
  results      JSONB NOT NULL DEFAULT '{}'          -- per system: {status, snapshots, rows, error}
);

COMMIT;
