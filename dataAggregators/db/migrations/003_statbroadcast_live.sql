-- StatBroadcast as a play source (used for live games), plus per-game live state for the poller.
BEGIN;

INSERT INTO sources (source) VALUES ('statbroadcast') ON CONFLICT DO NOTHING;

-- One row per game being polled: what the feed currently says, and how the polling is going.
-- The plays table can't say what the clock is when no plays have happened for a while, or whether the
-- feed has gone quiet, so a live scoreboard reads this alongside the plays.
CREATE TABLE live_game_state (
  game_id               TEXT PRIMARY KEY REFERENCES games (game_id) ON DELETE CASCADE,
  source                TEXT NOT NULL REFERENCES sources (source),
  source_game_id        TEXT NOT NULL,
  status_text           TEXT,                  -- the feed's own words ("Final", "In Progress", ...)
  period_number         INTEGER,
  clock_display         TEXT,                  -- clock of the latest play (not a ticking game clock)
  home_score            INTEGER,
  away_score            INTEGER,
  play_count            INTEGER NOT NULL DEFAULT 0,
  last_polled_at        TIMESTAMPTZ,
  last_changed_at       TIMESTAMPTZ,           -- last poll that added or changed a play
  consecutive_failures  INTEGER NOT NULL DEFAULT 0,
  last_error            TEXT
);

COMMIT;
