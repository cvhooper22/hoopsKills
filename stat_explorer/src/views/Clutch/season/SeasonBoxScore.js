import { useState } from 'react';
import SortableHeader from '../../../components/SortableHeader/SortableHeader';
import BallToggle from '../../../components/BallToggle/BallToggle';
import Net from '../../../components/Net/Net';
import { SORT_KEYS } from '../../../constants/sorting';
import { formatClutchTime } from '../../../utils/clutchUtils';

const ARIA_SORT = { [SORT_KEYS.ASC]: 'ascending', [SORT_KEYS.DESC]: 'descending' };

// A player's season line, or that line divided by games played. Shooting shows makes-attempts.
const avg = (p, k, perGame) => (perGame ? p[k] / p.gp : p[k]);
const num = (v, perGame) => (perGame ? v.toFixed(1) : String(v));
const countColumn = (key, label) => ({
  key, label, sortValue: (p, pg) => avg(p, key, pg), cell: (p, pg) => num(avg(p, key, pg), pg),
});
const shootingColumn = (key, label, made, att) => ({
  key, label,
  // makes first, then fewer attempts (the better percentage)
  sortValue: (p, pg) => avg(p, made, pg) * 1000 - avg(p, att, pg),
  cell: (p, pg) => `${num(avg(p, made, pg), pg)}-${num(avg(p, att, pg), pg)}`,
});

// Percentages come from the summed makes and attempts, so per game they match the totals view.
// A player with no attempts sorts last either way.
const pctColumn = (key, label, value, title) => ({
  key, label, title, sortValue: (p) => value(p) ?? -1, cell: (p) => (value(p) === null ? '–' : (value(p) * 100).toFixed(1)),
});
const ratio = (n, d) => (d ? n / d : null);

const COLUMNS = [
  { key: 'name', label: 'Player', align: 'left', sortValue: (p) => p.name, cell: (p) => p.name },
  { key: 'gp', label: 'GP', sortValue: (p) => p.gp, cell: (p) => p.gp },
  { key: 'seconds', label: 'MIN', sortValue: (p, pg) => avg(p, 'seconds', pg), cell: (p, pg) => formatClutchTime(avg(p, 'seconds', pg)) },
  { ...countColumn('pts', 'PTS'), strong: true },
  shootingColumn('fg', 'FG', 'fgm', 'fga'),
  pctColumn('fgPct', 'FG%', (p) => ratio(p.fgm, p.fga), 'Field goal %'),
  shootingColumn('tp', '3P', 'tpm', 'tpa'),
  pctColumn('tpPct', '3P%', (p) => ratio(p.tpm, p.tpa), 'Three-point %'),
  shootingColumn('ft', 'FT', 'ftm', 'fta'),
  pctColumn('ftPct', 'FT%', (p) => ratio(p.ftm, p.fta), 'Free throw %'),
  pctColumn('efg', 'eFG%', (p) => ratio(p.fgm + 0.5 * p.tpm, p.fga), 'Effective field goal %: counts a three as 1.5 makes'),
  pctColumn('ts', 'TS%', (p) => ratio(p.pts, 2 * (p.fga + 0.44 * p.fta)), 'True shooting %: points per shooting attempt, free throws included'),
  countColumn('oreb', 'OREB'),
  countColumn('reb', 'REB'),
  countColumn('ast', 'AST'),
  countColumn('stl', 'STL'),
  countColumn('blk', 'BLK'),
  countColumn('tov', 'TO'),
  countColumn('pf', 'PF'),
  {
    key: 'plusMinus', label: '+/-', sortValue: (p, pg) => avg(p, 'plusMinus', pg),
    cell: (p, pg) => <Net netVal={pg ? Number(avg(p, 'plusMinus', pg).toFixed(1)) : p.plusMinus} />,
  },
];

function sortPlayers(players, sort, perGame) {
  const col = COLUMNS.find((c) => c.key === sort.key);
  if (!col) return players; // already most clutch time, then points
  const dir = sort.direction === SORT_KEYS.ASC ? 1 : -1;
  return [...players].sort((a, b) => {
    const av = col.sortValue(a, perGame);
    const bv = col.sortValue(b, perGame);
    return dir * (typeof av === 'string' ? av.localeCompare(bv) : av - bv);
  });
}

// The season clutch box score: every BYU player with clutch activity in the filtered games. Totals by
// default; per game divides each player by their own games played. The team row stays a total.
export default function SeasonBoxScore({ folded, perGame, onPerGameChange }) {
  const [sort, setSort] = useState({ key: '', direction: '' });
  const [scrolled, setScrolled] = useState(false); // edge shadow under the pinned Player column
  const rows = sortPlayers(folded.players, sort, perGame);
  const team = {
    name: 'Team', gp: folded.totals.clutchGames, seconds: folded.totals.seconds, plusMinus: folded.derived.net,
    ...folded.totals.for,
  };

  return (
    <section className="clutch-section season-box">
      <div className="season-box__head">
        <div>
          <h2 className="clutch-section__title">Clutch box score</h2>
          <p className="clutch-section__sub">{perGame ? 'Per game played' : 'Season totals'}</p>
        </div>
        <BallToggle
          size="small" checked={perGame} onChange={onPerGameChange}
          leftLabel="Totals" rightLabel="Per game" ariaLabel="Show per-game averages instead of totals"
        />
      </div>
      <div
        className={`clutch-table-scroll${scrolled ? ' clutch-table-scroll--scrolled' : ''}`}
        onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
      >
        <table className="clutch-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => {
                const direction = sort.key === col.key ? sort.direction : '';
                return (
                  <th key={col.key} title={col.title} className={`clutch-table__th${col.align === 'left' ? ' clutch-table__name' : ''}`} aria-sort={ARIA_SORT[direction] ?? 'none'}>
                    <SortableHeader
                      classes={`clutch-sort${col.align === 'left' ? ' clutch-sort--left' : ''}`}
                      sortKey={col.key} sortDirection={direction}
                      onHeaderClick={(key, dir) => setSort({ key: dir ? key : '', direction: dir })}
                    >
                      {col.label}
                    </SortableHeader>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                {COLUMNS.map((col) => (
                  <td key={col.key} className={[col.align === 'left' && 'clutch-table__name', col.strong && 'clutch-table__pts'].filter(Boolean).join(' ') || undefined}>
                    {col.cell(p, perGame)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="clutch-table__totals">
              {COLUMNS.map((col) => (
                <td key={col.key} className={[col.align === 'left' && 'clutch-table__name', col.strong && 'clutch-table__pts'].filter(Boolean).join(' ') || undefined}>
                  {col.cell(team, false)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
