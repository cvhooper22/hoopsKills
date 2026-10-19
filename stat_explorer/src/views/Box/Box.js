import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import YBallLoader from '../../components/Loaders/YBballLoader';
import Glossary, { GlossaryEntry, GlossaryTerm, GlossaryDefinition } from '../../components/Glossary/Glossary';
import urls from '../../constants/assetUrls';
import BoxHeader from './BoxHeader';
import { PointsBySource, Shooting, DefenseSplit, PossessionBattle, HavocSqueeze, AtTheLine, PossessionValue } from './BoxSections';
import PlayerBox from './BoxPlayers';
import './Box.css';

// Single-game "box score" built from the metrics prototype in dataAggregators/derivations
// (game-box-prototype.js writes public/data/box/<gameId>.json). Local-only for now.
export default function Box() {
  const { name: gameId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setData(null);
    setError(false);
    fetch(urls.boxGame(gameId))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(setData)
      .catch((err) => { console.error(err); setError(true); });
  }, [gameId]);

  if (error) return <div className="box"><p className="mt-l">Could not load this box score.</p></div>;
  if (!data) return <div className="box"><YBallLoader /></div>;
  return <BoxBody data={data} />;
}

// Everything below the loading logic, shared with the live page (views/Box/LiveBox.js).
export function BoxBody({ data, inLive = false }) {
  const failed = data.checks.filter((c) => !c.ok);
  return (
    <div className={inLive ? undefined : 'box'}>
      <BoxHeader data={data} />
      <PointsBySource data={data} />
      <Shooting data={data} />
      <DefenseSplit data={data} />
      <PossessionBattle data={data} />
      <HavocSqueeze data={data} />
      <AtTheLine data={data} />
      <PossessionValue data={data} />
      <PlayerBox data={data} />

      <p className="box-foot box-foot--end">
        Prototype numbers for one game: no season or league averages yet, so nothing here is compared with a norm.
        {' '}Consistency checks: {data.checks.length - failed.length} of {data.checks.length} pass{failed.length ? ` (failing: ${failed.map((c) => c.name).join('; ')})` : ''}.
      </p>

      <Glossary storageKey="box-glossary-dismissed">
        <GlossaryEntry>
          <GlossaryTerm>Possession vs. chance</GlossaryTerm>
          <GlossaryDefinition>
            <p>A possession is one team's uninterrupted control of the ball. A chance (or play) is one opportunity to score inside it, so every offensive rebound starts a new chance. Chances = possessions + offensive rebounds.</p>
            <p className="glossary__example"><strong>Example:</strong> a team misses a three, grabs its own rebound and scores on the putback. That is one possession but two chances. If a team had 68 possessions and 9 offensive rebounds, it had 77 chances.</p>
          </GlossaryDefinition>
        </GlossaryEntry>
        <GlossaryEntry>
          <GlossaryTerm>Pts / chance</GlossaryTerm>
          <GlossaryDefinition>
            <p>Points scored divided by chances, so it shows how productive a type of play was.</p>
            <p className="glossary__example"><strong>Example:</strong> 15 points on 12 transition chances is 15 ÷ 12 = 1.25 points per chance.</p>
          </GlossaryDefinition>
        </GlossaryEntry>
        <GlossaryEntry>
          <GlossaryTerm>Points by source</GlossaryTerm>
          <GlossaryDefinition>
            <ul>
              <li><strong>Transition:</strong> a fast play after a steal or defensive rebound. <em className="glossary__example">Example: a steal, then a layup four seconds later.</em></li>
              <li><strong>Quick off a make:</strong> a shot soon after the other team scores. <em className="glossary__example">Example: they hit a three, you inbound and score within eight seconds.</em></li>
              <li><strong>First-shot half-court:</strong> the first play against a set defense. <em className="glossary__example">Example: a defensive rebound, a walk up the floor and a set play.</em></li>
              <li><strong>Quick putback:</strong> a score within a few seconds of an offensive rebound. <em className="glossary__example">Example: a missed layup, rebound and tip-in two seconds later.</em></li>
              <li><strong>Reset:</strong> the offense pulls it out after a rebound and the defense sets up again. <em className="glossary__example">Example: an offensive rebound, the ball goes back to the guard and the offense starts over.</em></li>
            </ul>
          </GlossaryDefinition>
        </GlossaryEntry>
        <GlossaryEntry>
          <GlossaryTerm>3-point rate</GlossaryTerm>
          <GlossaryDefinition>
            <p>The share of field-goal attempts that were threes: 3PA ÷ FGA.</p>
            <p className="glossary__example"><strong>Example:</strong> 17 threes out of 51 field-goal attempts is 17 ÷ 51 = 33.3%, so one shot in three was from deep. It says how often a team shoots threes, not how well.</p>
          </GlossaryDefinition>
        </GlossaryEntry>
        <GlossaryEntry>
          <GlossaryTerm>Free-throw rate</GlossaryTerm>
          <GlossaryDefinition>
            <p>Free-throw attempts per field-goal attempt: FTA ÷ FGA. It measures how often a team gets to the line.</p>
            <p className="glossary__example"><strong>Example:</strong> 19 free throws on 51 field-goal attempts is 19 ÷ 51 = 37.3%, about 37 free-throw attempts for every 100 shots.</p>
          </GlossaryDefinition>
        </GlossaryEntry>
        <GlossaryEntry>
          <GlossaryTerm>Effective FG% and true shooting %</GlossaryTerm>
          <GlossaryDefinition>
            <p>Effective FG% credits a three as 1.5 makes: (FGM + 0.5 × 3PM) ÷ FGA. True shooting % also counts free throws: points ÷ (2 × (FGA + 0.44 × FTA)).</p>
            <p className="glossary__example"><strong>Example:</strong> 21 makes (8 of them threes) on 51 attempts is (21 + 4) ÷ 51 = 49.0% effective FG%, even though plain FG% is 41.2%. With 66 points, 51 attempts and 19 free throws, true shooting is 66 ÷ (2 × (51 + 8.4)) = 55.6%.</p>
          </GlossaryDefinition>
        </GlossaryEntry>
        <GlossaryEntry>
          <GlossaryTerm>Pts produced</GlossaryTerm>
          <GlossaryDefinition>
            <p>Every point a player had a hand in: the points he scored plus the points on baskets he assisted (the Assist pts column; Assists is the number of passes behind them). If he assisted a basket that had a made and-one free throw, that free throw counts too. A basket scored off a teammate's pass counts for both players, so the column is not meant to add up to the team's points. The percentage in parentheses is the player's produced points as a share of the team's points, so the shares add up to more than 100%.</p>
            <p className="glossary__example"><strong>Example:</strong> a guard scores 15 points and assists baskets worth 15 more points: he produced 15 + 15 = 30, shown as 30 (50.0%) if his team scored 60. The player who scored those 15 points off his passes also counts them in his own total.</p>
          </GlossaryDefinition>
        </GlossaryEntry>
        <GlossaryEntry>
          <GlossaryTerm>EPA (expected points added)</GlossaryTerm>
          <GlossaryDefinition>
            <p>Each steal, offensive rebound, charge, recovered block and turnover valued in the points it is expected to be worth, using this game's pace of scoring. Actual swaps in the points that really followed.</p>
            <p className="glossary__example"><strong>Example:</strong> say a steal is expected to be worth 1.2 points because possessions that start that way score more than average. If the team then scores 2, the steal's actual EPA is +2 against +1.2 expected.</p>
          </GlossaryDefinition>
        </GlossaryEntry>
        <GlossaryEntry>
          <GlossaryTerm>Havoc rate</GlossaryTerm>
          <GlossaryDefinition>
            <p>Meant to mirror the football metric's idea of havoc. The rate is a count of havoc plays (steal, blocks, other forced turnovers) plus any other opponent turnovers times a weight then all of that divided by the opponent's possessions.</p>
            <ul>
              <li><strong>Forced Turnover:</strong> a violation the defense caused, like a shot-clock violation, 5-second violation, or charge.</li>
              <li><strong>The Weight:</strong> Gives BYU some credit for the rest of the turnovers the opponent committed (things like lost ball turnovers or bad passes that may not have really been directly caused by the defense). A turnover earlier in the clock is credited at 0.25, while one late in the clock is credited at 0.5 since it's more likely BYU's defense had a hand in it. Shot clock time is estimated from the timestamps on plays.</li>
            </ul>
            <p className="glossary__example"><strong>Example:</strong> a defense faces 34 possessions with 7 steals, 1 recovered block and 1 forced turnover, plus 3 other turnovers that all came early in the possession. Havoc rate is then: 9 + 3 × 0.25 = 9.75</p>
          </GlossaryDefinition>
        </GlossaryEntry>
        <GlossaryEntry>
          <GlossaryTerm>Squeeze rate</GlossaryTerm>
          <GlossaryDefinition>
            <p>The share of the opponent's possessions where the opponent was still holding the ball with 5 seconds or less (shot clock timing is estimated).</p>
            <p className="glossary__example"><strong>Example:</strong> the opponent was still holding the ball with five seconds or less left on 12 of 69 possessions: 12 ÷ 69 = 17.4%.</p>
          </GlossaryDefinition>
        </GlossaryEntry>
      </Glossary>
    </div>
  );
}
