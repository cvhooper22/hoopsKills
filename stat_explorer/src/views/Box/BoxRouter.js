import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import YBallLoader from '../../components/Loaders/YBballLoader';
import urls from '../../constants/assetUrls';
import GameSwitcher from '../../components/GameSwitcher/GameSwitcher';

// Same shell as Kills and Clutch: game/season pill on top, the box score below. Games without a
// derived box file (public/data/box) show a load error until the prototype has been run for them.
export default function BoxRouter() {
  return (
    <div className="lineups flex">
      <GameSwitcher basePath="games" />
      <div className="lineups-content box-shell box-shell--pill f1 flex-c pr-l">
        <Outlet />
      </div>
    </div>
  );
}

// /games -> the newest game in public/data/box/index.json
export function LatestBox() {
  const [id, setId] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(urls.boxIndex())
      .then((r) => r.json())
      .then((list) => (list.length ? setId(list[0].gameId) : setError(true)))
      .catch(() => setError(true));
  }, []);
  if (error) return <div className="mt-l">No box scores found. Run the prototype in dataAggregators/derivations.</div>;
  return id ? <Navigate replace to={`/games/${id}`} /> : <YBallLoader />;
}
