import { useMemo, useRef, useState } from 'react';
import { periodLabel } from './boxFormat';
import { marginTimeline, scoreTimeline, pointAt, gameMinutes, axisLayout, fromMinute, formatClock, snapNear } from '../../utils/playGroups';

// Game-flow graph for the Stint Compare tab: the score margin over the game (up = focus team ahead). Drag across it to select a
// stretch for the active group; click to clear that group's stretch. `ranges` is [{ from, to }] per slot (null = not set).
export const SLOT_COLORS = ['#002e5d', '#d9730d']; // A, B
const TEAM_COLORS = { byu: '#002e5d', opp: '#b4483a' }; // the T that marks a team's own timeout

const W = 800, H = 248, PAD = { l: 34, r: 10, t: 10, b: 52 }; // the extra 12 in the bottom pad is the lane for the media timeout markers
const SNAP = 0.5; // minutes
const TIMEOUT_SNAP = 0.75; // minutes: how close an edge has to land to a timeout to be pulled onto it

// `timeouts` are the media timeouts' game minutes (a diamond along the bottom) and `teamTimeouts` ([{ t, side }]) the teams' own (a T
// in the team's color). With `snap` on, a selection's edges land on the nearest timeout of either kind within 45 seconds of them.
export default function GameFlow({ plays, events, teams, ranges, active, names, onSelect, timeouts = [], teamTimeouts = [], snap = false }) {
  const total = gameMinutes(plays);
  // exact running score when the event log is there, else the margin from the chances' points (no score to show)
  const line = useMemo(() => (events ? scoreTimeline(events) : marginTimeline(plays)), [plays, events]);
  const maxAbs = Math.max(6, ...line.map((p) => Math.abs(p.margin)));
  const bound = Math.ceil(maxAbs / 5) * 5;
  const x = (t) => PAD.l + (t / total) * (W - PAD.l - PAD.r);
  const y = (m) => PAD.t + ((bound - m) / (2 * bound)) * (H - PAD.t - PAD.b);
  const path = line.map((p, i) => `${i ? `H${x(p.t)}V` : 'M'}${i ? y(p.margin) : `${x(p.t)} ${y(p.margin)}`}`).join('');
  const tail = line.length ? `H${x(Math.max(line[line.length - 1].t, 0))}` : '';

  const svg = useRef(null);
  const [drag, setDrag] = useState(null); // { a, b } in minutes while dragging
  const [hover, setHover] = useState(null); // game minute under the pointer
  const toMin = (e) => {
    const r = svg.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = ((px - PAD.l) / (W - PAD.l - PAD.r)) * total;
    const t0 = Math.min(total, Math.max(0, Math.round(t / SNAP) * SNAP));
    const near = snap ? snapNear(t, [...timeouts, ...teamTimeouts.map((m) => m.t)], TIMEOUT_SNAP) : t;
    return near !== t ? Math.min(total, Math.max(0, near)) : t0;
  };
  const down = (e) => { svg.current.setPointerCapture(e.pointerId); const t = toMin(e); setDrag({ a: t, b: t }); };
  const move = (e) => {
    const r = svg.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = ((px - PAD.l) / (W - PAD.l - PAD.r)) * total;
    setHover(t >= 0 && t <= total ? Math.round(t * 60) / 60 : null);
    if (drag) setDrag({ a: drag.a, b: toMin(e) });
  };
  const up = () => {
    if (!drag) return;
    const from = Math.min(drag.a, drag.b), to = Math.max(drag.a, drag.b);
    onSelect(active, to - from >= SNAP ? { from, to } : null);
    setDrag(null);
  };

  const onEdge = (t) => bands.some((r) => r && (Math.abs(r.from - t) < 1e-6 || Math.abs(r.to - t) < 1e-6));
  // a timeout within a few seconds of the cursor is named on the hover card
  const marks = [...timeouts.map((t) => ({ t, label: 'Media timeout' })), ...teamTimeouts.map(({ t, side }) => ({ t, label: `${teams[side]} timeout` }))];
  const noteAt = (h) => (h === null ? null : marks.find((m) => Math.abs(m.t - h) <= 0.25)?.label ?? null);
  const bands = ranges.map((r, i) => (drag && i === active ? { from: Math.min(drag.a, drag.b), to: Math.max(drag.a, drag.b) } : r && { from: Math.min(r.from, total), to: Math.min(r.to, total) }));
  // time left in the period at each 5-minute mark, then a label for each half / overtime under the axis
  const { ticks, periods } = axisLayout(total);

  return (
    <svg ref={svg} className="flow" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Score margin over the game; drag to select a stretch of plays"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => setHover(null)} onPointerCancel={() => { setDrag(null); setHover(null); }}>
      {bands.map((r, i) => (r ? <rect key={i} x={x(r.from)} y={PAD.t} width={Math.max(1, x(r.to) - x(r.from))} height={H - PAD.t - PAD.b} fill={SLOT_COLORS[i]} opacity="0.18" /> : null))}
      {[bound, 0, -bound].map((m) => <line key={m} x1={PAD.l} x2={W - PAD.r} y1={y(m)} y2={y(m)} stroke="currentColor" opacity={m === 0 ? 0.5 : 0.15} />)}
      {[bound, 0, -bound].map((m) => <text key={m} x={PAD.l - 4} y={y(m) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.7">{m > 0 ? `+${m}` : m}</text>)}
      <text x={PAD.l + 4} y={PAD.t + 11} fontSize="11" fill="currentColor" opacity="0.7">{teams.byu} ahead</text>
      <text x={PAD.l + 4} y={H - PAD.b - 4} fontSize="11" fill="currentColor" opacity="0.7">{teams.opp} ahead</text>
      {timeouts.map((t) => (
        <g key={t} pointerEvents="none" opacity={onEdge(t) ? 1 : 0.55}>
          <line x1={x(t)} x2={x(t)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeDasharray="1 3" opacity="0.35" />
          <path d={`M${x(t)} ${H - PAD.b + 3}l4.5 4.5l-4.5 4.5l-4.5 -4.5z`} fill="var(--royal-blue)" />
        </g>
      ))}
      <line x1={x(20)} x2={x(20)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeDasharray="3 3" opacity="0.4" />
      {ticks.map((k) => <text key={k.t} x={x(k.t)} y={H - 22} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">{k.label}</text>)}
      {periods.map((p) => <text key={p.per} x={x(p.start + p.len / 2)} y={H - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor" opacity="0.8">{periodLabel(p.per)}</text>)}
      <path d={path + tail} fill="none" stroke="var(--royal-blue)" strokeWidth="2" />
      {bands.map((r, i) => (r ? <text key={i} x={x(r.from) + 4} y={H - PAD.b - 4 - i * 13} fontSize="12" fontWeight="700" fill={SLOT_COLORS[i]}>{names[i]}</text> : null))}
      {teamTimeouts.map(({ t, side }) => <text key={`${side}${t}`} x={x(t)} y={H - PAD.b + 12} textAnchor="middle" fontSize="11" fontWeight="800" fill={TEAM_COLORS[side]} opacity={onEdge(t) ? 1 : 0.7} pointerEvents="none">T</text>)}
      {hover !== null ? <HoverTip t={hover} x={x(hover)} dotY={y(pointAt(line, hover).margin)} line={line} teams={teams} top={PAD.t} bottom={H - PAD.b} left={PAD.l} right={W - PAD.r} hasScore={!!events} note={noteAt(hover)} /> : null}
    </svg>
  );
}

// Cursor line plus a small card: game time (half and time left), the score and who leads.
function HoverTip({ t, x, dotY, line, teams, top, bottom, left, right, hasScore, note }) {
  const pt = pointAt(line, t);
  const { per, clockSec } = fromMinute(t);
  const lead = pt.margin === 0 ? 'Tied' : `${pt.margin > 0 ? teams.byu : teams.opp} +${Math.abs(pt.margin)}`;
  const lines = [`${periodLabel(per)} ${formatClock(clockSec)}`, hasScore ? `${teams.byu} ${pt.byu} – ${pt.opp} ${teams.opp}` : null, lead, note].filter(Boolean);
  const w = Math.max(...lines.map((l) => l.length)) * 7 + 16, h = lines.length * 16 + 10;
  const boxX = x + 12 + w > right ? x - 12 - w : x + 12; // flip to the left of the cursor near the right edge
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={top} y2={bottom} stroke="currentColor" opacity="0.6" />
      <circle cx={x} cy={dotY} r="3.5" fill="var(--royal-blue)" stroke="white" strokeWidth="1.5" />
      <rect x={Math.max(left, boxX)} y={top + 4} width={w} height={h} rx="4" fill="white" stroke="currentColor" opacity="0.95" />
      {lines.map((l, i) => <text key={i} x={Math.max(left, boxX) + 8} y={top + 4 + 16 + i * 16 - 3} fontSize="12" fontWeight={i === 0 ? 700 : 400} fill="#222">{l}</text>)}
    </g>
  );
}
