import { useEffect, useMemo, useState } from 'react';
import YBallLoader from '../../components/Loaders/YBballLoader';
import { detectKills } from '../../utils/kills';
import { killGameById } from '../../constants/killGames';
import KillsHeader from './KillsHeader';
import KillsTable from './KillsTable';
import StreaksTable from './StreaksTable';
import RhythmMix from './RhythmMix';
import './Kills.css';

// Single-game preview of the kill detector (src/utils/kills.js, rules in /kills-rules.md).
// BYU is the defense in every game; the hand marks from /admin/stops are shown as a check.
// Pinned to one game for now — no game picker. Switch GAME_ID (and re-add the
// picker from KILL_GAMES in src/constants/killGames.js) once this covers more games.
const GAME_ID = '2025-11-03-villanova-at-byu';
const game = killGameById(GAME_ID);

export default function Kills() {
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
  }, []);

  const result = useMemo(() => (plays ? detectKills(plays, game.defense) : null), [plays]);

  if (error) return <div className="kills"><p>Could not load the game data.</p></div>;
  if (!result) return <div className="kills"><YBallLoader /></div>;

  const { stops } = result;
  // marked is null until hand marks load (or if none exist for this game) — in
  // that case nothing is flagged as unmarked, since we have nothing to check against.
  const isUnmarked = (stop) => !!marked && !stop.seqs.some((q) => marked.has(q));
  const unmatched = marked ? [...marked].filter((q) => !stops.some((s) => s.seqs.includes(q))) : [];

  return (
    <div className="kills">
      <KillsHeader game={game} result={result} />

      <KillsTable result={result} isUnmarked={isUnmarked} />
      <StreaksTable result={result} />
      <RhythmMix result={result} />
    </div>
  );
}
