# BYU Hoops Countdown Stat Finder

A tool that scrapes Sports-Reference College Basketball pages for BYU players/teams,
extracts stat facts, and matches them against a target "countdown number" to generate
social-media-ready suggestions (e.g. "62 days to #BYUHoops... shot 62% from three...").

## Goals

- Given a number `N`, return a ranked shortlist of real stats that equal (or round to) `N`,
  each with enough context to draft a tweet.
- Start with single-player, single-page lookups; grow to a full-roster crawl that proactively
  finds interesting matches for a given number across every player.
- Keep scraped data cached locally so matching is instant and repeatable without hammering
  Sports-Reference.
- Make matching thresholds/weights configurable data, not hardcoded logic, so a future
  lightweight UI can tune them live.

## Non-goals (for now)

- No auto-posting to social media — output is draft text for a human to review/edit.
- No full NLP generation — sentence drafts come from templates per stat category.
- No support for other schools/sports beyond BYU men's basketball initially (but data model
  should not make this hard to extend later).

---

## Architecture Overview

```
Sports-Reference pages
        |
   [Fetcher]  --cache-->  local HTML cache (durable, refreshed only on explicit trigger)
        |
   [Table Extractor]  -->  raw rows (handles HTML-comment-hidden tables)
        |
   [Fact Normalizer]  -->  flat "facts" store (JSON or SQLite)
        |
   [Derivation Engine]  -->  computed facts (window totals, threshold counts, streaks)
        |                    reads thresholds/config
   [Number Matcher]  -->  candidates for target N
        |
   [Ranker]  -->  top N candidates (reads config weights)
        |
   [Sentence Drafter]  -->  template-based draft text
        |
   CLI output (v1)  /  Lightweight UI (v2)
```

---

## Data Sources (per player)

| Page | URL pattern | Used for |
|---|---|---|
| Overview | `/cbb/players/{slug}.html` | career/season totals, per-game, advanced |
| Game log | `/cbb/players/{slug}/gamelog/{season}` | single-game stats (highs, streaks, thresholds) |
| Career splits | `/cbb/players/{slug}/splits/` | class-year and situational breakdowns |
| Season splits | `/cbb/players/{slug}/splits/{season}` | same, scoped to one year |
| Team page | `/cbb/schools/brigham-young/men/{season}.html` | roster (player links), team totals |

**Known gotcha:** Sports-Reference hides secondary tables inside HTML comments to keep them
out of the default page render. The table extractor must search comment nodes, not just the
visible DOM, or matching tables silently disappear.

**Caching philosophy:** most of this data is historical (past seasons, completed games) and
doesn't change once scraped. Cache is treated as durable, not TTL'd/auto-expiring — there's
no background job silently re-fetching pages. Updates only happen when explicitly triggered:
- Manually via a scraper script/command (`python refresh.py --player nate-pickens-1`,
  `python refresh.py --team --season 2026`, `python refresh.py --all`).
- Declaratively via the lightweight UI (a "Refresh" button/action, scoped to a player, the
  team, or everything) — see Phase 7.
- The only case that actually needs refreshing during a season is the **current season's**
  data (in-progress game log, updated season totals) — everything from prior completed
  seasons can be cached indefinitely once pulled.

---

## Data Model

### Facts (scraped/derived stat records)

```json
{
  "player": "Nate Pickens",
  "player_slug": "nate-pickens-1",
  "season": "2024-25",
  "game_date": "2025-01-18",
  "opponent": "Florida State",
  "stat_name": "STL",
  "stat_value": 4,
  "stat_type": "single_game | season_total | career_total | window_total | window_pct | threshold_count | streak | career_split",
  "context": {
    "class_year": "Sophomore",
    "result": "W",
    "split_category": null
  },
  "sample_size": null,
  "source": "gamelog | overview | splits",
  "scope": "player | team"
}
```

Team-level facts (from the team page's totals/splits/game log) use `scope: "team"` with
`player: null` / `player_slug: null`. This is what lets the matcher filter by scope without
guessing — `player` facts and `team` facts live in the same store, just tagged differently.

### Config (thresholds/weights — separate file/table, UI-editable)

```json
{
  "sample_size_minimums": {
    "3P%": { "min_attempts": 20, "attempt_col": "3PA" },
    "FG%": { "min_attempts": 50, "attempt_col": "FGA" },
    "FT%": { "min_attempts": 15, "attempt_col": "FTA" }
  },
  "threshold_game_levels": {
    "STL": [2, 3, 4],
    "BLK": [2, 3],
    "3P": [3, 4, 5]
  },
  "streak_conditions": [
    { "stat": "STL", "op": ">=", "value": 1 },
    { "stat": "3P", "op": ">=", "value": 1 },
    { "stat": "PTS", "op": ">=", "value": 10 }
  ],
  "windows": ["current_season", "last_2_seasons", "career"],
  "ranking_weights": {
    "active_roster_bonus": 10,
    "career_total_bonus": 5,
    "single_game_bonus": 4,
    "has_opponent_context_bonus": 2,
    "pct_below_min_sample_penalty": -100,
    "low_number_cutoff": 30,
    "low_number_bonus": 3,
    "high_number_bonus": 3
  },
  "max_suggestions_per_number": 5,
  "manual_refresh_only": true
}
```

**Why config is separate from facts:** facts are expensive to produce (scrape + parse) and
change on a scrape schedule; config is cheap to edit and should change interactively without
ever triggering a rescrape.

---

## Storage

- **v1:** flat JSON files — `cache/{player_slug}/*.html` (raw pages), `data/facts.json`
  (normalized facts), `config.json` (thresholds/weights). Simple, diffable, good enough for
  one team's roster.
- **v2 (if needed):** SQLite — `facts` table + `config` table (`key, value, sport, updated_at`).
  Natural migration once querying/filtering facts gets unwieldy in flat JSON, or once this
  extends to multiple teams/sports.

---

## Build Phases

### Phase 1 — Single-player fetch & extract (proof of concept)
- Fetcher with local caching + polite rate limiting.
- Table extractor that handles comment-hidden tables.
- Parse one player's overview + one season's game log into normalized facts.
- Output: dump facts to JSON, eyeball for correctness.

### Phase 2 — Full single-player pipeline
- Add career splits parsing.
- Add multi-season game log crawl (discover all seasons from overview page).
- Add derivation engine: window totals, percentage-with-sample-size, threshold-game counts,
  streaks — all reading from `config.json`.

### Phase 3 — Number matcher + ranker
- `find_matches(facts, target_number, scope)`.
- `rank_candidates(...)` using `ranking_weights` from config.
- No forced dedup across players — a single player can legitimately dominate the shortlist
  if their stats are the best matches. Instead, support a **scope/mode** parameter that
  controls *which facts are eligible to match in the first place*:
  - `player` — facts limited to one specified player (current single-player behavior).
  - `roster` — facts across every player individually (a match belongs to whichever player
    it came from; no cross-player aggregation).
  - `team` — facts scoped to team-level records only (team totals/splits/game log from the
    team page, not individual box scores).
  - `all` — union of `roster` + `team` facts, ranked together in one shortlist.
  - CLI/function signature: `find_matches(facts, target_number, scope="all")`.
- Ranking weights can optionally include a per-scope bonus/penalty later (e.g. slightly
  favor team-level stats when `scope=all`) but this isn't required for v1 — default is a
  single shared ranking pass regardless of scope mix.
- **Result count is a caller-supplied parameter, not a hardcoded cutoff.** `rank_candidates`
  always sorts the *entire* candidate list; how much of it gets returned is controlled
  separately:
  - `limit` — integer, defaults to `config.max_suggestions_per_number`.
  - `limit=None` / `--all` — return every match found, unranked-cutoff, full list.
  - This is deliberately also a debugging aid: if `--all` returns 40 candidates for one
    number, that's a signal the matcher/thresholds are too loose (e.g. sample-size minimums
    need tightening) well before it ever reaches sentence drafting.
  - Output should include a count summary regardless of limit (`"37 candidates found, showing
    top 5"`) so the truncation is always visible, not silent.

### Phase 4 — Sentence drafting
- Template-per-stat-type drafting function.
- CLI: `python suggest.py --number 62 --scope player --player nate-pickens-1` → single-player
  suggestions.
- CLI: `python suggest.py --number 62 --scope roster` → across every player individually.
- CLI: `python suggest.py --number 62 --scope team` → team-level records only.
- CLI: `python suggest.py --number 62 --scope all` (default) → everything, ranked together.
- CLI: `--limit 10` → override `config.max_suggestions_per_number` for this run.
- CLI: `--all` → skip truncation, return every candidate (debugging: spot overly loose
  thresholds when a number returns way more matches than could ever be useful).
- Always print the "N candidates found, showing top K" summary line, even at default limit.

### Phase 5 — Roster-wide crawl
- Parse team page roster into player slugs/URLs.
- Run Phase 1–4 pipeline across the full roster.
- Cache is durable by default — no automatic invalidation. Refreshing (whole roster, one
  player, or just the team page) is always an explicit action (`--force-refresh` flag on the
  manual scraper, or the UI's Refresh action from Phase 7).

### Phase 6 — Config-driven tuning
- Confirm every magic number in matcher/ranker reads from `config.json` (no hardcoding left).
- Add a `--explain` flag that prints why a candidate scored the way it did (which weights
  fired) — useful for tuning before a UI exists.

### Phase 7 — Lightweight UI (later)
- Simple local web UI (e.g. Flask/FastAPI + minimal frontend) that:
  - Edits `config.json` values via form controls (numeric inputs, tag lists, weight sliders).
  - Has a "preview" pane: enter a number, see ranked suggestions update live against cached
    facts as config changes.
  - Roster browser with explicit "Refresh" actions (per player, whole roster, or just team
    page) — this is a deliberate, declarative trigger, never an automatic background job.
- No auth/deployment concerns — local tool only, unless scope changes later.

---

## Open Questions / Decisions To Revisit

- Exact list of counting stats to track per game (PTS, TRB, AST, STL, BLK, 3P, 3PA, FG, FGA,
  FT, FTA — anything else worth pulling, e.g. TOV, PF?).
- How to infer "class year" per season reliably (Sports-Reference doesn't always label this
  cleanly — may need a small manual mapping per player).
- Whether percentage sample-size minimums should scale with season length vs. stay fixed.
- Respect Sports-Reference's current robots.txt/ToS before scaling up the roster-wide crawl;
  consider Stathead as an alternative data source if scraping volume becomes a concern.
- Do we want a "this day in BYU hoops history" fact type eventually (manual curation, not
  scraped) to mix in alongside generated stats?

---

## Tech Notes

- Language: Python (BeautifulSoup for HTML parsing, requests for fetching).
- No external DB dependency for v1 — plain JSON files under `data/` and `cache/`.
- Keep fetch/parse/derive/match/rank/draft as separate modules/functions from day one, even
  in v1, so the eventual UI can call into match/rank/draft directly against cached data
  without re-running scrape logic.
