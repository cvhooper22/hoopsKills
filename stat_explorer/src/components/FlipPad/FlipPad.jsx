import './FlipPad.css';

const RING_PATH = 'M8,19 C6.4,13 5.6,4 8.6,3.4 C11.4,2.9 11.6,9 10.6,13';

function Ring({ x, tilt, scale }) {
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
      <g transform={tilt ? `rotate(${tilt} 8 19)` : undefined}>
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
  board = true, box = 'sky', cards = 'white', tilt = 0, tone, condensed = false,
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
                  ? <Ring x={w / 2} tilt={tilt} scale={scale} />
                  : <>
                      <Ring x={inset} tilt={tilt} scale={scale} />
                      <Ring x={w - inset} tilt={tilt} scale={scale} />
                    </>}
              </div>
            );
          })}
        </div>
      </div>

      {(unit || delta) && (
        <div className="flip-pad__foot">
          <span>{unit}</span>
          <b className={up ? 'is-up' : 'is-down'}>{delta}</b>
        </div>
      )}
    </div>
  );
}
