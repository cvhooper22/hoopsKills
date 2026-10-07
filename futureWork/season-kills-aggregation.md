# Future work: season kills aggregation

Status: implemented 2026-10-07 (local only, nothing uploaded or committed yet). Written from a
design discussion; the "As built" section at the bottom lists where the code differs from the plan.

Goal: roll per-game kills data up into season data, served from S3, with a mobile-first
games table that links to each game. Season numbers must respond to table filters
(conference only, home/away, last N).

## Principles

- **Store additive facts per game, sum them, derive ratios last.** Never average
  averages. Completion = kills / (kills + potential). Efficiency = gainSum / gainCount.
- **Derived values are never merged.** The merge sums `totals`; a separate finalize step
  computes ratios, maxes and distributions.
- **Rebuild the season from scratch every run.** No incremental state.
- **Order columns once, mobile-first.** Desktop just shows more of the same order.

## Step 0: reconcile the two kills.js copies (prerequisite)

`dataAggregators/derivations/kills.js` and `stat_explorer/src/utils/kills.js` have
diverged. The app copy has `swingMargin` (the possession-after-a-stop margin that
efficiency / `killGain` depends on); the aggregator copy does not. The header of the
aggregator copy says "keep in sync".

- **Decided: the app's `kills.js` is canonical; the `dataAggregators` copy is stale.**
- Retire the stale copy. Best: one shared CommonJS module, seeded from the app version,
  imported by both, so the per-game summary writer and the app can never disagree. The
  same goes for the season merge (step 2). `derivations/check-kills.js` needs to point
  at the shared module.
- Add a `RULES_VERSION` integer constant next to the kill rules. Bump it whenever the
  rules change (stop definitions, dirty rules, thresholds, kill size).

## Step 1: per-game kills summary

New tool: `ingest/tools/export-game-kills.js <gameId> [out]`, which reads the game's
plays (same source as `export-game-plays.js`) and header facts (same source as
`export-game-meta.js`), runs `detectKills` once for BYU as the defense and once for the
opponent, and writes `kills/games/<gameId>.json`. Upload with `upload.js` to
`kills/games/<gameId>.json` (the IAM scope already covers `hoopstats/kills/*`).

Shape (`oppKills` is a count only):

```
{ gameId, source, rulesVersion, generatedAt,
  game: { date, seasonYear, oppTeamId, location,        // location: home | away | neutral
          isConferenceGame, seasonType, tournamentRound,  // seasonType: regular | conf_tourney | postseason
          result, scoreFor, scoreAgainst, margin },
  byu: {
    kills, potential, stops, pure, dirty,
    byPeriod: { 1:{kills,potential,stops,pure,dirty}, 2:{…}, OT:{…} },
    gainSum, gainCount,
    gaps: [seconds], durations: [seconds], killTimes: [gameSeconds],
    streakLengths: { 2, 3, 4, 5plus },
    longestStreak: { length, period, startSeconds, endSeconds, converted },
    buckets: { critical, garbage, clutch, adjacent },
    stopMix: { rebound, turnover, steal, charge, tie_up, block },
    credit: { <playerId>: { name, steals, blocks } },
    avoidableBreakers },
  oppKills }
```

Notes:
- Dropped on purpose: stop sequence numbers, play ids, raw clocks, breaker fouler names,
  potential-kill end detail. Those are game-view drill-down data.
- `gainSum` / `gainCount` come from `killGain` over the kills (sum of non-null gains,
  count of kills with a gain).
- `longestStreak` is the longest stop streak in the game; `converted` is how many kills
  it produced. The existing `streakLengths` histogram stays.
- Opponent name, short label and logo are **not** stored per game: the summary carries
  `oppTeamId` and the app joins to `meta/teams.json` (see "Meta files"). The app already
  resolves logos by team id (`urls.teamLogo(opponentId)`).
- `location` is derived from BYU's side plus `is_neutral_site`, **not** from ESPN's event
  name or home/away labels (the Texas NCAA game is named "Texas at BYU" but was neutral).
  Neutral games get `location: "neutral"` and are excluded from home/away splits.
- Needs from the DB that the current exports do not carry: `is_conference_game`,
  `season_type`, `tournament_round`, `is_neutral_site` (the columns exist, see
  `001_init.sql`). Add them to the summary writer's query and to `export-games-index.js`.
- Source: each game is written once from a single primary source (WMT or ESPN), so a
  game covered by both is never double-counted.
- Add the new file to the README processing steps, between the meta export and the index
  refresh.

## Step 2: merge module (pure, shared)

CommonJS module, no I/O, importable by the CLI and the app.

- `emptyAccumulator()`
- `mergeGame(acc, gameSummary)`: sums the additive `totals` (counts, byPeriod, gainSum /
  gainCount, buckets, streakLengths, stopMix, avoidableBreakers, oppKills), merges
  `credit` by player id, and appends a thin `byGame` row.
- `finalize(acc)`: produces `derived` and sorts `byGame` by date.
- `foldRows(rows)`: the same fold over an arbitrary subset of `byGame` rows, used by the
  app to recompute everything under a filter. `mergeGame` should be built on it, so the
  CLI and the app run the same code.

Season-level numbers computed in finalize:
- completion, efficiency, kill differential, per-game averages (kills, kills against,
  potential, stops, avoidable breakers)
- gaps and durations: average / longest / shortest from the concatenated arrays
- longest streak: the max `length` across games. **Ties show every game involved**,
  so `derived.longestStreak` is `{ length, games: [{gameId, opp, date, period}] }`.

## Step 3: season file

`kills/seasons/<season>.json` (e.g. `2025-26`), plus `kills/seasons/index.json` listing
available seasons for the picker.

```
{ season, team, rulesVersion, generatedAt,
  gamesIncluded, gamesSkipped: [{gameId, reason}],
  totals: { games, kills, oppKills, potential, stops, pure, dirty,
            gainSum, gainCount, avoidableBreakers,
            byPeriod, buckets, streakLengths, stopMix },
  derived: { completion, efficiency, diff, perGame: {…},
             gaps: {avg,longest,shortest}, durations: {…},
             longestStreak: { length, games: [...] } },
  players: [ { id, name, steals, blocks, gamesWithCredit } ],
  byGame: [ { gameId, date, oppTeamId, location, isConferenceGame,
              seasonType, tournamentRound, result, scoreFor, scoreAgainst,
              kills, oppKills, potential, stops, completion, efficiency,
              pure, dirty, longestStreak, avoidableBreakers,
              gaps, durations, killTimes, stopMix } ] }
```

Filtering decision: **`byGame` rows carry their own `gaps`, `durations`, `killTimes` and
`stopMix`**, so tiles, table and rhythm cards all respond to filters by re-folding the
filtered rows. **Player credit stays season-wide** (labelled as such) because per-game
credit maps are bulkier. Revisit if filterable credit is wanted.

Rules:
- All games must share one `rulesVersion`. If they differ, the aggregator fails and lists
  the games to regenerate.
- A game with a missing or invalid summary goes in `gamesSkipped` with a reason, never
  silently dropped.
- Keyed by team; BYU first, but the CLI takes a team argument.

## Step 4: aggregator CLI

`derivations/aggregate-kills.js --season 2025-26 --team byu [--out path] [--no-upload]`

1. Read `games/index.json`, select the season's completed games for the team.
2. Fetch each `kills/games/<gameId>.json` from the CDN (or S3).
3. Validate `rulesVersion`; fold with `mergeGame`; `finalize`.
4. Write `kills/seasons/<season>.json` and update `kills/seasons/index.json`; upload with
   `upload.js`.
5. Print a summary: games included / skipped, totals, any version mismatch.

Add to the README flow as the last step after the index refresh.

## Step 5: the app view

New season view under Kills (route alongside the per-game one, switchable from
`KillsRouter`).

Layout, top to bottom:
1. **KPI tiles** (2-up on mobile; Kills and Completion first): Kills, Kills against, Diff,
   Completion, Potential, Stops, Efficiency, Longest streak (subline links to the game;
   shows every tied game).
2. **Games table.**
3. **Rhythm and mix**, season-level: gaps and durations avg / longest / shortest, stop mix,
   streak-length histogram, "when kills happen" histogram (bucketed from `killTimes` at
   view time), player credit (season-wide, labelled).

Games table, mobile-first column order (single order, desktop shows more):
1. **Opponent, sticky.** Line 1 is a location marker (`vs` home, `@` away, `N` neutral)
   plus short name or logo, resolved from `meta/teams.json`. Line 2 is the date and a W/L
   badge with score (letter plus color, not color alone). The whole cell links to
   `/kills/<gameId>`.
2. Kills
3. Kills against
4. Diff
5. Completion %
6. (scroll) Potential, Stops, Efficiency
7. (scroll, "more columns" toggle) Pure/dirty, longest streak, avoidable breakers

Table behavior: sortable headers; short headers (`K`, `K vs`, `Diff`, `Cmp%`) with
tooltips; a totals row (counts summed, ratios from the sums) that follows the same column
order; row min-height ~44px; filters collapsed into one "Filters" control; filter state in
URL params like Clutch's `?min=&margin=&view=`.

Filters (they stack, i.e. AND together):
- **Conference only** (`isConferenceGame`). Conference tournament games count as
  conference games (ESPN flags them so), so "conference + postseason" is how to see only
  conference tournament games.
- **Location:** home / away / neutral. Neutral games appear under "All" and "Neutral"
  only, never in the home or away splits.
- **Postseason only** (`seasonType` of `conf_tourney` or `postseason`). One toggle in the
  UI, **off by default**, so the default view is every game including postseason. The
  underlying data keeps the specific type so a future filter can split conference
  tournament from NCAA tournament stats.
- **Last N** games.

## Meta files (S3 now, shaped like future tables)

Each file is keyed by a stable id so a later DB load is a bulk insert.

- `meta/teams.json`: `{ teamId: { name, abbrev, shortName, logoKey } }`. Seeded from
  `config/team-logos.json` and the `teams` table; `abbrev` hand-filled where missing
  (only BYU is seeded today). The single lookup for opponent label and logo.
- `games/index.json`: extend with `isConferenceGame`, `isNeutralSite`, `seasonType`,
  `tournamentRound` (via `export-games-index.js`).
- Deferred: `meta/conferences.json` and per-season team conference membership (only
  needed to filter by opponent conference).

## Season type rule

Written to `games.season_type`, `games.is_postseason` and `games.tournament_round` at
ingest. Checked on three ESPN games (Big 12 tournament 2nd round and quarterfinal, NCAA
1st round); WMT carries no equivalent.

Precedence:
1. **Config marker** (for WMT-primary games, and as an override for any game).
   `config/season-boundaries.json`, per `seasonYear`:
   `{ "2025": { confTourneyStartsAfter: <gameId>, postseasonStartsAfter: <gameId> } }`.
   Games after a marker take that type. No date windows, since dates shift across seasons.
2. **ESPN event data:** event `seasonType` id 3 means `postseason`; `seasonType` 2 plus
   `competition.type` = Tournament means `conf_tourney` (`tournamentId` 5 was the Big 12
   one); `competition.notes[0].headline` is stored as `tournament_round`; otherwise
   `regular`.
3. Default `regular`.

Notes:
- The saved ESPN bundle does not keep the event-level `seasonType`, so the ingest needs
  one extra request per game (the event object) or the bundle must store it.
- The aggregator warns if a season with games in mid-March or later has no marker and no
  ESPN-derived types, since postseason games would otherwise count silently as regular.
- No WMT-to-ESPN crosswalk for now; the config markers cover WMT games.
- Unverified: whether NIT / CBI games arrive as `seasonType` 3. Check on first one.

Wrap the new tiles and table with `Collectable` once the collection flag rolls out
(see `collect-and-share.md`).

## Build order

1. Step 0: reconcile / share `kills.js`, add `RULES_VERSION`.
2. Step 1: per-game summary writer; generate and eyeball it for the three local games.
3. Step 2: merge module with unit tests (below).
4. Steps 3-4: season file shape and CLI; run against the local games, then upload.
5. Step 5: view, in this order: KPI tiles, games table, rhythm cards, filters.

## Tests

- Merge: summing two or three game fixtures equals a hand-computed season; completion
  and efficiency are weighted by counts, not averaged.
- Filter parity: `foldRows` on a subset equals running the full aggregator on only those
  games.
- Longest streak: ties return all games; a single leader returns one.
- Version guard: a mixed `rulesVersion` set fails and names the games.
- Skipped games appear in `gamesSkipped` and are excluded from `totals`.
- Per-game writer: the summary's `kills` / `potential` / `stops` match `detectKills` on
  the same plays; `oppKills` matches the opponent-defense run.

## Decided

- Season is keyed by `seasonYear` (the year the season started, as stored in `games`).
- Postseason games are included by default; a single "postseason only" filter narrows.
- Rules version is an integer.
- Ties for longest streak list every tied game.
- Player credit filtering and opponent detail beyond `oppKills` are deferred.

## Open items

- Fill `abbrev` / `shortName` for opponents in `meta/teams.json`.
- Set the season-boundaries markers for the current season (the games after the Texas
  Tech 82-76 win are postseason: Kansas State, West Virginia, Houston, Texas) and check
  them against ESPN's data once the ingest reads it.
- Confirm NIT / CBI season type when one is ingested.
- Opponent detail beyond `oppKills`, if wanted later. Add as an `opp` block; it needs a
  regenerate of older games to fill in.

## As built (deviations from the plan above)

- **One copy of the kills code.** The app files are canonical and Node 22+ `require()`s them
  (`dataAggregators/derivations/app-modules.js`, `derivations/kills.js` is a re-export). New shared
  files: `stat_explorer/src/utils/killsSummary.js` (per-game summary builder) and `killsSeason.js`
  (`gameRow`, `foldRows`, `filterRows`, `buildSeason`). `KILLS_RULES_VERSION = 1` is exported from
  `kills.js`. `killInsights.js` imports `stopTypes.js` with its extension so Node can load it.
- **Player credit is keyed by player name**, not id: the detector's stops carry the name only.
- **byGame rows carry every additive field** (byPeriod, buckets, streakLengths, gainSum/gainCount,
  and the arrays), not a thin subset, because the app re-folds filtered rows with the same code.
  There is no separate `pooled` block; `pooledKillTimes(rows)` builds the histogram input.
- **Summaries come from the DB** (`ingest/tools/export-game-kills.js`, shared plays query in
  `ingest/lib/game-plays.js`). The aggregator reads summaries and the games index from the CDN or
  a local dir (`--base`, `--index`).
- **Season type** is applied to the DB by `ingest/lib/season-type.js` (called from `upsertGame`
  and `ingest/tools/apply-season-types.js`) from `config/season-boundaries.json`, which names the
  last game before each stage (Texas Tech on 3/7 and Houston on 3/12 for 2025). A conference
  tournament game is forced to `is_conference_game = true` (WMT flags the Big 12 tournament as
  non-conference). The ESPN event-level `seasonType` is not read yet; only the markers are used.
- **Meta files:** `ingest/tools/export-teams-meta.js` writes `meta/teams.json` from the `teams` table
  plus `config/team-labels.json` (abbreviations are my fill-in, review them); `shortName` defaults
  to the team name. `export-games-index.js` now includes `isConferenceGame`, `isPostseason`,
  `tournamentRound`.
- **App view:** `/kills/season` (`views/Kills/KillsSeason.js`, `SeasonGamesTable`, `SeasonFilters`,
  `SeasonRhythm`, `KillsSubnav` on both kills pages). Filters live in the URL (`conf`, `post`,
  `loc`, `last`, `season`, `view=avg`). Added beyond the plan: a Totals / Per game toggle, and on a
  phone only four tiles show until "More stats" is tapped so the table is not pushed down.
  Collectable wrapping is not done.
- **Local preview:** `REACT_APP_PREVIEW_DATA_BASE` (see `.env.local.example`) reads the season
  files and `meta/teams.json` from `public/data` before they are uploaded.
- **Checked:** 14 unit tests (`killsSeason.test.js`); all 35 BYU games exported, season totals
  193 kills / 140 against / 55.3% completion / longest streak 11 (Pacific); the view verified at
  375px and desktop (no page overflow, sticky column, filters stack, rows link to games).
- **Not done:** upload to S3, ESPN event ingest for season type, Collectable wrapping, NIT/CBI
  season type check, a test for the CLI itself.
