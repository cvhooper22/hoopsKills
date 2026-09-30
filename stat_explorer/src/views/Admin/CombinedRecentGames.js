import React, { useMemo, useState } from 'react';

// Every alum's recent games in one table: top 5 by Game Score first, expandable to
// all, every column sortable. Rows are flattened from the per-alum results the
// admin page holds (freshly run, or loaded from public/data/recent-games.json).

const TOP = 5;

// "4-10" -> 4 (makes), "13:16" -> 13.27 minutes, "38" -> 38.
const leadingNumber = (v) => {
  if (v == null || v === '') return null;
  const s = String(v);
  const clock = s.match(/^(\d+):(\d{2})$/);
  if (clock) return Number(clock[1]) + Number(clock[2]) / 60;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const usDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : iso;
};

// key, label, numeric (sorts high-to-low first), value used for sorting, cell renderer
const COLUMNS = [
  { key: 'player', label: 'Player', left: true, sort: (r) => r.player.toLowerCase(), cell: (r) => <><strong>{r.player}</strong><span className="recent-games__team"> {r.team}</span></> },
  { key: 'gameScore', label: 'GmSc', numeric: true, strong: true, sort: (r) => r.gameScore,
    cell: (r) => (r.gameScore == null ? '–' : <span title={r.gameScoreRaw != null ? `3x3: raw ${r.gameScoreRaw} × ${r.gameScoreScale}` : undefined}>{r.gameScore.toFixed(1)}{r.gameScoreRaw != null ? '*' : ''}</span>) },
  { key: 'date', label: 'Date', sort: (r) => r.date, cell: (r) => usDate(r.date) },
  { key: 'opp', label: 'Opp', left: true, sort: (r) => (r.opp || '').toLowerCase(), cell: (r) => `${r.home === false ? '@ ' : ''}${r.opp || ''}` },
  { key: 'result', label: 'Result', left: true, sort: (r) => r.result || '', cell: (r) => r.result },
  { key: 'pts', label: 'PTS', numeric: true, sort: (r) => r.pts, cell: (r) => r.pts },
  { key: 'reb', label: 'REB', numeric: true, sort: (r) => r.reb, cell: (r) => r.reb },
  { key: 'ast', label: 'AST', numeric: true, sort: (r) => r.ast, cell: (r) => r.ast },
  { key: 'stl', label: 'STL', numeric: true, sort: (r) => r.stl, cell: (r) => r.stl },
  { key: 'blk', label: 'BLK', numeric: true, sort: (r) => r.blk, cell: (r) => r.blk },
  { key: 'tov', label: 'TOV', numeric: true, sort: (r) => r.tov, cell: (r) => r.tov },
  { key: 'fg', label: 'FG', numeric: true, sort: (r) => leadingNumber(r.fg), cell: (r) => r.fg },
  { key: 'threes', label: '3P', numeric: true, sort: (r) => leadingNumber(r.threes), cell: (r) => r.threes },
  { key: 'ft', label: 'FT', numeric: true, sort: (r) => leadingNumber(r.ft), cell: (r) => r.ft },
  { key: 'min', label: 'MIN', numeric: true, sort: (r) => leadingNumber(r.min), cell: (r) => r.min },
];

export function flattenGames(results, teams) {
  const rows = [];
  Object.entries(results).forEach(([player, entry]) => {
    (entry && entry.games ? entry.games : []).forEach((g) => {
      rows.push({ ...g, player, team: teams[player] || '', source: entry.source });
    });
  });
  return rows;
}

// Missing values always sink to the bottom, whichever way the column is sorted.
function compare(a, b, dir) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a < b) return -dir;
  if (a > b) return dir;
  return 0;
}

export default function CombinedRecentGames({ results, teams, generatedAt }) {
  const [sort, setSort] = useState({ key: 'gameScore', dir: -1 });
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => flattenGames(results, teams), [results, teams]);
  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key);
    return [...rows].sort((a, b) => compare(col.sort(a), col.sort(b), sort.dir) || compare(b.gameScore, a.gameScore, 1));
  }, [rows, sort]);
  const shown = expanded ? sorted : sorted.slice(0, TOP);

  function onSort(col) {
    setSort((s) => (s.key === col.key ? { key: col.key, dir: -s.dir } : { key: col.key, dir: col.numeric ? -1 : 1 }));
  }

  return (
    <section className="recent-games__combined">
      <div className="recent-games__combined-head">
        <h3>{expanded ? 'All recent games' : `Top ${Math.min(TOP, rows.length)} recent games`}</h3>
        <span className="recent-games__note">
          {rows.length} games from {new Set(rows.map((r) => r.player)).size} alumni
          {generatedAt ? ` · saved ${new Date(generatedAt).toLocaleString()}` : ''}
          {' · * = 3x3, scaled'}
        </span>
        {rows.length > TOP && (
          <button type="button" onClick={() => setExpanded((e) => !e)}>{expanded ? `Show top ${TOP}` : `Show all ${rows.length}`}</button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="recent-games__note">No games yet. Use Run all below (results are saved and reload next time).</div>
      ) : (
        <table className="recent-games__table recent-games__table--sortable">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} onClick={() => onSort(c)} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  {c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={`${r.player}-${r.date}-${r.opp}-${r.url || r.min}`}>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={`${c.left ? 'recent-games__left' : ''}${c.strong ? ' recent-games__strong' : ''}`}>{c.cell(r) ?? '–'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
