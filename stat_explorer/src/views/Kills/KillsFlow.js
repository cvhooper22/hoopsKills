import { useId, useMemo, useState } from 'react';
import { curveMonotoneX, line } from 'd3';
import { Axis, Chart, Line, Marker, Tooltip, positionOf, useChart } from '../../components/charts';
import { halfLabel } from '../../utils/killInsights';
import { Breaks, buildMarks } from './KillStream';
import { scoreSeries, stepPoints, flowSpans, windowPoints, spanEnd } from '../../utils/killsFlow';
import './KillsFlow.css';

const HALF = 1200;
const REG = 2 * HALF;
const OT = 300;
const HASHES = Array.from({ length: REG / 240 + 1 }, (_, i) => i * 240); // the regular 4-minute marks, 20 down to 0 in each half
// The minute labels and the Halftime / End breaks are the season kill stream's (see KillStream).

const toneOf = (s) => (s.gain > 0 ? 'good' : 'bad');
// Where a span's marker and fan point sit along time: the middle of its highlighted window.
const midOf = (s) => (s.t0 + spanEnd(s)) / 2;

// "BYU +4", "Texas +8" or "Tied": who leads, and by how much. The leader changes when the margin flips.
const leader = (m, opponent) => (m === 0 ? 'Tied' : `${m > 0 ? 'BYU' : opponent} +${Math.abs(m)}`);

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// Hover card for a marker: what BYU got out of the stretch where the opponent was held scoreless.
function SpanTip({ s, opponent }) {
  const name = s.kind === 'kill' ? 'Kill' : 'Potential kill';
  const tone = s.pts > 0 ? 'good' : 'bad';
  return (
    <div className="kills-flow__tip">
      <strong>{s.label} · {name}</strong>
      <span>{s.clock} left in the {halfLabel(s.period)}, held {opponent} {mmss(s.held)}</span>
      <span>Score: BYU {s.startByu}–{s.opp} → {s.startByu + s.pts}–{s.opp}</span>
      <span>Margin: {leader(s.startByu - s.opp, opponent)} → {leader(s.startByu - s.opp + s.pts, opponent)}</span>
      {s.endByu > s.startByu + s.pts && <span>Streak ran on to {s.endByu}–{s.opp}</span>}
      <span>Margin added: <b className={`kills-flow__tip-gain kills-flow__tip-gain--${tone}`}>{s.pts > 0 ? '+' : ''}{s.pts}</b></span>
    </div>
  );
}

// The markers, with one tooltip shared between them. Hover on a mouse, tap or focus otherwise.
function Markers({ spans, opponent }) {
  const { x, y } = useChart();
  const [active, setActive] = useState(null);
  return (
    <g>
      {spans.map((s) => (
        <Marker key={s.label} x={midOf(s)} yPx={y(0)}>
          {() => (
            <g
              className={`kills-flow__mark kills-flow__mark--${toneOf(s)}`} tabIndex={0} role="img"
              aria-label={`${s.label}: margin added ${s.pts}`}
              onPointerEnter={() => setActive(s)} onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(s)} onBlur={() => setActive(null)}
              onClick={() => setActive((cur) => (cur === s ? null : s))}
            >
              <Glyph s={s} />
            </g>
          )}
        </Marker>
      ))}
      {active && <Tooltip x={x(midOf(active))} y={y(0) + 14}><SpanTip s={active} opponent={opponent} /></Tooltip>}
    </g>
  );
}

// The fan from a marker up to the stretch of BYU's line it covers. Its far edge is cut from the
// drawn line itself (see windowPoints), so it follows the curve exactly.
function Fans({ spans, points }) {
  const { x, y } = useChart();
  const gen = line().x((p) => positionOf(x, p.t)).y((p) => positionOf(y, p.score)).curve(curveMonotoneX);
  return (
    <g>
      {spans.map((s) => {
        const apex = `${x(midOf(s))},${y(0)}`;
        const d = `M${apex}L${gen(windowPoints(points, s.t0, spanEnd(s))).slice(1)}L${apex}Z`;
        return <path key={s.label} className={`kills-flow__fan kills-flow__fan--${toneOf(s)}`} d={d} />;
      })}
    </g>
  );
}

// The highlighted stretch: the whole line drawn again in green or red and clipped to the span's
// window, so it is the line itself, not a second curve that has to be fitted to it.
function Segments({ spans, points }) {
  const { x, innerHeight } = useChart();
  const base = useId();
  return (
    <g>
      <defs>
        {spans.map((s) => (
          <clipPath key={s.label} id={`${base}-${s.label}`}>
            <rect x={x(s.t0)} y={0} width={Math.max(0, x(spanEnd(s)) - x(s.t0))} height={innerHeight} />
          </clipPath>
        ))}
      </defs>
      {spans.map((s) => (
        <Line key={s.label} data={points} x={(p) => p.t} y={(p) => p.score} curve={curveMonotoneX}
          className={`kills-flow__segment kills-flow__segment--${toneOf(s)}`} clipPath={`url(#${base}-${s.label})`} />
      ))}
    </g>
  );
}

// A kill is a solid shield, a potential kill the same shield left open. The open one gets a solid
// shield in the card's background color underneath, so no line or gridline shows through it.
function Glyph({ s }) {
  const open = s.kind === 'potential';
  const props = { textAnchor: 'middle', dominantBaseline: 'central' };
  return (
    <>
      {open && <text className="material-symbols-sharp kills-flow__shield kills-flow__shield--fill" {...props}>shield</text>}
      <text className={`material-symbols-sharp kills-flow__shield${open ? ' kills-flow__shield--open' : ''}`} {...props}>shield</text>
    </>
  );
}

// BYU's margin over the opponent in one line, so a kill (opponent held) reads as a climb. The markers
// sit on the zero line and fan up to the stretch of line they covered.

// BYU's margin line: blue while BYU leads, gray while it trails. One path, colored by a gradient
// that switches hard at the zero line (in plot pixels), so the color follows the line's height and
// the change lands exactly where the curve crosses zero, even between two data points.
function MarginLine({ points }) {
  const { y, innerHeight } = useChart();
  const id = useId();
  const zero = innerHeight > 0 ? y(0) / innerHeight : 0.5;
  return (
    <>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={0} y2={innerHeight}>
          <stop offset={zero} stopColor="var(--royal-blue)" />
          <stop offset={zero} stopColor="var(--gray3, #8f8f8f)" />
        </linearGradient>
      </defs>
      <Line data={points} x={(p) => p.t} y={(p) => p.score} curve={curveMonotoneX} className="kills-flow__byu" style={{ stroke: `url(#${id})` }} />
    </>
  );
}

export default function KillsFlow({ plays, result, game }) {
  const data = useMemo(() => {
    const series = scoreSeries(plays, game.defense);
    const last = series[series.length - 1];
    const end = last.t <= REG ? REG : REG + Math.ceil((last.t - REG) / OT) * OT;
    const swing = Math.max(5, ...series.map((p) => Math.abs(p.margin)));
    return {
      end,
      spans: flowSpans(plays, series, result, game.defense),
      lead: stepPoints(series, 'margin'),
      swing: Math.ceil(swing / 5) * 5 + 5,
    };
  }, [plays, result, game.defense]);
  const opponent = game.defense === 'home' ? game.away : game.home;
  const marks = useMemo(() => buildMarks(Math.round((data.end - REG) / OT)), [data.end]);
  const labels = useMemo(() => new Map(marks.minutes.map((m) => [m.t, m.label])), [marks]);
  const ticks = useMemo(() => marks.minutes.map((m) => m.t), [marks]);
  if (!data.spans.length) return null;

  const { spans, lead } = data;

  return (
    <section className="kills-flow rhythm-card">
      <h2>How the kills moved the margin</h2>
      <div className="kills-flow__legend" aria-hidden="true">
        <span><i className="kills-flow__key kills-flow__key--byu" />BYU leading</span>
        <span><i className="kills-flow__key kills-flow__key--trail" />BYU trailing</span>
        <span><span className="material-symbols-sharp kills-flow__legend-icon">shield</span>Kill</span>
        <span><span className="material-symbols-sharp kills-flow__legend-icon kills-flow__legend-icon--open">shield</span>Potential kill</span>
        <span><i className="kills-flow__key kills-flow__key--good" />BYU scored during it</span>
        <span><i className="kills-flow__key kills-flow__key--bad" />No points</span>
      </div>
      <Chart className="kills-flow__chart" height={320} margin={{ top: 12, right: 36, bottom: 28, left: 8 }}
        x={{ domain: [0, data.end] }} y={{ domain: [-data.swing, data.swing] }}
        label={`BYU's margin over ${opponent} through the game, with ${spans.length} kills and potential kills marked`}>
        <Axis orient="right" grid tickCount={5} tickFormat={(v) => (v > 0 ? `+${v}` : String(v))} />
        <ZeroLine />
        <Axis orient="bottom" tickValues={HASHES} tickFormat={() => ''} tickSize={5} />
        <Axis orient="bottom" tickValues={ticks} tickFormat={(v) => labels.get(v)} tickSize={5} hideDomain />
        <Breaks breaks={marks.breaks} />
        <Fans spans={spans} points={lead} />
        <MarginLine points={lead} />
        <Segments spans={spans} points={lead} />
        <Markers spans={spans} opponent={opponent} />
      </Chart>
    </section>
  );
}

function ZeroLine() {
  const { x, y } = useChart();
  return <line className="kills-flow__zero" x1={0} x2={x.range()[1]} y1={y(0)} y2={y(0)} />;
}
