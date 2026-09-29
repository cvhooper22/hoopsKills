import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import urls from '../../constants/assetUrls';
import '../GameSelector/GameSelector.css';
import './GameSwitcher.css';

const FOCUS_TEAM = 'byu';

// Season label matches common CBB notation, e.g. seasonYear 2025 -> "2025-26".
function seasonLabel(seasonYear) {
  if (seasonYear == null) return 'Unknown season';
  return `${seasonYear}-${String((seasonYear + 1) % 100).padStart(2, '0')}`;
}

// BYU's score always first. "at Team" on the road, "vs Team" at home, "(N)" on a neutral court.
function formatGame(g) {
  const byuHome = g.homeTeamId === FOCUS_TEAM;
  const opponentName = byuHome ? g.awayTeamName : g.homeTeamName;
  const byuScore = byuHome ? g.finalScoreHome : g.finalScoreAway;
  const oppScore = byuHome ? g.finalScoreAway : g.finalScoreHome;
  const hasScore = g.status === 'final' && byuScore != null && oppScore != null;
  return {
    result: hasScore ? (byuScore > oppScore ? 'W' : 'L') : null,
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

// Reads hoopstats/games/index.json and links into /<basePath>/<gameId> for the current view.
export default function GameSwitcher({ basePath }) {
  const [games, setGames] = useState(null);
  const location = useLocation();

  useEffect(() => {
    fetch(urls.gamesIndex())
      .then((r) => r.json())
      .then(setGames)
      .catch((err) => { console.error(err); setGames([]); });
  }, []);

  if (!games) return null;

  return (
    <div className="games flex-c mr-l scroll">
      {[...groupBySeason(games).entries()].map(([seasonYear, seasonGames]) => (
        <div key={seasonYear} className="games__broad-selectors">
          <div className="game-row flex-aic">
            <span className="game-oponent ml-s">{seasonLabel(seasonYear === 'unknown' ? null : seasonYear)}</span>
          </div>
          {seasonGames.map((g) => {
            const to = `/${basePath}/${g.gameId}`;
            const isCurrent = location.pathname === to;
            const { result, scoreText, opponentText } = formatGame(g);
            return (
              <Link to={to} className="game-link" key={g.gameId}>
                <div className={`game-row flex-aic${isCurrent ? ' game-row--selected' : ''}`}>
                  {result && (
                    <span className={`game-switcher__result game-switcher__result--${result.toLowerCase()}`}>
                      {result}
                    </span>
                  )}
                  {scoreText && <span className="game-switcher__score ml-s">{scoreText}</span>}
                  <span className="game-oponent ml-s">{opponentText}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
