import { useMemo, useState } from 'react';
import { Section } from './BoxParts';
import ShotChart from '../../components/ShotChart/ShotChart';
import { ShotChartCard } from '../../components/ShotChart/ShotChartPanel';
import { normalizeShot } from '../../utils/shotLocation';
import { elapsedSec } from '../../utils/playGroups';

// The chance (a row of data.plays) each shot (cat shot_attempt, field fga) or free throw (free_throw, fta) event belongs to, so it can
// be filtered by the chance's play type. Per team, the chances with attempts and the team's events are both in game order, so they pair off one to one; a pair whose
// times disagree is left out (the shot then has no play).
function playsByEvent(events, plays, cat, field) {
  const out = new Map();
  for (const side of ['byu', 'opp']) {
    const shots = events.filter((e) => e.cat === cat && e.side === side);
    const chances = plays.filter((p) => p.offense === side).flatMap((p) => Array(p[field] || 0).fill(p));
    if (shots.length !== chances.length) continue;
    shots.forEach((e, k) => {
      const p = chances[k], t = elapsedSec({ per: e.per, startRem: e.rem }), s = elapsedSec(p);
      if (e.per === p.per && t >= s - 1 && t <= s + (p.dur || 0) + 1) out.set(e, p);
    });
  }
  return out;
}

// The compare tabs' shot charts. Located shots come from the plays export (any feed); the compare panels select by the box
// payload's event log (who was on the floor, which period and window), so each shot is paired with its event: the log is the
// plays in order minus the period-end rows. A pairing is kept only when period and clock agree.
export function useLocatedShots(shotPlays, data) {
  return useMemo(() => {
    if (!shotPlays || !data.events) return null;
    const shots = [];
    const playOf = playsByEvent(data.events, data.plays, 'shot_attempt', 'fga');
    const ftPlayOf = playsByEvent(data.events, data.plays, 'free_throw', 'fta');
    // Match each located shot to its box event by period, clock, make and shooter rather than by position: the event log can carry
    // events the play list doesn't (assists, split rebounds), which throws a position match off for the rest of the game.
    const pool = new Map();
    data.events.forEach((event, idx) => {
      if (event.cat !== 'shot_attempt') return;
      const k = `${event.per}|${event.rem}|${!!event.made}`;
      if (!pool.has(k)) pool.set(k, []);
      pool.get(k).push(idx);
    });
    let unmatched = 0;
    for (const p of shotPlays) {
      const shot = normalizeShot(p);
      if (!shot) continue;
      const rem = p.period_number <= 2 ? (2 - p.period_number) * 1200 + (p.clock_seconds_remaining ?? 0) : (p.clock_seconds_remaining ?? 0);
      const cands = pool.get(`${p.period_number}|${rem}|${!!p.is_made}`) || [];
      const at = Math.max(0, cands.findIndex((idx) => data.events[idx].player === p.player_name));
      const [i] = cands.splice(at, 1);
      const event = i === undefined ? null : data.events[i];
      if (event) {
        const before = i > 0 ? data.events[i - 1].sc : [0, 0]; // the running score is on each event, after it
        shots.push({ shot: { ...shot, score: { before, after: event.sc } }, event, i, play: playOf.get(event) ?? null });
      } else unmatched++;
    }
    // free throws have no location, so they are not charted, but they count in a slice's summary
    const fts = data.events.map((event, i) => ({ event, i, play: ftPlayOf.get(event) ?? null })).filter((x) => x.event.cat === 'free_throw');
    return { shots, fts, unmatched };
  }, [shotPlays, data.events, data.plays]);
}

export const ftLine = (list) => ({ made: list.filter((x) => x.event.made).length, att: list.length });

export const MADE = '#003fa2', MISS = '#c0392b'; // the chart's own blue / red; every chart starts with them
const MADE_PRESETS = ['#003fa2', '#002e5d', '#0b5cd5', '#1e88e5', '#5aa9f0', '#4b4fc9', '#0f8aa8']; // blues for makes
const MISS_PRESETS = ['#c0392b', '#8e1b1b', '#e53935', '#ff6f60', '#d9531e', '#b4483a', '#e57373']; // reds for misses

// One color: a row of preset swatches, or (Custom) the browser's full color picker.
function ColorChoice({ label, value, presets, onChange }) {
  const [custom, setCustom] = useState(() => !presets.includes(value));
  return (
    <div className="shotcmp-choice">
      {custom ? <input type="color" className="shotcmp-color" aria-label={`${label} custom color`} value={value} onChange={(e) => onChange(e.target.value)} />
        : presets.map((c) => <button key={c} type="button" className={`shotcmp-swatch${c === value ? ' shotcmp-swatch--on' : ''}`} style={{ background: c }} aria-label={`${label} ${c}`} aria-pressed={c === value} onClick={() => onChange(c)} />)}
      <button type="button" className="plays-chip plays-chip--small shotcmp-mode" onClick={() => setCustom((v) => !v)}>{custom ? 'Presets' : 'Custom'}</button>
    </div>
  );
}


const GEAR = 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z';

// The "Shot charts" section shared by the compare tabs: a gear opens the settings (one chart per group or all on one court, and each
// chart's make / miss colors). charts: [{ id, name, shots, ft, made, miss }]; onColor(id, { made?, miss? }).
export function ShotChartsSection({ charts, loading, empty, sub, onColor, teams }) {
  const [picked, setView] = useState('sequence'); // sequence | stacked
  const multi = charts.length > 1; // with one chart there is nothing to stack
  const view = multi ? picked : 'sequence';
  const [config, setConfig] = useState(false);
  return (
    <Section title="Shot charts" sub={sub || undefined}>
      <div className="shotcmp-bar">
        <button type="button" className={`shotcmp-gear${config ? ' shotcmp-gear--on' : ''}`} aria-expanded={config} aria-label="Chart settings" title="Chart settings" onClick={() => setConfig((v) => !v)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d={GEAR} /></svg>
        </button>
      </div>
      {config ? (
        <div className="plays-group shotcmp-config">
          {multi ? (
            <>
              <h3 className="plays-group__title">Settings</h3>
              <div className="plays-group__row">
                <span className="plays-group__label">Show</span>
                {[['sequence', 'Chart Per Group'], ['stacked', 'Same Chart']].map(([k, label]) => <button key={k} type="button" className={`plays-chip${view === k ? ' plays-chip--on' : ''}`} onClick={() => setView(k)}>{label}</button>)}
              </div>
            </>
          ) : null}
          <h3 className="plays-group__title">Colors</h3>
          {charts.map((c) => (
            <div key={c.id} className="plays-group__row">
              <span className="plays-group__label shotcmp-config__name">{c.rawName}</span>
              <span className="plays-group__hint">Makes</span>
              <ColorChoice label={`${c.rawName} make`} value={c.made} presets={MADE_PRESETS} onChange={(made) => onColor(c.id, { made })} />
              <span className="plays-group__hint">Misses</span>
              <ColorChoice label={`${c.rawName} miss`} value={c.miss} presets={MISS_PRESETS} onChange={(miss) => onColor(c.id, { miss })} />
              <button type="button" className="plays-chip plays-chip--small" onClick={() => onColor(c.id, { made: MADE, miss: MISS })}>Reset</button>
            </div>
          ))}
        </div>
      ) : null}
      {loading ? <p>Loading shot locations…</p> : empty ? <p>No shot locations in this game's data.</p> : view === 'sequence' ? (
        <div className="shot-chart-panel__teams">
          {charts.map((c) => <ShotChartCard key={c.id} name={c.name} shots={c.shots} made={c.made} miss={c.miss} ft={c.ft} teams={teams} />)}
        </div>
      ) : (
        <>
          <ShotChart layers={charts} teams={teams} label="Stacked shot charts" />
          <div className="shot-chart-panel__legend">
            {charts.map((c) => <span key={c.id}><strong>{c.name}</strong> ({c.shots.filter((x) => x.made).length}–{c.shots.length}): <span style={{ color: c.made }}>● made</span> <span style={{ color: c.miss }}>✕ missed</span></span>)}
          </div>
          <div className="shot-chart-panel__teams">
            {charts.map((c) => <ShotChartCard key={c.id} name={c.name} shots={c.shots} made={c.made} miss={c.miss} ft={c.ft} chart={false} />)}
          </div>
        </>
      )}
    </Section>
  );
}

// slices: [{ name, side, pick(event, eventIndex, play) }]: one chart per slice, of that side's shots whose event `pick` accepts.
export default function CompareShotCharts({ located, slices, teams, note }) {
  const [colors, setColors] = useState({}); // by slice position: { made, miss }
  if (!located) return null;
  const sub = [note, 'Free throws have no location, so they are counted in each summary but not drawn on the charts.', located.unmatched ? `${located.unmatched} shot${located.unmatched === 1 ? '' : 's'} could not be matched to this box file and ${located.unmatched === 1 ? 'is' : 'are'} left out.` : null].filter(Boolean).join(' ');
  const charts = slices.map((s, i) => {
    const mine = (x) => x.event.side === s.side && s.pick(x.event, x.i, x.play);
    return { id: i, rawName: s.name, name: `${s.name} · ${teams[s.side]}`, shots: located.shots.filter(mine).map((x) => x.shot), ft: ftLine(located.fts.filter(mine)), made: MADE, miss: MISS, ...colors[i] };
  });
  return <ShotChartsSection charts={charts} empty={!located.shots.length} sub={sub} teams={teams} onColor={(id, change) => setColors((m) => ({ ...m, [id]: { ...m[id], ...change } }))} />;
}
