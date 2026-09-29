import { useState } from 'react';
import SortableHeader from '../../components/SortableHeader/SortableHeader';
import { SORT_KEYS } from '../../constants/sorting';
import { STOP_TYPES, STOP_TYPE_LETTER, STOP_TYPE_NAME } from '../../constants/stopTypes';
import { halfLabel, CREDIT_ABBR, killGain, gainTone } from '../../utils/killInsights';
import Tooltip from '../../components/Tooltip/Tooltip';
import PureDirtyInfo from './PureDirtyInfo';
import './KillsTable.css';

const ARIA_SORT = { [SORT_KEYS.ASC]: 'ascending', [SORT_KEYS.DESC]: 'descending' };

// Sorting never renumbers the K-labels — they stay tied to when the kill
// actually happened, so rows carry their chronological index going in.
function sortRows(rows, sort) {
  if (!sort.direction) return rows;
  const dir = sort.direction === SORT_KEYS.ASC ? 1 : -1;
  const valueOf = sort.key === 'held' ? (r) => r.kill.durationSeconds : (r) => killGain(r.kill);
  return [...rows].sort((a, b) => dir * (valueOf(a) - valueOf(b)));
}

// The tags a kill can carry (see KillTags below and kills-rules.md), with a
// plain-language definition for the legend.
const KILL_TAG_DEFS = [
  { tag: 'Critical', def: 'The score was within 5 points when the kill started.' },
  { tag: 'Clutch', def: "2 or 3 of the kill's stops happened in the last 5 minutes of a half or OT, with the score within 5." },
  { tag: 'Clutch-adjacent', def: 'Only 1 of the 3 stops happened in that same late-and-close window.' },
  { tag: 'Garbage', def: 'BYU led by 15 or more with under 8 minutes left when the kill started.' },
  { tag: 'Late stop', def: "One of the kill's stops happened with under 5 seconds left in the period." },
];

// Plain-language reason for each way a single stop can come back dirty (see
// dataAggregators/derivations/kills.js's markDirty/isEmptyTrip). Shown in a
// dirty stop badge's tooltip, and a stop can carry more than one.
const DIRTY_REASON_TEXT = {
  offensive_rebound: 'the offense got an offensive rebound first',
  empty_ft_trip: 'it only happened because the free throws were missed',
};

// Collapsible legend for the table's icons, tucked behind a "Show legend"
// toggle so the table itself is the first thing on the page. Stop types are
// the full exhaustive list (src/constants/stopTypes.js), not just the ones
// this game happens to have — the legend should hold even for a game with no
// charges or tie-ups yet.
function KillsLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="kills-legend">
      <div className="kills-legend__toggle-row">
        <button type="button" className="kills-legend__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={`kills-legend__caret ${open ? 'kills-legend__caret--open' : ''}`} aria-hidden="true" />
          {open ? 'Hide legend' : 'Show legend'}
        </button>
      </div>
      <div className={`kills-legend__panel ${open ? 'kills-legend__panel--open' : ''}`}>
        <div className="kills-legend__inner">
          <section className="kills-legend__section">
            <h4>Kill quality <PureDirtyInfo /></h4>
            <div className="kills-legend__row">
              <span className="kills-legend__item">
                <span className="material-symbols-sharp kills-table__purity kills-table__purity--pure" aria-hidden="true">shield</span> Pure kill
              </span>
              <span className="kills-legend__item">
                <span className="material-symbols-sharp kills-table__purity kills-table__purity--dirty" aria-hidden="true">gpp_maybe</span> Dirty kill
              </span>
              <span className="kills-legend__item">
                <span className="kills-table__stop kills-table__stop--dirty kills-table__stop--small">R</span> Dirty stop — hover a stop for why
              </span>
            </div>
          </section>

          <section className="kills-legend__section">
            <h4>Kill type</h4>
            <ul className="kills-legend__defs">
              {KILL_TAG_DEFS.map((d) => (
                <li key={d.tag}><span className="kills-table__tag">{d.tag}</span> {d.def}</li>
              ))}
            </ul>
          </section>

          <section className="kills-legend__section">
            <h4>Stop types</h4>
            <div className="kills-legend__row kills-legend__row--stack">
              {STOP_TYPES.map((t) => (
                <span className="kills-legend__item" key={t.type}>
                  <span className="kills-table__stop kills-table__stop--small">{t.letter}</span> {t.label}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// One row per kill (result.kills, already in chronological order). Pure/dirty
// is a filled vs. outlined dot next to the K-label rather than its own column;
// critical/clutch/garbage/late stack underneath as pills — all in one "Kill"
// cell per the design.
function KillTags({ kill }) {
  return (
    <div className="kills-table__kill-cell">
      <span className="kills-table__kill-label">
        K{kill.index}
        {/* Material Symbols Sharp (see public/index.html's icon_names subset):
            pure = solid shield, dirty = outlined shield with a warning mark. */}
        <span
          className={`material-symbols-sharp kills-table__purity ${kill.dirty ? 'kills-table__purity--dirty' : 'kills-table__purity--pure'}`}
          role="img"
          aria-label={kill.dirty ? 'Dirty kill' : 'Pure kill'}
          title={kill.dirty ? 'Dirty kill' : 'Pure kill'}
        >
          {kill.dirty ? 'gpp_maybe' : 'shield'}
        </span>
      </span>
      <span className="kills-table__tag-stack">
        {kill.critical && <span className="kills-table__tag">Critical</span>}
        {kill.clutch !== 'none' && <span className="kills-table__tag">{kill.clutch === 'clutch' ? 'Clutch' : 'Clutch-adjacent'}</span>}
        {kill.garbage && <span className="kills-table__tag">Garbage</span>}
        {kill.late && <span className="kills-table__tag">Late stop</span>}
      </span>
    </div>
  );
}

// A play's clock can carry fractional seconds (e.g. "0:18.6"), so durationSeconds
// isn't always a whole number — round it first or the seconds part can come out
// as a floating-point artifact like "58.599999999999994".
function formatHeld(durationSeconds) {
  const total = Math.round(durationSeconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function StopBadge({ stop }) {
  const content = stop.dirty && stop.dirtyReasons.length
    ? (
      <>
        <p><strong>{STOP_TYPE_NAME[stop.type]}</strong> — dirty</p>
        <ul>{stop.dirtyReasons.map((r) => <li key={r}>{DIRTY_REASON_TEXT[r] || r}</li>)}</ul>
      </>
    )
    : STOP_TYPE_NAME[stop.type];
  return (
    <Tooltip content={content}>
      <span className={`kills-table__stop ${stop.dirty ? 'kills-table__stop--dirty' : ''}`}>
        {STOP_TYPE_LETTER[stop.type]}
      </span>
    </Tooltip>
  );
}

export default function KillsTable({ result }) {
  const [sort, setSort] = useState({ key: '', direction: '' });
  const stopsBySeq = {};
  result.stops.forEach((s) => { stopsBySeq[s.seq] = s; });

  // Chronological index (the K-label) is fixed before sorting, so it never moves.
  const baseRows = result.kills.map((kill, i) => ({ kill, index: i + 1 }));
  const rows = sortRows(baseRows, sort);

  function onSort(key, direction) {
    setSort({ key: direction ? key : '', direction });
  }

  return (
    <section className="kills-table-section">
      <h2>Kills</h2>
      <KillsLegend />
      <div className="kills-table-scroll">
        <table className="kills-table-v2">
          <thead>
            <tr>
              <th>Kill</th>
              <th>Start</th>
              <th>Ended</th>
              <th className="kills-table-v2__th" aria-sort={ARIA_SORT[sort.key === 'held' ? sort.direction : ''] ?? 'none'}>
                <SortableHeader classes="" sortKey="held" sortDirection={sort.key === 'held' ? sort.direction : ''} onHeaderClick={onSort}>
                  Held
                </SortableHeader>
              </th>
              <th
                className="kills-table-v2__th kills-table__col-center"
                aria-sort={ARIA_SORT[sort.key === 'gained' ? sort.direction : ''] ?? 'none'}
                title="BYU's own points scored while this kill was building, from its first stop to the breaker. The opponent scores 0 in that span by definition."
              >
                <SortableHeader classes="kills-sort--center" sortKey="gained" sortDirection={sort.key === 'gained' ? sort.direction : ''} onHeaderClick={onSort}>
                  Pts gained
                </SortableHeader>
              </th>
              <th>Stops</th>
              <th>Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ kill, index }) => {
              const stops = kill.stops.map((seq) => stopsBySeq[seq]);
              const credits = stops.filter((s) => s.credit).map((s) => `${s.credit} (${CREDIT_ABBR[s.type] || s.type})`);
              return (
                <tr key={kill.start.seq}>
                  <td><KillTags kill={{ ...kill, index }} /></td>
                  <td>{kill.start.clock} <span className="kills-table__half">{halfLabel(kill.start.period)}</span></td>
                  <td>{kill.end.clock}</td>
                  <td>{formatHeld(kill.durationSeconds)}</td>
                  <td className="kills-table__col-center">
                    {/* Can go negative: the breaker's own basket ends the streak and always
                        counts against this, so a big shot right at the end can outweigh
                        what BYU scored while the kill was building. */}
                    <span className={`kills-table__margin kills-table__margin--${gainTone(killGain(kill))}`}>
                      {killGain(kill) > 0 ? '+' : ''}{killGain(kill)}
                    </span>
                  </td>
                  <td>
                    <span className="kills-table__stops">
                      {stops.map((s) => <StopBadge key={s.seq} stop={s} />)}
                    </span>
                  </td>
                  <td>{credits.length ? credits.join(', ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

