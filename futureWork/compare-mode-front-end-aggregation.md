# Future work: front-end aggregation for the Box score compare mode

Status: pinned, not started. Written 2026-11-05 from a design discussion (no code changed).
Source of the numbers below: `dataAggregators/derivations/game-box-prototype.js` and the
box JSON in `stat_explorer/public/data/box/`.

## Context

The plan is one global compare mode (A vs B slices, by lineup or by stint) that filters the
Box score tab and the Shot chart tab, replacing the Lineup compare, Stint Compare and Shot
chart compare tabs. Lineup timeline, Event timeline and Find plays stay as tabs. Compare
state lives in a context at the `Box` shell, with a pill in the tab bar and a sidebar
(desktop) or full-screen sheet (mobile) to edit it.

## Decision for now

Sections of the Box score tab whose numbers come from the Node-side precomputed `data.*`
aggregates cannot be sliced in the browser yet. While a compare is active they are grayed
out and show **"Not currently available in compare"**:

- Havoc and squeeze
- Possession value
- At the line
- The credit buckets in the player box (assisted, putback, early, self-created)
- Anything else that reads `data.havoc`, `data.E`, `data.line` or `data.battle` directly

Compare-aware sections (built from `data.plays` / `data.events` with the existing
`summarize`, `eventLines`, `playerContext`): Totals, Shooting, Chance margins, Rebounding,
Player box, Shot chart.

## Future work: compute the grayed-out sections in the browser

What it would take, from reading `computeBox`:

1. Extract the pure part of the generator (`segment`, `labelPlays`, and the aggregation
   code in `computeBox`) into a module shared by Node and the browser. Verify the Node
   output stays byte-identical. Check CommonJS vs ES module format first.
2. Ship raw events in the box JSON (`sn`, assist/block links, lineups). The current
   `data.plays` is a flattened summary with no event indices or steal-to-possession links.
3. Segment once over the whole game, then filter possessions, plays and events by the
   slice. Never segment only the slice's events: possession boundaries depend on neighbors.
   Keep cross-references (next possession after a steal, rest of possession after an
   offensive rebound) pointing at the full, unfiltered objects.
4. Add a browser entry point that takes a slice and returns the same shape `BoxBody`
   consumes, then turn sections on one at a time.

Effort by section: Chance margins, Offensive summary, Shooting and Extras are easy (plays
only). At the line, Possession value, Havoc and squeeze, and the player credit buckets are
moderate; havoc and squeeze is the fiddliest. EPA, WPA and the free-throw WP cost need the
win-probability model and the league rim percentage, so they stay out (they are hidden
today anyway).

Open problems to settle when this is picked up:

- **Side ownership:** havoc is credited to the defense, so a lineup slice has to include
  the opponent's possessions while that lineup defends (`lineupSplit` does this for
  offense and defense).
- **Small samples:** `E.live` shrinks toward the team's PPP with `SHRINK_K`; inside a
  slice it should shrink toward the whole-game number. Keep the "never a rate under
  MIN_N_FOR_RATE" convention.
- **Events crossing the slice edge:** attribute by the event's time and say so in a footer.
- **Squeeze timing:** uses the estimated shot-clock constants in `data.params`; verify
  against the Node output first. See `estimated-shot-clock.md`.
- **Checks:** the identity checks only make sense on the full game; skip them on slices.

## Cost (estimates, not benchmarks)

- Compute: ~500 events and ~180 plays per game. Segmenting is the only roughly O(n²) part
  (whole-array scans in `hasLiveSteal`, `pairedTO`, havoc). Estimated a few ms on desktop
  and 10 to 30 ms on a low-end phone. Segment once per game in `useMemo`, aggregate per
  slice, debounce while dragging, memoize slices by a stable key. Web Worker only if a
  throttled-CPU profile (6x slowdown) shows a problem.
- Load: the UNLV box file is 180 KB raw, ~16 KB gzipped (`plays` 83 KB, `events` 83 KB,
  `players` 26 KB). Raw events add roughly 10 to 30 KB raw. `plays` could drop its
  repeated `lu` name arrays to offset that.
- Season or multi-game compare is a different problem: 30 games is ~5 MB raw and 30
  fetches. `combineBoxes` avoids that by summing precomputed totals, so a multi-game slice
  would need precomputed per-game aggregates by lineup.
- Mobile DOM cost (13-column player tables, SVG shot charts) is likely larger than the math.
  Profile on a mid-range phone before shipping.
- Live games: memoize segmentation on event count so it does not re-run every render.
