import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Axis, BubbleStream, Chart, Highlight, useChart } from '../../components/charts';
import { teamName } from './SeasonGamesTable';
import useMediaQuery from '../../hooks/useMediaQuery';
import './KillStream.css';

// Every kill in the games shown, on one timeline of game time. Regulation is 2 halves of 20:00, each
// overtime adds 5:00, and the timeline stretches to the longest game in the set. Time reads as the
// clock does on TV, minutes LEFT in the period, so it counts down and starts over at halftime and in
// each overtime; those restarts are marked on the axis.
const HALF = 1200;
const REG = 2 * HALF;
const OT = 300;
const WIN = 'var(--royal-blue)';
const LOSS = '#c8ad7f';
const FULL_SIZE_WIDTH = 800; // chart width (px) at and above which dots are full size; narrower charts shrink them
// Stream layout settings by screen size. bin: kills within this many seconds of each other share a
// column, so busy minutes pile up; pull: how hard dots are held to their true time; lift: how hard
// they are drawn back to the middle line (see BubbleStream). The chart gets a lot narrower down the
// range, so each size has its own set: wide above 768px, mid from 768px down to a phone, mobile
// at 480px and below.
const STREAM_TUNING = {
  wide: { bin: 25, pull: 1, lift: 0.01 },
  mid: { bin: 55, pull: 0.6, lift: 0.045 },
  mobile: { bin: 85, pull: 0.9, lift: 0.01 },
};
const MOBILE_QUERY = '(max-width: 480px)';
const MID_QUERY = '(max-width: 768px)';

const periodOf = (t) => (t < HALF ? 0 : t < REG ? 1 : 2 + Math.floor((t - REG) / OT));
const periodName = (p) => (p === 0 ? '1st half' : p === 1 ? '2nd half' : p === 2 ? 'OT' : `${p - 1}OT`);

// "14:32": the clock a kill started at, counting down in its period.
function clockLeft(t) {
  const p = periodOf(t);
  const start = p < 2 ? p * HALF : REG + (p - 2) * OT;
  const left = Math.max(0, (p < 2 ? HALF : OT) - (t - start));
  return `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// How many overtimes the longest game in the set needed.
function overtimesIn(rows) {
  const maxKill = Math.max(0, ...rows.flatMap((r) => r.killTimes));
  const wentToOT = rows.some((r) => r.byPeriod.OT && r.byPeriod.OT.stops + r.byPeriod.OT.kills + r.byPeriod.OT.potential > 0);
  return Math.max(wentToOT ? 1 : 0, maxKill > REG ? Math.ceil((maxKill - REG) / OT) : 0);
}

// Axis marks, all in game seconds. `minutes` are the countdown ticks inside a half, every four
// minutes to echo the media timeouts in college basketball (20 at tip-off, then 16, 12, 8 and 4 left). `breaks` are where the clock starts over: halftime, the start of each
// overtime, and the final horn; they get a line and a bold label instead of a minute tick.
export function buildMarks(ots) {
  const minutes = [0, 240, 480, 720, 960, 1440, 1680, 1920, 2160].map((t) => ({ t, label: String(20 - (t % HALF) / 60) }));
  const end = REG + ots * OT;
  const breaks = [{ t: HALF, label: 'Halftime' }];
  if (ots === 0) {
    breaks.push({ t: REG, label: 'End' });
  } else {
    for (let k = 0; k <= ots; k += 1) breaks.push({ t: REG + k * OT, label: k === ots ? 'End' : periodName(2 + k) });
  }
  return { minutes, breaks, end };
}

// Break lines and their bold axis labels.
export function Breaks({ breaks }) {
  const { x, innerHeight, innerWidth } = useChart();
  const label = (b) => (b.label === 'Halftime' && innerWidth < 500 ? 'Half' : b.label); // "Halftime" runs into the ticks on a phone
  return (
    <g className="kill-stream__breaks">
      {breaks.map((b) => (
        <g key={b.t}>
          <line className="kill-stream__break-line" x1={x(b.t)} x2={x(b.t)} y1={0} y2={innerHeight} />
          <text className="kill-stream__break-label" x={x(b.t)} y={innerHeight + 8} dy="0.71em" textAnchor="middle">{label(b)}</text>
        </g>
      ))}
    </g>
  );
}

// `highlight` is a list of { from, to } windows in game seconds (to: null runs to the end); empty or
// missing for none. Windows that touch are merged into one band. The region is
// shaded and every kill outside it fades; the "When kills happen" bars drive it.
// Sorts windows and joins any that touch or overlap, so adjacent picks read as one band.
function mergeWindows(list) {
  const sorted = [...list].sort((a, b) => a.from - b.from);
  return sorted.reduce((out, w) => {
    const last = out[out.length - 1];
    if (last && (last.to === null || w.from <= last.to)) {
      last.to = last.to === null || w.to === null ? null : Math.max(last.to, w.to);
    } else {
      out.push({ from: w.from, to: w.to });
    }
    return out;
  }, []);
}

export default function KillStream({ rows, teams, highlight }) {
  const navigate = useNavigate();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const mid = useMediaQuery(MID_QUERY);
  const profile = mobile ? 'mobile' : mid ? 'mid' : 'wide';
  const tune = STREAM_TUNING[profile];
  const windows = useMemo(() => mergeWindows(highlight || []), [highlight]);
  const inWindow = (t) => windows.some((w) => t >= w.from && (w.to === null || t < w.to));
  const kills = useMemo(() => rows.flatMap((r) => r.killTimes.map((t, i) => ({
    t, gameId: r.gameId, opp: teamName(teams, r.oppTeamId), date: r.date, won: r.result === 'W', held: r.durations[i],
  }))), [rows, teams]);
  // "25 kills" over "(0.7 / gm)": the kills inside a highlighted band, and per game over the games shown.
  // Left off on a phone, where a band is too narrow to hold it.
  const windowLabel = (w) => {
    const n = kills.filter((k) => k.t >= w.from && (w.to === null || k.t < w.to)).length;
    return [`${n} kills`, `(${(n / Math.max(1, rows.length)).toFixed(1)} / gm)`];
  };
  const marks = useMemo(() => buildMarks(overtimesIn(rows)), [rows]);
  const labels = useMemo(() => new Map(marks.minutes.map((m) => [m.t, m.label])), [marks]);
  const tickValues = useMemo(() => marks.minutes.map((m) => m.t), [marks]);
  const xOf = useMemo(() => (k) => k.t, []);

  return (
    <div className="rhythm-card">
      <div className="rhythm-card__head">
        <h3>Where kills cluster</h3>
      </div>
      <div className="kill-stream__legend" aria-hidden="true">
        <span><i style={{ background: WIN }} />Kill happened in a Win</span>
        <span><i style={{ background: LOSS }} />Kill happened in a Loss</span>
        <span className="kill-stream__count">{kills.length} kills in {rows.length} {rows.length === 1 ? 'game' : 'games'}</span>
      </div>
      <Chart
        className="kill-stream"
        height={300}
        margin={{ top: 8, right: 12, bottom: 34, left: 12 }}
        x={{ domain: [0, marks.end] }}
        label={`${kills.length} kills across ${rows.length} games, plotted by time in the game`}
      >
        <Axis orient="bottom" tickValues={tickValues} tickFormat={(v) => labels.get(v)} />
        <Breaks breaks={marks.breaks} />
        <Highlight region={windows.map((w) => ({ x0: w.from, x1: w.to, label: mobile ? undefined : windowLabel(w) }))} />
        <BubbleStream
          data={kills}
          x={xOf}
          radius={8}
          fluidWidth={FULL_SIZE_WIDTH}
          minScale={0.5}
          bin={tune.bin}
          pull={tune.pull}
          lift={tune.lift}
          color={(k) => (k.won ? WIN : LOSS)}
          dimmed={windows.length ? (k) => !inWindow(k.t) : undefined}
          tooltip={({ datum: k }) => (
            <div className="kill-stream__tip">
              <strong>{k.opp}</strong>
              <span>{formatDate(k.date)} · {k.won ? 'Win' : 'Loss'}</span>
              <span>{clockLeft(k.t)} left in the {periodName(periodOf(k.t))}</span>
            </div>
          )}
          onPointClick={(k) => navigate(`/kills/${k.gameId}`)}
        />
      </Chart>
    </div>
  );
}
