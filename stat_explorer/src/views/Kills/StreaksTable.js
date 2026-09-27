import { useMemo, useState } from 'react';
import SortableHeader from '../../components/SortableHeader/SortableHeader';
import { SORT_KEYS } from '../../constants/sorting';
import { streaksForTable, breakerSummary, halfLabel, gainTone } from '../../utils/killInsights';
import './StreaksTable.css';

const CAUSE_TEXT = { second_chance: 'Second-chance bucket', foul: 'Foul' };
const ARIA_SORT = { [SORT_KEYS.ASC]: 'ascending', [SORT_KEYS.DESC]: 'descending' };

// Small squares showing how a streak's stops broke down: filled squares in
// groups of 3 for each completed kill, then a lighter pair for a potential
// kill, or a single faint square for a leftover stop that didn't count for
// anything (see kills-rules.md: a leftover of 1 counts for nothing).
function StreakDots({ streak }) {
  const groups = streak.kills.map((k) => 3);
  const leftover = streak.length - groups.length * 3;
  return (
    <span className="streak-dots">
      {groups.map((_, gi) => (
        <span className="streak-dots__group" key={gi}>
          {[0, 1, 2].map((i) => <span className="streak-dots__cell streak-dots__cell--kill" key={i} />)}
        </span>
      ))}
      {streak.potentialKill && (
        <span className="streak-dots__group">
          {[0, 1].map((i) => <span className="streak-dots__cell streak-dots__cell--pk" key={i} />)}
        </span>
      )}
      {!streak.potentialKill && leftover === 1 && (
        <span className="streak-dots__group">
          <span className="streak-dots__cell streak-dots__cell--none" />
        </span>
      )}
      <span className="streak-dots__count">{streak.length}</span>
    </span>
  );
}

function breakerText(streak) {
  const b = streak.breaker;
  if (!b) return streak.length ? 'game ended' : '';
  if (b.gameEnded) return 'game ended';
  const parts = b.causes.map((c) => CAUSE_TEXT[c] || c);
  const text = parts.join(' + ') || 'Made shot';
  return b.fouler ? `${text} · ${b.fouler}` : text;
}

export default function StreaksTable({ result }) {
  const streaks = useMemo(() => streaksForTable(result), [result]);
  const summary = useMemo(() => breakerSummary(streaks), [streaks]);
  const [sort, setSort] = useState({ key: '', direction: '' });

  const rows = useMemo(() => {
    // Same idea as killGain() in killInsights.js, at the whole-streak level: how
    // much ground BYU's offense actually gained while this streak was building,
    // from its first stop to the breaker — not the standing score at that stop.
    const withGain = streaks.map((s) => ({ streak: s, gain: streakGain(result, s) }));
    if (!sort.direction) return withGain;
    const dir = sort.direction === SORT_KEYS.ASC ? 1 : -1;
    return [...withGain].sort((a, b) => dir * (a.gain - b.gain));
  }, [streaks, sort, result]);

  function onSort(key, direction) {
    setSort({ key: direction ? key : '', direction });
  }

  const foulEntries = Object.entries(summary.foulCounts);

  return (
    <section className="streaks-section">
      <h2>What broke the streaks</h2>

      <div className="streaks-callout">
        <p className="streaks-callout__headline">
          {summary.avoidableCount} of {summary.total} streaks ended on avoidable plays
        </p>
        <p className="streaks-callout__detail">
          {summary.secondChance > 0 && <span>{summary.secondChance} second-chance bucket{summary.secondChance > 1 ? 's' : ''}</span>}
          {foulEntries.map(([name, count]) => <span key={name}>{count} foul ({name})</span>)}
          {summary.pksLost > 0 && <span>{summary.pksLost} potential kill{summary.pksLost > 1 ? 's' : ''} lost this way</span>}
        </p>
      </div>

      <div className="streaks-table-scroll">
        <table className="streaks-table">
          <thead>
            <tr>
              <th>Streak</th>
              <th>From</th>
              <th>Broken</th>
              <th
                className="streaks-table__th streaks-table__col-center"
                aria-sort={ARIA_SORT[sort.key === 'gained' ? sort.direction : ''] ?? 'none'}
              >
                <SortableHeader classes="streaks-sort--center" sortKey="gained" sortDirection={sort.key === 'gained' ? sort.direction : ''} onHeaderClick={onSort}>
                  Pts gained
                </SortableHeader>
              </th>
              <th>What broke it</th>
              <th>Avoidable</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ streak, gain }) => {
              const first = streak.stops.length ? result.stops.find((s) => s.seq === streak.stops[0]) : null;
              const avoidable = !!(streak.breaker && streak.breaker.avoidable);
              return (
                <tr key={streak.stops[0] || streak.breaker?.seq}>
                  <td><StreakDots streak={streak} /></td>
                  <td>
                    {first ? first.clock : ''} <span className={`streaks-table__half streaks-table__half--${first ? first.period : ''}`}>{first ? halfLabel(first.period) : ''}</span>
                  </td>
                  <td>{streak.breaker ? streak.breaker.clock : '—'}</td>
                  <td className="streaks-table__col-center">
                    <span className={`streaks-table__margin streaks-table__margin--${gainTone(gain)}`}>
                      {gain > 0 ? '+' : ''}{gain}
                    </span>
                  </td>
                  <td className={avoidable ? 'streaks-table__cause streaks-table__cause--avoidable' : 'streaks-table__cause'}>{breakerText(streak)}</td>
                  <td>{avoidable ? <span className="streaks-table__avoidable-pill">Avoidable</span> : <span className="streaks-table__no">No</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function streakGain(result, streak) {
  const first = result.stops.find((s) => s.seq === streak.stops[0]);
  return streak.breaker.margin - (first ? first.margin : streak.breaker.margin);
}
