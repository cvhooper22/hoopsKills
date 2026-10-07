import { useMemo, useState } from 'react';
import { STOP_TYPES } from '../../constants/stopTypes';
import { pooledKillTimes } from '../../utils/killsSeason';
import { MIX_COLORS, clockFmt } from './RhythmMix';
import './RhythmMix.css';
import './SeasonRhythm.css';

const REG_MINUTES = 40;
const BUCKET_MINUTES = 5;
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

function StopMixCard({ stopMix, total }) {
  const mix = STOP_TYPES.filter((t) => stopMix[t.type]);
  return (
    <div className="rhythm-card">
      <div className="rhythm-card__head"><h3>Stop mix</h3><span className="rhythm-card__note">{total} stops</span></div>
      {total ? (
        <>
          <div className="stop-mix-bar">
            {mix.map((t) => <span key={t.type} className="stop-mix-bar__seg" style={{ width: `${(stopMix[t.type] / total) * 100}%`, background: MIX_COLORS[t.type] }} />)}
          </div>
          <div className="stop-mix-legend">
            {mix.map((t) => (
              <span className="stop-mix-legend__item" key={t.type}>
                <span className="stop-mix-legend__dot" style={{ background: MIX_COLORS[t.type] }} />{t.label}<strong>{stopMix[t.type]}</strong>
              </span>
            ))}
          </div>
        </>
      ) : <p className="rhythm-card__empty">No stops in these games.</p>}
    </div>
  );
}

const STREAK_LABELS = [['2', '2 stops'], ['3', '3 stops'], ['4', '4 stops'], ['5plus', '5+ stops']];

function StreakCard({ streakLengths }) {
  const max = Math.max(1, ...Object.values(streakLengths));
  return (
    <div className="rhythm-card">
      <div className="rhythm-card__head"><h3>Streak lengths</h3><span className="rhythm-card__note">Runs of 2+ stops</span></div>
      <div className="kill-duration-bars season-streak">
        {STREAK_LABELS.map(([key, label]) => (
          <div className="kill-duration-bar" key={key}>
            <span className="kill-duration-bar__label">{label}</span>
            <span className="kill-duration-bar__track"><span className="kill-duration-bar__fill" style={{ width: `${(streakLengths[key] / max) * 100}%` }} /></span>
            <span className="kill-duration-bar__value">{streakLengths[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Kill start times, in 5-minute buckets of game time; anything past 40:00 is overtime.
function bucketKillTimes(times) {
  const buckets = Array.from({ length: REG_MINUTES / BUCKET_MINUTES }, (_, i) => ({ label: `${i * BUCKET_MINUTES}–${(i + 1) * BUCKET_MINUTES}`, count: 0 }));
  buckets.push({ label: 'OT', count: 0 });
  times.forEach((t) => {
    const i = Math.floor(t / 60 / BUCKET_MINUTES);
    buckets[Math.min(i, buckets.length - 1)].count += 1;
  });
  return buckets;
}

function WhenCard({ rows }) {
  const buckets = useMemo(() => bucketKillTimes(pooledKillTimes(rows)), [rows]);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="rhythm-card">
      <div className="rhythm-card__head"><h3>When kills happen</h3><span className="rhythm-card__note">Kill start, minutes into the game</span></div>
      <div className="season-when" role="img" aria-label="Kills by minutes into the game">
        {buckets.map((b) => (
          <div className="season-when__col" key={b.label}>
            <span className="season-when__count">{b.count || ''}</span>
            <span className="season-when__bar" style={{ height: `${(b.count / max) * 100}%` }} />
            <span className="season-when__label">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreditCard({ players }) {
  const [all, setAll] = useState(false);
  const shown = all ? players : players.slice(0, CREDIT_PREVIEW);
  return (
    <div className="rhythm-card">
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

// Season-level rhythm and mix. Everything but player credit follows the filtered games.
export default function SeasonRhythm({ rows, folded, players }) {
  const { totals, derived } = folded;
  return (
    <section className="rhythm-section">
      <h2>Rhythm and mix</h2>
      <div className="rhythm-grid">
        <RangeStats title="Time between kills" note="Start to start, game clock" stats={derived.gaps} empty="Not enough kills to measure a gap." />
        <RangeStats title="How long kills held" note="Kill start to breaker" stats={derived.durations} empty="No kills in these games." />
        <WhenCard rows={rows} />
        <StreakCard streakLengths={totals.streakLengths} />
        <StopMixCard stopMix={totals.stopMix} total={totals.stops} />
        <CreditCard players={players} />
      </div>
    </section>
  );
}
