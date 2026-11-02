import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { periodLabel, signed } from './boxFormat';
import { shortName, fromMinute, formatClock, axisLayout } from '../../utils/playGroups';
import { netRating, scoreAt } from '../../utils/lineupTimeline';

const ROW = 20, PAD = { l: 96, r: 10, t: 6, b: 40 };

export const at = (min, isEnd) => { const { per, clockSec } = fromMinute(min, isEnd); return `${periodLabel(per)} ${formatClock(clockSec)}`; };

// "BYU +4", "Texas +8" or "Tied": who leads, and by how much.
const leader = (m, teams) => (m === 0 ? 'Tied' : `${m > 0 ? teams.byu : teams.opp} +${Math.abs(m)}`);
// light enough to read on the team-colored bars; zero stays white
const signFill = (v) => (v.startsWith('+') ? '#7ee2a8' : v.startsWith('−') ? '#ffa095' : '#fff');
const MIN_LABEL_W = 26; // narrower bars leave the number to the tooltip
const MIN_NET_POSS = 6; // net rating on the bar needs at least this many possessions on each side; the tooltip always has it

// The lines of a bar's tooltip, the title first: the times, the score and margin at each end (when the game has an event log), and both metrics.
function tipLines(pl, i, { events, teams, side }) {
  const [s, e] = pl.spans[i], t = pl.totals[i];
  const other = side === 'byu' ? 'opp' : 'byu', net = netRating(t);
  const lines = [`${pl.name}: ${at(s, false)} to ${at(e, true)}`];
  if (events) {
    const [a, b] = [scoreAt(events, s), scoreAt(events, e)];
    lines.push(`Score: ${teams.byu} ${a[0]}–${a[1]} → ${b[0]}–${b[1]}`, `Margin: ${leader(a[0] - a[1], teams)} → ${leader(b[0] - b[1], teams)}`);
  }
  lines.push(`+/-: ${signed(t.scored - t.allowed)} (${teams[side]} ${t.scored}, ${teams[other]} ${t.allowed})`,
    `Net rating: ${net === null ? '–' : signed(net, 2)} per poss. (${t.offPoss} off. / ${t.defPoss} def. poss.)`);
  return lines;
}

const TIP_EDGE = 8, TIP_GAP = 6;

// The chart tooltip (white card, as on the Kills chart) for a bar: above it when there is room, below otherwise, kept inside the screen. Hidden until measured.
function BarTip({ rect, lines }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const p = ref.current.getBoundingClientRect();
    const screen = document.documentElement.clientWidth || window.innerWidth;
    const left = Math.max(TIP_EDGE, Math.min(rect.left + rect.width / 2 - p.width / 2, screen - p.width - TIP_EDGE));
    const above = rect.top - TIP_GAP - p.height;
    setPos({ left, top: above >= TIP_EDGE ? above : rect.bottom + TIP_GAP });
  }, [rect, lines]);
  return createPortal(
    <span ref={ref} className="chart-tooltip timeline-tip" role="tooltip" style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
      <strong>{lines[0]}</strong>
      {lines.slice(1).map((l) => <span key={l}>{l}</span>)}
    </span>,
    document.body,
  );
}

// Sizes in SVG units. Wide screens draw the whole game scaled to the page; narrow ones draw less at a time (one half, or a long
// strip that scrolls) so the text stays readable.
const FULL = { w: 800, padL: PAD.l };
export const COMPACT = { w: 380, padL: 64 }; // w is only the first guess: the half view is drawn at the card's measured pixel width, like the strip,
// so both phone views have the same row height and text size
export const STRIP_W = 1200; // the scrolling strip: 30 units per game minute

// The player names, drawn on their own so they can stay put while the bars scroll.
export function NameColumn({ floor, width }) {
  const H = PAD.t + floor.length * ROW + PAD.b;
  return (
    <svg className="timeline-names" width={width} height={H} aria-hidden="true">
      {floor.map((pl, i) => <text key={pl.name} x={width - 6} y={PAD.t + i * ROW + 14} textAnchor="end" fontSize="12" fill="currentColor">{shortName(pl.name)}</text>)}
    </svg>
  );
}

// One row per player, a bar wherever they were on the floor; `metric` ('pm' or 'net') is the number drawn on each bar. `lo`..`hi`
// is the stretch of game minutes drawn; `names` false leaves the names to a NameColumn; `width` is the drawing's width in units.
export function FloorChart({ floor, total, color, metric, tip, lo = 0, hi = total, width = FULL.w, padL = FULL.padL, names = true, fixed = false }) {
  const H = PAD.t + floor.length * ROW + PAD.b;
  // One tooltip shared by the bars. A mouse hovers, a finger taps (again, or anywhere else, to close), the keyboard focuses.
  const [active, setActive] = useState(null); // { key, rect, lines }
  const open = (key, el, lines) => setActive({ key, rect: el.getBoundingClientRect(), lines });
  const toggle = (key, el, lines) => (active && active.key === key ? setActive(null) : open(key, el, lines));
  useEffect(() => setActive(null), [lo, hi, floor, width, metric]);
  useEffect(() => {
    if (!active) return undefined;
    const close = () => setActive(null);
    const onOutside = (e) => { if (!e.target.closest?.('.timeline-bar')) close(); };
    document.addEventListener('pointerdown', onOutside);
    window.addEventListener('scroll', close, true); // the bar moves under the panel
    return () => { document.removeEventListener('pointerdown', onOutside); window.removeEventListener('scroll', close, true); };
  }, [active]);
  const x = (t) => padL + ((Math.min(hi, Math.max(lo, t)) - lo) / (hi - lo)) * (width - padL - PAD.r);
  const all = axisLayout(total);
  // the end of a half is drawn as 0:00 there, not as the 20:00 that opens the next one
  const ticks = all.ticks.filter((k) => k.t >= lo && (hi < total ? k.t < hi : k.t <= hi));
  if (hi < total) ticks.push({ t: hi, label: '0:00' });
  const periods = all.periods.filter((p) => p.start < hi && p.start + p.len > lo);
  return (
    <>
      <svg className="timeline" viewBox={`0 0 ${width} ${H}`} {...(fixed ? { width, height: H, style: { width, height: H } } : {})} role="img" aria-label="When each player was on the floor">
        {ticks.map((k) => <line key={k.t} x1={x(k.t)} x2={x(k.t)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" opacity="0.1" />)}
        {periods.filter((p) => p.start > lo).map((p) => <line key={p.per} x1={x(p.start)} x2={x(p.start)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeDasharray="3 3" opacity="0.4" />)}
        {floor.map((pl, i) => (
          <g key={pl.name}>
            {names ? <text x={padL - 6} y={PAD.t + i * ROW + 14} textAnchor="end" fontSize="12" fill="currentColor">{shortName(pl.name)}</text> : null}
            {pl.spans.map(([s, e], j) => {
              if (e <= lo || s >= hi) return null;
              const w = Math.max(1, x(e) - x(s)), t = pl.totals[j], net = netRating(t);
              const value = metric === 'net' ? (net === null || t.offPoss < MIN_NET_POSS || t.defPoss < MIN_NET_POSS ? null : signed(net, 2)) : signed(t.scored - t.allowed);
              const lines = tipLines(pl, j, tip), key = `${pl.name}|${j}`;
              return (
                <g key={j} className="timeline-bar" tabIndex={0} role="img" aria-label={lines.join('. ')}
                  onPointerEnter={(e) => { if (e.pointerType === 'mouse') open(key, e.currentTarget, lines); }}
                  onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive((cur) => (cur && cur.key === key ? null : cur)); }}
                  onPointerDown={(e) => { if (e.pointerType !== 'mouse') toggle(key, e.currentTarget, lines); }}
                  onFocus={(e) => { if (e.target.matches(':focus-visible')) open(key, e.currentTarget, lines); }}
                  onBlur={() => setActive((cur) => (cur && cur.key === key ? null : cur))}>
                  <rect x={x(s)} y={PAD.t + i * ROW + 3} width={w} height={ROW - 6} rx="2" fill={color} />
                  {value !== null && w >= MIN_LABEL_W ? <text x={x(s) + w / 2} y={PAD.t + i * ROW + 13} textAnchor="middle" fontSize="10" fontWeight="700" fill={signFill(value)} pointerEvents="none">{value}</text> : null}
                </g>
              );
            })}
          </g>
        ))}
        {ticks.map((k) => <text key={k.t} x={x(k.t)} y={H - 22} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">{k.label}</text>)}
        {periods.map((p) => <text key={p.per} x={x((Math.max(lo, p.start) + Math.min(hi, p.start + p.len)) / 2)} y={H - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor" opacity="0.8">{periodLabel(p.per)}</text>)}
      </svg>
      {active ? <BarTip rect={active.rect} lines={active.lines} /> : null}
    </>
  );
}
