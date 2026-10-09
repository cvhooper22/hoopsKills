import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SortableHeader from '../../components/SortableHeader/SortableHeader';
import { SORT_KEYS } from '../../constants/sorting';
import urls from '../../constants/assetUrls';
import './SeasonGamesTable.css';

const LOCATION_MARK = { home: 'vs', away: '@', neutral: 'N' };
const LOCATION_TITLE = { home: 'Home', away: 'Away', neutral: 'Neutral site' };

export function teamName(teams, id) {
  const t = teams && teams[id];
  if (t) return t.shortName || t.name;
  return String(id).replace(/-/g, ' ');
}

// Short code for a team ("PAC"), falling back to the name when the metadata has none.
export function teamAbbrev(teams, id) {
  const t = teams && teams[id];
  return (t && t.abbrev) || teamName(teams, id);
}

// Hides itself quietly if the logo file is missing, like the game switcher does.
export function TeamLogo({ teams, id }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [id]);
  const key = (teams && teams[id] && teams[id].logoKey) || id;
  if (failed) return null;
  return <img className="season-table__logo" src={urls.teamLogo(key)} alt="" onError={() => setFailed(true)} />;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const num = (n) => (n === null || n === undefined ? '–' : String(n));
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const pct = (n) => (n === null ? '–' : `${Math.round(n * 100)}%`);
const dec = (n) => (n === null || n === undefined ? '–' : n.toFixed(1));

// Column order is the mobile priority: opponent (sticky), then the headline numbers, then the rest
// scrolls. `more` columns sit behind the "More columns" toggle. `row` is a byGame row; `total` takes
// the folded { totals, derived } of the visible games, as a season total or a per-game average.
const COLUMNS = [
  { key: 'kills', head: 'K', title: 'Kills', row: (r) => r.kills, fmt: num,
    total: (f, avg) => (avg ? f.derived.perGame.kills : f.totals.kills) },
  { key: 'oppKills', head: 'K vs', title: 'Kills against', row: (r) => r.oppKills, fmt: num,
    total: (f, avg) => (avg ? f.derived.perGame.oppKills : f.totals.oppKills) },
  { key: 'diff', head: 'Diff', title: 'Kills minus kills against', row: (r) => r.kills - r.oppKills, fmt: signed, tone: true,
    total: (f, avg) => (avg && f.totals.games ? f.derived.diff / f.totals.games : f.derived.diff) },
  { key: 'completion', head: 'Cmp%', title: 'Completion: kills out of kills plus potential kills', row: (r) => r.completion, fmt: pct,
    total: (f) => f.derived.completion },
  { key: 'potential', head: 'PK', title: 'Potential kills', row: (r) => r.potential, fmt: num,
    total: (f, avg) => (avg ? f.derived.perGame.potential : f.totals.potential) },
  { key: 'stops', head: 'Stops', title: 'Stops', row: (r) => r.stops, fmt: num,
    total: (f, avg) => (avg ? f.derived.perGame.stops : f.totals.stops) },
  { key: 'efficiency', head: 'Eff', title: 'Efficiency: average net points gained per kill', row: (r) => r.efficiency, fmt: dec,
    total: (f) => f.derived.efficiency },
  { key: 'purity', head: 'P/D', title: 'Pure / dirty kills', more: true, row: (r) => r.pure, pair: true },
  { key: 'streak', head: 'Streak', title: 'Longest stop streak', more: true, row: (r) => (r.longestStreak ? r.longestStreak.length : 0), fmt: num,
    total: (f) => (f.derived.longestStreak ? f.derived.longestStreak.length : 0) },
  { key: 'avoid', head: 'Avoid', title: 'Avoidable streak breakers (a foul or second-chance score)', more: true, row: (r) => r.avoidableBreakers, fmt: num,
    total: (f, avg) => (avg ? f.derived.perGame.avoidableBreakers : f.totals.avoidableBreakers) },
];

function purityText(pure, dirty, digits = 0) {
  return `${pure.toFixed(digits)} / ${dirty.toFixed(digits)}`;
}

function sortRows(rows, sort) {
  if (!sort.direction) return rows;
  const col = COLUMNS.find((c) => c.key === sort.key);
  if (!col) return rows;
  const dir = sort.direction === SORT_KEYS.ASC ? 1 : -1;
  // null (no kills yet) sorts last either way
  return [...rows].sort((a, b) => {
    const av = col.row(a);
    const bv = col.row(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return dir * (av - bv);
  });
}

const ARIA_SORT = { [SORT_KEYS.ASC]: 'ascending', [SORT_KEYS.DESC]: 'descending' };
const toneClass = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'flat');

// One row per game, linking to that game's kills page. Opponent, date and result sit in a sticky
// first column so the headline numbers stay in view while the rest scrolls. The totals row follows
// whatever filters are applied.
export default function SeasonGamesTable({ rows, folded, teams, perGame }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState({ key: '', direction: '' });
  const [more, setMore] = useState(false);
  const visible = useMemo(() => COLUMNS.filter((c) => more || !c.more), [more]);
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  function onSort(key, direction) {
    setSort({ key: direction ? key : '', direction });
  }

  const n = folded.totals.games || 1;
  const totalCell = (col) => {
    if (col.pair) {
      const { pure, dirty } = folded.totals;
      return perGame ? purityText(pure / n, dirty / n, 1) : purityText(pure, dirty);
    }
    const v = col.total(folded, perGame);
    if (v === null || v === undefined) return '–';
    // per-game averages are fractional; show one decimal on the counts
    return perGame && ['kills', 'oppKills', 'potential', 'stops', 'avoid'].includes(col.key) ? v.toFixed(1)
      : perGame && col.key === 'diff' ? (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1))
        : col.fmt(v);
  };

  return (
    <section className="season-table-section">
      <div className="season-table-section__head">
        <h2>Games</h2>
        <button type="button" className="season-table-section__more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? 'Fewer columns' : 'More columns'}
        </button>
      </div>
      <div className="season-table-scroll">
        <table className="season-table">
          <thead>
            <tr>
              <th className="season-table__opp-head">Game</th>
              {visible.map((col) => (
                <th key={col.key} title={col.title} aria-sort={ARIA_SORT[sort.key === col.key ? sort.direction : ''] ?? 'none'}>
                  <SortableHeader classes="season-table__sort" sortKey={col.key} sortDirection={sort.key === col.key ? sort.direction : ''} onHeaderClick={onSort}>
                    {col.head}
                  </SortableHeader>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="season-table__total">
              <th scope="row" className="season-table__opp">
                {perGame ? 'Per game' : 'Season'} <small>{folded.totals.games} {folded.totals.games === 1 ? 'game' : 'games'}</small>
              </th>
              {visible.map((col) => <td key={col.key}>{totalCell(col)}</td>)}
            </tr>
            {sorted.map((r) => {
              const to = `/kills/${r.gameId}`;
              const post = r.seasonType !== 'regular';
              return (
                <tr key={r.gameId} className={`season-table__row${post ? ' season-table__row--post' : ''}`} onClick={() => navigate(to)}>
                  <th scope="row" className="season-table__opp">
                    <Link to={to} onClick={(e) => e.stopPropagation()} className="season-table__link">
                      <span className="season-table__opp-line">
                        <span className="season-table__loc" title={LOCATION_TITLE[r.location]}>{LOCATION_MARK[r.location]}</span>
                        <TeamLogo teams={teams} id={r.oppTeamId} />
                        <span className="season-table__opp-name">{teamName(teams, r.oppTeamId)}</span>
                      </span>
                      <span className="season-table__sub" title={post ? (r.seasonType === 'conf_tourney' ? 'Conference tournament' : 'Postseason') : undefined}>
                        {formatDate(r.date)} ·{' '}
                        <span className={`season-table__wl season-table__wl--${r.result.toLowerCase()}`}>{r.result}</span>{' '}
                        {r.scoreFor}-{r.scoreAgainst}
                      </span>
                    </Link>
                  </th>
                  {visible.map((col) => {
                    if (col.pair) return <td key={col.key}>{purityText(r.pure, r.dirty)}</td>;
                    const v = col.row(r);
                    return (
                      <td key={col.key} className={col.tone ? `season-table__tone season-table__tone--${toneClass(v)}` : undefined}>
                        {col.fmt(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {!sorted.length && (
              <tr><td className="season-table__empty" colSpan={visible.length + 1}>No games match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
