import { useEffect, useState } from 'react';
import { Outlet, useOutletContext, useParams } from 'react-router-dom';
import YBallLoader from '../../components/Loaders/YBballLoader';
import Glossary, { GlossaryEntries } from '../../components/Glossary/Glossary';
import { BOX_GLOSSARY } from '../../constants/glossaryEntries';
import urls from '../../constants/assetUrls';
import BoxHeader from './BoxHeader';
import { PointsBySource, Shooting, DefenseSplit, PossessionBattle, HavocSqueeze, AtTheLine, PossessionValue } from './BoxSections';
import { ShotClock } from './BoxShotClock';
import PlayerBox from './BoxPlayers';
import { BoxTabs } from './BoxParts';
import { oppColorStyle } from './boxFormat';
import { StintComparePanel } from './BoxStintCompare';
import { EventTimelinePanel } from './BoxEventTimeline';
import { LineupTimelinePanel } from './BoxLineupTimeline';
import { LineupComparePanel } from './BoxLineupCompare';
import { FindPlaysPanel } from './BoxFind';
import { ShotComparePanel } from './BoxShotCompare';
import ShotChartPanel from '../../components/ShotChart/ShotChartPanel';
import useGamePlays from '../../hooks/useGamePlays';
import AskAi from '../../components/AskAi/AskAi';
import { useFlag } from '../../contexts/FeatureFlagsContext';
import { ASK_AI } from '../../constants/featureFlags';
import './Box.css';

// Single-game "box score" built from the metrics prototype in dataAggregators/derivations
// (game-box-prototype.js writes public/data/box/<gameId>.json). Local-only for now.
export default function Box() {
  const { name: gameId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const askAiOn = useFlag(ASK_AI);

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
  return (
    <div className="box" style={oppColorStyle(data.header)}>
      <BoxTabs tabs={[{ to: `/games/${gameId}`, label: 'Box score', end: true }, { to: `/games/${gameId}/timeline`, label: 'Lineup timeline' }, { to: `/games/${gameId}/stint-compare`, label: 'Stint Compare' }, { to: `/games/${gameId}/event-timeline`, label: 'Event timeline' }, { to: `/games/${gameId}/lineup-compare`, label: 'Lineup compare' }, { to: `/games/${gameId}/find`, label: 'Find plays' }, data.hasShotLocations !== false && { to: `/games/${gameId}/shots`, label: 'Shot chart' }, data.hasShotLocations !== false && { to: `/games/${gameId}/shot-compare`, label: 'Shot chart compare' }].filter(Boolean)} />
      <Outlet context={{ data }} />
      {askAiOn && <AskAi data={data} />}
    </div>
  );
}

export function BoxScoreTab() {
  const { data } = useOutletContext();
  return <BoxBody data={data} inLive />;
}

export function BoxStintCompareTab() {
  const { data } = useOutletContext();
  const { plays } = useGamePlays(data.header.gameId);
  return <StintComparePanel data={data} shotPlays={plays} />;
}

// Everything below the loading logic, shared with the live page (views/Box/LiveBox.js).
export function BoxBody({ data, inLive = false }) {
  const failed = data.checks.filter((c) => !c.ok);
  return (
    <div className={inLive ? undefined : 'box'}>
      <BoxHeader data={data} />
      <PointsBySource data={data} />
      <Shooting data={data} />
      <ShotClock data={data} />
      <DefenseSplit data={data} />
      <HavocSqueeze data={data} />
      <PossessionBattle data={data} />
      <PossessionValue data={data} />
      <AtTheLine data={data} />
      <PlayerBox data={data} />


      <Glossary storageKey="box-glossary-dismissed"><GlossaryEntries entries={BOX_GLOSSARY} /></Glossary>
    </div>
  );
}

export function BoxEventTimelineTab() {
  const { data } = useOutletContext();
  return <EventTimelinePanel data={data} />;
}

export function BoxTimelineTab() {
  const { data } = useOutletContext();
  return <LineupTimelinePanel data={data} />;
}

export function BoxLineupCompareTab() {
  const { data } = useOutletContext();
  const { plays } = useGamePlays(data.header.gameId);
  return <LineupComparePanel data={data} shotPlays={plays} />;
}

// Shot locations for a finished game: needs the game's plays file in the data bucket (the box JSON has no coordinates).
export function BoxShotsTab() {
  const { name: gameId } = useParams();
  const { plays, meta, error } = useGamePlays(gameId);
  if (error) return <p className="mt-l">There is no shot chart data for this game.</p>;
  if (!plays) return <YBallLoader />;
  return <ShotChartPanel plays={plays} meta={meta} />;
}

export function BoxShotCompareTab() {
  const { data } = useOutletContext();
  const { plays } = useGamePlays(data.header.gameId);
  return <ShotComparePanel data={data} shotPlays={plays} />;
}

export function BoxFindTab() {
  const { data } = useOutletContext();
  return <FindPlaysPanel data={data} />;
}
