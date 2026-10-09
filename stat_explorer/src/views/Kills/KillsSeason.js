import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import YBallLoader from '../../components/Loaders/YBballLoader';
import FlipPad from '../../components/FlipPad/FlipPad';
import urls from '../../constants/assetUrls';
import { filterRows, foldRows } from '../../utils/killsSeason';
import SeasonFilters, { readFilters, activeFilterCount } from './SeasonFilters';
import SeasonGamesTable, { teamAbbrev, teamName } from './SeasonGamesTable';
import Tooltip from '../../components/Tooltip/Tooltip';
import SeasonRhythm from './SeasonRhythm';
import SeasonRecords from './SeasonRecords';
import BallToggle from '../../components/BallToggle/BallToggle';
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

function Tile({ label, value, note, tone, extra, reserveFoot }) {
  return <div className={`kills-kpi${extra ? ' kills-kpi--extra' : ''}`}><FlipPad label={label} value={value} unit={note} tone={tone} reserveFoot={reserveFoot} condensed /></div>;
}

// On a phone only the first tiles show until "More stats" is tapped, so the games table is not
// pushed off the screen. Desktop shows them all.
const PRIMARY_TILES = 4;

// The headline numbers for the games currently shown. Completion and kills lead, since the first
// two tiles are what a phone shows without scrolling.
function seasonTiles(folded, perGame, teams) {
  const { totals, derived } = folded;
  const n = totals.games || 1;
  const count = (total, avg) => (perGame ? avg.toFixed(1) : String(total));
  return [
    ['Kills', count(totals.kills, totals.kills / n), `vs ${count(totals.oppKills, totals.oppKills / n)} against`],
    ['Completion', pct(derived.completion)],
    ['Kill diff', perGame ? signed(derived.diff / n, 1) : signed(derived.diff), null, 'auto'],
    ['Potential kills', count(totals.potential, totals.potential / n)],
    ['Stops', count(totals.stops, totals.stops / n)],
    ['Efficiency', derived.efficiency === null ? '–' : derived.efficiency.toFixed(1)],
    ['Longest streak', derived.longestStreak ? String(derived.longestStreak.length) : '–', streakNote(derived.longestStreak, teams)],
  ];
}

// Footnote for the streak tile. One game: its opponent's code and date, linking to that game's kills
// page. A tie between games: a "2 games" label whose tooltip lists them, so the note stays on one line.
function streakNote(streak, teams) {
  if (!streak) return null;
  const { games } = streak;
  if (games.length === 1) {
    const g = games[0];
    return <Link className="season-kills__streak-link" to={`/kills/${g.gameId}`}>{teamAbbrev(teams, g.oppTeamId)}, {formatDate(g.date)}</Link>;
  }
  const list = (
    <ul className="season-kills__streak-list">
      {games.map((g) => <li key={g.gameId}>{teamName(teams, g.oppTeamId)}, {formatDate(g.date)}</li>)}
    </ul>
  );
  return <Tooltip content={list} align="center"><span className="season-kills__streak-games" tabIndex={0}>{games.length} games</span></Tooltip>;
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
  const perGame = params.get('view') !== 'totals';
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
  const tiles = useMemo(() => seasonTiles(folded, perGame, teams), [folded, perGame, teams]);

  function updateParams(patch) {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === undefined ? next.delete(k) : next.set(k, String(v))));
    setParams(next, { replace: true });
  }

  // Only worth saying when the filters hide games or some games have no data.
  const gamesNote = data && [
    rows.length !== data.byGame.length && `${rows.length} of ${data.byGame.length} games`,
    data.gamesSkipped.length > 0 && `${data.gamesSkipped.length} without data`,
  ].filter(Boolean).join(' · ');

  if (error) return <div className="kills"><p>Could not load the season data.</p></div>;
  if (!seasons || !data) return <div className="kills"><YBallLoader /></div>;

  return (
    <div className={`kills season-kills${activeFilterCount(filters) ? ' season-kills--filtered' : ''}`}>
      <div className="season-kills__scrim" aria-hidden="true" />
      <SeasonFilters filters={filters} onChange={updateParams} />
      <div className="kills-header season-kills__header">
        {gamesNote && <p className="kills-header__meta">{gamesNote}</p>}
        <h1 className="kills-header__title"><span className="kills-header__byu">{seasonLabel(data.season)}</span> kills</h1>
        {seasons.length > 1 && (
          <div className="season-kills__controls">
            <select className="season-kills__select" value={season} onChange={(e) => updateParams({ season: e.target.value })} aria-label="Season">
              {seasons.map((s) => <option key={s.season} value={s.season}>{seasonLabel(s.season)}</option>)}
            </select>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="season-kills__empty">No games match these filters.</p>
      ) : (
        <>
          <div className={`kills-kpis season-kills__kpis${moreStats ? ' season-kills__kpis--all' : ''}`}>
            {tiles.map(([label, value, note, tone], i) => <Tile key={label} label={label} value={value} note={note} tone={tone} extra={i >= PRIMARY_TILES} reserveFoot={tiles.some((t) => t[2])} />)}
          </div>
          <button type="button" className="season-kills__more-stats" aria-expanded={moreStats} onClick={() => setMoreStats((m) => !m)}>
            {moreStats ? 'Fewer stats' : 'More stats'}
          </button>
          <div className="season-kills__kpi-controls">
            <BallToggle size="small" checked={!perGame} onChange={(totals) => updateParams({ view: totals ? 'totals' : null })} leftLabel="Per game" rightLabel="Totals" ariaLabel="Show totals instead of per-game averages" />
          </div>
        </>
      )}

      <SeasonRecords rows={data.byGame} label={seasonLabel(data.season)} />

      {rows.length > 0 && <SeasonRhythm rows={rows} folded={folded} players={data.players} filtered={activeFilterCount(filters) > 0} teams={teams} />}

      <SeasonGamesTable rows={rows} folded={folded} teams={teams} perGame={perGame} />
    </div>
  );
}
