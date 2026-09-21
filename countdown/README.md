# BYU Hoops Countdown — stat finder

Scrapes Sports-Reference college-basketball pages for BYU players, normalizes the
numbers into a flat "facts" store, and (later phases) matches those facts against
a target countdown number to draft social posts.

Full design: `../countdownPlan.md` (or wherever `countdownPlan.md` lives).

## Status

| Phase | State |
|---|---|
| 1 — single-player fetch & extract | done |
| 2 — full single-player pipeline (splits, multi-season crawl, derivation engine) | done, with one caveat (see Splits) |
| 3 — number matcher + ranker | done |
| 4 — sentence drafting (`suggest.py`) | done |
| 5 — roster-wide crawl | done |
| 6 — config-driven tuning (`--explain`, no hardcoded knobs) | done |
| 7 — lightweight local UI (`server.py`) | done |

## Setup

```bash
python3 -m pip install -r requirements.txt
```

(`python3` on this machine — there is no `python`.)

## Usage

```bash
# one player, latest season only
python3 refresh.py --player richie-saunders-1

# specific season(s) — end-year, so 2025 == the 2024-25 season (repeatable)
python3 refresh.py --player richie-saunders-1 --season 2025 --season 2024

# every season on the player's overview page
python3 refresh.py --player richie-saunders-1 --all-seasons

# several players by slug
python3 refresh.py --players robert-wright-3 nate-pickens-1 --all-seasons

# resolve names off a team's roster page, add extra slugs for players whose
# SR page still lists a previous school (transfers in)
python3 refresh.py --roster-season 2026 \
    --names "Robert Wright" "Dawson Baker" --players tyler-betsey-1 jake-wahlin-1 \
    --all-seasons

# the whole roster for a season
python3 refresh.py --roster-season 2026 --all-seasons

# other flags
python3 refresh.py --player richie-saunders-1 --force-refresh   # ignore the cache
python3 refresh.py --player richie-saunders-1 --no-derive       # scraped facts only
python3 refresh.py --roster-season 2026 --school houston --all-seasons  # non-BYU school
```

Output: `data/facts.json` (normalized + derived facts, sorted, diffable) and,
when `--roster-season` is used, `data/roster.json` (who counts as "active" for
`active_roster_bonus` — merged across runs, so refreshing a subset never drops
players). Raw HTML lands in `cache/{slug}/…` (and `cache/_teams/…`), git-ignored.

`--roster-season` also ingests team season totals from the team page as
`scope: "team"` facts (`source: "team_page"`), which is what `--scope team` /
`--scope all` match against.

### Players with no Sports-Reference page (eurobasket.com)

Some players — overseas recruits, national-team youth events — only have a
[eurobasket.com](https://www.eurobasket.com) / usbasket.com profile. A second
entrypoint, `eurobasket_refresh.py`, parses that page shape (see
`buikaEurobasket.html` for the reference) and merges `source: "eurobasket"`
facts into the same `data/facts.json`.

```bash
# one or more players by profile URL
python3 eurobasket_refresh.py \
    --url "https://www.eurobasket.com/player/Dovydas-Buika/660337" \
    --url "https://www.eurobasket.com/player/Some-Other/123456"

# parse a hand-saved page / fragment (only if the site starts gating)
python3 eurobasket_refresh.py --html buikaEurobasket.html \
    --url "https://www.eurobasket.com/player/Dovydas-Buika/660337"

# align the slug with the player's SR slug so both sources merge under one player
python3 eurobasket_refresh.py --url "<profile url>" --slug dovydas-buika-1
```

The initial page only carries the current season; the scraper also calls
eurobasket's `PlayerStatsAjax` endpoint once per past season the page lists and
concatenates everything (overlapping blocks are de-duped), so one `--url` gets
the player's full eurobasket-tracked history.

What it emits (same stat vocabulary as the SR path, so it ranks/drafts the same):

- `season_total` — one row per season **per competition**, summed across any
  clubs the player played for that year. The competition is folded into the
  `season` label (`"2025-26 (Lithuania-LKL)"`) since two leagues can share a year.
- `career_total` — summed across every season/competition (only emitted for a
  genuine multi-season history); `context` flags it covers eurobasket-tracked
  competitions only.
- `window_pct` — FG% / 2P% / 3P% / FT% / eFG% per season and career, recomputed
  from summed makes/attempts (`sample_size` = attempts).
- `single_game` — one row per stat per game in the "Details" tables, with
  opponent + date.

Raw HTML / AJAX fragments land in `cache/_eurobasket/…`, git-ignored. Minutes and
eurobasket's `RNK` efficiency index are intentionally dropped (noise for the
number matcher). Identical stat lines eurobasket repeats under several youth-event
labels are counted once.

`career_page.py` renders one player's full history (from the cached fragments) to
two standalone HTML pages — `<name>-career.html` (bio, career totals, per-game
highs, season-by-season, recent games) and a sibling `<name>-games.html` (every
game pulled, sortable columns, season dividers, tick rows or a whole season to
total them). The career page links to the games page.

```bash
python3 eurobasket_refresh.py --url "<profile url>"          # populate the cache
python3 career_page.py --slug jakub-urbaniak --out jakub-urbaniak-career.html
```

### Suggesting posts for a number

```bash
python3 suggest.py --number 62                                  # all scopes, ranked together
python3 suggest.py --number 62 --scope player --player richie-saunders-1
python3 suggest.py --number 62 --scope roster                   # every player, individually
python3 suggest.py --number 62 --scope team                     # team-level facts only
python3 suggest.py --number 62 --limit 10                       # override config default
python3 suggest.py --number 62 --all                            # no truncation (debugging)
python3 suggest.py --number 62 --explain                        # show which weights fired
```

Output is one template-drafted line per candidate — **draft text for a human to
review/edit**, nothing is posted. Templates are one per `stat_type` (further
split counting-stat vs percentage) in `finder/draft.py`; the lead
(`"{n} days to #BYUHoops — "`) and team name are in `config.draft`.

`--all` returning 40 candidates for one number is the intended signal that
thresholds/sample-minimums are too loose — spot it before drafting matters.
`finder/match.py` also has a lower-level CLI (`python3 -m finder.match …`) that
prints facts without drafting.

**Matching:** counting stats match `N` exactly; percentages match within
`config.scoring.pct_match_tolerance` (0.5 = normal rounding), tagged `[rounded]`.

**Ranking:** `active_roster_bonus` (on `data/roster.json`, else "has a
current-season fact"), `career_total_bonus`, `single_game_bonus`,
`has_opponent_context_bonus`, `pct_below_min_sample_penalty`, and a low/high-`N`
framing bonus (small `N` favours single-game/streak/threshold facts, large `N`
favours cumulative totals — the `_stat_types` lists in `config.scoring` decide
which is which). See the tuning table below; `--explain` shows what fired.

### Web UI

```bash
python3 server.py      # http://127.0.0.1:8765
```

Stdlib only (`http.server`), localhost, no auth. One page ([ui/index.html](ui/index.html)),
vanilla JS. Three panes:

- **Preview** — number / scope / player / limit / show-all / explain; re-runs
  `rank_candidates` + drafting **live as you edit the config** (the in-form config
  is sent with each request; nothing is written until you Save).
- **Config** — number inputs for the common weights + a raw `config.json`
  textarea for everything else; *Save to disk* / *Reload from disk*.
- **Roster** — per-player fact counts + active dot, a *↻* per player, plus
  *Refresh team page* and *Refresh whole roster* (refreshes the tracked players
  from `data/roster.json`, not the entire 17-man roster). Season / all-seasons /
  force controls. Scrape output streams into a log box.

Saving from the UI reformats `config.json` (one array element per line) — the
content is identical, it's just `json.dumps(indent=2)`.

```bash
python3 -m unittest discover -s tests
```

## How it fits together

```
refresh.py            run_refresh() — Sports-Reference, shared by the CLI and the UI
eurobasket_refresh.py eurobasket.com / usbasket.com profile pages -> the same facts.json
server.py    stdlib http.server: serves ui/index.html + /api/{config,suggest,roster,refresh}
  └─ finder/fetcher.py     fetch pages (SR or eurobasket), durable on-disk cache, rate limiting
  └─ finder/eurobasket.py  parse a eurobasket.com/usbasket.com profile -> Fact records
  └─ finder/extractor.py   parse tables by data-stat attr; un-hides comment tables; reads tfoot
  └─ finder/normalizer.py  raw rows -> Fact records (totals, %s, single games, splits)
  └─ finder/derive.py      config-driven derived Facts (windows, thresholds, streaks, splits)
  └─ finder/match.py       find_matches() + rank_candidates() — number -> ranked shortlist
  └─ finder/draft.py       template-per-stat_type -> draft post text
  └─ finder/roster.py      team page -> player slugs, team totals, active-roster file
  └─ finder/models.py      Fact shape + FactStore (merge-by-identity, JSON persistence)
  └─ finder/config.py      loads config.json
```

Modules are kept independent on purpose: a future UI can call
match/rank/draft directly against `data/facts.json` without re-running any scrape.

### Fact types in `data/facts.json`

`single_game`, `season_total`, `career_total` — straight from SR tables
(`source: overview` / `gamelog`) or from a eurobasket.com profile
(`source: eurobasket`, plus `window_pct` for that source's shooting splits).
`career_split` — from a hand-saved splits page (`source: splits`) or rebuilt from
the game log (`source: derived`); see below.
`window_total`, `window_pct`, `threshold_count`, `streak` — computed by the
derivation engine from the game log (`source: derived`), all driven by
`config.json` (`windows`, `threshold_game_levels`, `streak_conditions`,
`sample_size_minimums`).

## Tuning — everything lives in `config.json`

No matcher/ranker/derivation number is hardcoded; edit `config.json` and re-run
`suggest.py` (no rescrape needed). `suggest.py --explain` shows which weights
fired for each candidate.

| block | controls |
|---|---|
| `ranking_weights` | bonus/penalty amounts + `low_number_cutoff` |
| `scoring.pct_match_tolerance` | how close a percentage must be to `N` (0.5 = normal rounding) |
| `scoring.*_stat_types` | which `stat_type`s each bonus applies to |
| `scoring.opponent_context_split_prefixes` | which split categories count as "opponent context" |
| `sample_size_minimums` | attempt floors for `%` facts (`default` covers stats with no explicit rule) |
| `threshold_game_levels` | which `STAT >= level` game-counts the derivation engine emits |
| `streak_conditions` + `streak_min_length` | which streaks it tracks and the shortest one worth recording |
| `windows` | which windows (`current_season` / `last_2_seasons` / `career`) get totals & streaks |
| `derived_split_stats` | which stats the game-log split rebuild emits |
| `splits.min_games` | drop saved-splits rows below this game count |
| `max_suggestions_per_number` | default `--limit` |
| `draft.lead` / `draft.team_name` | the post lead line and team label |

Only `_tiebreak` / `_SOURCE_RANK` in `match.py` stay in code — they just order
equal-scored candidates for display (exact before rounded, scraped before
derived) and aren't a tuning surface.

## Caching philosophy

The cache is **durable**, not TTL'd. Nothing re-fetches on its own — a page
already in `cache/` is reused until you pass `--force`. Only the current season's
pages ever need refreshing mid-season.

## Splits — hand-saved, not scraped

The SR splits page (`/cbb/players/{slug}/splits/` and `/splits/{year}`) sits
behind a Cloudflare "verify you are human" challenge — year-scoped URLs included.
We don't click through bot checks, so splits come in two ways:

1. **You save the HTML.** Open a splits page in your own browser, "Save Page"
   (full HTML is all that's needed — the `<table id="splits">` is in the live
   DOM, not a comment), and drop it in `cache/{slug}/`:
   - `cache/{slug}/splits_totals.html` — the **career** splits page
   - `cache/{slug}/splits_totals_<YYYY>.html` — the splits page for that season
     (`<YYYY>` = end year, so `2026` = 2025-26)
   - files with `per_game` in the name are ignored (totals are all we need)

   `refresh.py` picks these up automatically on the next run and emits
   `career_split` facts (source `"splits"`) for Location, Month, Game Type,
   vs. Conf, **vs. Team**, Game Result, Role. `config.splits.min_games` drops
   thin rows (default 2 — kills one-off opponents in vs. Team).

2. **Derived from the game log** (always, no file needed): class-year splits, and
   — when no saved splits file exists — home/away and win/loss too. Tagged
   source `"derived"`.

Not available either way: "vs. AP-ranked" (no opponent rank in the player game
log). Revisit if SR drops the challenge or a Stathead export shows up.

## Open items

- Verify against SR robots.txt / ToS before the Phase 5 roster-wide crawl.
- `class_year` is read from the SR season row's `class` cell — spot-check for
  players SR labels inconsistently.
- Consider whether `%` sample-size minimums should scale with season length.
