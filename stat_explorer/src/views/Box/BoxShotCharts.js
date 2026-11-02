import { useMemo } from 'react';
import { Section } from './BoxParts';
import { ShotChartCard } from '../../components/ShotChart/ShotChartPanel';
import { normalizeShot } from '../../utils/shotLocation';

// The compare tabs' shot charts. Located shots come from the plays export (any feed); the compare panels select by the box
// payload's event log (who was on the floor, which period and window), so each shot is paired with its event: the log is the
// plays in order minus the period-end rows. A pairing is kept only when period and clock agree.
export function useLocatedShots(shotPlays, data) {
  return useMemo(() => {
    if (!shotPlays || !data.events) return null;
    const shots = [];
    let unmatched = 0, i = -1;
    for (const p of shotPlays) {
      if (p.play_category === 'period_admin') continue;
      i++;
      const shot = normalizeShot(p);
      if (!shot) continue;
      const event = data.events[i];
      const rem = p.period_number <= 2 ? (2 - p.period_number) * 1200 + (p.clock_seconds_remaining ?? 0) : (p.clock_seconds_remaining ?? 0);
      if (event && event.cat === 'shot_attempt' && event.per === p.period_number && event.rem === rem) shots.push({ shot, event, i });
      else unmatched++;
    }
    return { shots, unmatched };
  }, [shotPlays, data.events]);
}

// slices: [{ name, side, pick(event, eventIndex) }]: one chart per slice, of that side's shots whose event `pick` accepts.
export default function CompareShotCharts({ located, slices, teams, note }) {
  if (!located) return null;
  const sub = [note, located.unmatched ? `${located.unmatched} shot${located.unmatched === 1 ? '' : 's'} could not be matched to this box file and ${located.unmatched === 1 ? 'is' : 'are'} left out.` : null].filter(Boolean).join(' ');
  return (
    <Section title="Shot charts" sub={sub || undefined}>
      {located.shots.length ? (
        <div className="shot-chart-panel__teams">
          {slices.map((s) => (
            <ShotChartCard key={s.name} name={`${s.name} · ${teams[s.side]}`}
              shots={located.shots.filter((x) => x.event.side === s.side && s.pick(x.event, x.i)).map((x) => x.shot)} />
          ))}
        </div>
      ) : <p>No shot locations in this game's data.</p>}
    </Section>
  );
}
