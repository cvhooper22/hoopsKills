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

// One normalized shot.
export function ShotMarker({ shot, onHover }) {
  const cx = shot.x, cy = sy(shot.y);
  const tip = `${shot.player || 'Shot'}: ${shot.made ? 'made' : 'missed'} ${shot.value}${shot.period ? ` · P${shot.period} ${shot.clock || ''}` : ''}`;
  return (
    <g className={`shot-chart__shot shot-chart__shot--${shot.made ? 'made' : 'miss'}`} onMouseEnter={onHover ? () => onHover(shot) : undefined} onMouseLeave={onHover ? () => onHover(null) : undefined}>
      <title>{tip}</title>
      <path transform={`translate(${cx} ${cy}) scale(1.1)`} d={shot.made ? MAKE_PATH : MISS_PATH} />
    </g>
  );
}

export default function ShotChart({ shots, onHover, label = 'Shot chart' }) {
  return (
    <svg className="shot-chart" viewBox={`${-COURT.halfWidth - 1} -1 ${W + 2} ${H + 2}`} role="img" aria-label={label}>
      <Court />
      {shots.map((s, i) => <ShotMarker key={s.sequence ?? i} shot={s} onHover={onHover} />)}
    </svg>
  );
}
