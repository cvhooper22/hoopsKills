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
# NCAA.com is a fallback source (ESPN preferred). No --write = build and vet the rows without touching the database:
node ingest/ncaa/ingest.js --id <ncaaContestId> [--write [--force-primary]]

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

Headshots: players from live (StatBroadcast) games have no ESPN id, so first run
`node ingest/tools/backfill-espn-ids.js <gameId> [--team <teamId>] [--apply]` (matches names against ESPN rosters; dry run
without `--apply`), then `node ingest/tools/collect-headshots.js [--dry-run] [--team <teamId>]`.

### Kills summaries and the season file

Season type (regular / conference tournament / postseason) comes from
`config/season-boundaries.json`, which names the last game before each stage per `seasonYear`.
Ingest applies it per game; after editing the markers run
`node ingest/tools/apply-season-types.js`.

```bash
# 5. Per-game kills summary (one game, or --all for every final BYU game), then upload each
node ingest/tools/export-game-kills.js <gameId> /tmp/kills/games/<gameId>.json
node ingest/tools/upload.js /tmp/kills/games/<gameId>.json kills/games/<gameId>.json

# 6. Games index (now with conference / neutral / season type) and the team lookup
node ingest/tools/export-games-index.js /tmp/games-index.json
node ingest/tools/upload.js /tmp/games-index.json games/index.json
node ingest/tools/export-teams-meta.js /tmp/meta/teams.json     # names from config/team-labels.json
node ingest/tools/upload.js /tmp/meta/teams.json meta/teams.json

# 7. Rebuild the season file from the uploaded summaries (rebuilt from scratch every time)
node derivations/aggregate-kills.js --season 2025 --out-dir /tmp/kills
node ingest/tools/upload.js /tmp/kills/seasons/2025.json kills/seasons/2025.json
node ingest/tools/upload.js /tmp/kills/seasons/index.json kills/seasons/index.json
```

`aggregate-kills.js` refuses to mix kill-rule versions (`KILLS_RULES_VERSION` in the app's
`kills.js`; bump it when the rules change, then regenerate every game's summary). To aggregate
summaries that are only on disk, pass `--base /tmp --index <games-index.json>`.
The kill logic itself lives in `stat_explorer/src/utils/{kills,killsSummary,killsSeason}.js`;
`derivations/` loads those files directly, so there is one copy. Details:
`../futureWork/season-kills-aggregation.md`.

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
- `derivations/` — loads the app's kills code (`kills.js` re-export, `app-modules.js`) and holds
  `aggregate-kills.js`, the season rollup. Clutch and lineups are still computed client-side in
  `stat_explorer` — see the project plan for why.
- `config/`, `fixtures/` — seed data and cached raw payloads for offline dev/testing.

Season lineups follow the same flow as kills: `node ingest/tools/export-game-lineups.js --all`
writes `lineups/games/<id>.json`, then `node derivations/aggregate-lineups.js --season <year>` writes
`lineups/seasons/<year>.json` (games identified by gameId + oppTeamId, like kills). Logic lives in
`stat_explorer/src/utils/{lineupsSummary,lineupsSeason}.js`; bump `LINEUPS_RULES_VERSION` if it changes.

Season clutch follows the same flow: `node ingest/tools/export-game-clutch.js --all` writes
`clutch/games/<id>.json` (BYU player lines, team totals for both sides, stretch splits), then
`node derivations/aggregate-clutch.js --season <year>` writes `clutch/seasons/<year>.json` and
`clutch/seasons/index.json`. Upload each to the matching `clutch/` key. The definition is fixed
(2nd half / OT, 5:00 or less, margin of 5 or less) in `CLUTCH_DEFINITION`; each summary also keeps a
`last2` tally (the same rule with a 2:00 window, regulation only, rules version 2); the per-game clutch
page keeps its adjustable definition by working from the plays. Logic lives in
`stat_explorer/src/utils/{clutchSummary,clutchSeason}.js`; bump `CLUTCH_RULES_VERSION` if it changes.

The per-game box (Box score, Plays and Lineup timeline views) is one file per game: `node ingest/tools/export-game-box.js
<game_id>` (or `--all`) writes `box/games/<id>.json` and rebuilds `box/index.json` under `--out-dir` (default: the temp
dir). It holds the aggregations, the per-chance rows and the play log; the Plays and timeline views compute everything
else in the browser. Upload with `upload.js` to `box/games/<id>.json` and `box/index.json`. It is the same payload
`derivations/game-box-prototype.js` writes for the local preview.

## Rankings (team ratings by system)

Snapshots of team ratings from Torvik (with WAB), NCAA NET, Haslametrics, KenPom and EvanMiya go into the
`rating_*` tables (migration `004_rankings.sql`), so a game can be joined to its opponent's rank either as of tip-off
or as of the latest snapshot. All D-I teams are stored, not just BYU's opponents.

```bash
node ingest/rankings/run.js                                   # latest snapshot of every system (KenPom opens a Chrome window briefly)
node ingest/rankings/run.js --systems torvik,net              # just these
node ingest/rankings/run.js --backfill torvik --from 2025-10-27 --to 2026-04-14   # Torvik publishes dated history
node ingest/rankings/status.js                                # what is stored (JSON)
node --test ingest/rankings/rankings.test.js
```

The same run is a button on the hidden `/admin/rankings` page (`npm start` only). Run it on game day **before tip-off**:
each snapshot is stamped with the date through which games are included (`through_date`), and a game on date G is
compared with the latest snapshot whose `through_date` < G. Torvik, NET and Haslametrics state that date themselves;
KenPom and EvanMiya do not, so a pull is assumed to be through yesterday, and BYU's record in each snapshot is checked
against the games table to catch a mislabelled one.

Team names differ per site. Every spelling is matched to this app's own canonical team list,
`config/rating-teams.json` (id -> name). It started from Torvik's names, but nothing depends on his spelling: if a site
renames a team the new spelling simply shows up as unmatched. Where a team also exists in the games `teams` table its id is
that team's id, so games join to ratings directly. `ingest/rankings/lib/names.js` reduces spellings to comparable keys and
`config/rating-team-synonyms.json` (spelling key -> team id) covers the rest. A collector reports names it could not
match; on `/admin/rankings` (local only) map each to an existing team or add it as a new one, rename canonical teams, then
re-run that system. The same edits are available on the command line: `node ingest/rankings/mappings.js` (see its header).

### Joining games to opponent ratings

Migration `005_game_opponent_ratings.sql` adds views; rank is constant within a game, so plays and players inherit it by
joining to the game. `game_opponent_ratings` has one row per BYU game, system and basis for the opponent (and BYU's own
rank): `at_game` is the latest snapshot of the game's season with `through_date` before the game date (always the pre-game
picture), `latest` is the season's latest snapshot (the final ratings for a finished season). Each row carries rank, native
rating, percentile and points above the D-I average (signed so higher is better, which makes systems comparable), plus the
system's extra metrics (WAB, quad records, ...). A missing snapshot is a missing row, never a guess.

```bash
node ingest/rankings/game-ratings.js            # table: opponent rank at tip-off / latest, per system
node ingest/rankings/game-ratings.js --check    # invariants (no game-day leak, one row per key, ...) and coverage
```

`ingest/tools/export-games-index.js` puts the same facts in each games-index entry as `opponentRatings`
(`{ [system]: { atGame, latest } }`) and writes `rating-systems.json` beside it (labels, units, direction), so the app can
filter games by opponent rank with no database. Upload both (`games/index.json` and `meta/rating-systems.json`). In the app,
`stat_explorer/src/utils/opponentFilters.js` turns filters such as "top-40 at tip-off" or "defense <= 95.5" into a set of
game ids, and `filterRows({ gameIds })` applies it to season rows; plays and players follow because they belong to games.

### Rankings timeline page

`/rankings` in `stat_explorer` (behind the `rankings` feature flag: `?ff=rankings`, or `REACT_APP_FF_RANKINGS`) charts BYU's rank
by system over a season: overall, offense, defense and Torvik's WAB, with an average-and-spread band, W/L dots for each game, and a
table of what each game did to BYU's Torvik rank. It reads `public/data/rankings/timeline-<season>.json`:

```bash
node ingest/tools/export-rankings-timeline.js --season 2025      # writes stat_explorer/public/data/rankings/timeline-2025.json
```

For 2025-26 the page also draws KenPom, EvanMiya and Haslametrics from `stat_explorer/src/constants/rankingsManual.js`, BYU's
hand-tracked values through Feb 9, 2026 (those systems were not being collected yet). They are hardcoded for that season only; from
2026-27 on every system comes from the database.

### Exhibitions

Hand-entered game tags live in `game_tags`. `node ingest/tools/tag-game.js <gameId> exhibition` marks an exhibition: it
stays in the database and the games index (`isExhibition`) but is left out of the season aggregations
(`derivations/aggregate-{kills,clutch,lineups}.js`; pass `--include-exhibitions` to keep it) and of the ratings record check.
