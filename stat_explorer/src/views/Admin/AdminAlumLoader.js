import React, { useCallback, useEffect, useState } from 'react';
import { fetchAlum } from './adminApi';

// Loads the alumni list from S3 through the admin API and hands it to `children`
// (a function). There is deliberately no fallback data: if the load fails the
// editor never mounts, so nothing stale or empty can be saved over S3.
export default function AdminAlumLoader({ children }) {
  const [alum, setAlum] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(() => {
    setError(null);
    setAlum(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAlum()
      .then((data) => { if (!cancelled) setAlum(data); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [attempt]);

  if (error) {
    return (
      <div className="admin-gate">
        <div className="admin-gate__form">
          <p className="admin-gate__error" role="alert">{error}</p>
          <button type="button" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }
  if (!alum) return <div className="admin-gate"><p>Loading alumni…</p></div>;
  return children(alum);
}
