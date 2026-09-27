# Kills and stops: rules

Settled with the user by hand-marking BYU's defensive stops in
`2025-11-03-villanova-at-byu` (40 stops, saved in
`stat_explorer/public/data/stops/2025-11-03-villanova-at-byu.json`, marked from
`/admin/stops`). Expected result for that game: 6 kills, 5 unconverted potential
kills, completion 6/11 (about 55%). Only the defending team's side is tracked for now.
The general case will need each team tracked per period.

## Stops

A stop ends an opponent possession with no opponent points:

- a defensive rebound, including team rebounds (never credit the rebounder)
- an opponent turnover (always a stop)
- a steal (always a stop). A steal that follows a turnover credits the stealer and
  is not counted twice; the pair is one stop.

Special cases:

- **Charge:** offensive foul plus an offensive turnover by the same player. One stop,
  type "charge", no player credit.
- **Tie-up (held ball):** a held ball logged at the same clock time as the turnover (or
  steal) right after it means the defense forced the tie-up and possession switched. One
  stop, type "tie_up", credited like a charge: attributable to the defense but no specific
  player (a steal logged in the same moment still credits that player). The play-by-play
  must log the turnover. A held ball with no turnover or steal (for example a held ball
  followed only by a rebound, or by nothing) is NOT detected as a tie-up; those slide. A
  held ball followed by a defensive rebound at the same time is still just a rebound stop.
  A mid-possession held ball does not reset the possession (offensive rebounds before it
  still make the stop dirty). Only a period-start jump ball resets it.
- **Block:** credited to the blocker only when a defensive rebound or team rebound by
  the blocker's team directly follows. If the offense recovers, it is not a stop and
  gets no credit.
- **Free throws:** a defensive rebound after free throws is a stop only when every
  available free throw was missed (an empty trip): two or three missed, a missed
  one-and-one first shot, or a missed technical. The data labels the last two `1of1`,
  so any missed `1of1` is empty.
- **Late stops:** a stop with under 5 seconds left in the period still counts but is
  labelled "late".

### Dirty stops

A stop is dirty if either applies (no other triggers for now):

1. The offense had a real offensive rebound during the possession. Dead-ball offensive
   rebounds are ignored.
2. It followed an empty free-throw trip.

## Streaks and kills

- A streak is consecutive stops with no opponent points in between. The defense's own
  scoring does not affect it. Streaks do not reset at period end (halftime rule
  deferred: "not a kill if too close to halftime" is undefined until a real case shows up).
- Kills are chunks of 3 from the start of the streak. A leftover of 2 is a potential
  kill (PK). A leftover of 1 counts for nothing. 8 stops = 2 kills + 1 PK.
- A kill is dirty if any of its 3 stops is dirty, otherwise pure. A dirty leftover
  matters for nothing.
- **Completion %** = kills / (kills + PKs that never became kills).
- **Timing:** each kill starts at its own first stop play. It ends at the streak's
  breaker (the opponent's scoring play), even when the kill sits inside a longer streak.

## Breakers

The breaker is the scoring play that ends a streak, tagged with a cause. Track them for
streaks of 2 or more only (so unconverted PKs are included).

- **second-chance:** offense had an offensive rebound earlier in the possession (avoidable)
- **foul:** a foul on the defense followed by made free throws, credited to the fouler
  (avoidable)
- **plain make:** not avoidable

A foul followed by *missed* free throws does not end the streak. It makes the next
stop dirty (empty trip) and can still complete a kill, a dirty one.

## Context tags

Stops are judged at the time they happen. Kills are tagged from their stops.

- **Critical:** score within 5 when the kill starts, at any time.
- **Garbage:** lead of 15 or more with under 8 minutes left, measured when the kill starts.
- **Clutch window (per stop):** 5 minutes or less left in the second half or overtime,
  and score within 5. Never the first half.
- **Kill clutch level:** 2 or 3 of its 3 stops in the window = clutch, 1 = clutch-adjacent,
  0 = normal.

## Open

- A streak still running when the game ends has no breaker. End time to be decided.
- Per-game metrics still to build from `ideas.md`: margin before/after each kill, time since
  last kill, min/max/average gap, stop type, efficiency labels, "quick points",
  "impact steals" and "critical turnovers".
