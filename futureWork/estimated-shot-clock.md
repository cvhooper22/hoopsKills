# Future work: possessions, chances, and estimated shot clock

Status: pinned, not started. Written 2026-09-25 from a design discussion plus a
read-only sensitivity check on the 3 games in the local pbp database (BYU vs
Villanova, at Dayton, at Kansas State; all WMT source).

## 1. Two possession counts

- **Possession (trip):** the traditional definition. A team's uninterrupted
  control of the ball. An offensive rebound, a non-shooting foul side-out, and
  non-final free throws all continue the same possession. Box-score estimate:
  `FGA - OREB + TOV + 0.44 * FTA`. Use this for ORtg / DRtg / pace so numbers
  compare with published ones.
- **Chance (Oliver's "play"):** an opportunity to score. Every offensive
  rebound starts a new chance. `Chances = Possessions + OREB`.
- Keep both, labeled. Chances separates conversion of each look from
  second-chance volume.
- Do not count deadball team rebounds after a non-final free throw miss
  (`play_subtype = 'deadball'`) as chances.

Measured on the 3 games (6 team-games): 441 possessions counted from events vs
437 from the formula (within 1%). 69 real offensive rebounds, so chances = 510,
about 16% more than possessions (~85 vs ~73.5 per team per game).

## 2. Foul resets (optional flag, low priority)

Idea: a non-shooting foul with under ~8 seconds on the shot clock counts as a
new chance. Not worth a default metric:

| Threshold | Qualifying fouls (3 games) |
|---|---|
| <= 6 s left | 0 |
| <= 8 s left | 2 |
| <= 10 s left | 5 |

That is about 1% of chances, and the count is unstable near the threshold.
Offer it as an off-by-default flag, threshold configurable. Rules vary by
level (NCAA resets to 20, NBA to 14, FIBA to 14).

## 3. Estimated shot clock (the main item)

`plays.shot_clock_seconds` exists in the schema (WMT only) but is empty for all
3 games. Estimate it from game-clock elapsed time since the last reset:

- Reset events: possession start (defensive rebound, steal, inbound after a
  made shot or turnover), offensive rebound, foul reset.
- Estimated on shot attempts first; that is what the target stats need.

Target stats, in order of reliability:
1. Distribution of when shots come (robust to +-1-2 s noise).
2. FG% by shot-clock bucket (use 0-5, 5-10, 10-20, 20+ left, not exact seconds).
3. Shot chart by shot-clock window (needs a full season; ~40 late-clock shots
   in 3 games is too thin).

Design notes:
- Add a **separate** column (e.g. `shot_clock_est`), never overwrite the real
  `shot_clock_seconds`.
- Add a confidence flag or method tag: possession start unknown (period start,
  held ball), missing events, estimate outside 0-30.
- It is a **derived** value: it depends on possession segmentation, so put it
  in the derived layer (alongside the planned `possessions` table, versioned
  through `derivation_runs`), not the normalized plays.
- Store **elapsed** since reset, not remaining. Elapsed is rule-independent;
  compute remaining at query time from the level's clock length (30 vs 35 vs
  24) and reset rules.
- Weak spots: whole-second timestamps, unrecorded resets (kicked ball, some
  fouls) which make the estimate read too late, delays after a rebound before
  the team has the ball.

## First steps when this is picked up

1. **Check raw WMT payloads** (`raw_payloads`) for a real shot-clock field the
   normalizer drops. If present, real data may replace the estimate for future
   games and can validate the estimate for these three.
2. Validate on known cases: the 2 `shotclock` turnovers should estimate near
   30 s elapsed; no estimate should exceed 30.
3. Decide the derived-table shape (`possessions` with chance segments, plus the
   estimate) and add it as a migration after `002_player_images.sql`.

## Scratch code

The exploratory script (read-only queries plus Python) was not saved to the
repo. Its rules: track possession owner from defensive rebound, steal, made
final shot or free throw, and turnover; reset the estimated clock to
`max(remaining, 20)` on offensive rebounds and non-shooting defensive fouls
without free throws; skip `deadball` rebounds; flag possessions still open at
period end.
