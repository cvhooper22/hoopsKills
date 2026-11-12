import React, { useCallback, useEffect, useState } from 'react';
import './RankingsAdmin.css';

// Hidden page at /admin/rankings. Local only, like /admin/stops: it talks to the dev-only endpoints in
// src/setupProxy.js, which run dataAggregators/ingest/rankings/run.js against the local Postgres, so it only
// works under `npm start`. One click collects the latest snapshot of every ratings system; run it on game day
// before tip-off (a snapshot pulled after the game already contains that game).

const SYSTEMS = ['torvik', 'net', 'haslam', 'kenpom', 'evanmiya'];
const BROWSER_NOTE = {
  kenpom: 'opens a Chrome window for a few seconds',
  evanmiya: 'runs a hidden browser',
};

const daysAgo = (iso) => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};
const ago = (iso) => {
  const d = daysAgo(iso);
  if (d === null) return 'never';
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
const fmt = (v, digits = 1) => (v === null || v === undefined ? '–' : Number(v).toFixed(digits));

async function api(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function SystemRow({ s, running, onRun }) {
  const stale = daysAgo(s.captured_at) > 0;
  const n = s.notes || {};
  return (
    <tr>
      <td><strong>{s.name}</strong>{BROWSER_NOTE[s.system] && <div className="rankings-admin__note">{BROWSER_NOTE[s.system]}</div>}</td>
      <td className="rankings-admin__num">{s.through_date || '–'}</td>
      <td className={stale ? 'rankings-admin__stale' : ''}>{ago(s.captured_at)}</td>
      <td className="rankings-admin__num">{s.snapshots}</td>
      <td className="rankings-admin__num">{s.teams_covered ? `${s.teams_covered}/${s.teams_expected || '?'}` : '–'}</td>
      <td className="rankings-admin__num">
        {s.overall_rank ? <>#{s.overall_rank}{s.off_rank ? ` · O ${s.off_rank} · D ${s.def_rank}` : ''}</> : '–'}
        {s.overall_rating !== null && s.overall_rating !== undefined && s.system !== 'torvik' ? <div className="rankings-admin__note">rating {fmt(s.overall_rating, 2)}</div> : null}
      </td>
      <td>
        {n.unresolved && <div className="rankings-admin__warn">{n.unresolved.length} unmatched team names: {n.unresolved.slice(0, 6).join('; ')}{n.unresolved.length > 6 ? '…' : ''}</div>}
        {n.focusRecordMismatch && <div className="rankings-admin__warn">BYU record {n.focusRecordMismatch.snapshot} here vs {n.focusRecordMismatch.games} in games: check the snapshot date</div>}
      </td>
      <td><button type="button" className="rankings-admin__row-run" disabled={running} onClick={() => onRun([s.system])}>Run</button></td>
    </tr>
  );
}

// The app's canonical team list for ratings and the spelling -> team mapping (local only: these edit
// dataAggregators/config/rating-teams.json and rating-team-synonyms.json). A name a collector could not match is either
// mapped to an existing team or added as a new one; the system that reported it then needs a re-run.
function MappingEditor({ onRerun, running }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [picks, setPicks] = useState({});
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);   // { id, name } while renaming
  const [touched, setTouched] = useState([]);     // systems with a name mapped since their last run

  const load = useCallback(async () => {
    try { setData(await api('/api/rankings/mappings')); setError(''); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const send = async (method, path, body, systems = []) => {
    try {
      await api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setError('');
      setTouched((t) => [...new Set([...t, ...systems])]);
      await load();
      return true;
    } catch (e) { setError(e.message); return false; }
  };

  if (!data) return <p className="rankings-admin__note">{error || 'Loading mappings…'}</p>;
  const byName = new Map(data.teams.map((t) => [t.name.toLowerCase(), t]));
  const match = (v) => (v ? byName.get(v.trim().toLowerCase()) : null);
  const f = filter.toLowerCase();
  const teams = data.teams.filter((t) => !f || `${t.name} ${t.id}`.toLowerCase().includes(f));
  const maps = data.synonyms.filter((m) => !f || `${m.alias_key} ${m.team_name || m.team_id}`.toLowerCase().includes(f));
  return (
    <div className="rankings-admin__mappings">
      <datalist id="rating-team-names">{data.teams.map((t) => <option key={t.id} value={t.name} />)}</datalist>
      {error && <p className="rankings-admin__status--error">{error}</p>}

      {data.unresolved.length > 0 && (
        <>
          <h3>Names no team matched</h3>
          <p className="rankings-admin__note">Type an existing team to map this spelling to it, or a new name to add a team.</p>
          {data.unresolved.map((u) => u.names.map((name) => {
            const k = `${u.system}:${name}`, v = picks[k] || '';
            const existing = match(v);
            return (
              <div key={k} className="rankings-admin__map-row">
                <span><strong>{name}</strong> <span className="rankings-admin__note">({u.system}, through {u.throughDate})</span></span>
                <input list="rating-team-names" placeholder="Team name" value={v} onChange={(e) => setPicks({ ...picks, [k]: e.target.value })} />
                {existing
                  ? <button type="button" className="rankings-admin__row-run" onClick={() => send('POST', '/api/rankings/mappings', { alias: name, team: existing.name }, [u.system])}>Map to {existing.name}</button>
                  : <button type="button" className="rankings-admin__row-run" disabled={!v.trim()} onClick={() => send('POST', '/api/rankings/teams', { name: v.trim(), alias: name }, [u.system])}>Add &ldquo;{v.trim()}&rdquo; as a new team</button>}
              </div>
            );
          }))}
        </>
      )}
      {touched.length > 0 && (
        <p className="rankings-admin__note">
          Changed since the last run: re-run {touched.map((s) => (
            <button key={s} type="button" className="rankings-admin__row-run" disabled={running} onClick={() => { setTouched((t) => t.filter((x) => x !== s)); onRerun([s]); }}>{s}</button>
          ))} to apply it.
        </p>
      )}

      <input className="rankings-admin__filter" placeholder="Filter teams and mappings" value={filter} onChange={(e) => setFilter(e.target.value)} />

      <h3>Canonical teams ({data.teams.length})</h3>
      <table className="rankings-admin__table">
        <thead><tr><th>Name</th><th>Id</th><th>Games team name</th><th /></tr></thead>
        <tbody>
          {teams.slice(0, 60).map((t) => (
            <tr key={t.id}>
              <td>
                {editing && editing.id === t.id
                  ? <input autoFocus value={editing.name} onChange={(e) => setEditing({ id: t.id, name: e.target.value })} />
                  : t.name}
              </td>
              <td>{t.id}</td>
              <td className={t.appName && t.appName !== t.name ? 'rankings-admin__stale' : 'rankings-admin__note'}>{t.appName || '–'}</td>
              <td>
                {editing && editing.id === t.id
                  ? <>
                    <button type="button" className="rankings-admin__row-run" onClick={async () => { if (await send('POST', '/api/rankings/teams/rename', editing)) setEditing(null); }}>Save</button>{' '}
                    <button type="button" className="rankings-admin__row-run" onClick={() => setEditing(null)}>Cancel</button>
                  </>
                  : <button type="button" className="rankings-admin__row-run" onClick={() => setEditing({ id: t.id, name: t.name })}>Rename</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {teams.length > 60 && <p className="rankings-admin__note">Showing 60 of {teams.length}; filter to find a team.</p>}

      <h3>Spellings mapped to a team ({data.synonyms.length})</h3>
      <table className="rankings-admin__table">
        <thead><tr><th>Spelling (as a key)</th><th>Maps to</th><th /></tr></thead>
        <tbody>
          {maps.map((m) => (
            <tr key={m.alias_key}>
              <td>{m.alias_key}</td>
              <td>{m.team_name || <span className="rankings-admin__warn">{m.team_id} (no such team)</span>}</td>
              <td><button type="button" className="rankings-admin__row-run" onClick={() => send('DELETE', '/api/rankings/mappings', { key: m.alias_key })}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ManualMap teams={data.teams} onMap={(alias, team) => send('POST', '/api/rankings/mappings', { alias, team })} />
    </div>
  );
}

function ManualMap({ teams, onMap }) {
  const [alias, setAlias] = useState('');
  const [team, setTeam] = useState('');
  return (
    <>
      <h3>Map a spelling by hand</h3>
      <div className="rankings-admin__map-row">
        <input placeholder="Name as a site prints it" value={alias} onChange={(e) => setAlias(e.target.value)} />
        <input list="rating-team-names" placeholder="Team" value={team} onChange={(e) => setTeam(e.target.value)} />
        <button type="button" className="rankings-admin__row-run" disabled={!alias || !team || !teams.some((t) => t.name.toLowerCase() === team.trim().toLowerCase())}
          onClick={async () => { if (await onMap(alias, team)) { setAlias(''); setTeam(''); } }}>Map</button>
      </div>
    </>
  );
}

export default function RankingsAdmin() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [uploaded, setUploaded] = useState(null);
  const [backfill, setBackfill] = useState({ from: '2025-10-27', to: '2026-04-14' });

  const load = useCallback(async () => {
    try {
      setStatus(await api('/api/rankings/status'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (body) => {
    setRunning(true);
    setLastRun(null);
    try {
      const result = await api('/api/rankings/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setLastRun(result);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
      load();
    }
  };

  // Sends the timeline files and their opponent logos to the shared bucket, which is where the /rankings page reads them.
  const upload = async () => {
    if (!window.confirm('Upload the rankings timeline files and their opponent logos to the shared S3 bucket?')) return;
    setRunning(true);
    setUploaded(null);
    try {
      setUploaded(await api('/api/rankings/upload', { method: 'POST' }));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const systems = status ? status.systems : SYSTEMS.map((system) => ({ system, name: system, snapshots: 0 }));
  return (
    <div className="rankings-admin">
      <h2>Rankings</h2>
      <p className="rankings-admin__lede">
        Collects the latest team ratings from each system into the local database. Run it on game day before tip-off:
        a snapshot pulled after the game already includes that game, which would leak the result into &ldquo;rank when we played them&rdquo;.
      </p>
      <div className="rankings-admin__bar">
        <button type="button" disabled={running} onClick={() => run({})}>{running ? 'Running…' : 'Run all systems'}</button>
        <button type="button" disabled={running} onClick={upload}>Upload timeline to S3</button>
        <button type="button" disabled={running} onClick={load}>Refresh</button>
        {running && <span className="rankings-admin__note">KenPom opens a Chrome window; this takes about a minute.</span>}
        {error && <span className="rankings-admin__status--error">{error}</span>}
      </div>
      {uploaded && (
        <p className={uploaded.failed.length ? 'rankings-admin__status--error' : 'rankings-admin__status--ok'}>
          Uploaded {uploaded.uploaded.length} file{uploaded.uploaded.length === 1 ? '' : 's'} ({uploaded.uploaded.filter((k) => k.startsWith('rankings/')).join(', ') || 'no timeline'} and {uploaded.uploaded.filter((k) => k.startsWith('assets/')).length} logos).
          {uploaded.failed.length > 0 && ` Failed: ${uploaded.failed.map((f) => `${f.key} (${f.error})`).join('; ')}`}
          {' '}The page can lag by up to 5 minutes (cache).
        </p>
      )}

      <table className="rankings-admin__table">
        <thead>
          <tr><th>System</th><th>Games through</th><th>Collected</th><th>Snapshots</th><th>Teams</th><th>BYU</th><th>Notes</th><th /></tr>
        </thead>
        <tbody>
          {systems.map((s) => <SystemRow key={s.system} s={s} running={running} onRun={(list) => run({ systems: list })} />)}
        </tbody>
      </table>

      {lastRun && (
        <div className="rankings-admin__runs">
          <strong>Last run</strong>
          <ul>
            {Object.entries(lastRun.results || {}).map(([system, r]) => (
              <li key={system} className={r.status === 'error' ? 'rankings-admin__status--error' : 'rankings-admin__status--ok'}>
                {system}: {r.status}{r.throughDate ? ` (through ${r.throughDate})` : ''}{r.error ? ` — ${r.error}` : ''}
                {r.inserted !== undefined ? ` — ${r.inserted} new, ${r.unchanged} unchanged, ${r.missing} with no file` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2>Torvik history</h2>
      <p className="rankings-admin__lede">Torvik publishes a dated snapshot for every day, so past days can be filled in (one small download per day, already-stored days are skipped).</p>
      <div className="rankings-admin__backfill">
        <label>From <input type="date" value={backfill.from} onChange={(e) => setBackfill({ ...backfill, from: e.target.value })} /></label>
        <label>To <input type="date" value={backfill.to} onChange={(e) => setBackfill({ ...backfill, to: e.target.value })} /></label>
        <button type="button" className="rankings-admin__row-run" disabled={running} onClick={() => run({ backfill })}>Backfill</button>
      </div>

      <h2>Teams and name mapping</h2>
      <p className="rankings-admin__lede">
        Every site spells teams differently. Spellings are matched to this app's own team list, which started from Torvik's names but does not depend on them.
        This edits <code>dataAggregators/config/rating-teams.json</code> and <code>rating-team-synonyms.json</code>,
        so it works on your machine under <code>npm start</code> and not on the deployed site.
      </p>
      <MappingEditor running={running} onRerun={(list) => run({ systems: list })} />

      {status && status.runs.length > 0 && (
        <>
          <h2>Recent runs</h2>
          <ul className="rankings-admin__runs">
            {status.runs.map((r) => (
              <li key={r.run_id}>
                #{r.run_id} · {new Date(r.started_at).toLocaleString()} · {r.trigger} ·{' '}
                {Object.entries(r.results || {}).map(([k, v]) => `${k} ${v.status}`).join(', ') || (r.finished_at ? 'no systems' : 'unfinished')}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
