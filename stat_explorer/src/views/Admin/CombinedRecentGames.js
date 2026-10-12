import React, { useMemo, useState } from 'react';
import { leagueLabel } from './TopGamesPost';

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

// "2026-10-10" -> "10/10" (the shareable view drops the year and month names).
const shortDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${Number(m[2])}/${Number(m[3])}` : iso;
};
// "W 114-108 OT" -> "W". Eurobasket lists the player's own team first in its bare scores ("84-78"),
// so those read as W / L (a guess, not published by the source; a tie stays as the score). Bare
// scores from any other source are left as they are.
export function shortResult(result, source) {
  if (/^[WL]\b/i.test(result || '')) return result.trim()[0].toUpperCase();
  const m = source === 'eurobasket' && /^(\d+)-(\d+)$/.exec((result || '').trim());
  if (m && Number(m[1]) !== Number(m[2])) return Number(m[1]) > Number(m[2]) ? 'W' : 'L';
  return result;
}

// key, label, numeric (sorts high-to-low first), value used for sorting, cell renderer
const COLUMNS = [
  { key: 'player', label: 'Player', left: true, sort: (r) => r.player.toLowerCase(), cell: (r) => <><strong>{r.player}</strong><span className="recent-games__team"> {r.team}</span></> },
  { key: 'gameScore', label: 'GmSc', numeric: true, strong: true, sort: (r) => r.gameScore,
    cell: (r) => (r.gameScore == null ? '–' : <span title={r.gameScoreRaw != null ? `3x3: raw ${r.gameScoreRaw} × ${r.gameScoreScale}` : undefined}>{r.gameScore.toFixed(1)}{r.gameScoreRaw != null ? '*' : ''}</span>) },
  { key: 'league', label: 'League', left: true, sort: (r) => r.league.toLowerCase(), cell: (r) => r.league },
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

// Identity of one game row, used to remember which ones were dropped from the table.
export const rowKey = (r) => `${r.player}|${r.date}|${r.opp}|${r.url || r.min}`;

// Hand edits to a row's team / league ({ [rowKey]: { team?, league? } }), applied on top of the data.
export function applyEdits(rows, edits) {
  return rows.map((r) => {
    const e = edits[rowKey(r)];
    if (!e) return r;
    return {
      ...r,
      ...(e.team != null && { team: e.team }),
      ...(e.league != null && { league: e.league, leagueEdit: e.league }),
    };
  });
}

export function flattenGames(results, teams, alumByName = {}) {
  const rows = [];
  Object.entries(results).forEach(([player, entry]) => {
    (entry && entry.games ? entry.games : []).forEach((g) => {
      rows.push({ ...g, player, team: teams[player] || '', league: leagueLabel(g, alumByName[player]), source: entry.source });
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

// Text box that saves on blur or Enter, so a row doesn't re-sort under the cursor while typing.
function EditText({ value, label, onCommit }) {
  return (
    <input
      key={value}
      className="recent-games__edit"
      type="text"
      defaultValue={value}
      aria-label={label}
      placeholder={label}
      onBlur={(e) => { if (e.target.value !== value) onCommit(e.target.value); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
    />
  );
}

export default function CombinedRecentGames({ results, teams, alumByName, generatedAt, dropped, onDrop, onRestoreAll, edits, onEdit, onResetEdits }) {
  const [sort, setSort] = useState({ key: 'gameScore', dir: -1 });
  const [expanded, setExpanded] = useState(false);
  const [dropMode, setDropMode] = useState(false);
  const [shareable, setShareable] = useState(false);

  const rows = useMemo(
    () => applyEdits(flattenGames(results, teams, alumByName), edits).filter((r) => !dropped.has(rowKey(r))),
    [results, teams, alumByName, dropped, edits]
  );
  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key);
    return [...rows].sort((a, b) => compare(col.sort(a), col.sort(b), sort.dir) || compare(b.gameScore, a.gameScore, 1));
  }, [rows, sort]);
  const shown = expanded ? sorted : sorted.slice(0, TOP);
  // "To Shareable" for screenshots: short dates, W/L only, no turnovers.
  const columns = shareable
    ? COLUMNS.filter((c) => c.key !== 'tov').map((c) => (
      c.key === 'date' ? { ...c, cell: (r) => shortDate(r.date) }
        : c.key === 'result' ? { ...c, cell: (r) => shortResult(r.result, r.source) }
          : c))
    : COLUMNS;

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
          {rows.some((r) => r.gameScoreRaw != null) ? ' · * = 3x3, scaled' : ''}
        </span>
        <button type="button" onClick={() => setShareable((s) => !s)} aria-pressed={shareable} title="Condensed table for screenshots: short dates, W/L results, no turnovers">
          {shareable ? 'Full table' : 'To Shareable'}
        </button>
        <button type="button" onClick={() => setDropMode((d) => !d)} aria-pressed={dropMode}>{dropMode ? 'Done editing' : 'Edit table'}</button>
        {Object.keys(edits).length > 0 && (
          <button type="button" onClick={onResetEdits} title="Undo every team / league edit">Reset {Object.keys(edits).length} edited</button>
        )}
        {dropped.size > 0 && (
          <button type="button" onClick={onRestoreAll} title="Bring back every game you dropped">Restore {dropped.size} dropped</button>
        )}
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
              {columns.map((c) => (
                <th key={c.key} onClick={() => onSort(c)} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  {c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              {dropMode && <th aria-label="Drop" />}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td key={c.key} className={`${c.left ? 'recent-games__left' : ''}${c.strong ? ' recent-games__strong' : ''}`}>
                    {dropMode && (c.key === 'player' || c.key === 'league')
                      ? <>
                          {c.key === 'player' && <strong>{r.player} </strong>}
                          <EditText value={c.key === 'player' ? r.team : r.league} label={c.key === 'player' ? 'Team' : 'League'} onCommit={(v) => onEdit(rowKey(r), c.key === 'player' ? 'team' : 'league', v)} />
                        </>
                      : (c.cell(r) ?? '–')}
                  </td>
                ))}
                {dropMode && (
                  <td>
                    <button type="button" className="recent-games__drop" onClick={() => onDrop(rowKey(r))} title={`Drop ${r.player} vs ${r.opp}, ${usDate(r.date)}`}>×</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
