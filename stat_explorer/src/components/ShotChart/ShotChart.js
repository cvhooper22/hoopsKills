import { useId, useState } from 'react';
import { COURT } from '../../utils/shotLocation';
import './ShotChart.css';

// A half court drawn in feet, with the rim at (0, 0) and the baseline at the bottom. Takes shots already in that frame
// (see utils/shotLocation.js); it knows nothing about feeds. Made shots are blue loops, misses are red slashes, both drawn by hand.
const W = COURT.halfWidth * 2, H = COURT.halfCourtY - COURT.baselineY; // 50 x 47
const CORNER_X = 21.67, ARC_R = 22.146; // college three-point line
const ARC_START_Y = Math.sqrt(ARC_R ** 2 - CORNER_X ** 2); // where the corner straights meet the arc
const sy = (y) => COURT.halfCourtY - y; // court feet -> svg y (baseline at the bottom)

function Court() {
  const ftY = 15 - COURT.rimFromBaseline; // free-throw line, from the rim
  return (
    <g className="shot-chart__court" fill="none">
      <rect x={-COURT.halfWidth} y={0} width={W} height={H} />
      <rect x={-8} y={sy(ftY)} width={16} height={ftY - COURT.baselineY} />
      <path d={`M -6 ${sy(ftY)} A 6 6 0 0 1 6 ${sy(ftY)}`} />
      <path className="shot-chart__dash" d={`M -6 ${sy(ftY)} A 6 6 0 0 0 6 ${sy(ftY)}`} />
      <path d={`M -4 ${sy(0)} A 4 4 0 0 1 4 ${sy(0)}`} />
      <path d={`M ${-CORNER_X} ${sy(COURT.baselineY)} L ${-CORNER_X} ${sy(ARC_START_Y)} A ${ARC_R} ${ARC_R} 0 0 1 ${CORNER_X} ${sy(ARC_START_Y)} L ${CORNER_X} ${sy(COURT.baselineY)}`} />
      <path d={`M -6 0 A 6 6 0 0 0 6 0`} />
      <line x1={-3} x2={3} y1={sy(-1.25)} y2={sy(-1.25)} />
      <line x1={0} x2={0} y1={sy(-1.25)} y2={sy(-0.75)} />
      <circle className="shot-chart__rim" cx={0} cy={sy(0)} r={0.75} />
    </g>
  );
}

// Hand-drawn marks, one of each (not varied per shot), in feet around the shot's spot: a loose loop whose end overshoots
// its start, and two uneven slashes. The rest of the court stays straight-edged.
const MAKE_PATH = 'M 0.35 -1.0 C 0.95 -1.05 1.18 -0.4 1.0 0.2 C 0.85 0.85 0.2 1.12 -0.4 0.98 C -1.0 0.85 -1.15 0.2 -0.98 -0.4 C -0.82 -0.95 -0.25 -1.15 0.3 -1.08 C 0.62 -1.03 0.82 -0.92 0.95 -0.7';
const MISS_PATH = 'M -1.0 -0.85 C -0.35 -0.55 0.4 0.5 1.05 0.95 M 0.9 -1.0 C 0.35 -0.2 -0.35 0.55 -0.95 0.82';

// What a shot's hover card (and its screen-reader label) says: who, what, when and, when the shot carries it, the score around it.
const shotLabel = (shot) => `${shot.player || 'Shot'}: ${shot.made ? 'made' : 'missed'} ${shot.value}${shot.period ? ` · P${shot.period} ${shot.clock || ''}` : ''}`;

// One normalized shot. It is focusable, and hovering or focusing it asks the chart to show its card.
export function ShotMarker({ shot, onHover, made, miss }) {
  const cx = shot.x, cy = sy(shot.y);
  return (
    <g className={`shot-chart__shot shot-chart__shot--${shot.made ? 'made' : 'miss'}`} role="img" aria-label={shotLabel(shot)} tabIndex={onHover ? 0 : undefined}
      onMouseEnter={onHover ? () => onHover(shot) : undefined} onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(shot) : undefined} onBlur={onHover ? () => onHover(null) : undefined}>
      <path transform={`translate(${cx} ${cy}) scale(1.1)`} d={shot.made ? MAKE_PATH : MISS_PATH} style={shot.made ? (made ? { fill: made, fillOpacity: 0.35, stroke: made } : undefined) : (miss ? { stroke: miss } : undefined)} />
    </g>
  );
}

const VB = { x: -COURT.halfWidth - 1, y: -1, w: W + 2, h: H + 2 };

// The card for the hovered shot, placed over the chart in percentages of its box, so it needs no measuring: above the mark (below it
// near the top) and nudged inward near the sides.
function ShotCard({ shot, teams }) {
  const left = ((shot.x - VB.x) / VB.w) * 100, top = ((sy(shot.y) - VB.y) / VB.h) * 100;
  const shift = left < 22 ? '0%' : left > 78 ? '-100%' : '-50%';
  const below = top < 28;
  const score = (s) => (teams ? `${teams.byu} ${s[0]} – ${s[1]} ${teams.opp}` : `${s[0]} – ${s[1]}`);
  return (
    <div className="shot-chart__card" role="tooltip" style={{ left: `${left}%`, top: `${top}%`, transform: `translate(${shift}, ${below ? '14px' : 'calc(-100% - 14px)'})` }}>
      <div className="shot-chart__card-name">{shot.player || 'Shot'}</div>
      <div>{shot.made ? 'Made' : 'Missed'} {shot.value === 3 ? '3-pointer' : '2-pointer'}{shot.period ? ` · P${shot.period} ${shot.clock || ''}` : ''}</div>
      {shot.score ? (
        <>
          <div className="shot-chart__card-score"><span>Before</span>{score(shot.score.before)}</div>
          <div className="shot-chart__card-score"><span>After</span>{score(shot.score.after)}</div>
        </>
      ) : null}
    </div>
  );
}

// `made` / `miss` recolor the marks (default blue / red); `layers` ([{ shots, made, miss }]) draws several sets of shots on one court, in
// order, instead of `shots`. A shot with `score` ({ before, after }, each [BYU, opponent]) shows it in its card, named by `teams` ({ byu, opp }).
export default function ShotChart({ shots, label = 'Shot chart', made, miss, layers, teams }) {
  const sets = layers || [{ shots, made, miss }];
  const [hover, setHover] = useState(null);
  const gradId = useId();
  return (
    <div className="shot-chart-wrap">
      <svg className="shot-chart" viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} role="group" aria-label={label}>
        <defs>
          <radialGradient id={gradId} gradientUnits="userSpaceOnUse" cx={0} cy={sy(0)} r={72}>
            <stop offset="0" className="shot-chart__bg-hoop" />
            <stop offset="1" className="shot-chart__bg-far" />
          </radialGradient>
        </defs>
        <rect className="shot-chart__bg" x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill={`url(#${gradId})`} />
        <Court />
        {sets.map((l, li) => l.shots.map((s, i) => <ShotMarker key={`${li}-${s.sequence ?? i}`} shot={s} onHover={setHover} made={l.made} miss={l.miss} />))}
      </svg>
      {hover ? <ShotCard shot={hover} teams={teams} /> : null}
    </div>
  );
}
