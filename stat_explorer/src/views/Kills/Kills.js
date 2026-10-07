import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import YBallLoader from '../../components/Loaders/YBballLoader';
import { detectKills } from '../../utils/kills';
import urls from '../../constants/assetUrls';
import KillsSubnav from './KillsSubnav';
import KillsHeader, { gameLabel } from './KillsHeader';
import KillsTable from './KillsTable';
import StreaksTable from './StreaksTable';
import RhythmMix from './RhythmMix';
import Glossary, { GlossaryEntry, GlossaryTerm, GlossaryDefinition } from '../../components/Glossary/Glossary';
import { PURE_DIRTY_DEFINITION, PotentialKillDefinition, EfficiencyDefinition } from './killsDefinitions';
import './Kills.css';

const FOCUS_TEAM = 'byu';

// game.json (see KillsHeader) from the game's meta sidecar: matchup, venue, and which
// side BYU played defense on — BYU is the defense in every game.
function gameFromMeta(meta) {
  const byuHome = meta.homeId === FOCUS_TEAM;
  return {
    date: meta.date,
    venue: meta.venue,
    neutral: meta.neutralSite,
    defense: byuHome ? 'home' : 'away',
    home: meta.teams[meta.homeId]?.name ?? meta.homeId,
    away: meta.teams[meta.awayId]?.name ?? meta.awayId,
  };
}

// Single-game preview of the kill detector (src/utils/kills.js, rules in /kills-rules.md).
// BYU is the defense in every game. Hand marks from /admin/stops are for the internal
// QA workflow (StopsEditor) only — not shown here; end users don't care what matched them.
export default function Kills() {
  const { name } = useParams();
  const gameId = name;
  const [plays, setPlays] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPlays(null);
    setGame(null);
    setError(false);
    fetch(urls.pbpGame(gameId))
      .then((r) => r.json())
      .then(setPlays)
      .catch((err) => { console.error(err); setError(true); });
    fetch(urls.pbpGameMeta(gameId))
      .then((r) => r.json())
      .then((meta) => setGame(gameFromMeta(meta)))
      .catch((err) => { console.error(err); setError(true); });
  }, [gameId]);

  const result = useMemo(() => (plays && game ? detectKills(plays, game.defense) : null), [plays, game]);

  if (error) return <div className="kills"><p>Could not load the game data.</p></div>;
  if (!result) return <div className="kills"><YBallLoader /></div>;

  return (
    <div className="kills">
      <KillsSubnav active="game" />
      <KillsHeader game={game} result={result} gameId={gameId} />

      <KillsTable result={result} gameId={gameId} gameLabel={gameLabel(game)} />
      <StreaksTable result={result} />
      <RhythmMix result={result} />

      <Glossary storageKey="kills-glossary-dismissed">
        <GlossaryEntry>
          <GlossaryTerm>Pure / dirty kills</GlossaryTerm>
          <GlossaryDefinition>{PURE_DIRTY_DEFINITION}</GlossaryDefinition>
        </GlossaryEntry>
        <GlossaryEntry>
          <GlossaryTerm>Potential kills (PKs)</GlossaryTerm>
          <GlossaryDefinition><PotentialKillDefinition showLabel={false} /></GlossaryDefinition>
        </GlossaryEntry>
        <GlossaryEntry>
          <GlossaryTerm>Efficiency</GlossaryTerm>
          <GlossaryDefinition><EfficiencyDefinition showLabel={false} /></GlossaryDefinition>
        </GlossaryEntry>
      </Glossary>
    </div>
  );
}
