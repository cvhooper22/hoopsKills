import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import YBallLoader from '../../../components/Loaders/YBballLoader';
import FlipPad from '../../../components/FlipPad/FlipPad';
import RecordTile from '../../../components/RecordTile/RecordTile';
import urls from '../../../constants/assetUrls';
import { filterRows, foldRows } from '../../../utils/clutchSeason';
import { formatClutchTime } from '../../../utils/clutchUtils';
import SeasonFilters, { readFilters, activeFilterCount } from '../../Kills/SeasonFilters';
import { seasonLabel } from '../../Kills/KillsSeason';
import TopPerformers from '../components/TopPerformers';
import SeasonOutplayed from './SeasonOutplayed';
import SeasonBoxScore from './SeasonBoxScore';
import SeasonGames from './SeasonGames';
import '../../Kills/Kills.css';
import '../../Kills/KillsHeader.css';
import '../../Kills/KillsSeason.css';
import '../Clutch.css';
import './ClutchSeason.css';

const pct = (n) => (n === null ? '–' : `${(n * 100).toFixed(1)}%`);
const signed = (n, digits = 0) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;

// Season-long shooting minimum for the top performers' shooting card.
const SEASON_MIN_FGA = 5;

function Tile({ label, value, note, tone, reserveFoot }) {
  return <div className="kills-kpi"><FlipPad label={label} value={value} unit={note} tone={tone} reserveFoot={reserveFoot} condensed /></div>;
}

function seasonTiles({ totals, derived }) {
  const netPerGame = derived.perGame.net;
  return [
    ['Clutch net', signed(derived.net), `${totals.for.pts}-${totals.against.pts} pts`, 'auto'],
    ['Net / game', netPerGame === null ? '–' : signed(netPerGame, 1), 'per clutch game', 'auto'],
    ['eFG%', pct(derived.forRates.efg), `vs ${pct(derived.againstRates.efg)}`],
    ['Clutch time', formatClutchTime(totals.seconds), totals.clutchGames ? `${formatClutchTime(totals.seconds / totals.clutchGames)} / game` : null],
  ];
}

// The two win-loss tiles shown under the flip tiles.
function seasonRecords({ totals, derived }) {
  const { record } = derived;
  const { outcomes } = totals;
  return [
    { label: 'Clutch record', wins: record.w, losses: record.l, note: `${totals.clutchGames} of ${totals.games} games` },
    { label: 'Stretches won', wins: outcomes.won, losses: outcomes.lost, note: outcomes.even ? `${outcomes.even} even` : `of ${totals.stretches}` },
  ];
}

// Season clutch view: every number is a fold of the season file's per-game rows
// (src/utils/clutchSeason.js), so it all follows the filters. Clutch is the fixed definition the
// season files were built with; the game page is where it can be adjusted.
export default function ClutchSeason() {
  const [params, setParams] = useSearchParams();
  const [seasons, setSeasons] = useState(null);
  const [data, setData] = useState(null);
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState(false);

  const seasonParam = Number(params.get('season')) || null;
  const season = seasonParam ?? (seasons && seasons[0] ? seasons[0].season : null);
  const perGame = params.get('view') === 'pg';
  const filters = useMemo(() => readFilters(params), [params]);

  useEffect(() => {
    fetch(urls.clutchSeasonsIndex())
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setSeasons)
      .catch((err) => { console.error(err); setError(true); });
    // opponent names and logos are optional: the table falls back to the team ids
    fetch(urls.teamsMeta())
      .then((r) => (r.ok ? r.json() : null))
      .then(setTeams)
      .catch(() => setTeams(null));
  }, []);

  useEffect(() => {
    if (!season) return;
    setData(null);
    fetch(urls.clutchSeason(season))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((err) => { console.error(err); setError(true); });
  }, [season]);

  const rows = useMemo(() => (data ? filterRows(data.byGame, filters) : []), [data, filters]);
  const folded = useMemo(() => foldRows(rows), [rows]);
  const tiles = useMemo(() => seasonTiles(folded), [folded]);
  const records = useMemo(() => seasonRecords(folded), [folded]);

  function updateParams(patch) {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === undefined ? next.delete(k) : next.set(k, String(v))));
    setParams(next, { replace: true });
  }

  const gamesNote = data && [
    `${folded.totals.clutchGames} of ${rows.length} games had clutch time`,
    data.gamesSkipped.length > 0 && `${data.gamesSkipped.length} without data`,
  ].filter(Boolean).join(' · ');

  if (error) return <div className="kills"><p>Could not load the season data.</p></div>;
  if (!seasons || !data) return <div className="kills"><YBallLoader /></div>;

  const hasClutch = folded.totals.clutchGames > 0;
  const { seconds, margin } = data.definition || { seconds: 300, margin: 5 };
  return (
    <div className={`kills season-kills season-clutch${activeFilterCount(filters) ? ' season-kills--filtered' : ''}`}>
      <div className="season-kills__scrim" aria-hidden="true" />
      <SeasonFilters filters={filters} onChange={updateParams} />
      <div className="kills-header season-kills__header">
        {gamesNote && <p className="kills-header__meta">{gamesNote}</p>}
        <h1 className="kills-header__title"><span className="kills-header__byu">{seasonLabel(data.season)}</span> clutch</h1>
        <p className="season-clutch__definition">
          2nd half or OT · {formatClutchTime(seconds)} or less · within {margin} points
        </p>
        {seasons.length > 1 && (
          <div className="season-kills__controls">
            <select className="season-kills__select" value={season} onChange={(e) => updateParams({ season: e.target.value })} aria-label="Season">
              {seasons.map((s) => <option key={s.season} value={s.season}>{seasonLabel(s.season)}</option>)}
            </select>
          </div>
        )}
      </div>

      {!hasClutch ? (
        <p className="season-kills__empty">{rows.length ? 'None of these games reached clutch time.' : 'No games match these filters.'}</p>
      ) : (
        <>
          <div className="kills-kpis season-kills__kpis">
            {tiles.map(([label, value, note, tone]) => <Tile key={label} label={label} value={value} note={note} tone={tone} reserveFoot={tiles.some((t) => t[2])} />)}
          </div>
          <div className="season-clutch__records">
            {records.map((r) => <RecordTile key={r.label} variant="slim" wins={r.wins} losses={r.losses} label={r.label} note={r.note} />)}
          </div>

          <TopPerformers players={folded.players} headshots={data.headshots} sub="Season totals, clutch only" minFga={SEASON_MIN_FGA} expandable />
          <SeasonOutplayed folded={folded} />
          <SeasonBoxScore folded={folded} perGame={perGame} onPerGameChange={(pg) => updateParams({ view: pg ? 'pg' : null })} />
        </>
      )}

      <SeasonGames rows={rows} folded={folded} teams={teams} />
    </div>
  );
}
