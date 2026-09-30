import React, { useCallback, useEffect, useState } from 'react';
import { adminApiConfigured, adminFetch, DEV_PROXY, getPassword, onAuthLost, setPassword } from './adminApi';
import './AdminGate.css';

// Login gate for the admin pages. Children (and their code, which the caller
// lazy-loads) are only rendered after the API confirms the password via
// GET /whoami. This is UX only: the API itself rejects any request without a
// valid password.
async function checkPassword(password) {
  const res = await adminFetch('/whoami', { password });
  if (res.ok) return null;
  if (res.status === 401 || res.status === 403) return 'Incorrect password';
  if (res.status === 429) return 'Too many attempts, wait a moment and try again';
  return `Unexpected response (${res.status})`;
}

export default function AdminGate({ children }) {
  // 'checking' (validating a remembered password) | 'locked' | 'open'
  const [state, setState] = useState(() => (getPassword() ? 'checking' : 'locked'));
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const attempt = useCallback(async (password, fromStorage) => {
    setBusy(true);
    setError(null);
    try {
      const failure = await checkPassword(password);
      if (failure) {
        setPassword('');
        setState('locked');
        if (!fromStorage) setError(failure);
        return;
      }
      setPassword(password);
      setInput('');
      setState('open');
    } catch (e) {
      setState('locked');
      setError("Can't reach the admin API");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const stored = getPassword();
    if (stored) attempt(stored, true);
  }, [attempt]);

  // Any later request that comes back 401/403 (rotated password) re-locks the page.
  useEffect(
    () =>
      onAuthLost(() => {
        setState('locked');
        setError('Signed out: the password was rejected');
      }),
    []
  );

  if (state === 'open' || DEV_PROXY) return children; // DEV_PROXY: local `npm start`, see adminApi.js

  if (!adminApiConfigured()) {
    return (
      <div className="admin-gate">
        <p className="admin-gate__error">The admin API isn't configured for this build (REACT_APP_ADMIN_API_URL).</p>
      </div>
    );
  }

  if (state === 'checking') {
    return <div className="admin-gate"><p>Checking…</p></div>;
  }

  return (
    <div className="admin-gate">
      <form
        className="admin-gate__form"
        onSubmit={(e) => {
          e.preventDefault();
          if (input && !busy) attempt(input, false);
        }}
      >
        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={busy || !input}>{busy ? 'Checking…' : 'Unlock'}</button>
        {error && <p className="admin-gate__error" role="alert">{error}</p>}
      </form>
    </div>
  );
}
