# Kills view: design handoff

For the BYU Hoops Stats app (`stat_explorer/`, React, CRA). This covers what the data is and what I want the view to show. A rough preview exists at `/kills` (`src/views/Kills/Kills.js`); replace it freely. Rules are in `kills-rules.md`.

## What a "kill" is, in one paragraph

A **stop** is a BYU defensive possession that ends with no opponent points (defensive rebound, opponent turnover, steal, charge). A **streak** is consecutive stops with no opponent points in between. Every 3 stops in a streak is a **kill**. A leftover 2 is a **potential kill** (PK). **Completion %** = kills / (kills + PKs that never became kills). The point of the page is to show how often BYU strings stops together, how close it came when it didn't, and what broke each streak.

## Audience and use

BYU basketball fans and the person running the site. It is a stats page, not a game tracker: one game at a time first, season rollup later. Sits beside the Lineups and Clutch views, which use the same blue theme (`--lightest-blue`, `--blue-stop-3`, `--secondary-text`, `--app-bg`) and summary-card patterns (see `Clutch.css`).

## Data available per game

From `detectKills(plays, defenseSide)` in `src/utils/kills.js`. Three games exist so far (Villanova, Dayton, Kansas St.); BYU is home in the first and away in the other two.

**Game summary**
- kills (pure vs dirty), unconverted potential kills, completion %, total stops (dirty count)
- everything above split by half

**Streak** (only streaks of 2 or more matter)
- length, its stops, its kills, its potential kill (if any)
- **breaker:** the opponent scoring play that ended it: game clock, period, score margin, and causes

**Kill**
- 3 stops, start (first stop's clock, period, BYU margin), end (breaker's clock), duration in seconds
- **pure or dirty** (dirty if any stop in it is dirty)
- tags: **critical** (score within 5 when it starts), **clutch** (2 or 3 of its stops in the last 5 minutes with score within 5) / **clutch-adjacent** (1 of 3), **garbage** (lead of 15 or more, under 8 minutes left)

**Stop**
- clock, period, score margin at that moment
- type: `rebound`, `turnover`, `steal`, `charge`, `tie_up`, `block`
- **credited player** for steals and blocks only (rebounders are never credited; charges and tie-ups have no player of their own)
- **dirty**, with a reason: `offensive_rebound` (the opponent had one in that possession) or `empty_ft_trip` (they missed every free throw)
- **late** flag if under 5 seconds left in the period

**Breaker**
- cause: `second_chance`, `foul` (with the fouling BYU player), or plain make
- **avoidable** = second-chance or foul; a plain make is not

## What I want to show (priority order)

1. **Header summary:** kills, potential kills, completion %, stops. Pure vs dirty split.
2. **Timeline of the game** (strongest idea): a horizontal game timeline, 2 halves, with stops as marks, streaks grouped, and kills highlighted. The breaker (opponent bucket) marks each streak's end. Show it so clutch and critical stretches are visible.
3. **Kill cards or rows:** start and end time, duration, margin at start, pure/dirty, critical/clutch/garbage tags, and who got credit (steals, blocks).
4. **Breakers breakdown:** for streaks of 2 or more, what stopped them and whether it was avoidable. Highlight the avoidable ones (offensive rebounds, fouls) and name the fouler. This is the "how close were we, and what cost us" story.
5. **Gaps:** time between kills, average, longest and shortest. Kill start to breaker times.
6. **Stop mix:** how many stops were steals, blocks, charges, turnovers, rebounds.

## Not defined yet (please design around it, don't invent numbers)

- "Efficiency" labels from my notes: positive, negative, no gain, clean, dirty. Only pure/dirty exist so far.
- Margin before and after each kill.
- Season rollup and per-player credit totals.
- "Quick points" and "impact steals" (steals leading to points within about 7 seconds), and "critical turnovers".
- The halftime rule ("not a kill if too close to halftime") is deliberately deferred.

## Real numbers to design against (Villanova at BYU, 2025-11-03, BYU home)

- 40 stops, 5 dirty. 6 kills (3 pure, 3 dirty). 5 unconverted potential kills. Completion 55%.
- First half: 3 kills, 2 PKs. Second half: 3 kills, 3 PKs.
- Longest streak: 8 stops in the first half (2 kills + 1 PK), from 15:30 to 11:04, broken by a second-chance make.
- Second half: two back-to-back **critical + clutch** kills (4:33 and 2:59 left, BYU up 2 and 4).
- Credited steals: Saunders x2, Keita, Wright. Credited blocks: Boskovic, Keita. One charge.
- One streak ended on a foul, credited to Saunders.

## Constraints

- Desktop-first, like the rest of the app. Data is static JSON per game, loaded client-side.
- Dev-only admin pages (`/admin/stops`) are separate and not part of this handoff.
