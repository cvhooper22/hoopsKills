-- Play-by-play database, first pass. Postgres.
-- Layers: raw (immutable) -> normalized (games, plays, participants) -> views.
-- Derived tables (possessions, lineup_stints, substitution_events) come later.

BEGIN;

-- Known external data sources. Adding a source is an INSERT here, not a schema change.
CREATE TABLE sources (
  source  TEXT PRIMARY KEY
);
INSERT INTO sources (source) VALUES ('wmt'), ('espn'), ('ncaa');

-- ---------------------------------------------------------------------------
-- Layer 1: raw. Every fetch is kept; the normalizer reads the latest per game.
-- ---------------------------------------------------------------------------
CREATE TABLE raw_payloads (
  raw_id          BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL REFERENCES sources (source),
  source_game_id  TEXT NOT NULL,
  kind            TEXT NOT NULL,              -- plays | boxscore | scoreboard | ...
  page            INTEGER NOT NULL DEFAULT 0,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload         JSONB NOT NULL
);
CREATE INDEX raw_payloads_lookup
  ON raw_payloads (source, source_game_id, kind, page, fetched_at DESC);

-- ---------------------------------------------------------------------------
-- Crosswalks: the three sources share no ids.
-- ---------------------------------------------------------------------------
CREATE TABLE teams (
  team_id  TEXT PRIMARY KEY,                  -- stable internal slug, e.g. 'byu'
  name     TEXT NOT NULL,
  abbrev   TEXT
);
CREATE TABLE team_external_ids (
  team_id      TEXT NOT NULL REFERENCES teams (team_id),
  source       TEXT NOT NULL REFERENCES sources (source),
  external_id  TEXT NOT NULL,
  PRIMARY KEY (team_id, source),
  UNIQUE (source, external_id)
);

-- No team_id on players: transfers. A player's team for a game comes from the plays.
CREATE TABLE players (
  player_id  TEXT PRIMARY KEY,                -- stable internal id
  name       TEXT NOT NULL
);
CREATE TABLE player_external_ids (
  player_id    TEXT NOT NULL REFERENCES players (player_id),
  source       TEXT NOT NULL REFERENCES sources (source),
  external_id  TEXT NOT NULL,
  PRIMARY KEY (player_id, source),
  UNIQUE (source, external_id)
);

-- ---------------------------------------------------------------------------
-- Games. Game-level facts and hand-entered fields live here.
-- Anything derivable (day of week, opponent rank, rivalry) is in game_context.
-- ---------------------------------------------------------------------------
CREATE TABLE games (
  game_id              TEXT PRIMARY KEY,
  game_date            DATE NOT NULL,          -- local date at the venue
  tipoff_local         TIME,                   -- local wall-clock time at the venue
  venue_tz             TEXT,                   -- IANA name, e.g. 'America/Denver'
  season_year          INTEGER NOT NULL,       -- year the season started
  season_type          TEXT,                   -- regular | conf_tourney | postseason
  tournament_round     TEXT,
  home_team_id         TEXT NOT NULL REFERENCES teams (team_id),
  away_team_id         TEXT NOT NULL REFERENCES teams (team_id),
  is_neutral_site      BOOLEAN,
  is_conference_game   BOOLEAN,
  is_postseason        BOOLEAN,
  venue                TEXT,
  attendance           INTEGER,
  home_record_entering TEXT,
  away_record_entering TEXT,
  final_score_home     INTEGER,
  final_score_away     INTEGER,
  winner_team_id       TEXT REFERENCES teams (team_id),
  ball_brand           TEXT,                   -- manual entry, last value wins

  -- Clock structure. Defaults are men's college: two 20-minute halves, 5-minute OT.
  period_count           SMALLINT NOT NULL DEFAULT 2,
  period_length_seconds  INTEGER  NOT NULL DEFAULT 1200,
  ot_length_seconds      INTEGER  NOT NULL DEFAULT 300,

  status               TEXT NOT NULL DEFAULT 'final' CHECK (status IN ('scheduled', 'live', 'final')),
  primary_source       TEXT NOT NULL REFERENCES sources (source),
  context_extra        JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX games_date ON games (game_date);
CREATE INDEX games_season ON games (season_year);

-- Which source game ids belong to which game. matched_by = 'manual' is an override.
CREATE TABLE source_games (
  source          TEXT NOT NULL REFERENCES sources (source),
  source_game_id  TEXT NOT NULL,
  game_id         TEXT NOT NULL REFERENCES games (game_id),
  matched_by      TEXT NOT NULL DEFAULT 'auto' CHECK (matched_by IN ('auto', 'manual')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_game_id)
);
CREATE INDEX source_games_game ON source_games (game_id);

-- Hand-entered game context beyond the columns above ("senior night", ...).
CREATE TABLE game_tags (
  game_id  TEXT NOT NULL REFERENCES games (game_id),
  tag      TEXT NOT NULL,
  value    TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (game_id, tag)
);

-- Saved split definitions ("afternoon games", "ball brand X"). Rules are evaluated
-- at query time; nothing is precomputed. Rule format is defined when the evaluator is built.
CREATE TABLE game_splits (
  split_id    SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  rule        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Layer 2: the normalized play.
-- One primary source per game; only that source's plays are stored here.
-- ---------------------------------------------------------------------------
CREATE TABLE plays (
  play_id          TEXT PRIMARY KEY,           -- '{game_id}-{source_play_id}', stable across corrections
  game_id          TEXT NOT NULL REFERENCES games (game_id),
  sequence_number  INTEGER NOT NULL,           -- sort key; ties broken by source row order
  source           TEXT NOT NULL REFERENCES sources (source),
  source_play_id   TEXT NOT NULL,              -- the feed's own id for the play
  source_play_ref  TEXT,                       -- pointer into raw_payloads (page / index)

  period_number             INTEGER NOT NULL,
  period_type               TEXT NOT NULL CHECK (period_type IN ('regulation', 'ot')),
  clock_seconds_remaining   REAL,              -- time left in the period
  clock_display             TEXT,
  game_seconds_elapsed      REAL,
  wallclock_utc             TIMESTAMPTZ,

  team_id           TEXT REFERENCES teams (team_id),   -- null for neutral events
  team_side         TEXT CHECK (team_side IN ('home', 'away')),
  is_neutral_event  BOOLEAN NOT NULL DEFAULT false,
  player_id         TEXT REFERENCES players (player_id), -- main actor; null for team-level

  play_category     TEXT NOT NULL CHECK (play_category IN (
                      'shot_attempt', 'free_throw', 'rebound', 'turnover', 'steal', 'block',
                      'foul', 'assist', 'substitution', 'timeout', 'jumpball', 'challenge',
                      'period_admin', 'other')),
  play_type         TEXT,
  play_subtype      TEXT,                      -- WMT only; 'in' / 'out' on substitutions
  play_description  TEXT,

  home_score_after  INTEGER NOT NULL,
  away_score_after  INTEGER NOT NULL,
  shot_value        SMALLINT CHECK (shot_value IN (1, 2, 3)),
  is_shot_attempt   BOOLEAN NOT NULL DEFAULT false,
  is_made           BOOLEAN,
  made_is_inferred  BOOLEAN NOT NULL DEFAULT false,
  is_assisted       BOOLEAN,
  linked_play_id    TEXT,                      -- assist -> shot

  court_x REAL, court_y REAL,                  -- normalized single-basket grid
  raw_x REAL, raw_y REAL, goal_side TEXT,      -- WMT full-court originals
  area_of_action    TEXT,                      -- WMT only
  has_valid_location BOOLEAN NOT NULL DEFAULT false,

  play_qualifiers      TEXT[],                 -- WMT: {fastbreak,2ndchance}
  shot_clock_seconds   REAL,                   -- WMT only
  lineup_home          TEXT[],                 -- player_ids on court
  lineup_away          TEXT[],
  win_probability_home REAL,                   -- ESPN only

  sources  JSONB NOT NULL DEFAULT '{}',
  extra    JSONB NOT NULL DEFAULT '{}',

  UNIQUE (game_id, sequence_number) DEFERRABLE INITIALLY DEFERRED,  -- upserts can reorder
  UNIQUE (game_id, source, source_play_id)
);
CREATE INDEX plays_game_cat  ON plays (game_id, play_category);
CREATE INDEX plays_player    ON plays (player_id);
CREATE INDEX plays_team      ON plays (team_id);

-- Everyone involved in a play, including the main actor (also stored in plays.player_id).
CREATE TABLE play_participants (
  play_id    TEXT NOT NULL REFERENCES plays (play_id) ON DELETE CASCADE,
  player_id  TEXT NOT NULL REFERENCES players (player_id),
  role       TEXT NOT NULL CHECK (role IN (
               'shooter', 'assister', 'blocker', 'rebounder', 'turned_over_by', 'stealer',
               'fouler', 'fouled', 'sub_in', 'sub_out',
               'jumpball_home', 'jumpball_away', 'jumpball_won_by')),
  PRIMARY KEY (play_id, role, player_id)
);
CREATE INDEX play_participants_player ON play_participants (player_id, role);

-- Tracks which derivations have run for which game, and at which version.
-- Re-ingesting a game clears its rows here so stale derived data gets rebuilt.
CREATE TABLE derivation_runs (
  game_id     TEXT NOT NULL REFERENCES games (game_id) ON DELETE CASCADE,
  derivation  TEXT NOT NULL,
  version     INTEGER NOT NULL,
  ran_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, derivation)
);

-- ---------------------------------------------------------------------------
-- Views: context is computed, never stored per row.
-- ---------------------------------------------------------------------------

-- Game-level context. Rank and rivalry columns get added when those tables exist.
CREATE VIEW game_context AS
SELECT
  g.*,
  to_char(g.game_date, 'FMDay')                     AS day_of_week,
  EXTRACT(ISODOW FROM g.game_date)::int             AS iso_day_of_week,
  EXTRACT(MONTH FROM g.game_date)::int              AS game_month
FROM games g;

-- Play-level situation: the ingredients a time or score window rule filters on.
CREATE VIEW play_situation AS
SELECT
  p.*,
  (p.home_score_after - p.away_score_after) AS score_margin,   -- home minus away
  CASE p.team_side
    WHEN 'home' THEN p.home_score_after - p.away_score_after
    WHEN 'away' THEN p.away_score_after - p.home_score_after
  END                                       AS team_margin,    -- relative to the play's team
  CASE
    WHEN p.home_score_after = p.away_score_after THEN 'tied'
    WHEN p.home_score_after > p.away_score_after THEN 'home'
    ELSE 'away'
  END                                       AS leading_side,
  (p.period_type = 'ot')                    AS is_overtime,
  g.status                                  AS game_status,
  CASE p.period_type
    WHEN 'regulation'
      THEN p.clock_seconds_remaining + (g.period_count - p.period_number) * g.period_length_seconds
    ELSE p.clock_seconds_remaining
  END                                       AS game_seconds_remaining
FROM plays p
JOIN games g USING (game_id);

COMMIT;
