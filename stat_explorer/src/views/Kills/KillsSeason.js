import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import YBallLoader from '../../components/Loaders/YBballLoader';
import FlipPad from '../../components/FlipPad/FlipPad';
import urls from '../../constants/assetUrls';
import { filterRows, foldRows } from '../../utils/killsSeason';
import KillsSubnav from './KillsSubnav';
import SeasonFilters, { readFilters } from './SeasonFilters';
import SeasonGamesTable, { teamName } from './SeasonGamesTable';
import SeasonRhythm from './SeasonRhythm';
import './Kills.css';
import './KillsHeader.css';
import './KillsSeason.css';

// Season label matches common CBB notation, e.g. seasonYear 2025 -> "2025-26".
export function seasonLabel(seasonYear) {
  return `${seasonYear}-${String((seasonYear + 1) % 100).padStart(2, '0')}`;
}

const pct = (n) => (n === null ? '–' : `${Math.round(n * 100)}%`);
const signed = (n, digits = 0) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Tile({ label, value, extra }) {
  return <div className={`kills-kpi${extra ? ' kills-kpi--extra' : ''}`}><FlipPad label={label} value={value} condensed /></div>;
}

// On a phone only the first tiles show until "More stats" is tapped, so the games table is not
// pushed off the screen. Desktop shows them all.
const PRIMARY_TILES = 4;

// The headline numbers for the games currently shown. Completion and kills lead, since the first
// two tiles are what a phone shows without scrolling.
function seasonTiles(folded, perGame) {
  const { totals, derived } = folded;
  const n = totals.games || 1;
  const count = (total, avg) => (perGame ? avg.toFixed(1) : String(total));
  return [
    ['Kills', count(totals.kills, totals.kills / n)],
    ['Completion', pct(derived.completion)],
    ['Kills against', count(totals.oppKills, totals.oppKills / n)],
    ['Kill diff', perGame ? signed(derived.diff / n, 1) : signed(derived.diff)],
    ['Potential kills', count(totals.potential, totals.potential / n)],
    ['Stops', count(totals.stops, totals.stops / n)],
    ['Efficiency', derived.efficiency === null ? '–' : derived.efficiency.toFixed(1)],
    ['Longest streak', derived.longestStreak ? String(derived.longestStreak.length) : '–'],
  ];
}

function LongestStreakNote({ streak, teams }) {
  if (!streak) return null;
  return (
    <p className="season-streak-note">
      Longest stop streak: <strong>{streak.length} in a row</strong>
      {streak.games.map((g, i) => (
        <span key={g.gameId}>
          {i === 0 ? ' · ' : ' and '}
          <Link to={`/kills/${g.gameId}`}>{teamName(teams, g.oppTeamId)}, {formatDate(g.date)}</Link>
        </span>
      ))}
    </p>
  );
}

// Season view: the games table and headline numbers for the filtered games, built by re-folding
// the season file's per-game rows (src/utils/killsSeason.js), so every number follows the filters.
export default function KillsSeason() {
  const [params, setParams] = useSearchParams();
  const [seasons, setSeasons] = useState(null);
  const [data, setData] = useState(null);
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState(false);
  const [moreStats, setMoreStats] = useState(false);

  const seasonParam = Number(params.get('season')) || null;
  const season = seasonParam ?? (seasons && seasons[0] ? seasons[0].season : null);
  const perGame = params.get('view') === 'avg';
  const filters = useMemo(() => readFilters(params), [params]);

  useEffect(() => {
    fetch(urls.killsSeasonsIndex())
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setSeasons)
      .catch((err) => { console.error(err); setError(true); });
    // the opponent names and logos are optional: the table falls back to the team ids
    fetch(urls.teamsMeta())
      .then((r) => (r.ok ? r.json() : null))
      .then(setTeams)
      .catch(() => setTeams(null));
  }, []);

  useEffect(() => {
    if (!season) return;
    setData(null);
    fetch(urls.killsSeason(season))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((err) => { console.error(err); setError(true); });
  }, [season]);

  const rows = useMemo(() => (data ? filterRows(data.byGame, filters) : []), [data, filters]);
  const folded = useMemo(() => foldRows(rows), [rows]);

  function updateParams(patch) {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === undefined ? next.delete(k) : next.set(k, String(v))));
    setParams(next, { replace: true });
  }

  if (error) return <div className="kills"><p>Could not load the season data.</p></div>;
  if (!seasons || !data) return <div className="kills"><YBallLoader /></div>;

  return (
    <div className="kills season-kills">
      <KillsSubnav active="season" />
      <div className="kills-header season-kills__header">
        <p className="kills-header__meta">{rows.length} of {data.byGame.length} games{data.gamesSkipped.length ? ` · ${data.gamesSkipped.length} without data` : ''}</p>
        <h1 className="kills-header__title"><span className="kills-header__byu">{seasonLabel(data.season)}</span> kills</h1>
        <div className="season-kills__controls">
          {seasons.length > 1 && (
            <select className="season-kills__select" value={season} onChange={(e) => updateParams({ season: e.target.value })} aria-label="Season">
              {seasons.map((s) => <option key={s.season} value={s.season}>{seasonLabel(s.season)}</option>)}
            </select>
          )}
          <div className="season-kills__view" role="group" aria-label="Counts">
            <button type="button" className={`season-chip${perGame ? '' : ' season-chip--active'}`} aria-pressed={!perGame} onClick={() => updateParams({ view: null })}>Totals</button>
            <button type="button" className={`season-chip${perGame ? ' season-chip--active' : ''}`} aria-pressed={perGame} onClick={() => updateParams({ view: 'avg' })}>Per game</button>
          </div>
        </div>
        <SeasonFilters filters={filters} onChange={updateParams} />
      </div>

      {rows.length === 0 ? (
        <p className="season-kills__empty">No games match these filters.</p>
      ) : (
        <>
          <div className={`kills-kpis season-kills__kpis${moreStats ? ' season-kills__kpis--all' : ''}`}>
            {seasonTiles(folded, perGame).map(([label, value], i) => <Tile key={label} label={label} value={value} extra={i >= PRIMARY_TILES} />)}
          </div>
          <button type="button" className="season-kills__more-stats" aria-expanded={moreStats} onClick={() => setMoreStats((m) => !m)}>
            {moreStats ? 'Fewer stats' : 'More stats'}
          </button>
          <LongestStreakNote streak={folded.derived.longestStreak} teams={teams} />
        </>
      )}

      <SeasonGamesTable rows={rows} folded={folded} teams={teams} perGame={perGame} />
      {rows.length > 0 && <SeasonRhythm rows={rows} folded={folded} players={data.players} />}
    </div>
  );
}
