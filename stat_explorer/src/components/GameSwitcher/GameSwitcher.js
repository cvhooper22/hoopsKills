import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import urls from '../../constants/assetUrls';
import './GameSwitcher.css';

const FOCUS_TEAM = 'byu';

// Season label matches common CBB notation, e.g. seasonYear 2025 -> "2025-26".
function seasonLabel(seasonYear) {
  if (seasonYear == null) return 'Unknown season';
  return `${seasonYear}-${String((seasonYear + 1) % 100).padStart(2, '0')}`;
}

// "vs [logo] Team": hides the logo quietly if the file is missing.
function OpponentLabel({ info }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [info.opponentId]);
  return (
    <>
      {info.prefix}
      {info.opponentId && !failed && (
        <img
          className="game-pill__logo"
          src={urls.teamLogo(info.opponentId)}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
      <span>{info.opponentName}</span>
    </>
  );
}

// BYU's score always first. "at Team" on the road, "vs Team" at home, "(N)" on a neutral court.
function formatGame(g) {
  const byuHome = g.homeTeamId === FOCUS_TEAM;
  const opponentName = byuHome ? g.awayTeamName : g.homeTeamName;
  const byuScore = byuHome ? g.finalScoreHome : g.finalScoreAway;
  const oppScore = byuHome ? g.finalScoreAway : g.finalScoreHome;
  const hasScore = g.status === 'final' && byuScore != null && oppScore != null;
  return {
    prefix: byuHome ? 'vs' : 'at',
    opponentName: `${opponentName}${g.neutralSite ? ' (N)' : ''}`,
    opponentId: byuHome ? g.awayTeamId : g.homeTeamId,
    result: hasScore ? (byuScore > oppScore ? 'W' : 'L') : null,
    byuScore: hasScore ? byuScore : null,
    oppScore: hasScore ? oppScore : null,
    scoreText: hasScore ? `${byuScore}-${oppScore}` : null,
    opponentText: `${byuHome ? 'vs' : 'at'} ${opponentName}${g.neutralSite ? ' (N)' : ''}`,
  };
}

function groupBySeason(games) {
  const groups = new Map();
  [...games].reverse().forEach((g) => {
    const key = g.seasonYear ?? 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  });
  return groups;
}

// Floating pill showing the current season + game. Opening it slides season pills out to the
// right and drops the game list down; picking a game rolls everything back into the pill.
// Reads hoopstats/games/index.json and links into /<basePath>/<gameId> for the current view.
export default function GameSwitcher({ basePath }) {
  const [games, setGames] = useState(null);
  const [open, setOpen] = useState(false);
  const [pickedSeason, setPickedSeason] = useState(null);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const rootRef = useRef(null);

  useEffect(() => {
    fetch(urls.gamesIndex())
      .then((r) => r.json())
      .then(setGames)
      .catch((err) => { console.error(err); setGames([]); });
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!games) return null;

  const seasons = [...groupBySeason(games).entries()];
  const currentGame = games.find((g) => location.pathname === `/${basePath}/${g.gameId}`);
  // Kills has a "Full Season" entry at the top of each season's list, living at /kills/season.
  const hasSeasonPage = basePath === 'kills';
  const onSeasonPage = hasSeasonPage && location.pathname === `/${basePath}/season`;
  const seasonParam = Number(searchParams.get('season')) || null;
  const currentKey = currentGame ? (currentGame.seasonYear ?? 'unknown')
    : (onSeasonPage && seasons.some(([k]) => k === seasonParam) ? seasonParam : seasons[0]?.[0]);
  const activeKey = pickedSeason ?? currentKey;
  const activeGames = seasons.find(([k]) => k === activeKey)?.[1] ?? [];
  const currentInfo = currentGame ? formatGame(currentGame) : null;
  const fullSeasonTo = (k) => `/${basePath}/season?season=${k}`;
  const labelFor = (k) => seasonLabel(k === 'unknown' ? null : k);

  function toggle() {
    setPickedSeason(null);
    setOpen((o) => !o);
  }

  return (
    <div className={`game-pill${open ? ' game-pill--open' : ''}${basePath === 'lineups' ? '' : ' game-pill--radii'}`} ref={rootRef}>
      <div className="game-pill__row">
        <button type="button" className="game-pill__main" onClick={toggle} aria-expanded={open}>
          <span className="game-pill__season">{labelFor(currentKey)}</span>
          <span className="game-pill__divider" />
          <span className="game-pill__game">
            {currentInfo ? <OpponentLabel info={currentInfo} /> : (onSeasonPage ? 'Full Season' : 'Select a game')}
          </span>
          {currentInfo?.scoreText && (
            <span className="game-pill__final">
              <span className={`game-pill__byu-score game-pill__byu-score--${currentInfo.result === 'W' ? 'win' : 'loss'}`}>
                {currentInfo.byuScore}
              </span>
              -{currentInfo.oppScore}
            </span>
          )}
          <span className="game-pill__chevron" aria-hidden="true" />
        </button>
        <div className="game-pill__seasons">
          {seasons.map(([k]) => (
            <button
              type="button"
              key={k}
              className={`game-pill__season-pill${k === activeKey ? ' game-pill__season-pill--active' : ''}`}
              tabIndex={open ? 0 : -1}
              onClick={() => setPickedSeason(k)}
            >
              {labelFor(k)}
            </button>
          ))}
        </div>
      </div>
      <div className="game-pill__list" aria-hidden={!open}>
        <div className="game-pill__list-inner">
          {hasSeasonPage && activeKey !== 'unknown' && (
            <Link
              to={fullSeasonTo(activeKey)}
              tabIndex={open ? 0 : -1}
              className={`game-pill__game-row game-pill__game-row--season${onSeasonPage && activeKey === currentKey ? ' game-pill__game-row--selected' : ''}`}
            >
              Full Season {activeKey}
            </Link>
          )}
          {activeGames.map((g) => {
            const to = `/${basePath}/${g.gameId}`;
            const isCurrent = location.pathname === to;
            const info = formatGame(g);
            const { result, scoreText } = info;
            return (
              <Link
                to={to}
                key={g.gameId}
                tabIndex={open ? 0 : -1}
                className={`game-pill__game-row${isCurrent ? ' game-pill__game-row--selected' : ''}`}
              >
                <span className={`game-switcher__result${result ? ` game-switcher__result--${result.toLowerCase()}` : ''}`}>
                  {result}
                </span>
                <span className="game-switcher__score">{scoreText}</span>
                <span className="game-pill__opponent"><OpponentLabel info={info} /></span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
