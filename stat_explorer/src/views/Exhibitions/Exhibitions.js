import { useEffect, useState } from 'react';
import YBallLoader from '../../components/Loaders/YBballLoader';
import urls from '../../constants/assetUrls';
import { combineBoxes } from '../../utils/boxCombine';
import { BoxBody } from '../Box/Box';
import '../Box/Box.css';

// TEMPORARY: BYU's two exhibition games totaled into one Box score. Delete this folder, utils/boxCombine.js,
// and the Exhibitions entries in App.js and constants/views.js once it has served its purpose.
const EXHIBITION_GAME_IDS = ['2026-10-16-nebraska-at-byu', '2026-10-24-byu-at-unlv'];

export default function Exhibitions() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all(EXHIBITION_GAME_IDS.map((id) => fetch(urls.boxGame(id)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))))
      .then((games) => {
        const combined = combineBoxes(games, { label: 'Exhibitions', opponents: 'Opponents' });
        combined.header.dateLabel = games.map((g) => g.header.teams.opp).join(' + ');
        setData(combined);
      })
      .catch((err) => { console.error(err); setError(true); });
  }, []);

  if (error) return <div className="box"><p className="mt-l">Could not load the exhibition box scores.</p></div>;
  if (!data) return <div className="box"><YBallLoader /></div>;
  return (
    <div className="lineups flex">
      <div className="lineups-content f1 flex-c pr-l">
        <div className="box"><BoxBody data={data} inLive /></div>
      </div>
    </div>
  );
}
