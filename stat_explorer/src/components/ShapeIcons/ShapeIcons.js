// Shape icons: small geometric marks, drawn centered on (0, 0) inside a 12 x 12 box.
//
// SELF-CONTAINED ON PURPOSE. This folder imports only React and has no app styles, constants or utils, so it can be lifted to the
// top of the codebase (or its own package) unchanged. What a shape MEANS (2PT make, steal, ...) lives with whoever uses it, not here.
//
//   <ShapeIcon name="triangle" size={14} color="#0a8a5c" />            HTML / inline use: renders its own <svg>
//   <svg><g transform="translate(20,20)"><ShapeMark name="star" /></g></svg>   inside an existing <svg> (charts)
//
// `filled={false}` draws the outline only, so one shape can carry a second meaning (made vs. missed).
// Swapping in real icons later: change the entries in SHAPES (a path `d` in the same -6..6 box, optional `rotate`); callers keep working.

const star = (() => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 2.7 : 6.2;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

const PLUS = 'M-1.8 -5.5H1.8V-1.8H5.5V1.8H1.8V5.5H-1.8V1.8H-5.5V-1.8H-1.8Z';

export const SHAPES = {
  circle: { d: 'M-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z' },
  triangle: { d: 'M0 -6L6 5H-6Z' },
  triangleDown: { d: 'M0 6L6 -5H-6Z' },
  square: { d: 'M-5 -5H5V5H-5Z' },
  diamond: { d: 'M0 -6.4L6.4 0L0 6.4L-6.4 0Z' },
  hexagon: { d: 'M-3 -5.2H3L6 0L3 5.2H-3L-6 0Z' },
  plus: { d: PLUS },
  cross: { d: PLUS, rotate: 45 },
  bar: { d: 'M-6 -2.2H6V2.2H-6Z' },
  star: { d: star },
};

export const SHAPE_NAMES = Object.keys(SHAPES);

// The shape itself, for use inside an <svg>. Scales with `size` (the 12-unit box becomes `size` px wide).
export function ShapeMark({ name, size = 12, filled = true, color = 'currentColor', outline = 1.6, ...svgProps }) {
  const shape = SHAPES[name] ?? SHAPES.circle;
  const scale = size / 12;
  const transform = `${shape.rotate ? `rotate(${shape.rotate}) ` : ''}`;
  return (
    <g transform={`scale(${scale})`} {...svgProps}>
      <path
        d={shape.d}
        transform={transform || undefined}
        fill={filled ? color : 'white'}
        stroke={color}
        strokeWidth={outline}
        strokeLinejoin="round"
      />
    </g>
  );
}

// A standalone icon for HTML (legends, table rows, buttons).
export function ShapeIcon({ name, size = 14, filled = true, color = 'currentColor', title, className, style }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="-7 -7 14 14" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <ShapeMark name={name} size={12} filled={filled} color={color} />
    </svg>
  );
}

export default ShapeIcon;
