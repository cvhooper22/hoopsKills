import { useEffect, useState } from 'react';
import urls from '../constants/assetUrls';

// A finished game's normalized plays (and header facts) from the data bucket. `error` is true when the game has no plays file.
export default function useGamePlays(gameId) {
  const [state, setState] = useState({ plays: null, meta: null, error: false });
  useEffect(() => {
    let live = true;
    setState({ plays: null, meta: null, error: false });
    Promise.all([
      fetch(urls.pbpGame(gameId)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))),
      fetch(urls.pbpGameMeta(gameId)).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([plays, meta]) => live && setState({ plays, meta, error: false }))
      .catch((err) => { console.error(err); if (live) setState({ plays: null, meta: null, error: true }); });
    return () => { live = false; };
  }, [gameId]);
  return state;
}
