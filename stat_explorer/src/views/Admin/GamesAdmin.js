import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEV_PROXY } from './adminApi';
import './GamesAdmin.css';

// Hidden page at /admin/games. Local only, like /admin/rankings: it talks to the dev-only endpoints in
// src/setupProxy.js, which run dataAggregators/ingest/tools/game-pipeline.js against the local Postgres and the
// S3 credentials in .env.local. For every game it shows which files are on the deployed site's bucket, and runs
// the steps that get a game there: ingest, build each file, then deploy (upload + indexes + season rollups).

const FILE_STEPS = [
  { step: 'plays', label: 'Plays' },
  { step: 'meta', label: 'Meta' },
  { step: 'kills', label: 'Kills' },
  { step: 'clutch', label: 'Clutch' },
  { step: 'lineups', label: 'Lineups' },
  { step: 'box', label: 'Box' },
];
const ROLLUP_KINDS = ['kills', 'clutch', 'lineups'];
const STATE_LABEL = {
  deployed: 'Deployed',
  stale: 'Re-ingested since deploy',
  partial: 'Partly deployed',
  'not-deployed': 'Not deployed',
  live: 'Live',
  'no-plays': 'No plays',
};
const NEEDS_DEPLOY = new Set(['stale', 'partial', 'not-deployed']);

async function api(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}
const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never');

function FileDots({ game }) {
  return (
    <span className="games-admin__dots">
      {FILE_STEPS.map(({ step, label }) => {
        const f = game.files[step];
        const cls = !f.deployed ? (f.required ? 'missing' : 'na') : f.olderThanIngest ? 'old' : 'ok';
        const title = `${label}: ${f.deployed ? `on S3, uploaded ${when(f.lastModified)}${f.olderThanIngest ? ' (before the latest ingest)' : ''}` : `not on S3${f.required ? '' : ' (not needed for an exhibition: only the season rollups read it)'}`}${f.staged ? `; built ${when(f.staged)}` : ''}`;
        return <span key={step} title={title} className={`games-admin__dot games-admin__dot--${cls}${f.staged ? ' games-admin__dot--staged' : ''}`}>{label[0]}</span>;
      })}
    </span>
  );
}

function RollupChips({ game }) {
  if (game.isExhibition) return <span className="games-admin__note">exhibition: not in rollups</span>;
  return (
    <span>
      {ROLLUP_KINDS.map((k) => {
        const v = game.inRollups[k];
        return <span key={k} title={`${k} season file ${v === null ? 'unreadable' : v ? 'includes' : 'is missing'} this game`}
          className={`games-admin__chip games-admin__chip--${v === null ? 'unknown' : v ? 'ok' : 'missing'}`}>{k}</span>;
      })}
    </span>
  );
}

function GameRow({ game, selected, onSelect, busy, onBuild, onDeploy, onReingest }) {
  const [open, setOpen] = useState(false);
  const ready = game.stagedAll && !game.stagedBehind;
  return (
    <>
      <tr className={open ? 'games-admin__row games-admin__row--open' : 'games-admin__row'}>
        <td><input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Select ${game.gameId}`} disabled={game.plays === 0} /></td>
        <td className="games-admin__num">{game.date}</td>
        <td><strong>{game.away} at {game.home}</strong>{game.isExhibition && <span className="games-admin__note"> · exhibition</span>}<div className="games-admin__note">{game.gameId}</div></td>
        <td className="games-admin__num">{game.score || '–'}</td>
        <td className="games-admin__num">{game.plays || '–'}<div className="games-admin__note">{game.primarySource}</div></td>
        <td><span className={`games-admin__state games-admin__state--${game.state}`}>{STATE_LABEL[game.state]}</span></td>
        <td><FileDots game={game} /></td>
        <td>{game.inIndex ? <span className="games-admin__chip games-admin__chip--ok">index</span> : <span className="games-admin__chip games-admin__chip--missing">index</span>}<RollupChips game={game} /></td>
        <td className="games-admin__actions">
          <button type="button" disabled={busy || game.plays === 0} onClick={() => onBuild(game.gameId)}>Build</button>
          <button type="button" className="games-admin__primary" disabled={busy || !ready} title={ready ? '' : game.stagedBehind ? 'Rebuild: the files were built before the latest ingest' : 'Build first'}
            onClick={() => onDeploy([game.gameId])}>Deploy</button>
          <button type="button" className="games-admin__link" onClick={() => setOpen(!open)}>{open ? 'Less' : 'Steps'}</button>
        </td>
      </tr>
      {open && (
        <tr className="games-admin__detail">
          <td />
          <td colSpan={8}>
            <div className="games-admin__steps">
              {FILE_STEPS.map(({ step, label }) => (
                <button key={step} type="button" disabled={busy || game.plays === 0} onClick={() => onBuild(game.gameId, [step])}>Rebuild {label.toLowerCase()}</button>
              ))}
              {game.sources.wmt && <button type="button" disabled={busy} onClick={() => onReingest({ wmtId: game.sources.wmt })}>Re-ingest WMT {game.sources.wmt}</button>}
              {game.sources.espn && <button type="button" disabled={busy} onClick={() => onReingest({ espnId: game.sources.espn })}>Re-ingest ESPN {game.sources.espn}</button>}
            </div>
            <div className="games-admin__note">
              Last ingest {when(game.lastIngest)} · sources {Object.entries(game.sources).map(([s, id]) => `${s} ${id}`).join(', ') || 'none'}
              {game.stagedAll ? ` · built files staged (${game.stagedBehind ? 'older than the latest ingest' : 'current'})` : ' · not built yet'}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function JobPanel({ job }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [job && job.log.length]);
  if (!job) return null;
  return (
    <section className="games-admin__job">
      <h3>
        {job.label} <span className={`games-admin__state games-admin__state--${job.status === 'done' ? 'deployed' : job.status === 'error' ? 'not-deployed' : 'live'}`}>{job.status === 'running' ? 'Running…' : job.status === 'done' ? 'Done' : 'Failed'}</span>
      </h3>
      {job.error && <p className="games-admin__error">{job.error}</p>}
      <pre ref={ref}>{job.log.join('\n') || 'Starting…'}</pre>
    </section>
  );
}

export default function GamesAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const [source, setSource] = useState('');
  const busy = !!job && job.status === 'running';

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setData(await api('/api/games/status')); setError(''); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    api('/api/games/job').then((r) => setJob(r.job)).catch(() => {});
  }, [refresh]);

  // Poll the running job; when it finishes, reload the status so the table shows what changed.
  useEffect(() => {
    if (!busy) return undefined;
    const t = setInterval(async () => {
      try {
        const { job: next } = await api('/api/games/job');
        setJob(next);
        if (next && next.status !== 'running') refresh();
      } catch (e) { /* keep polling */ }
    }, 1500);
    return () => clearInterval(t);
  }, [busy, refresh]);

  const start = async (body) => {
    try { setJob((await post('/api/games/jobs', body)).job); setError(''); } catch (e) { setError(e.message); }
  };
  const build = (gameId, steps) => start({ action: 'build', gameId, ...(steps ? { steps } : {}) });
  const deploy = (ids) => {
    if (!window.confirm(`Upload ${ids.length === 1 ? ids[0] : `${ids.length} games`} to S3 and refresh the indexes and season rollups the deployed site reads?`)) return;
    start({ action: 'deploy', gameIds: ids });
  };
  const ingest = () => {
    const v = source.trim();
    if (/^https?:\/\//i.test(v)) start({ action: 'ingest', url: v });
    else if (/^\d+$/.test(v)) start({ action: 'ingest', wmtId: v });
    else setError('Paste a box score link (https://…) or a WMT game id');
  };

  const games = useMemo(() => (data ? data.games : []), [data]);
  const counts = useMemo(() => games.reduce((a, g) => ({ ...a, [g.state]: (a[g.state] || 0) + 1 }), {}), [games]);
  const needing = games.filter((g) => NEEDS_DEPLOY.has(g.state) || g.state === 'live');
  const shown = showAll || !needing.length ? games : needing;
  const seasons = data ? [...new Set(games.map((g) => g.seasonYear))].sort((a, b) => b - a) : [];

  if (!DEV_PROXY) {
    return <div className="games-admin"><h2>Games</h2><p className="games-admin__lede">This page runs scripts against your local database and S3 credentials, so it only works under <code>npm start</code>.</p></div>;
  }

  return (
    <div className="games-admin">
      <p className="games-admin__crumb"><Link to="/admin">← Admin</Link></p>
      <h2>Games</h2>
      <p className="games-admin__lede">
        What the deployed site has for each game, from the data CloudFront. Flow: ingest a game, <strong>Build</strong> its files
        (plays, meta, kills, clutch, lineups, box), then <strong>Deploy</strong>: it uploads them, rebuilds the games index, teams and box index, and
        refreshes the season rollups. Built files are staged in <code>{data ? data.stageDir : '…'}</code> until deployed.
      </p>

      <div className="games-admin__bar">
        <input className="games-admin__source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ingest from a box score link (https://byucougars.com/boxscore/25257) or a WMT id"
          onKeyDown={(e) => { if (e.key === 'Enter' && source.trim() && !busy) ingest(); }} />
        <button type="button" disabled={busy || !source.trim()} onClick={ingest}>Ingest</button>
        <button type="button" disabled={loading} onClick={refresh}>{loading ? 'Checking…' : 'Refresh'}</button>
        {error && <span className="games-admin__error" role="alert">{error}</span>}
      </div>

      <JobPanel job={job} />

      {data && (
        <>
          <div className="games-admin__summary">
            {Object.keys(STATE_LABEL).filter((s) => counts[s]).map((s) => <span key={s} className={`games-admin__state games-admin__state--${s}`}>{counts[s]} {STATE_LABEL[s].toLowerCase()}</span>)}
            <label className="games-admin__toggle"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all {games.length} games</label>
            <button type="button" className="games-admin__primary" disabled={busy || !selected.size} onClick={() => deploy([...selected])}>Deploy {selected.size || ''} selected</button>
          </div>

          <table className="games-admin__table">
            <thead>
              <tr><th /><th>Date</th><th>Game</th><th>Score</th><th>Plays</th><th>State</th><th title="Plays, Meta, Kills, Clutch, Lineups, Box. Green: on S3. Amber: uploaded before the latest ingest. Grey: missing. Outlined: built locally.">Files</th><th>Listed in</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((g) => (
                <GameRow key={g.gameId} game={g} busy={busy} selected={selected.has(g.gameId)}
                  onSelect={(on) => setSelected((s) => { const n = new Set(s); if (on) n.add(g.gameId); else n.delete(g.gameId); return n; })}
                  onBuild={build} onDeploy={deploy} onReingest={(ids) => start({ action: 'ingest', ...ids })} />
              ))}
              {!shown.length && <tr><td colSpan={9}>No games in the local database.</td></tr>}
            </tbody>
          </table>

          <h3>Shared files and season rollups</h3>
          <p className="games-admin__note">
            Games index {when(data.shared.gamesIndex.lastModified)} · teams {when(data.shared.teams.lastModified)} · box index {when(data.shared.boxIndex.lastModified)}.
            Rollups are rebuilt from the game files on CloudFront (cached up to 5 minutes), so rerun them after redeploying a game that was already up.
          </p>
          <ul className="games-admin__rollups">
            {seasons.map((y) => (
              <li key={y}>
                <strong>{y}</strong>:{' '}
                {ROLLUP_KINDS.map((k) => { const r = data.seasons[`${k}:${y}`]; return <span key={k}>{k} {r ? `${r.games} games, built ${when(r.generatedAt)}` : 'missing'}; </span>; })}
                <button type="button" className="games-admin__link" disabled={busy} onClick={() => start({ action: 'rollups', seasons: [y] })}>Rebuild {y} rollups</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
