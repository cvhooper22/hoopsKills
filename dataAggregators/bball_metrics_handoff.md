# Handoff: Possession-Level Metrics and an Enhanced Box Score from Play-by-Play

## 0. Purpose and context

You have access to normalized play-by-play (PBP) data for BYU men's basketball games (and possibly opponents/other D-I games). Build the metric families below, validate them against hand-tracked numbers, and produce tables, an enhanced box score per game, and a short findings report.

The end goal: a **new game box score** that goes beyond traditional and standard advanced stats and explains what actually happened in a game, what went right and what went wrong.

1. **Defense split: first-shot / set half-court / second-chance / transition.** The question behind this: was BYU playing solid half-court defense that was hidden by giving up offensive rebounds (and transition)?
2. **Possession value (possessions created, then points added).** Credit players for plays that win or lose possessions (steals, offensive rebounds, charges drawn, recovered blocks, turnovers), first as a count, then valued in expected points.
3. **Win probability (WP) and win probability added (WPA).** A simple, transparent in-game WP model, used to weight the possession-value events by game situation.
4. **Situational offense: quick points off makes and after-timeout (ATO) play.** How often and how well a team scores right after the opponent makes a basket, and on designed plays out of timeouts.
5. **Enhanced player box score.** Scoring broken down by how points were created, plus the points a player's turnovers, steals, rebounds, and fouls led to, and what missed free throws actually cost.
6. **Game box score.** Ties everything together, led by a breakdown of the final margin by where points came from.

The user built early versions of #1 and #2 by hand in spreadsheets. Their hand-tracked numbers are in §10 for validation. Several formula issues were found in those sheets; the definitions below are the corrected versions. Follow these definitions rather than reverse-engineering the old sheets.

Everything is computed for **both teams** in every game: BYU's offense and BYU's defense (the opponent's offense).

---

## 1. Required fields and mapping

Map your normalized schema to these concepts. If any are missing or unreliable, say so in the report and describe the fallback you used. Don't guess silently.

| Concept | Needed for | Notes |
|---|---|---|
| `game_id`, `game_date`, home/away (or neutral) | all | Neutral-site flag matters for WP (§5). |
| `period`, `clock_seconds_remaining` | all | Convert any `MM:SS` or `HH:MM:SS`-style clock to seconds remaining in the period. |
| event sequence / order | all | Use the source's sequence number; never sort by clock alone (ties are common). |
| `team_id` of the acting team | all | Some events are team-neutral (timeouts, jump ball, period end). Tolerate null. |
| `player_id`, player name | §4 | Team-credited events use a synthetic "TEAM" player in some feeds; don't treat it as a player. |
| event type + subtype | all | Need: FG attempt (2/3), FT attempt (with "n of m" if available), off/def rebound, turnover (+ subtype), steal, block, foul (+ type: personal/shooting/offensive), substitution, timeout, period start/end. |
| made/missed flag | all | If no explicit flag, infer from score change or text. Document which. |
| running score after event | all | Used for points attribution and as a cross-check. |
| assist link (which shot an assist belongs to) | §7 | Required for assisted vs. self-created scoring. WMT links it directly (`play_by_play_id`); NCAA puts the assist on the next row at the same clock; ESPN embeds it in the shot's text. |
| timeouts, with which team called them (or media/official) | §6 | Required for ATO. |
| shot subtype or distance | §7, §8 | Needed to identify rim attempts (layup, dunk, tip, or a short distance). |
| qualifiers (`fastbreak`, `2ndchance`, `fromturnover`) | §2 | If present (e.g. WMT feed), use them to cross-check your own classification. |
| on-court lineups | optional | Enables on/off (§7) and lineup splits (§9). |
| source win probability per play | optional | Used only to sanity-check §5 (ESPN provides one). |

Source quirks the user has already documented (handle defensively if your normalized data came from these):
- **ESPN:** shot type names don't indicate make/miss; free throws use the type "MadeFreeThrow" for misses too; some plays are missing `team`.
- **NCAA:** no event-type code at all (text only); assists are separate rows; non-ASCII names are mojibake'd.
- **WMT:** has a real two-level type taxonomy, an explicit `play_successful` flag, qualifiers, inline lineups, and shot clock. Its `play_time` looks like `HH:MM:SS` but means `MM:SS`.

---

## 2. Core build: possession and play segmentation

Everything downstream depends on this layer. Build it once as an audit table: one row per play, with possession id, play id, team, start type, start time, end time, end reason, points.

### 2.1 Definitions

- **Possession:** a continuous stretch of one team having the ball. It ends on a made FG (unless free throws are pending), a defensive rebound, a turnover, the end of a free-throw trip (made last FT, or a missed last FT the defense rebounds), or the end of the period. An offensive rebound does **not** end a possession.
- **Play:** a single chance to score within a possession. A possession's first play starts with the possession. **Each offensive rebound starts a new play inside the same possession.** A play ends on a shot, turnover, or free-throw trip.
- Plays per possession is about 1.15 for a typical D-I team.

### 2.2 Edge cases

- **And-ones:** the made FG and its free throw are one play.
- **Free-throw trips:** a shooting foul ends the play. Points from the trip belong to that play.
- **Missed non-final FT:** the "dead-ball team rebound" after a missed first FT of two is not a rebound and doesn't start a play.
- **Missed final FT:** the possession continues if the offense gets the rebound (new play); otherwise it ends.
- **Non-shooting fouls in the bonus:** the resulting FT trip ends the play.
- **Offensive fouls / charges:** count as a turnover ending the possession.
- **Jump balls / held balls:** award the possession per the alternating-possession result in the data.
- **End of period with the ball:** the possession ends with 0 points.

### 2.3 Labels for each play's start (mutually exclusive)

Every play gets exactly one label. Points always belong to the play they were scored on, so nothing is double-counted.

| Label | Definition |
|---|---|
| `transition` | First play of a possession that started after a live-ball turnover or a defensive rebound, **and** the play ends (shot, shooting foul, or turnover) within `TRANSITION_WINDOW_SEC` of the possession starting. If the source has a `fastbreak` qualifier, report agreement between it and your classification. |
| `initial_halfcourt` | The first play of any possession that isn't `transition`. Includes possessions after made baskets, dead balls, and timeouts. |
| `quick_putback` | A play starting from an offensive rebound that ends within `QUICK_WINDOW_SEC` of the rebound. Includes tip-ins and scramble kick-out threes. Based on Haslametrics' "potential quick points off second chances" idea. |
| `reset` | A play starting from an offensive rebound that lasts longer than `QUICK_WINDOW_SEC` (the offense pulled it out and the defense got set again). |

Also label how each possession started: `after_made_FG`, `after_made_FT`, `after_def_rebound`, `after_live_ball_TO`, `after_dead_ball_TO`, `after_other_dead_ball`. §4 and §6 need this. Keep the made-FG vs. made-FT split: after free throws the defense is already lined up, so it's a different situation.

`initial_halfcourt` plays get a sub-label, used in §6 and §8. The §3 metrics still use the full `initial_halfcourt` label.

| Sub-label | Definition |
|---|---|
| `quick_off_make` | The possession started `after_made_FG` and the play ended within `QUICK_MAKE_WINDOW_SEC` of the made basket. Excludes plays in the late-game window (`LATE_GAME_EXCLUDE_SEC`). |
| `ato_own` | The play resumed after the offense's own timeout (see §6.2). |
| `standard` | Everything else. |

Precedence if both apply: `quick_off_make` first, then `ato_own`.

Separately from labels, flag every play with a `timeout_before` attribute: `own`, `opponent`, `media`, or `none`. This captures ATO situations on any play, including resets.

- **Live-ball turnover:** a turnover with a steal credited (same clock, opposing team), or a subtype like bad pass/lost ball with a steal.
- **Dead-ball turnover:** everything else (travel, out of bounds, offensive foul, shot-clock violation). Report how many turnovers couldn't be classified.

### 2.4 Parameters (expose these; don't hard-code them)

| Parameter | Default | Notes |
|---|---|---|
| `TRANSITION_WINDOW_SEC` | 8 | Tune so transition counts roughly match the hand-tracked FB possessions in §10. Report the value chosen and the fit. |
| `QUICK_WINDOW_SEC` | 5 | Haslametrics convention. |
| `QUICK_MAKE_WINDOW_SEC` | 8 | Placeholder. Replace with the value chosen from the data in §6.1. |
| `LATE_GAME_EXCLUDE_SEC` | 120 | Seconds at the end of the 2nd half and each OT excluded from quick-off-make analysis. |
| `ASSIST_CREDIT` | 0.5 | Share of an assisted basket's points credited to the passer in the additive player columns (§7.3). |
| `MIN_N_FOR_RATE` | 10 | Below this many chances, the game box score shows "made/chances" instead of a rate. |
| `LEAGUE_FT_PCT` | 0.72 | Replace with the actual D-I average from league data if available. Used for the league baseline and for shrinkage (§7.5). |
| `FT_SHRINK_K` | 20 | Attempts of league-average shooting blended into each player's FT% (§7.5). |

---

## 3. Metric family 1: defense split

Compute for each team-offense in each game, then aggregate by season. BYU's **defensive** numbers are the opponent's offensive rows.

### 3.1 Metrics

Notation: `pts(label)` and `n(label)` are the points and number of plays with that label.

| Metric | Formula | Unit |
|---|---|---|
| Possessions | count of possessions | — |
| Plays | count of plays | — |
| Total PPP | total points / possessions | per possession |
| Plays per possession | plays / possessions | — |
| Points per play | total points / plays | per play |
| **First-shot half-court PPP** | `pts(initial_halfcourt) / n(initial_halfcourt)` | per possession (= per play here) |
| **Set half-court PPP** | `(pts(initial_halfcourt) + pts(reset)) / (n(initial_halfcourt) + n(reset))` | per play |
| Transition PPP | `pts(transition) / n(transition)` | per play |
| Quick-putback points, plays, PPP | from `quick_putback` | per play |
| Reset points, trips, PPP | from `reset` | per play |
| Second-chance points | `pts(quick_putback) + pts(reset)` | — |
| Offensive rebound rate | OREB / (OREB + opponent DREB), on live-ball missed shots only | — |

Identities that should hold; check them:
- Total PPP = points per play × plays per possession
- Total points = transition + initial_halfcourt + quick_putback + reset points
- Possessions = n(transition) + n(initial_halfcourt)

### 3.2 How to interpret

- **Set half-court PPP** answers "how good was the defense when it was set?" Quick putbacks are left out because they come before the defense can reorganize. They count as rebounding/scramble failures, not half-court scheme failures.
- Resets are included because once the offense resets, the defense has to defend a new half-court play.
- **Second-chance damage comes in two kinds:** quick-scramble damage (box-outs) and reset damage (the set defense failing again). Report both. In the hand-tracked games, these split very differently: WVU scored 12 of its 15 second-chance points on quick putbacks, while Houston scored 10 of 17 after resets.
- **Never compare per-play numbers with per-possession benchmarks.** Synergy-style half-court numbers are per play; KenPom-style numbers are per possession. Mixing them makes a defense look about 15% better than it is. Label every output column with its unit.
- **Quick off a make sits inside `initial_halfcourt`.** The defense often isn't fully set on those plays either. Report first-shot half-court PPP both with and without `quick_off_make` plays so the user can see whether it matters.
- **Single-game numbers are noisy.** Reset trips run 0–9 per game. Present season aggregates alongside game values, and compare BYU against its own season average (and the D-I average if league-wide data exists).

---

## 4. Metric family 2: possession value

### 4.1 Count version (replicates the user's sheet)

Per player per game:

`possessions_created = steals + offensive rebounds + offensive fouls drawn + recovered blocks − turnovers`

- **Recovered block:** a block followed by the blocking team's defensive rebound (including team rebounds) before the opponent regains possession. A block the opponent recovers doesn't count.
- **Offensive foul drawn:** credit the defender the foul was committed against, if the data identifies them; otherwise report it as unattributed.
- **Defensive rebounds are excluded on purpose.** The opponent's possession was ending on that miss anyway.

Report **gains and losses separately**, not just the net. Raw turnovers punish ball handlers, so also report:
- Per 40 minutes (needs minutes; derive from substitutions or lineups if they're not provided)
- Turnover rate = TO / (FGA + 0.44×FTA + TO)

### 4.2 Expected points added (EPA) version

Value each event by how much it changes expected points, not as "+1 possession."

**Key principle:** possessions alternate, so a steal doesn't hand you an extra possession. It erases the opponent's possession and upgrades the start of your next one. Only offensive rebounds add a new scoring chance (a new play).

#### Baseline values

Compute these from the data, for each team, with possessions labeled per §2.3:

| Symbol | Meaning | Unit |
|---|---|---|
| `E_norm(team)` | team's PPP on all possessions | per possession |
| `E_liveTO(team)` | team's PPP on possessions starting `after_live_ball_TO` | per possession |
| `E_oreb(team)` | expected points remaining in a possession right after an offensive rebound (all later plays in that possession) | per possession-remainder |

Baseline modes (parameter `BASELINE_MODE`):
- `season`: season-to-date values, using only games before this one (no leakage).
- `in_game_shrunk` (the user's "PPP up to that point in the game" idea, stabilized): `(points_so_far + K × season_value) / (count_so_far + K)`, with `K = 20` by default. This keeps early-game values from being wild (6-for-6 four minutes in is not a 2.00 PPP team).

Separate-subset values like `E_liveTO` have small samples. Shrink them toward league or team-season values the same way, and report sample sizes.

#### Event values

`own` = the acting player's team, `opp` = the other team.

| Event | Value |
|---|---|
| Steal | `E_norm(opp) + (E_liveTO(own) − E_norm(own))` |
| Charge / offensive foul drawn | `E_norm(opp)` |
| Recovered block | `E_norm(opp)` |
| Offensive rebound | `E_oreb(own)` |
| Live-ball turnover (cost) | `−[E_norm(own) + (E_liveTO(opp) − E_norm(opp))]` |
| Dead-ball turnover (cost) | `−E_norm(own)` |

For a sense of scale (made-up numbers): with own 1.05, opp 1.00, and 1.25 after a steal, a steal is worth about +1.20 points, a live-ball turnover about −1.30, and a dead-ball turnover about −1.05.

#### Expected vs. actual

Report both, per event and summed per player:
- **Expected:** formulas above. Isolates the player's contribution.
- **Actual:** replace the "upgrade" term with what actually happened. After a steal, use the points actually scored on the next possession minus `E_norm(own)`. After an offensive rebound, use the points actually scored in the rest of that possession.
- **Gap (actual − expected) at team level:** consistently scoring less than expected after steals means transition chances are being wasted. That's a finishing/decision problem, not a defensive one.

#### Credit allocation

Default: give the full expected value to the player credited with the event. Make it a parameter whether, in actual mode, the transition upgrade term is split with the scorer (like assist credit). Document the choice.

#### Outputs

Per player per game and per season: count version (gains, losses, net), EPA expected, EPA actual, per-40 versions, and turnover rate. Split turnovers into live-ball and dead-ball.

---

## 5. Metric family 3: win probability and WPA

### 5.1 Pregame expected margin

Use only data from games **before** the game being modeled.

1. Per team, season to date: possessions (count them directly from §2 if all games are present; otherwise estimate with `FGA − OREB + TO + 0.44×FTA`), offensive rating (ORtg = points per 100 possessions), defensive rating (DRtg = points allowed per 100), and pace.
2. Expected game possessions = the average of the two teams' paces.
3. Expected points for team A = `poss × (ORtg_A × DRtg_B / league_avg_rating) / 100`, and likewise for team B.
4. `μ` = expected margin (A − B) + `HCA` if A is home (0 on a neutral court).

**Strength of schedule is the biggest weakness.** Raw ratings don't adjust for opponents. If league-wide data exists, compute iterative opponent-adjusted ratings. Otherwise, support plugging in external ratings (Bart Torvik's are free; KenPom and ESPN BPI also work) as an optional input. Report which was used.

### 5.2 In-game model

Uses the random-walk approach from Hal Stern's 1994 model:

```
f   = seconds remaining in the game / 2400       (regulation = 40 min)
adj = lead + possession_bonus                    (the team with the ball gets ≈ its E_norm, about 1 point)
WP  = Φ( (adj + μ·f) / (σ·√f) )
```

- `Φ` is the standard normal CDF.
- `σ` (default 11) is the game-level standard deviation of the final margin around expectation. Optionally scale σ by `√(expected_poss / 68)` for pace.
- `HCA` defaults to 3.0 points.
- **Overtime:** treat a tie at the end of regulation as 0.5, then run the same formula with `f` = OT seconds remaining / 2400 and `μ` scaled by the same `f`.
- **End of game:** when `f` reaches 0, WP is 1, 0, or 0.5. Put a floor on `f` (e.g. 1 second) to avoid dividing by zero.
- **Known weakness:** the last minute (intentional fouling, shot clock, timeouts). Flag WP values in the final 60 seconds as low-confidence.

### 5.3 WPA

For each event, WPA = WP after the event − WP before it, from the acting team's view. Attach WPA to every §4 event. Report season-level WPA per player alongside EPA. EPA rewards production; WPA rewards production that mattered.

### 5.4 Checks

- If the source has its own WP (ESPN), report the average absolute difference and plot both curves for a few games.
- Over all modeled games: Brier score and a calibration table (bucket pregame and in-game WP into deciles; compare predicted vs. actual win rate). Expect rough calibration only; it's a simple model.
- Sanity check: a 4-point favorite leading by 3 with 10:00 left should come out around 77% (without the possession bonus).

---

## 6. Metric family 4: situational offense

Both are computed for both teams, so each also has a defensive mirror (e.g. how often opponents score quickly right after BYU scores).

### 6.1 Quick points off a make

The question: how fast does a team score after the opponent makes a field goal, before the defense is fully back? The user believes this is an under-used part of the game.

**Measure time from the made basket, not from the inbound.** In college the game clock keeps running after a made FG (except late in games), so inbound speed is part of what's being measured.

**Include every possession after a make, not just quick shots.** Every possession starting `after_made_FG` (outside the late-game window) goes in the population, however it ended: shot, foul, turnover, or a slow half-court possession. Counting only quick shots would show just the successes and overstate PPP.

**Choose the window from the data:**
1. For all possessions starting `after_made_FG`, compute seconds from the made basket to the end of the possession's first play.
2. Compute first-play PPP in 1-second bins (smoothed, e.g. a 3-second rolling window), using the whole season and both teams. Use league-wide data if available.
3. Plot it. Expect high PPP in the first few seconds, then a leveling-off near the normal half-court rate. Set `QUICK_MAKE_WINDOW_SEC` at the leveling-off point.
4. If there's no single clean break, define two tiers instead: `push` (e.g. ≤6s) and `early_offense` (e.g. 7–12s), and report both.
5. Include the curve and the chosen value in `report.md`.

**Metrics** (per team per game and per season):

| Metric | Definition |
|---|---|
| Push rate | `n(quick_off_make)` ÷ possessions starting `after_made_FG` (excluding late game) |
| Quick-off-make PPP | `pts(quick_off_make)` ÷ `n(quick_off_make)` |
| Non-quick PPP after makes | PPP of the remaining possessions after made FGs |
| Quick-off-make points | total, for the margin breakdown in §8 |
| Defensive mirror | the same metrics for the opponent, after BYU makes |

Optional: if the data has player-level inbound or ball-handler info, break out who initiates the push.

### 6.2 After-timeout (ATO) offense

**Find ATO plays.** For each timeout, find the next live-ball play by either team. Use the `timeout_before` attribute from §2.3 to label who called it: `own` (the offense), `opponent` (the defense), or `media`. Sometimes a team timeout runs into a media timeout. Label it by who called it and set a `merged_with_media` flag.

**Metrics** (per team; season level is the main use):

| Metric | Definition |
|---|---|
| ATO first-play PPP | points on the first play after the timeout ÷ number of ATO plays. This measures the designed set. |
| ATO possession PPP | points on the rest of the possession after the timeout, including any offensive rebounds and resets |
| Split by `own` / `opponent` / `media` | Own timeout = a designed play; opponent timeout = reacting to their adjustment; media = a third baseline |
| Inbound location | `baseline`, `sideline`, `backcourt`, or `unknown`, if it can be inferred from the event before the timeout (e.g. a shot-clock violation or out-of-bounds call). Never guess. |
| Defensive mirror | Opponent ATO PPP vs. BYU |

**Small samples:** a team typically gets only 3–6 ATO plays per game. In game box scores, show "scored on X of Y" rather than a PPP (see `MIN_N_FOR_RATE`). Show PPP only in season summaries, next to the sample size.

---

## 7. Metric family 5: enhanced player box score

Keep the traditional columns (MIN, PTS, FGM-A, 3PM-A, FTM-A, OREB, DREB, AST, STL, BLK, TO, PF) and add the three groups below.

**The most important design rule:** some columns are **additive** (they add up across players to the team's actual total) and some are **context** columns (they describe involvement and intentionally overlap). Label them that way in output metadata and in the rendered box score. If players' "points created" add up to more than the team scored without a note explaining why, readers will stop trusting the whole box score.

### 7.1 Scoring breakdown (additive within the player: sums to that player's PTS)

Every point a player scores falls into exactly one bucket. Apply these rules in order:

| Column | Rule |
|---|---|
| `pts_ft` | All free-throw points, including and-one free throws. |
| `pts_assisted` | Field-goal points on shots with an assist credited. |
| `pts_putback` | Unassisted field-goal points on `quick_putback` plays. |
| `pts_early` | Unassisted field-goal points on `transition` or `quick_off_make` plays. |
| `pts_self_created_hc` | All other unassisted field-goal points: `initial_halfcourt` (standard or ATO) and `reset` plays. **This is "self-created" in the shot-creation sense.** |

Check: these five columns sum to PTS for every player.

"Unassisted" isn't the same as "self-created." A putback and a breakaway layup are both unassisted but aren't shot creation in the isolation/pull-up sense. That's why they get their own columns.

### 7.2 Context columns (overlap by design; never total them across players)

| Column | Definition |
|---|---|
| `assist_pts` | Points value of the shots this player assisted (2 or 3 each, not a flat 2 per assist). Excludes the and-one free throw. |
| `pts_created` | `PTS + assist_pts` |
| `opp_pts_off_his_to` | Points the opponent scored on the possession right after this player's turnover (the whole possession, including their offensive rebounds). Split into live-ball and dead-ball. Show the expected cost from §4.2 next to it. |
| `pts_off_his_gains` | Points BYU scored on the possession right after this player's steal, charge drawn, or recovered block. Show each event type separately and in total, with the expected value from §4.2 next to it. |
| `pts_off_his_oreb` | Points BYU scored on the rest of the possession after this player's offensive rebound, split into quick putback vs. reset. |
| `opp_pts_off_his_fouls` | Opponent free-throw points on trips caused by this player's fouls, including the and-one free throw after his shooting foul. |
| `pts_left_ft` | Same as `ft_shortfall_own` in §7.5, kept here for the points-left-on-the-table group. |
| `pts_left_rim` | Missed rim attempts (layup, dunk, tip, or ≤ 4 ft if distance exists) × 2 × the league rim FG% (or team-season rate if league data isn't available). |
| `on_off_net_ppp` | BYU's PPP margin (offense − defense) with the player on vs. off the court, with possession counts. Needs lineups; leave null otherwise. |

Team-credited events ("TEAM" turnovers like shot-clock violations, team rebounds) go on a `TEAM` row, not on any player.

### 7.3 Additive credit-split column

| Column | Definition |
|---|---|
| `pts_produced` | Unassisted field goals and all free throws: full credit to the scorer. Assisted field goals: the scorer gets `(1 − ASSIST_CREDIT)` × shot points and the passer gets `ASSIST_CREDIT` × shot points. |

Check: the sum of `pts_produced` across players equals team points exactly.

This is a simplified version of Dean Oliver's points-produced idea. Use it whenever players need to be compared on a single scoring-production number. The EPA columns from §4.2 are the additive version for possession events.

### 7.5 Missed free-throw cost ("missed FT swing")

BYU has struggled at the line for several seasons. This section measures what missed free throws actually cost, without blaming the misses for things they didn't cause.

**Key principle:** the opponent gets the next possession whether a free throw is made or missed. So the opponent's points on that possession are mostly *not* caused by the miss. A miss causes only (a) the points it failed to produce, compared with expectation, and (b) the change in how the next possession starts. Report the opponent's next-possession points as context ("after the miss"), never as part of the cost.

#### Trips

Build one row per free-throw trip. Classify each trip:

| Trip type | Identification | Expected points |
|---|---|---|
| `one_shot` | and-one (FT at the same clock as the shooter's made FG) or technical | `p` |
| `two_shot` | shooting foul on a 2-point attempt, or the double bonus (10+ team fouls in the half) | `2p` |
| `three_shot` | shooting foul on a 3-point attempt | `3p` |
| `one_and_one` | non-shooting foul with the fouling team at 7–9 fouls in the half | `p + p²` |

If the feed has "n of m" attempt labels, use them. Otherwise infer from foul type and team foul count. A missed front end shows up as a single attempt, so don't infer trip type from attempt count alone. Report the number of trips classified as `unknown`.

`p` = the shooter's FT% going into the game, shrunk toward the league average: `(made + FT_SHRINK_K × LEAGUE_FT_PCT) / (attempts + FT_SHRINK_K)`. Use season-to-date data only, and include prior seasons in the shrink if available.

#### Two baselines (always report both)

- **Own:** `p` from the shooter's own shrunk percentage. Answers "did we shoot worse than usual tonight?" (execution and luck).
- **League:** `p = LEAGUE_FT_PCT` for every shooter. Answers "what does being a weak free-throw team cost?" (the skill gap). A team that's consistently poor at the line shows near-zero own-baseline shortfall, so this is the number that captures BYU's real problem.

Optional third baseline: the opponent's team FT% in this game, for a head-to-head comparison.

#### Per-trip values

| Field | Definition |
|---|---|
| `expected_pts` | from the table above (one value per baseline) |
| `shortfall` | `expected_pts − actual_pts`. Negative when the player shoots above expectation; that's credit, keep it. |
| `final_ft_missed` | true if the last attempt of the trip (or the front end of a 1-and-1) missed and the ball was live |
| `rebound_outcome` | `defense`, `offense`, or `none` (dead ball, lane violation) |
| `possession_effect` | Only when `final_ft_missed`. **Defense rebounds:** `E_opp(after_def_rebound_of_FT) − E_opp(after_made_FT)`. **Offense rebounds:** `−E_oreb(own)` (credit for the extra chance). |
| `ft_cost` | `shortfall + possession_effect` (one value per baseline) |
| `opp_pts_after` | Opponent's actual points on their next possession. **Context only, not part of the cost.** |
| `wp_cost` | Win probability (from the shooting team's view) under the counterfactual minus actual win probability right after the trip. The counterfactual adds `shortfall` to the lead and gives the opponent the ball as if after a made FT. Use the §5 model. |
| `late_game` | true if in the final `LATE_GAME_EXCLUDE_SEC` of the 2nd half or OT |

`E_opp(after_def_rebound_of_FT)` is a new possession-start value. After a missed free throw, players are lined up on the lane, so transition chances are fewer than after a missed field goal. Compute it as its own start type, shrunk toward `E_opp(after_def_rebound)` if the sample is small. Report the sample size.

Sanity check, using made-up numbers: a 68% shooter misses the front end of a 1-and-1 (expected 1.14), the defense rebounds, and the possession effect is about 0.10. That gives `ft_cost` ≈ 1.24. If the opponent then hits a three, `opp_pts_after` = 3, but the cost stays about 1.24.

#### Player columns (added to `player_game_box`)

`ft_trips`, `ft_shortfall_own`, `ft_shortfall_league`, `ft_cost_own`, `ft_cost_league`, `front_end_misses`, `ft_wp_cost`, `late_game_fta`, and `opp_pts_after_missed_final_ft` (context).

`ft_cost_*` is additive across players (each trip has one shooter). `opp_pts_after_*` is context.

#### Game- and season-level

- **Team per game, both teams:** total shortfall (both baselines), total `ft_cost` (both), front-end misses, WP lost at the line (sum of `wp_cost`), and opponent points after missed final FTs (context).
- **Flag** games where `ft_cost_league` is greater than the losing margin. Word it as "the free-throw line was worth more than the margin," never "would have won." Once the score changes, fouling decisions and everything else afterward change too.
- **Late-game targeting:** in the final 2 minutes, each player's share of BYU's FTA vs. his share of minutes. Opponents intentionally foul the weakest shooters, so this checks whether poor shooters are on the floor (and on the line) in high-leverage moments.
- **Season:** `ft_cost_league` per game and per 100 possessions, total WP lost at the line, and player rankings by `ft_cost_league` and `ft_wp_cost`.

### 7.6 Data caveats to report

- Assist recording varies by scorekeeper (home stat crews tend to be generous), so assisted vs. self-created splits are noisier across venues than within a game. Report each venue's assist rate (assisted FGM ÷ FGM) in `report.md` if multiple venues are present.
- Report how many assists couldn't be linked to a shot.

---

## 8. The game box score

The deliverable that ties everything together: a one-page view per game that explains what happened.

### 8.1 Margin breakdown (the headline table)

Every point in the game belongs to exactly one bucket, so each team's bucket totals add up to its final score.

| Bucket | Plays included |
|---|---|
| Transition | `transition` |
| Quick off a make | `initial_halfcourt` / `quick_off_make` |
| After own timeout | `initial_halfcourt` / `ato_own` |
| Half-court (first shot) | `initial_halfcourt` / `standard` |
| Quick putbacks | `quick_putback` |
| Reset second chances | `reset` |
| Other | technical-foul FTs and anything that doesn't fit a play; should be near 0 |

For each bucket, show both teams' points, chances (plays), PPP, and **net** (BYU − opponent). Check: the nets sum to the final margin.

Optional column: **net vs. expected**. Expected points per bucket = chances × that team's season-to-date PPP in that bucket. Then actual − expected separates "we had more chances" from "we converted better or worse than usual."

**Headline sentence:** auto-generate one plain-language line from the largest nets. For example: "Lost by 8: −7 on second chances, −7 in the half court, +6 in transition." Use the two most negative and the most positive buckets (reverse it for wins), grouping quick putbacks and resets as "second chances" when both have the same sign.

### 8.2 Layout

1. **Headline:** final score, possessions, PPP for both teams, and the headline sentence.
2. **Points by source:** the §8.1 table, with each team's season average for comparison.
3. **Possession battle:** possession margin, possessions gained/lost by type, live- vs. dead-ball turnovers, offensive rebound rate for both teams.
4. **Situational:** push rate and quick-off-make results; ATO results ("scored on X of Y"); both teams.
5. **Points left on the table:** team totals of `pts_left_rim`, plus advantage possessions (transition and quick-off-make) that ended scoreless, valued at their expected PPP.
6. **At the line (§7.5):** both teams' FT shortfall and `ft_cost` vs. own and league baselines, front-end misses, WP lost at the line, and opponent points after missed final FTs (context). Show the margin flag when it applies.
7. **Player table:** traditional columns, then the §7.1 breakdown, `pts_produced`, EPA (§4.2), possessions gained/lost, and WPA. Sort by total impact (EPA or WPA), not points. Context columns (§7.2) go in an expandable or secondary table with a footnote that they overlap.
8. **Win probability chart:** the §5 curve, with the 3–5 largest single-event WPA swings labeled.

### 8.3 Display rules

- **Every rate gets a comparison:** the team's season average, the opponent, or both. "1.03 PPP" alone means little; "1.03 (season 0.94)" tells a story.
- **Small samples:** below `MIN_N_FOR_RATE` chances, show "made/chances" instead of PPP, or grey out the rate.
- **Plain-language labels** in the rendered box score ("Points after offensive rebounds," not "2nd-ch PPP"). Technical names belong in the data tables only.
- **Lead with what decided the game.** The margin breakdown always comes first.

---

## 9. Optional extensions (only after §2–8 are validated)

- **Lineups:** if lineups are available, compute defense-split metrics and possession value by 5-man unit and by player on/off. Note sample sizes.
- **Push-rate impact:** whether BYU's push rate after makes relates to its overall offensive efficiency across games, and whether opponents' quick-off-make PPP rises after BYU's own scores (relaxing after scoring).
- **Rolling trends:** BYU's season trend in set half-court PPP allowed vs. second-chance points allowed. This is the season-level version of the user's original question.
- **Does possession margin predict winning?** Game-level possession margin vs. result, compared with how well shooting efficiency predicts results.

---

## 10. Validation targets (user's hand-tracked numbers)

### 10.1 Defense-split sheet

Each row is a team on offense, from five BYU games (all BYU losses). Hand-tracked, so expect small differences. **Target: within ±3 possessions and ±5 points per bucket.** List every game outside that and explain the difference.

| Offense | Opponent | Poss | Pts | Quick 2nd-ch pts | FB pts | Reset trips | 2nd-ch pts (total) | FB poss |
|---|---|---|---|---|---|---|---|---|
| Houston | BYU | 59 | 77 | 7 | 4 | 8 | 17 | 3 |
| BYU | Houston | 58 | 66 | 8 | 5 | 7 | 11 | 7 |
| Kansas | BYU | 66 | 90 | 7 | 11 | 0 | 7 | 9 |
| BYU | Kansas | 66 | 82 | 10 | 2 | 4 | 13 | 3 |
| Oklahoma State | BYU | 75 | 99 | 11 | 23 | 2 | 13 | 17 |
| BYU | Oklahoma State | 74 | 92 | 7 | 22 | 3 | 12 | 12 |
| Arizona | BYU | 72 | 86 | 1 | 18 | 4 | 6 | 17 |
| BYU | Arizona | 75 | 83 | 9 | 6 | 6 | 14 | 4 |
| WVU | BYU | 61 | 79 | 12 | 7 | 9 | 15 | 3 |
| BYU | WVU | 64 | 71 | 8 | 13 | 4 | 8 | 15 |

Expected derived values from the hand counts, BYU defense:

| Opponent | Total PPP | First-shot HC PPP | Set HC PPP (incl. resets) |
|---|---|---|---|
| Houston | 1.31 | 1.00 | 1.03 |
| WVU | 1.30 | 0.98 | 0.90 |
| Oklahoma State | 1.32 | 1.09 | 1.08 |
| Arizona | 1.19 | 1.13 | 1.14 |
| Kansas | 1.36 | 1.26 | 1.26 |

How the hand-tracked derived values were calculated (lets you reconcile differences):
- First-shot HC PPP = `(Pts − 2nd-ch pts − FB pts) / (Poss − FB poss)`
- Set HC PPP = `(Pts − quick pts − FB pts) / (Poss − FB poss + reset trips)`

These come close to the §3.1 play-label definitions, but the hand version may double-count a fast-break putback (counted as both FB and second-chance). The play-label method avoids that. Small differences from this are expected and fine; note them.

### 10.2 Possessions-created sheet

The hand count is from one BYU game. **The sheet doesn't say which game:** ask the user, or identify it by finding the BYU game whose counts match.

| Player | Steals | OREB | Off. fouls drawn | Recovered blocks | TO | Net |
|---|---|---|---|---|---|---|
| AJ | 3 | 3 | 0 | 1 | 7 | 0 |
| Rob | 0 | 0 | 0 | 1 | 4 | −3 |
| Tyler | 0 | 1 | 0 | 0 | 1 | 0 |
| Mboup | 1 | 1 | 0 | 0 | 0 | +2 |
| Ahmed | 0 | 0 | 0 | 1 | 0 | +1 |
| Keita | 1 | 1 | 0 | 0 | 2 | 0 |
| Davis | 0 | 0 | 0 | 0 | 0 | 0 |
| Aleksei | 0 | 0 | 0 | 0 | 1 | −1 |
| Mihai | 0 | 0 | 0 | 0 | 1 | −1 |

Note: offensive fouls drawn were zero for everyone. Check whether that's real or whether the data can't attribute charges to a defender.

### 10.3 Margin breakdown check (WVU game)

Built from the §10.1 hand counts. The hand tracking didn't split out quick-off-make or ATO, so combine those with `standard` into one half-court row before comparing.

| Bucket | BYU | WVU | Net |
|---|---|---|---|
| Transition | 13 | 7 | +6 |
| Quick putbacks | 8 | 12 | −4 |
| Reset second chances | 0 | 3 | −3 |
| Half-court (all initial) | 50 | 57 | −7 |
| **Total** | 71 | 79 | −8 |

The same tolerance as §10.1 applies. The nets must sum to the final margin exactly, whatever the hand counts say.

---

## 11. Deliverables

1. **`plays` audit table** (CSV or parquet): one row per play. Columns: `game_id`, `possession_id`, `play_id`, `offense_team`, `period`, `start_sec`, `end_sec`, `possession_start_type`, `play_label`, `end_reason`, `points`, `score_before`, `score_after`.
2. **`team_game_defense_split`**: one row per team-offense per game with all §3.1 metrics. Units go in column names (e.g. `set_hc_ppp_per_play`).
3. **`player_game_possession_value`**: §4 count, EPA expected/actual, live/dead TO split, per-40 values, TO rate, and WPA.
4. **`wp_timeline`**: per event, `wp_before`, `wp_after`, `wpa`, and the source WP if available.
5. **`team_game_situational`**: §6 metrics per team per game (push rate, quick-off-make PPP, ATO results by timeout type), both offense and defensive mirror.
6. **`quick_off_make_curve`**: first-play PPP by seconds after a made basket (the §6.1 plot data), with counts per bin.
7. **`player_game_box`**: one row per player per game (plus a `TEAM` row): traditional columns, §7.1 scoring breakdown, §7.2 context columns, §7.5 free-throw columns, `pts_produced`. Mark additive vs. context columns in a column-metadata file.
8. **`ft_trips`**: one row per free-throw trip with every §7.5 per-trip field.
9. **`team_game_scoring_sources`**: the §8.1 margin breakdown per game, with chances, PPP, net, and optional net vs. expected.
10. **Rendered game box scores** (`box_{game_id}.md` or HTML): the §8.2 layout. Render the five validation games in §10 first, then the rest.
11. **`season_summary`**: season aggregates of the team and player tables, with sample sizes.
12. **`report.md`**, short, covering:
   - Field mapping and any fallbacks used
   - Parameter values chosen: the transition window fit vs. the hand counts, and the quick-off-make window with its curve
   - Additive checks (pass/fail): §7.1 buckets sum to PTS, `pts_produced` sums to team points, §8.1 nets sum to the margin
   - Assist linkage rate and assist rate by venue (§7.6)
   - Free-throw trip classification: counts by type, number `unknown`, and the `E_opp(after_def_rebound_of_FT)` sample size
   - BYU's season free-throw cost vs. the league baseline, and the late-game FTA-share findings
   - Validation results vs. §10, with explanations for misses
   - Identity checks from §3.1 (pass/fail)
   - WP calibration and the comparison to the source WP
   - Findings on the user's question: across the season, how much of BYU's defensive PPP allowed came from transition, quick scrambles, resets, and set half-court play, and is the pattern consistent or game-specific?

## 12. Ground rules

- Don't silently change a definition. If data limits force a different approach, document it in `report.md`.
- Keep every threshold and constant as a named parameter.
- No future data in baselines or pregame ratings: anything predictive uses only games before the one being evaluated.
- Label units (per possession vs. per play) everywhere.
- Report sample sizes next to every rate. Treat single-game rates as descriptive, not conclusive.
