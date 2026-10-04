# Future work: collect and share (cart -> /collection -> PNG export)

Status: paused after the pilot, behind the `collection` feature flag. Written 2026-10-01.
Nothing here is committed yet as of writing; check `git log` before assuming.

Idea: every table / KPI can be added to a cart, and a `/collection` page re-renders the
collected items and exports them as PNGs for social media. All code lives in `stat_explorer/`.

## What exists (the pilot)

- **Feature flag** (`constants/featureFlags.js`, `utils/featureFlags.js`,
  `contexts/FeatureFlagsContext.js`). Resolution order: personal `?ff=collection` override
  (localStorage; `?ff=-collection` off, `?ff=clear` reset) > runtime `data/flags.json` on the
  data CloudFront > build-time `REACT_APP_FF_COLLECTION` > off. Fails closed.
  - `flags.json` does not exist yet (the fetch 403s, harmlessly). To turn the feature on in
    prod, upload `{"collection": true}` to `data/flags.json` in the data bucket.
  - Set `REACT_APP_FF_COLLECTION=true` in `.env.local` for local dev (example file updated).
- **Cart** (`utils/collection.js`, `contexts/CollectionContext.js`). Item =
  `{id, type, gameId, params, title, subtitle, snapshot, savedAt}`. The id is derived from
  type + game + params, so the same view collects once. Stored in localStorage
  (`collection`), versioned (`COLLECTION_VERSION`), capped at 24 items, synced across tabs.
  Inert while the flag is off.
- **Registry** (`collection/registry.js`): maps item `type` -> `render(item)` + `exportWidth`.
  Types so far: `kpi-flip`, `kills-table`.
- **`Collectable`** (`components/Collectable/`): wraps a component with the add/remove button;
  renders children untouched when the flag is off or in export mode. `RenderBoundary` keeps a
  stale snapshot from crashing the page.
- **Wrapped so far:** the five `FlipPad` KPI tiles in `views/Kills/KillsHeader.js` and
  `views/Kills/KillsTable.js` (which passes its own current sort, so no state lifting was needed).
- **`/collection` page** (`views/Collection/`): lazy-loaded; route + nav item (with count badge)
  only registered while the flag is on. Shape selector (Fit, 1:1, 4:5, 16:9; remembered),
  per-card Download PNG / Copy / Share, Download all.
- **Export** (`components/ExportCard/`, `utils/exportImage.js`, `utils/exportStage.js`,
  `constants/exportRatios.js`; dependency `html-to-image`). Fixed-width frame with caption and
  site footer on a white canvas of the chosen ratio; output at least 1080px wide.
- **`FlipPad`** takes an optional `seed` so ring tilts are identical on every render.
- Unit tests: 23 passing in `src/utils/*.test.js`. `App.test.js` is the old CRA template
  and was already failing before this work (d3 ESM import).

## Remaining work

1. **Roll `Collectable` out to everything else.** Each new type needs: a wrapper with a
   descriptor whose snapshot is exactly what its renderer needs, a registry entry, and an
   `exportMode` prop (no tooltips / legend / sorting / scroll wrapper).
   - Kills: `StreaksTable`, `RhythmMix` (Time between kills, Stop mix, credited players),
     the per-half table in `KillsHeader`.
   - Clutch: `ClutchTable` (per team; has a sticky first column and a scroll wrapper),
     `ClutchStretches` / `StretchDetail`, `TopPerformers`, `ClutchHeader` KPIs, `MarginChart`
     (d3 chart).
   - Lineups: `LineupTable` / `LineupRow` / `LineupStints` and `SeasonLineupTable` (built
     from divs, not `<table>`), `LineupSummary` / `SeasonLineupSummary`.
   - Alumni: `AlumniCard` (flip card; photos are from many hosts, see CORS below).
2. **Make sort/filter state restorable.** Kills and Clutch tables keep sort in local
   `useState`; Lineups keeps `filterPlayers` and sort in `useState` too. Add an `initialSort`
   style prop (as `KillsTable` now has) and move Lineups filters into URL params, as Clutch
   already does with `?min=&margin=&view=`.
3. **"Open in context" link** on each collected card, using the stored `gameId` + `params`
   to deep link back to the live view.
4. **CORS for player and alumni photos.** Export fails or taints if an `<img>` is cross-origin
   without CORS headers. Known: CloudFront (logos, most alumni), flagcdn are fine. Untested:
   ESPN headshots (`a.espncdn.com`, only checked with a dummy id) and the other alumni hosts
   (bleague.jp, clupik.com, wikimedia, basket.co.il, aekbc.gr, bristolflyers, riders.basketball,
   storage.googleapis.com). Set `crossOrigin="anonymous"` on export-time images, and add a
   proxy or a placeholder fallback for hosts that refuse. Needed before collecting anything
   with photos.
5. **localStorage quota.** Writes fail silently when the quota is hit (`setStorageItem` only
   logs). Real snapshots are small (3 items ~ 8 KB) but charts or many items could grow;
   surface a visible "couldn't save" message.
6. **Shared fetch cache** (small): each view refetches game JSON on every mount; only matters
   for "open in context" and any future collection that fetches.
7. **Tests.** Add tests for the registry adapters, `Collectable`, and the context (needs a
   working Jest setup for d3 ESM or mocks), and a Playwright script for PNG fidelity.
8. **Mobile polish.** Nav badge and add-button placement on narrow screens (the top bar hides
   on scroll); verify the Share button on real iOS / Android.
9. **Release.** When ready: upload `flags.json`, then delete the `collection` flag and its
   dead branches (`FLAGS`, `useFlag` gating in `App.js`, the `enabled` checks in
   `CollectionContext` / `Collectable`).

## Gotchas learned (save the next person the debugging)

- **Google Fonts must be inlined by hand.** `html-to-image` can't read cross-origin
  stylesheets, so `utils/exportImage.js` fetches the font CSS, keeps the latin and latin-ext
  subsets, and embeds the files as data URLs. The Material Symbols icon font is served as
  `text/html`, which makes an unusable data URL; the code forces `font/woff2`. Without that,
  icons export as their ligature names ("shield").
- **Adding a new Material Symbols icon** still needs its name added to the `icon_names` list in
  `public/index.html` (the font is a subset). The export code picks it up automatically.
- **Don't verify exports in the built-in preview pane.** It reports `visibilityState: hidden`
  and image rendering never finishes. Use Playwright or a real browser.
- **A snapshot is what the renderer needs, nothing more.** Changing a renderer's props
  incompatibly means bumping `COLLECTION_VERSION` (old carts are dropped, not migrated).
- **Collected-state is keyed to game + params**, so a KPI whose value later changes still
  shows as collected with its old snapshot.
- **The footer shows `window.location.host`.** That reads `localhost:4444` in dev, which is
  expected.
