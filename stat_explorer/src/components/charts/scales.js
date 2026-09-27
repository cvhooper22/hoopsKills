import { scaleBand, scaleLinear, scalePoint, scaleTime, scaleUtc } from "d3";

const FACTORIES = {
  linear: scaleLinear,
  time: scaleTime,
  utc: scaleUtc,
  band: scaleBand,
  point: scalePoint,
};

// A scale spec is plain data, so it can sit in props without breaking memoization:
//   { type: 'linear' | 'time' | 'utc' | 'band' | 'point', domain: [...], nice?, clamp?, padding? }
// A domain may run high to low (for example seconds remaining, 600 -> 0) to flip an axis.
export function createScale(spec, range) {
  const { type = "linear", domain, nice, clamp, padding } = spec;
  const factory = FACTORIES[type];
  if (!factory) throw new Error(`Unknown scale type: ${type}`);
  const scale = factory().domain(domain).range(range);
  if (nice && scale.nice) scale.nice(nice === true ? undefined : nice);
  if (clamp && scale.clamp) scale.clamp(true);
  if (padding !== undefined && scale.padding) scale.padding(padding);
  return scale;
}

export const isBandScale = (scale) => typeof scale.bandwidth === "function";

// Center of a value on any scale (band scales are positioned by their band's left edge).
export const positionOf = (scale, value) => (isBandScale(scale) ? scale(value) + scale.bandwidth() / 2 : scale(value));
