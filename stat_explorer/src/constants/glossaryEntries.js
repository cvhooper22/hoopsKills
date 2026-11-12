// Every glossary entry on the site, in one place. The per-page floating Glossary
// (Box, Kills) renders its slice of these, and the /glossary page lists them all.
import { PURE_DIRTY_DEFINITION, PotentialKillDefinition, EfficiencyDefinition } from '../views/Kills/killsDefinitions';

export const BOX_GLOSSARY = [
  {
    id: 'possession-vs-chance',
    term: 'Possession vs. chance',
    definition: (
      <>
        <p>A possession is one team's uninterrupted control of the ball. A chance (or play) is one opportunity to score inside it, so every offensive rebound starts a new chance. Chances = possessions + offensive rebounds.</p>
        <p className="glossary__example"><strong>Example:</strong> a team misses a three, grabs its own rebound and scores on the putback. That is one possession but two chances. If a team had 68 possessions and 9 offensive rebounds, it had 77 chances.</p>
      </>
    ),
  },
  {
    id: 'pts-per-chance',
    term: 'Pts / chance',
    definition: (
      <>
        <p>Points scored divided by chances, so it shows how productive a type of play was.</p>
        <p className="glossary__example"><strong>Example:</strong> 15 points on 12 transition chances is 15 ÷ 12 = 1.25 points per chance.</p>
      </>
    ),
  },
  {
    id: 'points-by-source',
    term: 'Points by source',
    definition: (
      <ul>
        <li><strong>Transition:</strong> a fast play after a steal or defensive rebound. <em className="glossary__example">Example: a steal, then a layup four seconds later.</em></li>
        <li><strong>Quick off a make:</strong> a shot soon after the other team scores. <em className="glossary__example">Example: they hit a three, you inbound and score within eight seconds.</em></li>
        <li><strong>First-shot half-court:</strong> the first play against a set defense. <em className="glossary__example">Example: a defensive rebound, a walk up the floor and a set play.</em></li>
        <li><strong>Quick putback:</strong> a score within a few seconds of an offensive rebound. <em className="glossary__example">Example: a missed layup, rebound and tip-in two seconds later.</em></li>
        <li><strong>Reset:</strong> the offense pulls it out after a rebound and the defense sets up again. <em className="glossary__example">Example: an offensive rebound, the ball goes back to the guard and the offense starts over.</em></li>
      </ul>
    ),
  },
  {
    id: 'three-point-rate',
    term: '3-point rate',
    definition: (
      <>
        <p>The share of field-goal attempts that were threes: 3PA ÷ FGA.</p>
        <p className="glossary__example"><strong>Example:</strong> 17 threes out of 51 field-goal attempts is 17 ÷ 51 = 33.3%, so one shot in three was from deep. It says how often a team shoots threes, not how well.</p>
      </>
    ),
  },
  {
    id: 'free-throw-rate',
    term: 'Free-throw rate',
    definition: (
      <>
        <p>Free-throw attempts per field-goal attempt: FTA ÷ FGA. It measures how often a team gets to the line.</p>
        <p className="glossary__example"><strong>Example:</strong> 19 free throws on 51 field-goal attempts is 19 ÷ 51 = 37.3%, about 37 free-throw attempts for every 100 shots.</p>
      </>
    ),
  },
  {
    id: 'efg-ts',
    term: 'Effective FG% and true shooting %',
    definition: (
      <>
        <p>Effective FG% credits a three as 1.5 makes: (FGM + 0.5 × 3PM) ÷ FGA. True shooting % also counts free throws: points ÷ (2 × (FGA + 0.44 × FTA)).</p>
        <p className="glossary__example"><strong>Example:</strong> 21 makes (8 of them threes) on 51 attempts is (21 + 4) ÷ 51 = 49.0% effective FG%, even though plain FG% is 41.2%. With 66 points, 51 attempts and 19 free throws, true shooting is 66 ÷ (2 × (51 + 8.4)) = 55.6%.</p>
      </>
    ),
  },
  {
    id: 'pts-produced',
    term: 'Pts produced',
    definition: (
      <>
        <p>Every point a player had a hand in: the points he scored plus the points on baskets he assisted (the Assist pts column; Assists is the number of passes behind them). If he assisted a basket that had a made and-one free throw, that free throw counts too. A basket scored off a teammate's pass counts for both players, so the column is not meant to add up to the team's points. The percentage in parentheses is the player's produced points as a share of the team's points, so the shares add up to more than 100%.</p>
        <p className="glossary__example"><strong>Example:</strong> a guard scores 15 points and assists baskets worth 15 more points: he produced 15 + 15 = 30, shown as 30 (50.0%) if his team scored 60. The player who scored those 15 points off his passes also counts them in his own total.</p>
      </>
    ),
  },
  {
    id: 'epa',
    term: 'EPA (expected points added)',
    definition: (
      <>
        <p>Each steal, offensive rebound, charge, recovered block and turnover valued in the points it is expected to be worth, using this game's pace of scoring. Actual swaps in the points that really followed.</p>
        <p className="glossary__example"><strong>Example:</strong> say a steal is expected to be worth 1.2 points because possessions that start that way score more than average. If the team then scores 2, the steal's actual EPA is +2 against +1.2 expected.</p>
      </>
    ),
  },
  {
    id: 'havoc-rate',
    term: 'Havoc rate',
    definition: (
      <>
        <p>Meant to mirror the football metric's idea of havoc. The rate is a count of havoc plays (steal, blocks, other forced turnovers) plus any other opponent turnovers times a weight then all of that divided by the opponent's possessions.</p>
        <ul>
          <li><strong>Forced Turnover:</strong> a violation the defense caused, like a shot-clock violation, 5-second violation, or charge.</li>
          <li><strong>The Weight:</strong> Gives BYU some credit for the rest of the turnovers the opponent committed (things like lost ball turnovers or bad passes that may not have really been directly caused by the defense). A turnover earlier in the clock is credited at 0.25, while one late in the clock is credited at 0.5 since it's more likely BYU's defense had a hand in it. Shot clock time is estimated from the timestamps on plays.</li>
        </ul>
        <p className="glossary__example"><strong>Example:</strong> a defense faces 34 possessions with 7 steals, 1 recovered block and 1 forced turnover, plus 3 other turnovers that all came early in the possession. Havoc rate is then: 9 + 3 × 0.25 = 9.75</p>
      </>
    ),
  },
  {
    id: 'squeeze-rate',
    term: 'Squeeze rate',
    definition: (
      <>
        <p>The share of the opponent's possessions where the opponent was still holding the ball with 5 seconds or less (shot clock timing is estimated).</p>
        <p className="glossary__example"><strong>Example:</strong> the opponent was still holding the ball with five seconds or less left on 12 of 69 possessions: 12 ÷ 69 = 17.4%.</p>
      </>
    ),
  },
];

export const KILLS_GLOSSARY = [
  { id: 'pure-dirty-kills', term: 'Pure / dirty kills', definition: PURE_DIRTY_DEFINITION },
  { id: 'potential-kills', term: 'Potential kills (PKs)', definition: <PotentialKillDefinition showLabel={false} /> },
  { id: 'kill-efficiency', term: 'Efficiency', definition: <EfficiencyDefinition showLabel={false} /> },
];

export const ANALYTICALLY_FINAL_GLOSSARY = [
  {
    id: 'analytically-final',
    term: 'Analytically Final',
    definition: (
      <>
        <p>A lead is analytically final once the seconds left in the game are at most (lead − 5)². A lead of 5 or less is only final when the clock hits zero. The idea and the formula are Haslametrics'. Who has the ball is ignored, and overtime uses the same formula with the overtime clock.</p>
        <p className="glossary__example"><strong>Example:</strong> a 10-point lead is final with 25 seconds left: (10 − 5)² = 25. A 21-point lead is final with 4:16 left: (21 − 5)² = 256 seconds.</p>
      </>
    ),
  },
  {
    id: 'points-short',
    term: 'Points short of final',
    definition: (
      <>
        <p>How many more points the leader would need, at this moment, for the game to be analytically final: 5 + √(seconds left) − lead, and 0 once it is final.</p>
        <p className="glossary__example"><strong>Example:</strong> up 8 with 25 seconds left: 5 + √25 = 10, so the leader is 2 points short.</p>
      </>
    ),
  },
  {
    id: 'times-close',
    term: 'Times close / time close',
    definition: (
      <>
        <p>The game is close to final while the leader is within a set number of points of the safe line (3 by default, adjustable on the page) without being final. Times close counts each approach once (the lead has to fall more than one point past that range before the next one counts), and time close adds up the game clock spent in range.</p>
      </>
    ),
  },
  {
    id: 'af-near-miss-reversal',
    term: 'Near miss, dip and reversal',
    definition: (
      <>
        <p>A near miss is an approach that ended with the lead cut back out of range by more than one extra point. A dip counts every time a lead in range is pushed back out of it, with no extra margin, so it can be higher than near misses when a game hovers at the edge. A reversal is a game that went final and then lost it, with the trailing team scoring enough to drop the lead back under the line.</p>
      </>
    ),
  },
  {
    id: 'af-pushed-over',
    term: 'The play that pushed it over',
    definition: (
      <>
        <p>The first play after the game crossed the line. If the leader scored, that score gets the credit. If the trailing team's possession ended with a miss or a turnover, or the leader got a steal, block or defensive rebound, that stop gets it. Otherwise it was just the clock running, and a lead of 5 or less goes final at the final buzzer.</p>
      </>
    ),
  },
];

// Add a new group's entries here to have them show up on /glossary.
export const GLOSSARY_GROUPS = [
  { id: 'box', label: 'Box score', entries: BOX_GLOSSARY },
  { id: 'kills', label: 'Kills', entries: KILLS_GLOSSARY },
  { id: 'analytically-final', label: 'Analytically Final', entries: ANALYTICALLY_FINAL_GLOSSARY },
];
