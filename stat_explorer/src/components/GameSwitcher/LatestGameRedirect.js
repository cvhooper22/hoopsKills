import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import urls from '../../constants/assetUrls';

// Index route for a game view: sends /<basePath> to the most recent final game so the view
// only ever mounts with a real game id.
export default function LatestGameRedirect({ basePath }) {
  const [latest, setLatest] = useState(undefined);

  useEffect(() => {
    fetch(urls.gamesIndex())
      .then((r) => r.json())
      .then((games) => {
        const finals = games.filter((g) => g.status === 'final');
        finals.sort((a, b) => a.date.localeCompare(b.date));
        setLatest(finals[finals.length - 1] ?? null);
      })
      .catch((err) => { console.error(err); setLatest(null); });
  }, []);

  if (latest) return <Navigate replace to={`/${basePath}/${latest.gameId}`} />;
  return null;
}
