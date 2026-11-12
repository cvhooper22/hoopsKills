import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import YBallLoader from '../../components/Loaders/YBballLoader';
import XClose from '../../components/Icons/XClose';
import Pin from '../../components/Icons/Pin';
import urls from '../../constants/assetUrls';
import { BoxBody } from './Box';
import { BoxTabs } from './BoxParts';
import { AnalyticallyFinalPanel } from './BoxAnalyticallyFinal';
import { StintComparePanel } from './BoxStintCompare';
import { EventTimelinePanel } from './BoxEventTimeline';
import { LineupTimelinePanel } from './BoxLineupTimeline';
import { LineupComparePanel } from './BoxLineupCompare';
import { FindPlaysPanel } from './BoxFind';
import { ShotComparePanel } from './BoxShotCompare';
import { KillsBody, gameFromMeta } from '../Kills/Kills';
import { detectKills } from '../../utils/kills';
import { LineupsPanel } from '../Lineups/components/GameLineups';
import ShotChartPanel from '../../components/ShotChart/ShotChartPanel';
import { liveClockText, oppColorStyle } from './boxFormat';
import AskAi from '../../components/AskAi/AskAi';
import { useFlag } from '../../contexts/FeatureFlagsContext';
import { ASK_AI } from '../../constants/featureFlags';

// In-game page: the same box-score sections as /box, fed by derivations/live-box-server.js. The server recomputes the whole
// suite whenever new plays are stored and pushes it over server-sent events; this page just swaps the payload in. Behind the
// `liveGame` feature flag (see App.js). The base URL is the local server or, when deployed, the live-relay Worker (see assetUrls.js).
const UNAVAILABLE = "Live game data isn't available right now.";
const STATUS_LABEL = { live: 'live', stalled: 'not updating' }; // anything else reads as final
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
    fetch(urls.liveBox(gameId)).then((r) => { if (r.status === 404) setProblem('No live data for this game yet. Check back once the game has started.'); }).catch(() => {});
    return () => stream.close();
  }, [gameId]);

  return { data, playsData, connection, problem };
}

const BANNER_PIN_KEY = 'live-banner-pinned';
const readBannerPinned = () => { try { return window.localStorage.getItem(BANNER_PIN_KEY) !== '0'; } catch { return true; } }; // pinned unless the user turned it off
const ageText = (ms) => (ms < 1500 ? 'just now' : `${Math.round(ms / 1000)}s ago`);

function LiveBanner({ data, connection, children }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const [pinned, setPinned] = useState(readBannerPinned); // phone widths only: keep the banner on screen once it has been scrolled past
  const [stuck, setStuck] = useState(false); // true while it is riding at the top of the screen
  const sentinel = useRef(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !window.IntersectionObserver) return undefined;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const setPin = (value) => {
    setPinned(value);
    try { window.localStorage.setItem(BANNER_PIN_KEY, value ? '1' : '0'); } catch { /* storage unavailable: it just won't be remembered */ }
  };
  const l = data.live;
  const final = l.status === 'final';
  const polledAge = l.lastPolledAt ? now - Date.parse(l.lastPolledAt) : null;
  const stale = !final && polledAge !== null && polledAge > STALE_AFTER_MS;
  const state = final ? 'final' : stale || connection === 'reconnecting' ? 'warn' : 'live';
  const { final: pts, teams } = data.header || {};
  const score = pts && teams ? `${teams.byu} ${pts.byu}–${pts.opp} ${teams.opp}` : null;
  const cls = ['live-banner', `live-banner--${state}`, pinned ? 'live-banner--pinned' : '', pinned && stuck && score ? 'live-banner--stuck' : ''].filter(Boolean).join(' ');
  return (
    <>
      <div ref={sentinel} className="live-banner__sentinel" aria-hidden="true" />
      <div className={cls} role="status">
        <span className="live-banner__dot" aria-hidden="true" />
        <strong>{final ? 'Final' : stale ? 'Feed stalled' : 'Live'}</strong>
        {!final && l.period ? <span>{liveClockText(l)}</span> : null}
        {!final && l.timeout ? <span className="live-banner__timeout">{l.timeout.label}</span> : null}
        <span className="live-banner__sep">·</span>
        <span className="live-banner__age">{l.lastChangedAt ? `last new play ${ageText(now - Date.parse(l.lastChangedAt))}` : ''}</span>
        {score ? <span className="live-banner__score">{score}</span> : null}
        {children}
        <button type="button" className="live-banner__pin" onClick={() => setPin(!pinned)} aria-label={pinned ? 'Unpin banner' : 'Pin banner to the top of the screen'} title={pinned ? 'Unpin' : 'Pin to top'}>
          {pinned ? <XClose width={18} height={18} fillColor="currentColor" /> : <Pin width={18} height={18} fillColor="currentColor" />}
        </button>
        {stale ? <span className="live-banner__note">No update from the feed for {Math.round(polledAge / 1000)}s: capture may have stopped.</span> : null}
        {connection === 'reconnecting' ? <span className="live-banner__note">Reconnecting to the live server…</span> : null}
        {l.failedChecks.length ? <span className="live-banner__note">Failing checks: {l.failedChecks.join('; ')}</span> : null}
      </div>
    </>
  );
}

// The score, the half and the clock as a pill, for dropping into screenshots. Desktop only. It starts docked in the live banner; drag it anywhere
// (the spot is remembered) and a pin button sends it back. A "drag me anywhere" nudge shows for the first few sessions, until the pill has been dragged.
const PILL_POS_KEY = 'live-clock-pill-pos';
const NUDGE_COUNT_KEY = 'live-clock-pill-nudge-sessions'; // how many browser sessions have shown the nudge
const NUDGE_SEEN_KEY = 'live-clock-pill-nudge-counted'; // sessionStorage: this session is already counted
const NUDGE_DONE_KEY = 'live-clock-pill-dragged'; // the user has dragged it once, so the nudge has done its job
const NUDGE_SESSIONS = 3;
const DRAG_THRESHOLD = 4; // px of movement before a press becomes a drag, so a click never moves it
const store = {
  get: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* storage unavailable: it just won't be remembered */ } },
  del: (k) => { try { window.localStorage.removeItem(k); } catch { /* nothing to clear */ } },
};
function readPos() {
  try { return JSON.parse(store.get(PILL_POS_KEY)) || null; } catch { return null; }
}
function shouldNudge() {
  if (!window.matchMedia || !window.matchMedia('(min-width: 701px)').matches) return false; // the pill is hidden on phones
  if (store.get(NUDGE_DONE_KEY) || readPos()) return false;
  let count = Number(store.get(NUDGE_COUNT_KEY)) || 0;
  try {
    if (!window.sessionStorage.getItem(NUDGE_SEEN_KEY)) { window.sessionStorage.setItem(NUDGE_SEEN_KEY, '1'); count += 1; store.set(NUDGE_COUNT_KEY, String(count)); }
    if (window.sessionStorage.getItem('live-clock-pill-nudge-closed')) return false; // the x only hides it for this session; the count above keeps going
  } catch { /* no sessionStorage: count by page load */ }
  return count <= NUDGE_SESSIONS;
}
function ClockPill({ live, header }) {
  const [pos, setPos] = useState(readPos); // {x, y} in px from the top-left of the screen once dragged, or null while docked
  const [size, setSize] = useState(null); // the docked footprint, kept as a placeholder while the pill is away
  const [nudge, setNudge] = useState(shouldNudge);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const final = live.status === 'final';
  const text = final ? 'Final' : liveClockText(live);
  if (!text) return null;
  const { final: pts, teams } = header || {};
  const score = pts && teams ? `${teams.byu} ${pts.byu}–${pts.opp} ${teams.opp}` : null;
  const closeNudge = () => {
    setNudge(false);
    try { window.sessionStorage.setItem('live-clock-pill-nudge-closed', '1'); } catch { /* it will show again on reload */ }
  };
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const box = e.currentTarget.getBoundingClientRect();
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top, x0: e.clientX, y0: e.clientY, moved: false, box };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_THRESHOLD) return;
      d.moved = true;
      if (!pos) setSize({ width: d.box.width, height: d.box.height }); // leave a dashed slot behind in the banner
      setDragging(true);
      setNudge(false);
      store.set(NUDGE_DONE_KEY, '1');
    }
    const maxX = window.innerWidth - d.box.width;
    const maxY = window.innerHeight - d.box.height;
    setPos({ x: Math.min(Math.max(0, e.clientX - d.dx), maxX), y: Math.min(Math.max(0, e.clientY - d.dy), maxY) });
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d && d.moved && pos) store.set(PILL_POS_KEY, JSON.stringify(pos));
  };
  const dockAgain = () => { setPos(null); store.del(PILL_POS_KEY); };
  const cls = ['clock-pill', pos ? 'clock-pill--floating' : 'clock-pill--docked', dragging ? 'clock-pill--dragging' : '', nudge ? 'clock-pill--nudge' : ''].filter(Boolean).join(' ');
  return (
    <>
      {pos ? <span className="clock-slot" style={size || { width: '12rem', height: '2rem' }} aria-hidden="true" /> : null}
      <div
        className={cls}
        style={pos ? { left: pos.x, top: pos.y } : undefined}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        aria-label="Score and game clock (drag to move)"
      >
        <span className="clock-pill__grip" aria-hidden="true" />
        {score ? <span className="clock-pill__score">{score}</span> : null}
        {text}
        {!final && live.timeout ? <span className="clock-pill__timeout">{live.timeout.kind === 'media' ? 'Media TO' : 'TO'}</span> : null}
        {pos ? (
          <button type="button" className="clock-pill__home" onPointerDown={(e) => e.stopPropagation()} onClick={dockAgain} aria-label="Put the pill back in the banner" title="Put back">
            <Pin width={16} height={16} fillColor="currentColor" />
          </button>
        ) : null}
        {nudge ? (
          <span className="clock-pill__tip" role="note" onPointerDown={(e) => e.stopPropagation()}>
            Drag me anywhere
            <button type="button" className="clock-pill__tip-x" onClick={closeNudge} aria-label="Dismiss"><XClose width={14} height={14} fillColor="currentColor" /></button>
          </span>
        ) : null}
      </div>
    </>
  );
}

// /live/:name: one connection to the live server, shared by the tabs below (Box score, Kills).
export function LiveGame() {
  const { name: gameId } = useParams();
  const live = useLiveGame(gameId);
  const { data, connection, problem } = live;
  const askAiOn = useFlag(ASK_AI);
  if (!data) {
    return (
      <div className="box">
        {problem ? <p className="mt-l">{problem}</p> : <YBallLoader />}
        {connection === 'reconnecting' ? <p className="mt-l">{UNAVAILABLE}</p> : null}
      </div>
    );
  }
  return (
    <div className="box" style={oppColorStyle(data.header)}>
      <LiveBanner data={data} connection={connection}><ClockPill live={data.live} header={data.header} /></LiveBanner>
      <BoxTabs tabs={[
        { to: `/live/${gameId}`, label: 'Box score', end: true }, { to: `/live/${gameId}/stint-compare`, label: 'Stint Compare' }, { to: `/live/${gameId}/event-timeline`, label: 'Event timeline' }, { to: `/live/${gameId}/find`, label: 'Find plays' }, { to: `/live/${gameId}/analytically-final`, label: 'Analytically Final' }, { to: `/live/${gameId}/timeline`, label: 'Lineup timeline' }, { to: `/live/${gameId}/lineup-compare`, label: 'Lineup compare' },
        data.hasShotLocations !== false && { to: `/live/${gameId}/shots`, label: 'Shot chart' }, data.hasShotLocations !== false && { to: `/live/${gameId}/shot-compare`, label: 'Shot chart compare' }, { to: `/live/${gameId}/kills`, label: 'Kills' }, { to: `/live/${gameId}/lineups`, label: 'Lineups' },
      ].filter(Boolean)} />
      <Outlet context={{ ...live, gameId }} />
      {askAiOn && <AskAi data={data} inProgress={data.live.status !== 'final'} />}
    </div>
  );
}

export function LiveBox() {
  const { data } = useOutletContext();
  return <BoxBody data={data} inLive />;
}

// Shot locations for the game so far, from the live plays (any feed's coordinates; see utils/shotLocation.js).
export function LiveShots() {
  const { playsData } = useOutletContext();
  if (!playsData) return <YBallLoader />;
  return <ShotChartPanel plays={playsData.plays} meta={playsData.meta} />;
}

export function LiveShotCompare() {
  const { data, playsData } = useOutletContext();
  return <ShotComparePanel data={data} shotPlays={playsData ? playsData.plays : null} />;
}

// Kills for the game so far: the app's own detector (src/utils/kills.js) run in the browser on the live plays, BYU on defense.
export function LiveKills() {
  const { playsData, gameId } = useOutletContext();
  const game = useMemo(() => (playsData ? gameFromMeta(playsData.meta) : null), [playsData]);
  const result = useMemo(() => (playsData && game ? detectKills(playsData.plays, game.defense) : null), [playsData, game]);
  if (!result) return <YBallLoader />;
  return <KillsBody plays={playsData.plays} game={game} result={result} gameId={gameId} />;
}

// Plays for the game so far: the box payload's per-chance rows, regrouped in the browser.
export function LiveStintCompare() {
  const { data, playsData } = useOutletContext();
  return <StintComparePanel data={data} shotPlays={playsData ? playsData.plays : null} />;
}

// Event timeline for the game so far: every counting stat from the box payload's event log.
export function LiveEventTimeline() {
  const { data } = useOutletContext();
  return <EventTimelinePanel data={data} />;
}

// Find plays for the game so far: search of the box payload's event log.
export function LiveFind() {
  const { data } = useOutletContext();
  return <FindPlaysPanel data={data} />;
}

// Analytically Final for the game so far: derived from the box payload's event log.
export function LiveAnalyticallyFinal() {
  const { data } = useOutletContext();
  return <AnalyticallyFinalPanel data={data} />;
}

// Lineup timeline for the game so far, from the same per-chance rows as the Stint Compare tab.
export function LiveTimeline() {
  const { data } = useOutletContext();
  return <LineupTimelinePanel data={data} />;
}

// Lineup compare for the game so far: on/off splits from the same per-chance rows.
export function LiveLineupCompare() {
  const { data, playsData } = useOutletContext();
  return <LineupComparePanel data={data} shotPlays={playsData ? playsData.plays : null} />;
}

// Lineups for the game so far: the app's own lineup view, fed the live plays. BYU only, like the rest of the lineup views.
export function LiveLineups() {
  const { playsData, data } = useOutletContext();
  if (!playsData || !data) return <YBallLoader />;
  // The box payload's focus team is whichever side of the game is not its opponent (BYU in a BYU game).
  const { homeId, awayId } = playsData.meta;
  const focusTeamId = data.header.oppId === homeId ? awayId : homeId;
  return <LineupsPanel plays={playsData.plays} topCombos focusTeamId={focusTeamId} live={data.live.status !== 'final'} />;
}

// /live: the games the live server knows about; goes straight to the only live one when there is exactly one.
export function LiveIndex() {
  const [games, setGames] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(urls.liveGames()).then((r) => r.json()).then(setGames).catch(() => setError(true));
  }, []);
  if (error) return <div className="box"><p className="mt-l">{UNAVAILABLE}</p></div>;
  if (!games) return <div className="box"><YBallLoader /></div>;
  const live = games.filter((g) => g.status === 'live');
  if (live.length === 1) return <Navigate replace to={`/live/${live[0].game_id}`} />;
  if (!games.length) return <div className="box"><p className="mt-l">No live games right now.</p></div>;
  return (
    <div className="box">
      <h2 className="mt-l">Games</h2>
      <ul>
        {games.map((g) => (
          <li key={g.game_id}><Link to={`/live/${g.game_id}`}>{g.game_id}</Link> · {STATUS_LABEL[g.status] || 'final'} · {g.away_score}-{g.home_score} · {g.play_count} plays</li>
        ))}
      </ul>
    </div>
  );
}

export function LiveRouter() {
  return (
    <div className="lineups live-shell flex">
      <div className="lineups-content box-shell f1 flex-c pr-l"><Outlet /></div>
    </div>
  );
}
