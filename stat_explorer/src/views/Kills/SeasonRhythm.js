import { useMemo, useState } from 'react';
import { Chart, Donut } from '../../components/charts';
import BallToggle from '../../components/BallToggle/BallToggle';
import Tooltip from '../../components/Tooltip/Tooltip';
import PureDirtyInfo from './PureDirtyInfo';
import KillStream from './KillStream';
import { PotentialKillDefinition } from './killsDefinitions';
import { STOP_TYPES } from '../../constants/stopTypes';
import { pooledKillTimes } from '../../utils/killsSeason';
import { MIX_COLORS, clockFmt } from './RhythmMix';
import './RhythmMix.css';
import './SeasonRhythm.css';

const CREDIT_PREVIEW = 8;

function RangeStats({ title, note, stats, empty }) {
  return (
    <div className="rhythm-card">
      <div className="rhythm-card__head">
        <h3>{title}</h3>
        {note && <span className="rhythm-card__note">{note}</span>}
      </div>
      {stats ? (
        <div className="rhythm-stat-row">
          <div className="rhythm-stat"><span className="rhythm-stat__label">Average</span><span className="rhythm-stat__value">{clockFmt(stats.avg)}</span></div>
          <div className="rhythm-stat"><span className="rhythm-stat__label">Longest</span><span className="rhythm-stat__value">{clockFmt(stats.longest)}</span></div>
          <div className="rhythm-stat"><span className="rhythm-stat__label">Shortest</span><span className="rhythm-stat__value">{clockFmt(stats.shortest)}</span></div>
        </div>
      ) : <p className="rhythm-card__empty">{empty}</p>}
    </div>
  );
}

// Local Per game / Totals switch for a card. Totals is the default; `games` is how many games the
// card is showing, so a count becomes a per-game average.
function useCountMode(games) {
  const [perGame, setPerGame] = useState(false);
  const fmt = (n) => (perGame ? (n / Math.max(1, games)).toFixed(1) : String(n));
  const toggle = (
    <div className="rhythm-card__mode">
      <BallToggle size="small" checked={!perGame} onChange={(totals) => setPerGame(!totals)} leftLabel="Per game" rightLabel="Totals" ariaLabel="Show totals instead of per-game averages" />
    </div>
  );
  return { perGame, fmt, toggle };
}

const HALF_ROWS = [['1', '1st half'], ['2', '2nd half'], ['OT', 'Overtime']];
const pctText = (n) => (n === null ? '–' : `${Math.round(n * 100)}%`);

// The per-game page's half-by-half table, summed over the games shown: kills, pure / dirty, potential
// kills, completion and stops for each half, plus overtime when any shown game went to it. Counts can
// switch to per-game averages; completion is a ratio of the sums, so it never changes.
function HalvesCard({ byPeriod, games }) {
  const { perGame, fmt, toggle: modeToggle } = useCountMode(games);
  const rows = HALF_ROWS.map(([key, label]) => ({ key, label, ...byPeriod[key] })).filter((r) => r.key !== 'OT' || r.kills + r.potential + r.stops > 0);
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  const completion = (r) => (r.kills + r.potential ? r.kills / (r.kills + r.potential) : null);
  const total = { label: 'Total', kills: sum('kills'), pure: sum('pure'), dirty: sum('dirty'), potential: sum('potential'), stops: sum('stops') };
  return (
    <div className="rhythm-card rhythm-card--wide">
      <div className="rhythm-card__head"><h3>By half</h3><span className="rhythm-card__note">{games} {games === 1 ? 'game' : 'games'}{perGame ? ', per game' : ''}</span></div>
      {modeToggle}
      <div className="rhythm-card__scroll">
      <table className="kills-half-table">
        <thead>
          <tr>
            <th></th>
            <th>Kills</th>
            <th className="kills-half-table__pure-dirty">Pure / dirty <PureDirtyInfo /></th>
            <th className="kills-half-table__pks">
              PKs
              <Tooltip content={<PotentialKillDefinition />}>
                <span className="material-symbols-sharp pure-dirty-info__icon" role="img" aria-label="What is a potential kill">info</span>
              </Tooltip>
            </th>
            <th>Completion</th>
            <th>Stops</th>
          </tr>
        </thead>
        <tbody>
          {[...rows, { ...total, total: true }].map((r) => (
            <tr key={r.key || 'total'} className={r.total ? 'kills-half-table__total' : undefined}>
              <th scope="row">{r.label}</th>
              <td className="kills-half-table__kills">{fmt(r.kills)}</td>
              <td>{fmt(r.pure)} / {fmt(r.dirty)}</td>
              <td>{fmt(r.potential)}</td>
              <td>{pctText(completion(r))}</td>
              <td>{fmt(r.stops)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// How the stops were made, as a donut with the legend beside it. Defensive rebounds are most of the
// stops and drown out everything else, so clicking a type (in the legend or on its slice) drops it
// from the donut and the total; click it in the legend again to bring it back. The center shows the
// total of what is left, or the type being hovered / tapped.
function StopMixCard({ stopMix, total, games }) {
  const { perGame, fmt, toggle: modeToggle } = useCountMode(games);
  const all = STOP_TYPES.filter((t) => stopMix[t.type]).map((t) => ({ ...t, count: stopMix[t.type] }));
  const [dropped, setDropped] = useState([]);
  const [activeType, setActiveType] = useState(null);
  const toggle = (type) => {
    setDropped((d) => (d.includes(type) ? d.filter((x) => x !== type) : [...d, type]));
    setActiveType(null);
  };
  const shownMix = all.filter((t) => !dropped.includes(t.type));
  const shownTotal = shownMix.reduce((sum, t) => sum + t.count, 0);
  const active = shownMix.find((t) => t.type === activeType);
  return (
    <div className="rhythm-card">
      <div className="rhythm-card__head">
        <h3>Stop mix</h3>
        <span className="rhythm-card__note">{dropped.length ? `${fmt(shownTotal)} of ${fmt(total)}` : fmt(total)} stops{perGame ? ' per game' : ''}</span>
      </div>
      {modeToggle}
      {total ? (
        <div className="mix-donut">
          <div className="mix-donut__chart">
            <Chart height={176} margin={{ top: 2, right: 2, bottom: 2, left: 2 }} label="Stops by type">
              <Donut
                data={shownMix}
                value={(t) => t.count}
                label={(t) => t.label}
                color={(t) => MIX_COLORS[t.type]}
                activeIndex={active ? shownMix.indexOf(active) : -1}
                onActiveChange={(a) => setActiveType(a ? a.datum.type : null)}
                onSliceClick={({ datum }) => toggle(datum.type)}
              >
                {({ innerRadius }) => (
                  <text className="when-donut__readout" textAnchor="middle" style={{ fontSize: innerRadius * 0.62 }}>
                    <tspan x="0" dy="0.1em">{fmt(active ? active.count : shownTotal)}</tspan>
                    <tspan className="when-donut__sub" x="0" dy="1.35em" style={{ fontSize: innerRadius * 0.24 }}>{active ? active.label : 'stops'}</tspan>
                  </text>
                )}
              </Donut>
            </Chart>
          </div>
          <ul className="when-donut__legend">
            {all.map((t) => {
              const off = dropped.includes(t.type);
              return (
                <li key={t.type}>
                  <button
                    type="button"
                    className={`when-donut__item${t.type === activeType ? ' when-donut__item--active' : ''}${off ? ' when-donut__item--off' : ''}`}
                    aria-pressed={!off}
                    title={off ? 'Click to include' : 'Click to leave out'}
                    onClick={() => toggle(t.type)}
                    onMouseEnter={() => !off && setActiveType(t.type)}
                    onMouseLeave={() => setActiveType(null)}
                  >
                    <span className="when-donut__swatch" style={{ background: MIX_COLORS[t.type] }} />
                    <span className="when-donut__label">{t.label}</span>
                    <strong>{fmt(t.count)}</strong>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : <p className="rhythm-card__empty">No stops in these games.</p>}
    </div>
  );
}

const STREAK_LABELS = [['2', '2 stops'], ['3', '3 stops'], ['4', '4 stops'], ['5plus', '5+ stops']];

function StreakCard({ streakLengths, games }) {
  const { fmt, toggle: modeToggle } = useCountMode(games);
  const max = Math.max(1, ...Object.values(streakLengths));
  return (
    <div className="rhythm-card">
      <div className="rhythm-card__head"><h3>Streak lengths</h3><span className="rhythm-card__note">Runs of 2+ stops</span></div>
      {modeToggle}
      <div className="kill-duration-bars season-streak">
        {STREAK_LABELS.map(([key, label]) => (
          <div className="kill-duration-bar" key={key}>
            <span className="kill-duration-bar__label">{label}</span>
            <span className="kill-duration-bar__track"><span className="kill-duration-bar__fill" style={{ width: `${(streakLengths[key] / max) * 100}%` }} /></span>
            <span className="kill-duration-bar__value">{fmt(streakLengths[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Kill start times in the same four-minute windows the stream's axis marks (the media-timeout
// spacing): 20-16, 16-12, 12-8, 8-4 and 4-0 left in each half, with all overtime together.
const WINDOW_SECONDS = 240;
const HALF_SECONDS = 1200;
const WINDOWS_PER_HALF = HALF_SECONDS / WINDOW_SECONDS;
const windowLabel = (i) => `${20 - i * 4}–${16 - i * 4}`;

function bucketKillTimes(times) {
  // `from` / `to` are the window in game seconds (to: null runs to the end of the game), which is
  // what lets the stream highlight the same stretch.
  const half = (h) => Array.from({ length: WINDOWS_PER_HALF }, (_, i) => ({
    id: `${h}-${i}`, label: windowLabel(i), count: 0,
    from: h * HALF_SECONDS + i * WINDOW_SECONDS, to: h * HALF_SECONDS + (i + 1) * WINDOW_SECONDS,
  }));
  const groups = [
    { name: '1st half', buckets: half(0) },
    { name: '2nd half', buckets: half(1) },
    { name: 'Overtime', buckets: [{ id: 'ot', label: 'OT', count: 0, from: 2 * HALF_SECONDS, to: null }] },
  ];
  times.forEach((t) => {
    if (t >= 2 * HALF_SECONDS) { groups[2].buckets[0].count += 1; return; }
    const h = t < HALF_SECONDS ? 0 : 1;
    const i = Math.min(WINDOWS_PER_HALF - 1, Math.floor((t - h * HALF_SECONDS) / WINDOW_SECONDS));
    groups[h].buckets[i].count += 1;
  });
  return groups;
}

// Kills by those four-minute windows as horizontal bars, so it lines up with the stream beside it.
// Grouped by half; the busiest window's bar is the full width. Hovering a row (or focusing it with
// the keyboard) previews that window in the stream; clicking or tapping it pins it, so it stays lit
// after the pointer leaves. Any number can be pinned at once; clicking a pinned row lets it go. A
// hover shows on top of whatever is pinned, and only while hovering do the other rows step back.
function WhenCard({ rows, litIds, pinnedIds, hovering, onHover, onPin }) {
  const groups = useMemo(() => bucketKillTimes(pooledKillTimes(rows)), [rows]);
  const max = Math.max(1, ...groups.flatMap((g) => g.buckets.map((b) => b.count)));
  return (
    <div className="rhythm-card">
      <div className="rhythm-card__head"><h3>When kills happen</h3><span className="rhythm-card__note">Minutes left</span></div>
      <div className="when-bars">
        {groups.map((g) => (
          <div className="when-bars__group" key={g.name}>
            <h4 className="when-bars__name">{g.name}</h4>
            {g.buckets.map((b) => {
              const on = litIds.has(b.id);
              const pinned = pinnedIds.has(b.id);
              return (
                <button
                  type="button"
                  className={`kill-duration-bar when-bars__row${on ? ' when-bars__row--active' : ''}${hovering && !on ? ' when-bars__row--quiet' : ''}`}
                  key={b.id}
                  aria-pressed={pinned}
                  onPointerEnter={(e) => { if (e.pointerType === 'mouse') onHover(b); }}
                  onPointerLeave={(e) => { if (e.pointerType === 'mouse') onHover(null); }}
                  onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) onHover(b); }}
                  onBlur={() => onHover(null)}
                  onClick={() => onPin(b)}
                >
                  <span className="kill-duration-bar__label">{b.label}</span>
                  <span className="kill-duration-bar__track"><span className="kill-duration-bar__fill" style={{ width: `${(b.count / max) * 100}%` }} /></span>
                  <span className="kill-duration-bar__value">{b.count}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CreditCard({ players, filtered }) {
  const [all, setAll] = useState(false);
  const shown = all ? players : players.slice(0, CREDIT_PREVIEW);
  return (
    <div className={`rhythm-card${filtered ? ' rhythm-card--stale' : ''}`}>
      <div className="rhythm-card__head"><h3>Credited</h3><span className="rhythm-card__note">Full season, not filtered</span></div>
      {players.length ? (
        <>
          <table className="credited-table">
            <thead><tr><th>Player</th><th>Steals</th><th>Blocks</th></tr></thead>
            <tbody>
              {shown.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.steals || '—'}</td><td>{p.blocks || '—'}</td></tr>)}
            </tbody>
          </table>
          {players.length > CREDIT_PREVIEW && (
            <button type="button" className="season-rhythm__more" onClick={() => setAll((a) => !a)}>{all ? 'Show fewer' : `Show all ${players.length}`}</button>
          )}
        </>
      ) : <p className="rhythm-card__empty">No credited steals or blocks.</p>}
    </div>
  );
}

// Season-level rhythm and mix. Everything but player credit follows the filtered games, so while a
// filter is on, `filtered` greys the Credited card out to show it is still the full season.
export default function SeasonRhythm({ rows, folded, players, filtered, teams }) {
  const { totals, derived } = folded;
  // The windows picked in "When kills happen", shown in the stream beside it: every pinned (clicked)
  // one, plus the one being hovered right now.
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState([]);
  const picks = hovered && !pinned.some((p) => p.id === hovered.id) ? [...pinned, hovered] : pinned;
  const litIds = new Set(picks.map((p) => p.id));
  const pinnedIds = new Set(pinned.map((p) => p.id));
  const togglePin = (b) => setPinned((list) => (list.some((p) => p.id === b.id) ? list.filter((p) => p.id !== b.id) : [...list, b]));
  return (
    <section className="rhythm-section">
      <h2>Rhythm and mix</h2>
      <div className="rhythm-grid">
        <HalvesCard byPeriod={totals.byPeriod} games={totals.games} />
        <div className="rhythm-row">
          <KillStream rows={rows} teams={teams} highlight={picks} />
          <WhenCard rows={rows} litIds={litIds} pinnedIds={pinnedIds} hovering={!!hovered} onHover={setHovered} onPin={togglePin} />
        </div>
        <RangeStats title="Time between kills" note="Start to start, game clock" stats={derived.gaps} empty="Not enough kills to measure a gap." />
        <RangeStats title="How long kills held" note="Kill start to breaker" stats={derived.durations} empty="No kills in these games." />
        <StreakCard streakLengths={totals.streakLengths} games={totals.games} />
        <StopMixCard stopMix={totals.stopMix} total={totals.stops} games={totals.games} />
        <CreditCard players={players} filtered={filtered} />
      </div>
    </section>
  );
}
