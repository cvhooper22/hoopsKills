# Clutch page: design brief

## What this page is
The **Clutch** nav item on BYU Hoops Stats. It shows how BYU (and its opponent) performed in the
clutch moments of **one game**. Later it will aggregate to the season, so the layout should not be
so game-specific that it cannot become a season view. The demo game is **BYU at Dayton,
2025-11-28** (BYU won 83-79). A working functional version exists at `/clutch`; this brief is for a
proper design pass over it.

Audience: BYU basketball fans and stat people. The tone is closer to an announcer's recap than a
box score. Moments matter as much as numbers.

## Clutch is user-adjustable
Definition: 2nd half or overtime, **N minutes or less** on the clock, score margin **M points or fewer**.
Default 5 min / 5 pts (NBA standard). The user can change both values (or pick a preset such as
4 min / 3 pts) and **everything on the page recalculates instantly** in the browser. The current
definition lives in the URL (`?min=4&margin=3`) so it can be shared.

The margin is measured going into each play. A game can leave clutch (the lead grows past M) and
re-enter it (a comeback), so clutch time is split into **stretches**.

## What the user wants to show
1. **Clutch definition controls**: two number inputs, presets, and a plain-English readout of the current definition.
2. **Game summary**: final score, total clutch time, number of stretches, BYU's clutch net (BYU clutch points minus opponent's).
3. **Clutch stretches** (a list or timeline; the user wants these viewable, at least behind an option):
   - Time span, e.g. "H2 4:50 to H2 1:08", and clutch time in that stretch.
   - Score going in and out, BYU net in the stretch.
   - **The play that pushed the game out of clutch**, presented like an announcer saying "that's the dagger / they put the game away" (who extended the lead, by how much, the score).
   - **The play that brought it back into clutch** ("cut it to...").
   - The shots, free throws, turnovers, steals and blocks in the stretch, with the running score.
4. **Top performers, BYU only**, in the clutch: most points, most stocks (steals + blocks), most assists, most offensive rebounds, best shooters (currently eFG% with a 2 FGA minimum; FG% is an open alternative).
5. **Player tables** for BYU and the opponent: clutch minutes, PTS, FG, 3P, FT, REB, AST, STL, BLK, TO, PF, +/-.

## Data available (all client-side, from one play-by-play JSON per game, about 500 plays)
Each play has:
`sequence_number`, `period_number` (1-2 halves, 3+ overtime), `period_type`, `clock_display`
(e.g. "4:57" or "0:47.8"), `clock_seconds_remaining`, `game_seconds_elapsed`, `team_id`
(`byu`, `dayton`), `team_side` (home/away), `player_id`, `player_name`, `play_category`
(shot_attempt, free_throw, rebound, assist, steal, block, turnover, foul, substitution, timeout,
jumpball, period_admin), `play_type`/`play_subtype` (e.g. offensive/defensive rebound, jumpshot,
layup, dunk), `play_description` (human text, e.g. "AJ Dybantsa 2pt turnaroundjumpshot made"),
`home_score_after`, `away_score_after`, `shot_value` (1/2/3), `is_made`, and the **five-player
lineups on the floor for both teams** (`lineup_home`, `lineup_away`) on every play.

Not in the data: shot locations, a shot clock, win probability, and any indicator of who a foul is
drawn on beyond the description text.

## What is already computed for the page
Per game, for a given definition:
- **Stretches**: id, start and end (period, clock, both scores), clutch seconds, points scored by each team in it, the entry play (scoring play that cut it back into range), the exit play (scoring play that pushed it out, with leader and margin), and its plays.
- **Per player** (both teams): clutch seconds, pts, fgm/fga, 3pm/3pa, ftm/fta, reb, oreb, ast, stl, blk, tov, pf, plus-minus (points differential while on the floor, in clutch only).
- **Per team**: clutch points.
- **Game**: final score, total clutch seconds.

Not yet computed but derivable from the data: lineups on the floor during a stretch, timeouts and fouls per stretch, scoring runs, per-team turnovers and rebounds, team shooting splits, and which player was involved in the exit/entry play (the play descriptions name them).

## Dayton demo values (to design with real numbers)
- **5 min / 5 pts**: 4:44 of clutch time, 2 stretches, BYU clutch net +2 (16-14).
  - Stretch 1: H2 4:50 to 1:08, BYU 67-62 to 79-73. Exit play: AJ Dybantsa turnaround jumper, BYU +6. 3:52 of clutch time.
  - Stretch 2: H2 0:52.4 to 0:00, BYU 79-76 to 83-79. Entry: Bryce Heard three, Dayton within 3. 0:52 of clutch time. Ends at the final buzzer.
- **4 min / 3 pts**: 2:09 of clutch time, 4 stretches, BYU net +8.
- **Leaders (5/5)**: points Richie Saunders 9, AJ Dybantsa 4, Robert Wright III 3. Stocks Khadim Mboup 1 (block). Assists AJ Dybantsa 2. OREB AJ Dybantsa 1. Shooting Richie Saunders 2-2 FG, 2-2 3P.
- Clutch samples are small, so some leader lists are short or empty. Design for one to three rows and an empty state.

## Constraints and existing look
- React app (Create React App), plain CSS, no component library. Font: Noto Sans.
- Existing palette (CSS variables): navy `#002e52`, blues `#00377A` to `#003C95`, light blue `#edf4ff`, page background `#fffffd`, positive green `#006141`, negative red `#A3082A`, secondary text lightslategray. Table headers use the mid blue with white text. Match the Lineups page's feel.
- The page sits under a top bar and nav ("Home, Lineups, Kills, Clutch, Alumni").
- Must work on mobile. Player tables are wide (13 columns) and currently scroll horizontally.
- Positive/negative values use green/red (the `Net` component).

## Open questions for the design
- Timeline versus cards for the stretches, and how prominent the "dagger" moment should be.
- Where the definition controls live so they read as the page's main lever without crowding it.
- How the layout scales to a season view (aggregated leaders, per-game rows) without a redesign.
- Player tables: all stretches combined (current) or filterable per stretch.
- Which shooting metric to feature (eFG% or FG%).
- Whether the opponent gets the same treatment as BYU (tables yes, leaders currently BYU only).
