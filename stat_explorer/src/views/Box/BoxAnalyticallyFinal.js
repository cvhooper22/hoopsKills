import { useMemo, useState } from 'react';
import { Chart, Axis, Line, Band, ReferenceLine, useChart } from '../../components/charts';
import Glossary, { GlossaryEntries } from '../../components/Glossary/Glossary';
import { ANALYTICALLY_FINAL_GLOSSARY } from '../../constants/glossaryEntries';
import { Section, BoxTable } from './BoxParts';
import { periodLabel } from './boxFormat';
import { gameMinutes, axisLayout, formatClock } from '../../utils/playGroups';
import { analyzeGame, playText, CLOSE_POINTS } from '../../utils/analyticallyFinal';

// The Analytically Final tab (Haslametrics' idea): when a lead became mathematically safe, how close the game came to that before
// it did, and the play that pushed it over. Everything is derived from data.events, so the finished-game and live pages share it.
const CLOSE_OPTIONS = [1, 2, 3, 5, 8, 10]; // choices for how many points short counts as close
const SHORT_CAP = 20; // the line is drawn no higher than this many points short
const MARGIN = { top: 12, right: 14, bottom: 46, left: 40 };
const teamName = (n) => (n.length <= 4 ? n.toUpperCase() : n);
const CAUSE_TEXT = {
  score: 'a score by the leader',
  stop: 'a stop: the trailing team\'s possession ended without points',
  clock: 'the clock running down',
  buzzer: 'the final buzzer',
};

// A moment as "2nd half 4:12" from the period and the clock left in it.
const periodClock = (per, secs) => `${periodLabel(per)} ${formatClock(per === 1 ? secs - 1200 : secs)}`;
const minutesSeconds = (sec) => formatClock(Math.round(sec));

function PeriodDividers({ periods }) {
  const chart = useChart();
  return (
    <>
      {periods.filter((p) => p.start > 0).map((p) => <ReferenceLine key={p.per} x={p.start} className="etl-divider" />)}
      {periods.map((p) => <text key={p.per} className="etl-period" x={chart.x(p.start + p.len / 2)} y={chart.innerHeight + 38} textAnchor="middle">{periodLabel(p.per)}</text>)}
    </>
  );
}

function ShortChart({ result, total, close }) {
  const series = useMemo(() => result.series.map((p) => ({ t: p.t, short: Math.min(p.short, SHORT_CAP) })), [result.series]);
  const { ticks, periods } = useMemo(() => axisLayout(total), [total]);
  const labelAt = useMemo(() => Object.fromEntries(ticks.map((k) => [k.t, k.label])), [ticks]);
  return (
    <Chart height={260} margin={MARGIN} x={{ domain: [0, total] }} y={{ domain: [0, SHORT_CAP] }} label="Points short of analytically final over the game">
      <Band y0={0} y1={close} className="af-band" />
      <Axis orient="left" tickCount={5} grid />
      <Axis orient="bottom" tickValues={ticks.map((k) => k.t)} tickFormat={(t) => labelAt[t]} />
      <PeriodDividers periods={periods} />
      <Line data={series} x={(d) => d.t} y={(d) => d.short} style={{ fill: 'none', stroke: 'var(--royal-blue)', strokeWidth: 2 }} />
      {result.crossings.map((c, i) => <ReferenceLine key={c.id} x={c.t} className="af-cross" label={i === result.crossings.length - 1 ? 'Analytically Final' : undefined} labelOffset={-6} />)}
    </Chart>
  );
}

function Tile({ label, value, note }) {
  return (
    <div className="af-tile">
      <div className="af-tile__value">{value}</div>
      <div className="af-tile__label">{label}</div>
      {note ? <div className="af-tile__note">{note}</div> : null}
    </div>
  );
}

function Headline({ result, teams, over }) {
  const c = result.finalAt;
  if (c) {
    const lead = `${teams[c.leader]} +${c.lead}`;
    return (
      <div className="af-headline af-headline--final">
        <strong>Analytically Final</strong> · {c.kind === 'buzzer' ? 'at the final buzzer' : periodClock(c.per, c.secs)} · {lead}
        <div className="af-headline__sub">Pushed over by {CAUSE_TEXT[c.cause]}{c.cause !== 'buzzer' ? `: ${playText(c, teams)}${c.player ? ` (${c.player})` : ''}` : ''}.</div>
      </div>
    );
  }
  return (
    <div className="af-headline">
      <strong>{over ? 'Never analytically final' : 'Not analytically final yet'}</strong>
      {result.reversals.length ? <div className="af-headline__sub">It was final once and the lead was cut back below the line.</div> : null}
    </div>
  );
}

export function AnalyticallyFinalPanel({ data }) {
  const teams = useMemo(() => ({ byu: teamName(data.header.teams.byu), opp: teamName(data.header.teams.opp) }), [data.header.teams]);
  const over = !data.live || data.live.status === 'final';
  const [close, setClose] = useState(CLOSE_POINTS);
  const result = useMemo(() => analyzeGame(data.events, { final: over, close }), [data.events, over, close]);
  const total = useMemo(() => gameMinutes(data.plays || []), [data.plays]);

  if (!data.events?.length) {
    return <Section title="Analytically Final"><p>This game's box file has no event log. Regenerate it with <code>node derivations/game-box-prototype.js {data.header.gameId}</code>.</p></Section>;
  }

  const rows = result.episodes.map((e, i) => [
    i + 1,
    { v: `${teams[e.leader]} +${e.lead}`, className: 'box-table__label' },
    periodClock(e.per, e.secs),
    e.outcome === 'final' ? 'Went final' : e.outcome === 'faded' ? 'Lead cut, faded' : 'In progress',
    e.endT === null ? '—' : e.outcome === 'final' ? 'Final' : 'Out of range',
  ]);

  return (
    <div className="plays">
      <Section title="Analytically Final" sub="A lead is safe once the seconds left are at most (lead − 5)². Who has the ball is ignored and overtime uses the same formula.">
        <Headline result={result} teams={teams} over={over} />
        <div className="plays-group__row mt-l">
          <span className="plays-group__label">Close means within</span>
          {CLOSE_OPTIONS.map((n) => <button key={n} type="button" className={`plays-chip${close === n ? ' plays-chip--on' : ''}`} aria-pressed={close === n} onClick={() => setClose(n)}>{n} {n === 1 ? 'point' : 'points'}</button>)}
        </div>
        <div className="af-tiles">
          <Tile label="Times close" value={result.timesClose} note={`within ${close} points of final`} />
          <Tile label="Time close" value={minutesSeconds(result.secondsClose)} note="game clock" />
          <Tile label="Near misses" value={result.nearMisses} note="close, then the lead was cut" />
          <Tile label="Dips" value={result.dips} note="in range, then pushed back out" />
          <Tile label="Reversals" value={result.reversals.length} note="went final, then lost it" />
        </div>
      </Section>

      <Section title="Points short of final" sub={`How far the leader's lead is from the safe line at each moment (0 = final). The shaded band is within ${close} points, and the black dashed line marks where the game went final.`}>
        <ShortChart result={result} total={total} close={close} />
      </Section>

      <Section title="Close calls">
        {rows.length ? (
          <BoxTable
            head={[{ label: '#' }, { label: 'Leader', className: 'box-table__label' }, { label: 'Got close at' }, { label: 'Result' }, { label: 'Ended' }]}
            rows={rows}
            stickyFirst={false}
          />
        ) : <p className="box-foot">The game never got within {close} points of final.</p>}
      </Section>

      <Glossary storageKey="af-glossary-dismissed"><GlossaryEntries entries={ANALYTICALLY_FINAL_GLOSSARY} /></Glossary>
    </div>
  );
}
