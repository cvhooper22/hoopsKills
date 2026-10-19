import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import YBallLoader from '../../components/Loaders/YBballLoader';
import urls from '../../constants/assetUrls';
import { BoxBody } from './Box';
import { KillsBody, gameFromMeta } from '../Kills/Kills';
import { detectKills } from '../../utils/kills';
import { LineupsPanel } from '../Lineups/components/GameLineups';
import { periodLabel } from './boxFormat';

// In-game page: the same box-score sections as /box, fed by derivations/live-box-server.js. The server recomputes the whole
// suite whenever new plays are stored and pushes it over server-sent events; this page just swaps the payload in. Behind the
// `liveGame` feature flag (see App.js). Local only: the server is on this machine.
const STALE_AFTER_MS = 90 * 1000; // capture polls every 5-30 seconds (the popup's interval), so this long without one means it has stopped

function useLiveGame(gameId) {
  const [data, setData] = useState(null);
  const [playsData, setPlaysData] = useState(null); // {meta, plays}: what the Kills view loads for a finished game
  const [connection, setConnection] = useState('connecting'); // connecting | open | reconnecting
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    setData(null); setPlaysData(null); setProblem(null); setConnection('connecting');
    const stream = new EventSource(urls.liveBoxStream(gameId));
    stream.onopen = () => setConnection('open');
    stream.onerror = () => setConnection('reconnecting'); // EventSource retries on its own
    stream.addEventListener('box', (e) => { setData(JSON.parse(e.data)); setProblem(null); setConnection('open'); });
    stream.addEventListener('plays', (e) => setPlaysData(JSON.parse(e.data)));
    // the stream sends the latest payload on connect, but a game with no plays stored yet has none: say so instead of spinning
    fetch(urls.liveBox(gameId)).then((r) => { if (r.status === 404) setProblem('No plays stored for this game yet. Start capture, or check the game id.'); }).catch(() => {});
    return () => stream.close();
  }, [gameId]);

  return { data, playsData, connection, problem };
}

const ageText = (ms) => (ms < 1500 ? 'just now' : `${Math.round(ms / 1000)}s ago`);

function LiveBanner({ data, connection }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const l = data.live;
  const final = l.status === 'final';
  const polledAge = l.lastPolledAt ? now - Date.parse(l.lastPolledAt) : null;
  const stale = !final && polledAge !== null && polledAge > STALE_AFTER_MS;
  const state = final ? 'final' : stale || connection === 'reconnecting' ? 'warn' : 'live';
  return (
    <div className={`live-banner live-banner--${state}`} role="status">
      <span className="live-banner__dot" aria-hidden="true" />
      <strong>{final ? 'Final' : stale ? 'Feed stalled' : 'Live'}</strong>
      {!final && l.period ? <span>{periodLabel(l.period)} {l.clock}</span> : null}
      {!final && l.timeout ? <span className="live-banner__timeout">{l.timeout.label}</span> : null}
      <span className="live-banner__sep">·</span>
      <span>{l.playCount} plays{l.lastChangedAt ? `, last new play ${ageText(now - Date.parse(l.lastChangedAt))}` : ''}</span>
      {stale ? <span className="live-banner__note">No update from the feed for {Math.round(polledAge / 1000)}s: capture may have stopped.</span> : null}
      {connection === 'reconnecting' ? <span className="live-banner__note">Reconnecting to the live server…</span> : null}
      {l.failedChecks.length ? <span className="live-banner__note">Failing checks: {l.failedChecks.join('; ')}</span> : null}
    </div>
  );
}

// A small floating pill with the half and the clock, for dropping into screenshots. Drag it anywhere; the spot is remembered.
const PILL_POS_KEY = 'live-clock-pill-pos';
function readPos() {
  try { return JSON.parse(window.localStorage.getItem(PILL_POS_KEY)) || null; } catch { return null; }
}
function ClockPill({ live }) {
  const [pos, setPos] = useState(readPos); // {x, y} in px from the top-left, or null for the default corner
  const drag = useRef(null);
  const final = live.status === 'final';
  const text = final ? 'Final' : [live.period ? periodLabel(live.period) : null, live.clock].filter(Boolean).join(' ');
  if (!text) return null;
  const onPointerDown = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    setPos({ x: Math.max(0, e.clientX - drag.current.dx), y: Math.max(0, e.clientY - drag.current.dy) });
  };
  const onPointerUp = () => {
    drag.current = null;
    try { if (pos) window.localStorage.setItem(PILL_POS_KEY, JSON.stringify(pos)); } catch { /* storage unavailable: it just won't be remembered */ }
  };
  return (
    <div
      className="clock-pill"
      style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      aria-label="Game clock (drag to move)"
    >
      {text}
      {!final && live.timeout ? <span className="clock-pill__timeout">{live.timeout.kind === 'media' ? 'Media TO' : 'TO'}</span> : null}
    </div>
  );
}

// /live/:name: one connection to the live server, shared by the tabs below (Box score, Kills).
export function LiveGame() {
  const { name: gameId } = useParams();
  const live = useLiveGame(gameId);
  const { data, connection, problem } = live;
  if (!data) {
    return (
      <div className="box">
        {problem ? <p className="mt-l">{problem}</p> : <YBallLoader />}
        {connection === 'reconnecting' ? <p className="mt-l">Can't reach the live server at {urls.liveGames().replace('/games', '')}. Start it with <code>node derivations/live-box-server.js</code>.</p> : null}
      </div>
    );
  }
  return (
    <div className="box">
      <LiveBanner data={data} connection={connection} />
      <ClockPill live={data.live} />
      <nav className="live-tabs" aria-label="Live game views">
        <NavLink end to={`/live/${gameId}`}>Box score</NavLink>
        <NavLink to={`/live/${gameId}/kills`}>Kills</NavLink>
        <NavLink to={`/live/${gameId}/lineups`}>Lineups</NavLink>
      </nav>
      <Outlet context={{ ...live, gameId }} />
    </div>
  );
}

export function LiveBox() {
  const { data } = useOutletContext();
  return <BoxBody data={data} inLive />;
}

// Kills for the game so far: the app's own detector (src/utils/kills.js) run in the browser on the live plays, BYU on defense.
export function LiveKills() {
  const { playsData, gameId } = useOutletContext();
  const game = useMemo(() => (playsData ? gameFromMeta(playsData.meta) : null), [playsData]);
  const result = useMemo(() => (playsData && game ? detectKills(playsData.plays, game.defense) : null), [playsData, game]);
  if (!result) return <YBallLoader />;
  return <KillsBody plays={playsData.plays} game={game} result={result} gameId={gameId} />;
}

// Lineups for the game so far: the app's own lineup view, fed the live plays. BYU only, like the rest of the lineup views.
export function LiveLineups() {
  const { playsData } = useOutletContext();
  if (!playsData) return <YBallLoader />;
  return <LineupsPanel plays={playsData.plays} topCombos />;
}

// /live: the games the live server knows about; goes straight to the only live one when there is exactly one.
export function LiveIndex() {
  const [games, setGames] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(urls.liveGames()).then((r) => r.json()).then(setGames).catch(() => setError(true));
  }, []);
  if (error) return <div className="box"><p className="mt-l">Can't reach the live server at {urls.liveGames().replace('/games', '')}. Start it with <code>node derivations/live-box-server.js</code>.</p></div>;
  if (!games) return <div className="box"><YBallLoader /></div>;
  const live = games.filter((g) => g.status === 'live');
  if (live.length === 1) return <Navigate replace to={`/live/${live[0].game_id}`} />;
  if (!games.length) return <div className="box"><p className="mt-l">No games have been captured yet.</p></div>;
  return (
    <div className="box">
      <h2 className="mt-l">Captured games</h2>
      <ul>
        {games.map((g) => (
          <li key={g.game_id}><Link to={`/live/${g.game_id}`}>{g.game_id}</Link> · {g.status === 'live' ? 'live' : 'final'} · {g.away_score}-{g.home_score} · {g.play_count} plays</li>
        ))}
      </ul>
    </div>
  );
}

export function LiveRouter() {
  return (
    <div className="lineups flex">
      <div className="lineups-content f1 flex-c pr-l"><Outlet /></div>
    </div>
  );
}
