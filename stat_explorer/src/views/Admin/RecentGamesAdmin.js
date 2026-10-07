import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAlum, saveAlum } from './adminApi';
import CombinedRecentGames, { flattenGames } from './CombinedRecentGames';
import TopGamesPostSection from './TopGamesPost';
import './RecentGamesAdmin.css';

// Hidden page at /admin/recent-games, behind the password gate. The alumni list comes
// from S3 (`initialAlum`, loaded by AdminAlumLoader). Runs countdown/recent_games.py per alum
// through the dev-only proxy (src/setupProxy.js), so it only works under
// `npm start`. Each Run pulls the games fresh; "Run all" also saves the results to
// public/data/recent-games.json (gitignored) so the combined table loads without re-running.

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
};

const ARROW = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><polyline points="12 16 16 12 12 8" /><line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

function RankedGames({ games }) {
  const byRank = [...games].sort((a, b) => a.rank - b.rank);
  return (
    <table className="recent-games__table">
      <thead>
        <tr><th>#</th><th>GmSc</th><th>Date</th><th>Opp</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th><th>FG</th><th>3P</th><th>FT</th><th>MIN</th><th>Result</th></tr>
      </thead>
      <tbody>
        {byRank.map((g) => (
          <tr key={`${g.date}-${g.opp}`}>
            <td>{g.rank}</td>
            <td className="recent-games__strong">{g.gameScore.toFixed(1)}</td>
            <td>{g.date}</td>
            <td className="recent-games__left">{g.home === false ? '@ ' : ''}{g.opp}</td>
            <td>{g.pts}</td><td>{g.reb}</td><td>{g.ast}</td><td>{g.stl}</td><td>{g.blk}</td><td>{g.tov}</td>
            <td>{g.fg}</td><td>{g.threes}</td><td>{g.ft}</td><td>{g.min}</td>
            <td>{g.result}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// FIBA 3x3: the event's games from the team page, each scored from its boxscore.
// Game Score is Hollinger on the 3x3 line times a multiplier (3x3 goes to 21), shown as
// raw x multiplier so the adjustment stays visible. 1PT + 2PT shots count as FG; "2P" is the arc.
const dash = (v) => (v === null || v === undefined ? '–' : v);

function ScheduleGames({ games }) {
  const byRank = [...games].sort((a, b) => (a.rank || 99) - (b.rank || 99));
  return (
    <table className="recent-games__table">
      <thead>
        <tr><th>#</th><th>GmSc</th><th>Raw × k</th><th>Date</th><th>Opp</th><th>Result</th><th>Round</th><th>PTS</th><th>REB</th><th>AST</th><th>BLK</th><th>TOV</th><th>FG</th><th>2P (arc)</th><th>FT</th><th>Boxscore</th></tr>
      </thead>
      <tbody>
        {byRank.map((g) => (
          <tr key={g.url}>
            <td>{dash(g.rank)}</td>
            <td className="recent-games__strong">{g.gameScore == null ? '–' : g.gameScore.toFixed(1)}</td>
            <td>{g.gameScoreRaw == null ? '–' : `${g.gameScoreRaw.toFixed(1)} × ${g.gameScoreScale}`}</td>
            <td>{g.date}</td>
            <td className="recent-games__left">{g.opp}</td>
            <td>{g.result}</td>
            <td className="recent-games__left">{g.round}</td>
            <td>{dash(g.pts)}</td><td>{dash(g.reb)}</td><td>{dash(g.ast)}</td><td>{dash(g.blk)}</td><td>{dash(g.tov)}</td>
            <td>{dash(g.fg)}</td><td>{dash(g.threes)}</td><td>{dash(g.ft)}</td>
            <td>
              <a className="recent-games__arrow" href={g.url} target="_blank" rel="noreferrer" title={`Boxscore: ${g.team} vs ${g.opp}`}>
                {ARROW}
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Result({ entry }) {
  if (!entry) return null;
  if (entry.loading) return <div className="recent-games__note">Running… (RealGM opens a Chrome window and can take a minute)</div>;
  if (entry.error) return <div className="recent-games__note recent-games__note--error">{entry.error}</div>;
  return (
    <div>
      <div className="recent-games__note">
        {entry.source} · {entry.status}{entry.message ? ` — ${entry.message}` : ''}
      </div>
      {entry.games.length > 0 && (entry.kind === 'schedule' ? <ScheduleGames games={entry.games} /> : <RankedGames games={entry.games} />)}
    </div>
  );
}

export default function RecentGamesAdmin({ initialAlum: alumSeed }) {
  const [days, setDays] = useState(7);
  const [n, setN] = useState(7);
  const [showInactive, setShowInactive] = useState(false);
  const [results, setResults] = useState({}); // name -> { loading } | { error } | entry
  const [eventUrls, setEventUrls] = useState(() =>
    Object.fromEntries(alumSeed.map((a) => [a.name, a.recentGamesUrl || '']))
  );
  const [savedUrls, setSavedUrls] = useState(eventUrls);
  const [urlMsg, setUrlMsg] = useState({});
  const [runningAll, setRunningAll] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [publishMsg, setPublishMsg] = useState('');
  const [publishing, setPublishing] = useState(false);
  const resultsRef = useRef(results);
  resultsRef.current = results;

  const alumByName = useMemo(() => Object.fromEntries(alumSeed.map((a) => [a.name, a])), [alumSeed]);
  const teams = useMemo(() => Object.fromEntries(alumSeed.map((a) => [a.name, a.team])), [alumSeed]);

  // Saved results from the last "Run all", if any. In dev a missing file falls back to
  // index.html, so a non-JSON body just means "nothing saved yet".
  useEffect(() => {
    fetch('/data/recent-games.json')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.players) {
          setResults((r) => ({ ...data.players, ...r }));
          setGeneratedAt(data.generatedAt);
          if (data.days !== undefined) setDays(data.days);
          if (data.n !== undefined) setN(data.n);
        }
      })
      .catch(() => {});
  }, []);

  const alumni = alumSeed.filter((a) => showInactive || !a.inactive);

  async function run(name) {
    setResults((r) => ({ ...r, [name]: { loading: true } }));
    try {
      const res = await fetch('/api/recent-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, days: Number(days), n: Number(n) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setResults((r) => ({ ...r, [name]: data }));
      return data;
    } catch (e) {
      const entry = { error: `${e.message} (this only works under "npm start" locally)` };
      setResults((r) => ({ ...r, [name]: entry }));
      return entry;
    }
  }

  async function runAll() {
    setRunningAll(true);
    setSaveMsg('');
    const fresh = {};
    for (const a of alumni) {
      if (a.playerUrl || eventUrls[a.name]) fresh[a.name] = await run(a.name);
    }
    setRunningAll(false);
    await saveResults(fresh);
  }

  // Merge into what was saved before, so alumni not in this run (e.g. inactive ones hidden) keep their entries.
  async function saveResults(fresh) {
    const ok = Object.fromEntries(Object.entries(fresh).filter(([, e]) => e && !e.error && !e.loading));
    const payload = { generatedAt: new Date().toISOString(), days: Number(days), n: Number(n), players: { ...savedPlayers(), ...ok } };
    try {
      const res = await fetch('/api/recent-games-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setGeneratedAt(payload.generatedAt);
      setSaveMsg('Saved to public/data/recent-games.json');
    } catch (e) {
      setSaveMsg(`Not saved: ${e.message}`);
    }
  }

  // Uploads the saved file to S3 as recent-games-<UTC run time>.json (see setupProxy.js).
  // A dry run first names the exact key, then the upload only happens after a confirm.
  async function publish() {
    setPublishing(true);
    setPublishMsg('');
    try {
      const post = async (body) => {
        const res = await fetch('/api/recent-games-publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Publish failed');
        return data;
      };
      const plan = await post({ dryRun: true });
      if (!window.confirm(`Upload ${plan.players} players' games from the ${plan.runDate} run to S3 as\n${plan.key}?`)) return;
      const done = await post({});
      setPublishMsg(`Published ${done.key}`);
    } catch (e) {
      setPublishMsg(`Not published: ${e.message}`);
    } finally {
      setPublishing(false);
    }
  }

  const savedPlayers = () => Object.fromEntries(Object.entries(resultsRef.current).filter(([, e]) => e && e.games));

  async function saveUrl(name) {
    setUrlMsg((m) => ({ ...m, [name]: 'Saving…' }));
    try {
      // Read-modify-write against the latest S3 copy, so a stale page can't clobber other edits.
      const latest = await fetchAlum();
      const entry = latest.find((a) => a.name === name);
      if (!entry) throw new Error(`No alum named ${name}`);
      const url = eventUrls[name].trim();
      if (url) entry.recentGamesUrl = url;
      else delete entry.recentGamesUrl;
      await saveAlum(latest);
      setSavedUrls((s) => ({ ...s, [name]: eventUrls[name].trim() }));
      setUrlMsg((m) => ({ ...m, [name]: 'Saved' }));
    } catch (e) {
      setUrlMsg((m) => ({ ...m, [name]: e.message }));
    }
  }

  return (
    <div className="recent-games">
      <div className="recent-games__bar">
        <h2>Recent games</h2>
        <label>Last <input type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} /> days (0 = no limit)</label>
        <label>Up to <input type="number" min="1" max="50" value={n} onChange={(e) => setN(e.target.value)} /> games</label>
        <label><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
        <button type="button" onClick={runAll} disabled={runningAll}>{runningAll ? 'Running…' : 'Run all'}</button>
        <button type="button" onClick={publish} disabled={publishing || runningAll || !generatedAt} title="Upload the saved run to S3 as a timestamped file">
          {publishing ? 'Publishing…' : 'Publish to S3'}
        </button>
        {saveMsg && <span className="recent-games__saved">{saveMsg}</span>}
        {publishMsg && <span className={publishMsg.startsWith('Not') ? 'recent-games__note--error' : 'recent-games__saved'}>{publishMsg}</span>}
      </div>
      <CombinedRecentGames results={results} teams={teams} alumByName={alumByName} generatedAt={generatedAt} />
      <TopGamesPostSection rows={flattenGames(results, teams, alumByName)} alumni={alumSeed} />
      <p className="recent-games__hint">
        Ranked by Hollinger Game Score (BBR&rsquo;s own where published, otherwise computed from the box line).
        Runs on demand and stores nothing. FIBA 3x3: paste that event&rsquo;s World Tour <em>team</em> page
        (e.g. worldtour.fiba3x3.com/2026/deqing/teams/&lt;id&gt;) into the event link. Each game is scored from its boxscore
        (steals and fouls aren&rsquo;t published) and multiplied onto the full-game scale; the arrow opens the boxscore.
      </p>

      {alumni.map((a) => {
        const effective = savedUrls[a.name] || a.playerUrl;
        const dirty = eventUrls[a.name] !== savedUrls[a.name];
        const busy = results[a.name] && results[a.name].loading;
        return (
          <section className="recent-games__alum" key={a.name}>
            <div className="recent-games__head">
              <strong>{a.name}</strong>
              <span className="recent-games__team">{a.team}</span>
              <span className="recent-games__src">{effective ? hostOf(effective) : 'no link'}</span>
              <button type="button" onClick={() => run(a.name)} disabled={busy || runningAll || !effective}>Run</button>
            </div>
            <div className="recent-games__event">
              <input
                type="url"
                placeholder="Recent games / latest event link (optional, overrides the player stats URL)"
                value={eventUrls[a.name]}
                onChange={(e) => setEventUrls((u) => ({ ...u, [a.name]: e.target.value }))}
              />
              <button type="button" onClick={() => saveUrl(a.name)} disabled={!dirty}>Save link</button>
              {urlMsg[a.name] && !dirty && <span className="recent-games__saved">{urlMsg[a.name]}</span>}
            </div>
            <Result entry={results[a.name]} />
          </section>
        );
      })}
    </div>
  );
}
