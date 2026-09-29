import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import YBallLoader from '../../components/Loaders/YBballLoader';
import { detectKills } from '../../utils/kills';
import { killGameById } from '../../constants/killGames';
import { KILLS_DEMO_GAME_ID } from '../../constants/demo';
import urls from '../../constants/assetUrls';
import KillsHeader from './KillsHeader';
import KillsTable from './KillsTable';
import StreaksTable from './StreaksTable';
import RhythmMix from './RhythmMix';
import './Kills.css';

// Single-game preview of the kill detector (src/utils/kills.js, rules in /kills-rules.md).
// BYU is the defense in every game. Hand marks from /admin/stops are for the internal
// QA workflow (StopsEditor) only — not shown here; end users don't care what matched them.
export default function Kills() {
  const { name } = useParams();
  const gameId = name ?? KILLS_DEMO_GAME_ID;
  const game = killGameById(gameId);
  const [plays, setPlays] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPlays(null);
    setError(false);
    fetch(urls.pbpGame(gameId))
      .then((r) => r.json())
      .then(setPlays)
      .catch((err) => { console.error(err); setError(true); });
  }, [gameId]);

  const result = useMemo(() => (plays ? detectKills(plays, game.defense) : null), [plays, game]);

  if (error) return <div className="kills"><p>Could not load the game data.</p></div>;
  if (!result) return <div className="kills"><YBallLoader /></div>;

  return (
    <div className="kills">
      <KillsHeader game={game} result={result} />

      <KillsTable result={result} />
      <StreaksTable result={result} />
      <RhythmMix result={result} />
    </div>
  );
}
