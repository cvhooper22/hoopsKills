import { useEffect, useMemo, useState } from 'react';
import YBallLoader from '../../components/Loaders/YBballLoader';
import { detectKills } from '../../utils/kills';
import { KILL_GAMES } from '../../constants/killGames';
import './Kills.css';

// Single-game preview of the kill detector (src/utils/kills.js, rules in /kills-rules.md).
// BYU is the defense in every game; the hand marks from /admin/stops are shown as a check.

const REASONS = { offensive_rebound: 'offensive rebound', empty_ft_trip: 'empty FT trip' };
const CAUSES = { second_chance: 'second-chance', foul: 'foul' };

function pct(n) {
  return n === null ? '–' : `${Math.round(n * 100)}%`;
}

function when(period, clock) {
  return `${period === 1 ? '1st' : period === 2 ? '2nd' : `OT${period - 2}`} ${clock}`;
}

function breakerText(b) {
  if (!b) return '';
  if (b.gameEnded) return 'game ended';
  const cause = b.causes.map((c) => CAUSES[c]).join(' + ') || 'plain make';
  return `${cause}${b.fouler ? ` (${b.fouler})` : ''} at ${when(b.period, b.clock)}`;
}

function StopChip({ stop, marked }) {
  const title = [
    stop.type,
    stop.credit && `credit ${stop.credit}`,
    stop.dirtyReasons.map((r) => REASONS[r]).join(', '),
    stop.late && 'late stop',
    marked === false && 'not in your marks',
  ].filter(Boolean).join(' · ');
  return (
    <span className={`kills-stop ${stop.dirty ? 'kills-stop--dirty' : ''} ${marked === false ? 'kills-stop--unmarked' : ''}`} title={title}>
      {stop.clock} {stop.type}{stop.credit ? ` · ${stop.credit}` : ''}
    </span>
  );
}

function KillTags({ kill }) {
  return (
    <>
      <span className={`kills-tag ${kill.dirty ? 'kills-tag--dirty' : 'kills-tag--pure'}`}>{kill.dirty ? 'dirty' : 'pure'}</span>
      {kill.critical && <span className="kills-tag">critical</span>}
      {kill.clutch !== 'none' && <span className="kills-tag kills-tag--clutch">{kill.clutch === 'clutch' ? 'clutch' : 'clutch-adjacent'}</span>}
      {kill.garbage && <span className="kills-tag">garbage</span>}
      {kill.late && <span className="kills-tag">late stop</span>}
    </>
  );
}

export default function Kills() {
  const [game, setGame] = useState(KILL_GAMES[0]);
  return <KillsGame key={game.id} game={game} onGameChange={setGame} />;
}

function KillsGame({ game, onGameChange }) {
  const GAME_ID = game.id;
  const DEFENSE = game.defense;
  const [plays, setPlays] = useState(null);
  const [marked, setMarked] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/data/${GAME_ID}.json`)
      .then((r) => r.json())
      .then(setPlays)
      .catch((err) => { console.error(err); setError(true); });
    // Hand marks are optional. CRA answers a missing file with index.html, hence the type check.
    fetch(`${process.env.PUBLIC_URL}/data/stops/${GAME_ID}.json`)
      .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null))
      .then((saved) => saved && setMarked(new Set(saved.plays.filter((p) => p.stop).map((p) => p.sequence_number))))
      .catch(() => {});
  }, [GAME_ID]);

  const result = useMemo(() => (plays ? detectKills(plays, DEFENSE) : null), [plays, DEFENSE]);
  const stopsBySeq = useMemo(() => {
    const m = {};
    if (result) result.stops.forEach((s) => { m[s.seq] = s; });
    return m;
  }, [result]);

  const picker = (
    <select value={game.id} onChange={(e) => onGameChange(KILL_GAMES.find((g) => g.id === e.target.value))}>
      {KILL_GAMES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
    </select>
  );
  if (error) return <div className="kills">{picker}<p>Could not load the game data.</p></div>;
  if (!result) return <div className="kills">{picker}<YBallLoader /></div>;

  const { stops, streaks, kills, potentialKills, completion } = result;
  const isMarked = (stop) => (marked ? stop.seqs.some((q) => marked.has(q)) : undefined);
  const unmatched = marked ? [...marked].filter((q) => !stops.some((s) => s.seqs.includes(q))) : [];
  const dirtyKills = kills.filter((k) => k.dirty).length;
  const stopStreaks = streaks.filter((s) => s.length >= 2);

  return (
    <div className="kills">
      <h2 className="kills-title">BYU kills {picker}</h2>
      <div className="kills-summary">
        <div className="kills-summary__stat"><span className="kills-summary__label">Kills</span>{kills.length}<small> ({kills.length - dirtyKills} pure, {dirtyKills} dirty)</small></div>
        <div className="kills-summary__stat"><span className="kills-summary__label">Potential kills, not converted</span>{potentialKills.length}</div>
        <div className="kills-summary__stat"><span className="kills-summary__label">Completion</span>{pct(completion)}</div>
        <div className="kills-summary__stat"><span className="kills-summary__label">Stops</span>{stops.length}<small> ({stops.filter((s) => s.dirty).length} dirty)</small></div>
      </div>
      {marked && (
        <p className="kills-check">
          Detector vs your marks: {marked.size - unmatched.length}/{marked.size} of your stops found, {stops.filter((s) => !isMarked(s)).length} extra stops found.
        </p>
      )}

      <h3>Streaks of 2 or more</h3>
      {stopStreaks.map((streak) => (
        <div className="kills-streak" key={streak.stops[0]}>
          <div className="kills-streak__head">
            <strong>{streak.length} stops in a row</strong>
            {streak.kills.length > 0 && <span> · {streak.kills.length} kill{streak.kills.length > 1 ? 's' : ''}</span>}
            {streak.potentialKill && <span> · potential kill{streak.potentialKill.dirty ? ' (dirty)' : ''}</span>}
            <span className="kills-streak__breaker"> · broken by {breakerText(streak.breaker)}
              {streak.breaker && streak.breaker.avoidable ? ' · avoidable' : ''}
            </span>
          </div>
          {streak.kills.map((kill) => (
            <div className="kills-kill" key={kill.start.seq}>
              <div>
                <strong>Kill</strong> <KillTags kill={kill} />
                <span className="kills-kill__meta"> starts {when(kill.start.period, kill.start.clock)}, BYU {kill.start.margin >= 0 ? '+' : ''}{kill.start.margin}, lasts {kill.durationSeconds}s</span>
              </div>
              <div className="kills-stops">
                {kill.stops.map((seq) => <StopChip key={seq} stop={stopsBySeq[seq]} marked={isMarked(stopsBySeq[seq])} />)}
              </div>
            </div>
          ))}
          {streak.potentialKill && (
            <div className="kills-kill kills-kill--potential">
              <div><strong>Potential kill</strong></div>
              <div className="kills-stops">
                {streak.potentialKill.stops.map((seq) => <StopChip key={seq} stop={stopsBySeq[seq]} marked={isMarked(stopsBySeq[seq])} />)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
