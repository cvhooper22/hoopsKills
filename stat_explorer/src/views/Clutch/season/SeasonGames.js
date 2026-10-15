import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SortableHeader from '../../../components/SortableHeader/SortableHeader';
import { SORT_KEYS } from '../../../constants/sorting';
import { formatClutchTime } from '../../../utils/clutchUtils';
import { TeamLogo, teamName } from '../../Kills/SeasonGamesTable';
import '../../Kills/SeasonGamesTable.css';

const LOCATION_MARK = { home: 'vs', away: '@', neutral: 'N' };
const LOCATION_TITLE = { home: 'Home', away: 'Away', neutral: 'Neutral site' };

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const signed = (n) => (n > 0 ? `+${n}` : String(n));
const pct = (n) => (n === null ? '–' : `${(n * 100).toFixed(0)}%`);
const efg = (t) => (t.fga ? (t.fgm + 0.5 * t.tpm) / t.fga : null);

// Column order is the mobile priority; `more` columns sit behind the "More columns" toggle. `row` is a
// byGame row, `total` the folded { totals, derived } of the visible games.
const COLUMNS = [
  { key: 'seconds', head: 'Min', title: 'Clutch time', row: (r) => r.seconds, fmt: formatClutchTime, total: (f) => f.totals.seconds, totalFmt: formatClutchTime },
  { key: 'ptsFor', head: 'BYU', title: 'BYU clutch points', row: (r) => r.team.for.pts, fmt: String, total: (f) => f.totals.for.pts },
  { key: 'ptsAgainst', head: 'Opp', title: 'Opponent clutch points', row: (r) => r.team.against.pts, fmt: String, total: (f) => f.totals.against.pts },
  { key: 'net', head: 'Net', title: 'Clutch points minus opponent clutch points', row: (r) => r.net, fmt: signed, tone: true, total: (f) => f.derived.net },
  { key: 'stretches', head: 'Str', title: 'Clutch stretches', row: (r) => r.stretches, fmt: String, total: (f) => f.totals.stretches },
  { key: 'efg', head: 'eFG%', title: 'BYU effective field goal % in the clutch', more: true, row: (r) => efg(r.team.for), fmt: pct, total: (f) => f.derived.forRates.efg },
  { key: 'efgOpp', head: 'Opp eFG', title: 'Opponent effective field goal % in the clutch', more: true, row: (r) => efg(r.team.against), fmt: pct, total: (f) => f.derived.againstRates.efg },
  { key: 'tov', head: 'TO', title: 'BYU clutch turnovers', more: true, row: (r) => r.team.for.tov, fmt: String, total: (f) => f.totals.for.tov },
  { key: 'tovOpp', head: 'Opp TO', title: 'Opponent clutch turnovers', more: true, row: (r) => r.team.against.tov, fmt: String, total: (f) => f.totals.against.tov },
];

const ARIA_SORT = { [SORT_KEYS.ASC]: 'ascending', [SORT_KEYS.DESC]: 'descending' };
const toneClass = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'flat');

function sortRows(rows, sort) {
  const col = COLUMNS.find((c) => c.key === sort.key);
  if (!sort.direction || !col) return rows;
  const dir = sort.direction === SORT_KEYS.ASC ? 1 : -1;
  // null (no shooting attempts yet) sorts last either way
  return [...rows].sort((a, b) => {
    const av = col.row(a);
    const bv = col.row(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return dir * (av - bv);
  });
}

// One row per game that reached clutch time, linking to that game's clutch page. Same layout as the
// kills games table, so the opponent column is sticky and the totals row follows the filters.
export default function SeasonGames({ rows: allRows, folded, teams }) {
  const rows = useMemo(() => allRows.filter((r) => r.seconds > 0), [allRows]);
  const navigate = useNavigate();
  const [sort, setSort] = useState({ key: '', direction: '' });
  const [more, setMore] = useState(false);
  const visible = useMemo(() => COLUMNS.filter((c) => more || !c.more), [more]);
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  const onSort = (key, direction) => setSort({ key: direction ? key : '', direction });
  const totalCell = (col) => {
    const v = col.total(folded);
    return v === null || v === undefined ? '–' : (col.totalFmt || col.fmt)(v);
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
                Season <small>{folded.totals.clutchGames} {folded.totals.clutchGames === 1 ? 'game' : 'games'}</small>
              </th>
              {visible.map((col) => <td key={col.key}>{totalCell(col)}</td>)}
            </tr>
            {sorted.map((r) => {
              const to = `/clutch/${r.gameId}`;
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
              <tr><td className="season-table__empty" colSpan={visible.length + 1}>No clutch games match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
