# dataAggregators — play-by-play pipeline

Scrapes ESPN/WMT play-by-play into a local Postgres database, then exports normalized
per-game JSON (plus a games/seasons index) and uploads it to S3, where the app reads it
via CloudFront. See `../REORG_NOTES.md` for how this folder relates to the rest of the repo.

## One-time setup

1. Start the local database: `docker compose -f db/docker-compose.yml up -d` (Postgres on port 5544).
2. Run migrations: `node db/migrate.js`.
3. In `../stat_explorer/.env.local`, set the S3 credentials and target (see
   `.env.local.example`): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`,
   `BUCKET_NAME=byu.freema22`, `KEY_PREFIX=hoopstats`. These are an IAM user scoped to
   `hoopstats/{pbp,kills,clutch,lineups,raw,games}/*` — never the AWS root/default profile.

## Processing a game

Ingest is manual, run by hand after each game — there's no scheduler.

```bash
# 1. Ingest from a source (repeat for whichever source(s) cover this game)
node ingest/espn/ingest.js --id <espnGameId> --save-fixture fixtures/espn
node ingest/wmt/ingest.js --id <wmtGameId>

# 2. Export normalized plays + header facts for the game
node ingest/tools/export-game-plays.js <gameId> /tmp/pbp-<gameId>.json
node ingest/tools/export-game-meta.js <gameId> /tmp/meta-<gameId>.json

# 3. Upload both to S3 (served at https://dd0v7fgd2sjsh.cloudfront.net/pbp/games/<gameId>.json)
node ingest/tools/upload.js /tmp/pbp-<gameId>.json pbp/games/<gameId>.json
node ingest/tools/upload.js /tmp/meta-<gameId>.json pbp/games/<gameId>.meta.json

# 4. Refresh the games/seasons index so the new game shows up in the app's switcher
node ingest/tools/export-games-index.js /tmp/games-index.json
node ingest/tools/upload.js /tmp/games-index.json games/index.json
```

`upload.js` sets a 5-minute cache on everything it writes, so changes (including a
freshly-added game) can take a few minutes to show up everywhere.

## Useful checks

- `node ingest/tools/list-bucket.js hoopstats/<prefix>/` — read-only listing of what's in S3
  under a prefix (e.g. `hoopstats/pbp/games/`).
- `node ingest/tools/compare-sources.js` — diffs two Postgres databases' derived stats for a game.
- `node ingest/espn/check.js` / `ingest/wmt/check.js` — post-ingest sanity checks per source.

## Layout

- `db/` — Postgres schema, migrations, connection helper.
- `ingest/espn/`, `ingest/wmt/` — per-source fetch + normalize + ingest CLIs.
- `ingest/lib/` — shared entity resolution (teams/players/games across sources) and DB writes.
- `ingest/tools/` — export (DB → JSON) and upload (JSON → S3) CLIs, plus dev utilities.
- `derivations/` — stats computed from normalized plays (currently just kills; clutch and
  lineups are still computed client-side in `stat_explorer` — see the project plan for why).
- `config/`, `fixtures/` — seed data and cached raw payloads for offline dev/testing.

Note: `seasonLineups.js`, `updateLineupsWithGame.js`, and `modules/` are a separate, older
pipeline (scrapes `gamestats.byucougars.com` directly) that still generates the season
lineups view. It's slated for retirement once season-level aggregation moves onto this
pipeline — see the project plan.
