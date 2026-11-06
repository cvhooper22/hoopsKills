import { useMemo } from 'react';
import { Section } from './BoxParts';
import { Chart, ButterflyBars, RadialBars } from '../../components/charts';
import { CLOCK_BUCKETS, shotClockBuckets } from '../../utils/shotClockBuckets';
import { f2, pct, isNum } from './boxFormat';

const MIN_SHOTS = 5; // fewer first shots than this in a bucket is flagged as a small sample in the tooltip
const BYU = 'var(--blue-stop-3)', OPP = 'var(--opp-color)';
// the smaller of the two points-per-shot values in a bucket is the one drawn faded
const smaller = (side, other) => (d) => isNum(d[side].pps) && isNum(d[other].pps) && d[side].pps < d[other].pps;

export function ShotClock({ data }) {
  const { header: h, plays, params } = data;
  const sc = useMemo(() => shotClockBuckets(plays, params), [plays, params]);
  const rows = useMemo(() => CLOCK_BUCKETS.map((b, i) => ({ ...b, byu: sc.byu[i], opp: sc.opp[i] })), [sc]);
  if (!sc.n.byu && !sc.n.opp) return null;

  const tip = ({ datum: d }) => (
    <>
      <div className="shotclock__tip-head">{d.label}{d.note ? ` (${d.note})` : ''} seconds left</div>
      {['byu', 'opp'].map((s) => (
        <div key={s}>{h.teams[s]}: {d[s].n} first shots ({pct(d[s].share)}), {f2(d[s].pps)} pts per shot, {pct(d[s].efg)} eFG{d[s].n < MIN_SHOTS ? ' (small sample)' : ''}</div>
      ))}
    </>
  );

  return (
    <Section title="Shot distribution by shot clock" sub="* first shot only">
      <div className="shotclock">
        <div className="shotclock__main">
          <Chart height={rows.length * 44 + 26} margin={{ top: 22, right: 44, bottom: 4, left: 44 }} label="Share of first shots and points per shot by shot clock left">
            <ButterflyBars
              data={rows} label={(d) => d.label} sub={(d) => d.note} tooltip={tip}
              left={{ name: h.teams.byu, value: (d) => d.byu.share, color: BYU, format: pct, outer: (d) => String(d.byu.n), outerName: 'Att' }}
              right={{ name: h.teams.opp, value: (d) => d.opp.share, color: OPP, format: pct, outer: (d) => String(d.opp.n), outerName: 'Att' }}
            />
          </Chart>
        </div>
        <div className="shotclock__side">
          <p className="shotclock__label">Points per Shot</p>
          <Chart height={340} margin={{ top: 8, right: 8, bottom: 8, left: 8 }} label="Points per shot by shot clock left">
            <RadialBars
              data={rows} label={(d) => d.label} format={f2} tooltip={tip} rings={[1, 2]} ringLabels={false}
              series={[
                { name: h.teams.byu, value: (d) => d.byu.pps, color: BYU, muted: smaller('byu', 'opp') },
                { name: h.teams.opp, value: (d) => d.opp.pps, color: OPP, muted: smaller('opp', 'byu') },
              ]}
            />
          </Chart>
        </div>
      </div>
      <p className="box-foot">
        Shot clock time is estimated from the game clock.
      </p>
    </Section>
  );
}
