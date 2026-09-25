# Repo reorganization notes

Written 2026-09-25 from a read-only look at the repo. Nothing has been moved yet.

## What's there now

| Path | What it actually is |
|---|---|
| `stat_explorer/` | The React app (CRA, port 4444). Its dev proxy also writes `src/assets/alum.js`. |
| `dataAggregators/` | Two things in one folder: the old Node lineup scripts (`seasonLineups.js`, `updateLineupsWithGame.js`, `modules/`, `data/`), and the new Postgres play-by-play pipeline (`db/`, `ingest/`, `config/`, `fixtures/`). |
| `countdown/` | The Python stat finder: scrapers, `finder/`, a small UI on port 8765, and 12 MB of cache plus 9 MB of data. |
| `server/` | A 2019-20 ticketing QR-code service (package name `TicketingQRCodeService`, Node 8, knex, canvas). The only hoopsKills part is `gameReader.js`, the 2021-22 kill-mapping prototype. |
| `image-uploader-lambda/` | A standalone AWS Lambda for alumni photos. |
| Root loose files | 6 generated player HTML pages, `ideas.md` (the kill and stop rules), `dataGuide.txt`, `gameCodes/`, `data/`, and a 2-line README. |

## Problems worth fixing regardless of layout

1. **`node_modules` is partly committed.** 24 files under `dataAggregators/node_modules` are tracked, because `.gitignore` only ignores a root-level `/node_modules/`. The `pg` install added more untracked ones.
2. **Duplicated code.** `dataAggregators/modules/{assetUrls,games,lineupUtils}.js` are diverged copies of `stat_explorer/src/...`. Not yet diffed to see which is current.
3. **`server/` is mostly dead.** Only `server/gameReader.js` reads `data/sampleGame.json`, and nothing else references `server/`. The ticketing parts (`server.js`, `knexfile.js`, migrations, `addNewUsers.js`, webpack, `package.json`) have nothing to do with this project.
4. **Generated pages at the root.** `countdown/career_page.py` writes the six player HTML files to `../`, which is the repo root.
5. **`gameCodes/`** is near-empty and unreferenced.

## Proposed layout

```
hoopsKills/
  README.md                  real one: what lives where, how to run each piece
  app/                       stat_explorer (renamed; later absorbs the countdown UI)
  pbp/                       Node + Postgres play-by-play (db, ingest, config, fixtures, later derivations/)
  lineups/                   the old dataAggregators scripts (seasonLineups, updateLineupsWithGame, data/)
  players/                   Python scrapers: countdown + player scrapes, with its own requirements.txt
    out/                     generated player pages (gitignored)
  lambdas/
    image-uploader/
  docs/
    pbp/                     the design brief, decisions, the recovered discussion notes
    kills/                   ideas.md + dataGuide.txt + gameReader.js (see below)
```

Each language stays in its own folder with its own dependency file. No workspace tooling, since Node and Python don't share a runtime.

## Decisions on the specific notes

- **countdown into `stat_explorer`:** fold the UI in, not the scrapers. The scrapers and `finder/` stay Python in `players/`. They keep writing `facts.json` and the app reads it, so no port is needed. The `server.py` UI can retire once the app has that view.
- **Player scrapes with countdown:** yes, that is what `players/` is.
- **`server/`:** delete the ticketing service and keep only the kill prototype. Move `gameReader.js`, `data/sampleGame.json` and `ideas.md` into `docs/kills/`, as reference for the dedicated possessions session. Everything else stays recoverable from git history.

## Suggested order

1. Fix `.gitignore` and untrack `node_modules`.
2. Retire `server/` and `gameCodes/`, and move the loose root files.
3. Rename `dataAggregators/` into `pbp/` and `lineups/`, then update `.claude/launch.json` and any relative paths (the countdown output path, the fixtures paths).
4. Only then look at the duplicated code in problem 2 above.

## Open questions before starting

- **Git:** use plain file moves and leave the staging to the user, or use `git mv`? No git commands unless asked.
- **Names:** are `app/`, `pbp/`, `lineups/` and `players/` right? `pbp/` versus `play-by-play/` is the least certain.
- **`countdown/cache`:** not yet checked whether it is tracked. Gitignore it if so.
