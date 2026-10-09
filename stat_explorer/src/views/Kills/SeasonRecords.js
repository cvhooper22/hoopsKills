import { useMemo, useState } from 'react';
import { findRecords, recordSentence, restSentence } from '../../utils/killsRecords';
import './SeasonRecords.css';

// "BYU is 7-1 when they get 8 kills": thresholds in the season's own games where BYU won 80%+
// over at least 5 games and did clearly worse in the other games (src/utils/killsRecords.js). Uses every game in the season, not the
// filtered ones, so a record doesn't change when a filter is toggled. Tapping one copies the line.
export default function SeasonRecords({ rows, label }) {
  const records = useMemo(() => findRecords(rows), [rows]);
  const [copied, setCopied] = useState(null);
  if (!records.length) return null;

  function copy(rec, i) {
    const text = `${recordSentence(rec)}, ${restSentence(rec)} (${label})`;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    setCopied(i);
    setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
  }

  return (
    <section className="season-records">
      <h2>Notable records</h2>
      <ul className="season-records__list">
        {records.map((rec, i) => (
          <li key={rec.conditions.map((c) => `${c.metric}${c.op}${c.value}`).join('&')}>
            <button type="button" className="season-records__item" onClick={() => copy(rec, i)} title="Copy this line">
              <span className="season-records__wl">{rec.wins}-{rec.losses}</span>
              <span className="season-records__text">
                {recordSentence(rec).replace(/^BYU is \d+-\d+ when they /, '')}
                <small className="season-records__rest">{restSentence(rec)}</small>
              </span>
              <span className="season-records__copy">{copied === i ? 'Copied' : 'Copy'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
