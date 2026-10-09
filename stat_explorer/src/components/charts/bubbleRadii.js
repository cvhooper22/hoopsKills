// Radius for each datum at full scale: all `radius` without a size accessor, otherwise area-proportional
// between minRadius and radius.
export function bubbleRadii(data, size, radius, minRadius, sizeDomain) {
  if (!size) return data.map(() => radius);
  const values = data.map((d) => size(d)).map((v) => (Number.isFinite(v) ? v : null));
  const known = values.filter((v) => v !== null);
  const [lo, hi] = sizeDomain ?? [Math.min(...known), Math.max(...known)];
  return values.map((v) => {
    if (v === null) return minRadius;
    if (hi === lo) return radius;
    const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
    return Math.sqrt(minRadius * minRadius + t * (radius * radius - minRadius * minRadius));
  });
}
