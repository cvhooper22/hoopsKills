 Kill stat generator

CAL STATE FULLERTON ID
1290251


might need a game data object that has functions on it:
log player action
log stop
etc
Would be cool to have times on it

# Rules
Not a kill if it’s a foul leading to a free throw
If it was a block, capture that and who
  - Block is “block” followed by “rebound def”
It it was a steal, capture that and who
  - Steal is “turnover” followed by “steal”
Capture time started and ended
- Related this, note time since last stop streak/kill
NOT A KILL if the possession came after a missed FT
NOT A KILL if the possession was too close to halftime
  - NEED TO DEFINE THIS

When we move to the general case will have to enhance gameData with each team by period, then can track stops and kills according to the current team

## Is a play a stop?
  - def rebound (EXCEPT IF IT WAS A FT BEFORE)
    - was there a block the play before?

  - turnover by the offense
    - need to know if it was a charge, previous play will be a foul on that same player
  - steal by the defense

## Does a play end a stop streak?
 - made basket by the opposition
 - possible caveat - foul leading to free throws
	will be foul followed by FT or followed by subs then FT

## Things that indicate makes
 - good

# Per game results (all broken down to 1st and second half)
kills
Kill start and end time
Margin before and after kill
“Critical Kills” - game within 5 (10?, what threshold here
“Garbage kills” - game outside of 15 pts with less than 8 min left
Time since last kill
Related to time since last kill - average time between kills
Stop “type” - was it a steal, a charge, a shot clock violation, etc
  - individual kills
Max time between
Min time between
Completion %
Efficiency
- Positive
- Negative
- No gain
- Clean
- dirty
- one day maybe even shooting percentages during the stop streak
- Time start (1st stop) to time end (their bucket)

# Play by Play data
What it could give - things like when a player scored see if a player scores in bursts or not
Traditional box scores only give fast break points as happening after a turnover or defensive rebound. I want to know how many “quick points” are scored, i.e. how many times you score fast off of a make

Could make up new stats like “impact steals” being steals that lead to points within 7 seconds or something like that

“Critical Turnovers”
Ones that happen when the game is within 5 and/or with a certain amount of time left in the game
Could even tier it to what seems reasonable (down 5-8 with 4 minutes left)

Could essentially track everything about the team/player. For instance, when did the turnovers happen, when did a player score their points, etc
  - Something like what I did for Alex one time. When does a player take his shots, how is it spread out the game. Did time for Alex but possessions would be more meaningful since that would remove the addition of the time he was on defense and literally ccould not take a shot

Something like this evenhttps://cbbstatistics.blogspot.com/2020/08/does-high-minutes-average-cause.html


# Lineups stuff
+/- for players
Stats for players
A more intuitive lineup thing where you can see who’s on the court and stuff (run etc)
Can do assisted buckets and assist maps here too

General box score fun times
How many threes were made by different players
How many different players had an assist

OTHER FUN STUFF
Could rate a certain stat - kinda like the idea of clutch minutes
Critical - clutch definition
Bad - score within 7 OR margin > time left in second half
OK - score from 7 - 15
DOESN'T MATTER - Score + 15

So for makes this is kinda flipped as far as the sentiment goes

Could use data from hoop-math.com to do some fun stuff like shooting profiles (rim/2pt/three frequency) and just give a better view of that data
