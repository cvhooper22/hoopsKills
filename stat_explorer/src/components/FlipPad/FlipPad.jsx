import { useMemo } from 'react';
import './FlipPad.css';

const RING_PATH = 'M8,19 C6.4,13 5.6,4 8.6,3.4 C11.4,2.9 11.6,9 10.6,13';

// mostly-upright random tilt, capped at 30deg off the midline; a signed power
// curve biases toward 0 while still landing in the outer 25-30deg band ~5% of the time
function tiltFrom(r) {
  const u = r * 2 - 1;
  return Math.sign(u) * Math.abs(u) ** 1.73 * 30;
}

// With a seed the tilt is a pure function of it (so a collected tile re-renders, and
// exports, identically every time); without one it's random per mount as before.
function seededUnit(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function Ring({ x, scale, seed }) {
  const tilt = useMemo(() => tiltFrom(seed ? seededUnit(seed) : Math.random()), [seed]);
  return (
    <svg
      className="flip-pad__ring"
      style={{ left: x - 8 * scale }}
      viewBox="0 0 16 24"
      width={16 * scale}
      height={24 * scale}
      aria-hidden="true"
    >
      <circle cx="8" cy="19" r="2.3" className="flip-pad__hole" />
      <g transform={`rotate(${tilt} 8 19)`}>
        <path d={RING_PATH} className="flip-pad__ring-shadow" />
        <path d={RING_PATH} className="flip-pad__ring-metal" />
        <path d="M7.2,14 C6.6,10 6.8,5.6 8.4,4.6" className="flip-pad__ring-hi" />
      </g>
    </svg>
  );
}

// condensed keeps the same drawing at about 77% size, for rows with many tiles
const SIZES = {
  regular: { full: 44, narrow: 30, inset: 11, scale: 1 },
  condensed: { full: 34, narrow: 23, inset: 8.5, scale: 0.77 },
};

export default function FlipPad({
  label, value, unit, delta, up = true,
  board = true, box = 'sky', cards = 'white', tone, condensed = false, seed, reserveFoot = false,
}) {
  const { full, narrow: narrowW, inset, scale } = SIZES[condensed ? 'condensed' : 'regular'];
  // tone tints the page digits: 'pos' | 'neg' | 'auto' (green for a leading +, red for a leading -)
  const digitTone = tone === 'auto' ? { '+': 'pos', '-': 'neg' }[value[0]] : tone;
  const cls = [
    'flip-pad',
    !board && 'flip-pad--no-board',
    box === 'white' && 'flip-pad--box-white',
    cards !== 'white' && `flip-pad--cards-${cards}`,
    digitTone && `flip-pad--tone-${digitTone}`,
    condensed && 'flip-pad--condensed',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} role="group" aria-label={`${label}: ${value}${unit ? ` ${unit}` : ''}`}>
      <div className="flip-pad__plate">{label}</div>

      <div className="flip-pad__stand">
        <div className="flip-pad__pages" aria-hidden="true">
          {board && <div className="flip-pad__board" />}
          {value.split('').map((c, i) => {
            if (c === '.') return <div className="flip-pad__dot" key={i} />;
            if (c === ':') return <div className="flip-pad__colon" key={i}><i /><i /></div>;
            const narrow = c === '+' || c === '-';
            const w = narrow ? narrowW : full;
            return (
              <div className={'flip-pad__page' + (narrow ? ' flip-pad__page--narrow' : '')} key={i}>
                <div className="flip-pad__sheet"><span>{c}</span></div>
                {narrow
                  ? <Ring x={w / 2} scale={scale} seed={seed && `${seed}:${i}`} />
                  : <>
                      <Ring x={inset} scale={scale} seed={seed && `${seed}:${i}:l`} />
                      <Ring x={w - inset} scale={scale} seed={seed && `${seed}:${i}:r`} />
                    </>}
              </div>
            );
          })}
        </div>
      </div>

      {(unit || delta) ? (
        <div className="flip-pad__foot">
          <span>{unit}</span>
          <b className={up ? 'is-up' : 'is-down'}>{delta}</b>
        </div>
      ) : reserveFoot && (
        // an empty footer, so this pad matches the height of its neighbours that have one
        <div className="flip-pad__foot flip-pad__foot--empty" aria-hidden="true"><span>&nbsp;</span></div>
      )}
    </div>
  );
}
