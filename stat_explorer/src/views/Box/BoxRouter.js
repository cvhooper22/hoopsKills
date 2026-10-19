import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import YBallLoader from '../../components/Loaders/YBballLoader';
import urls from '../../constants/assetUrls';

// Same shell as Kills and Clutch, minus the game switcher: box scores are a local prototype
// (public/data/box), so there is no games index to switch between yet.
export default function BoxRouter() {
  return (
    <div className="lineups flex">
      <div className="lineups-content f1 flex-c pr-l">
        <Outlet />
      </div>
    </div>
  );
}

// /box -> the newest game in public/data/box/index.json
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
  return id ? <Navigate replace to={`/box/${id}`} /> : <YBallLoader />;
}
