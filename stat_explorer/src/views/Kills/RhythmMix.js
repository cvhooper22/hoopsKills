import { useMemo } from 'react';
import { killGaps, stopMix, creditedTable } from '../../utils/killInsights';
import './RhythmMix.css';

export const MIX_COLORS = {
  rebound: '#aebfd4', turnover: 'var(--royal-blue)', steal: 'var(--blue-stop-3)',
  block: 'var(--navy-blue)', charge: 'var(--almostBlack)', tie_up: 'var(--gray4)',
};

export function clockFmt(seconds) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function TimeBetweenKills({ kills }) {
  const gaps = useMemo(() => killGaps(kills), [kills]);
  if (gaps.length === 0) {
    return (
      <div className="rhythm-card">
        <div className="rhythm-card__head"><h3>Time between kills</h3></div>
        <p className="rhythm-card__empty">Not enough kills yet to measure a gap.</p>
      </div>
    );
  }
  const avg = gaps.reduce((sum, g) => sum + g.seconds, 0) / gaps.length;
  const longest = gaps.reduce((a, b) => (b.seconds > a.seconds ? b : a));
  const shortest = gaps.reduce((a, b) => (b.seconds < a.seconds ? b : a));
  const maxDuration = Math.max(...kills.map((k) => k.durationSeconds));
  return (
    <div className="rhythm-card">
      <div className="rhythm-card__head">
        <h3>Time between kills</h3>
        <span className="rhythm-card__note">Start to start, game clock</span>
      </div>
      <div className="rhythm-stat-row">
        <div className="rhythm-stat">
          <span className="rhythm-stat__label">Average</span>
          <span className="rhythm-stat__value">{clockFmt(avg)}</span>
        </div>
        <div className="rhythm-stat">
          <span className="rhythm-stat__label">Longest</span>
          <span className="rhythm-stat__value">{clockFmt(longest.seconds)}</span>
          <span className="rhythm-stat__sub">K{longest.from} → K{longest.to}</span>
        </div>
        <div className="rhythm-stat">
          <span className="rhythm-stat__label">Shortest</span>
          <span className="rhythm-stat__value">{clockFmt(shortest.seconds)}</span>
          <span className="rhythm-stat__sub">K{shortest.from} → K{shortest.to}</span>
        </div>
      </div>

      <h4 className="rhythm-card__subhead">Kill start to breaker</h4>
      <p className="rhythm-card__note rhythm-card__note--left">How long the run held</p>
      <div className="kill-duration-bars">
        {kills.map((k, i) => (
          <div className="kill-duration-bar" key={i}>
            <span className="kill-duration-bar__label">K{i + 1}</span>
            <span className="kill-duration-bar__track">
              <span className="kill-duration-bar__fill" style={{ width: `${(k.durationSeconds / maxDuration) * 100}%` }} />
            </span>
            <span className="kill-duration-bar__value">{clockFmt(k.durationSeconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StopMixCard({ stops }) {
  const mix = useMemo(() => stopMix(stops), [stops]);
  const { rows: credited, charges } = useMemo(() => creditedTable(stops), [stops]);
  const total = stops.length;

  return (
    <div className="rhythm-card">
      <div className="rhythm-card__head">
        <h3>Stop mix</h3>
        <span className="rhythm-card__note">{total} stops</span>
      </div>
      <div className="stop-mix-bar">
        {mix.map((m) => (
          <span key={m.type} className="stop-mix-bar__seg" style={{ width: `${(m.count / total) * 100}%`, background: MIX_COLORS[m.type] }} />
        ))}
      </div>
      <div className="stop-mix-legend">
        {mix.map((m) => (
          <span className="stop-mix-legend__item" key={m.type}>
            <span className="stop-mix-legend__dot" style={{ background: MIX_COLORS[m.type] }} />
            {m.label}
            <strong>{m.count}</strong>
          </span>
        ))}
      </div>

      <h4 className="rhythm-card__subhead">Credited</h4>
      {credited.length === 0 && charges === 0 ? (
        <p className="rhythm-card__empty">No credited steals or blocks yet.</p>
      ) : (
        <table className="credited-table">
          <thead><tr><th>Player</th><th>Steals</th><th>Blocks</th></tr></thead>
          <tbody>
            {credited.map((row) => (
              <tr key={row.player}>
                <td>{row.player}</td>
                <td>{row.steals || '—'}</td>
                <td>{row.blocks || '—'}</td>
              </tr>
            ))}
            {charges > 0 && (
              <tr>
                <td>Charges</td>
                <td colSpan={2}>{charges} · no player credited</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function RhythmMix({ result }) {
  return (
    <section className="rhythm-section">
      <h2>Rhythm and mix</h2>
      <div className="rhythm-grid">
        <TimeBetweenKills kills={result.kills} />
        <StopMixCard stops={result.stops} />
      </div>
    </section>
  );
}
