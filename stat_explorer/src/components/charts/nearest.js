// Index of the datum to snap to for a pointer at pixel `target`. `pixelOf(d)` is the datum's pixel
// position along the axis, and `data` must be sorted along that axis in either direction (for
// example seconds remaining running 600 -> 0 on a reversed axis). O(log n) per lookup.
//   'nearest': the closest datum, either side (scatter, lines, snapping to events)
//   'before':  the last datum at or before the pointer (step-after series: the value "in force")
export function nearestIndex(data, pixelOf, target, mode = "nearest") {
  const n = data.length;
  if (!n) return -1;
  const ascending = pixelOf(data[0]) <= pixelOf(data[n - 1]);
  // first index whose pixel is at or past the target, in the direction the data runs
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const past = ascending ? pixelOf(data[mid]) >= target : pixelOf(data[mid]) <= target;
    if (past) hi = mid;
    else lo = mid + 1;
  }
  if (mode === "before") {
    // datum sitting exactly on the target counts as "at"; otherwise step back one
    if (lo < n && pixelOf(data[lo]) === target) return lo;
    return Math.max(0, lo - 1);
  }
  if (lo === 0) return 0;
  if (lo === n) return n - 1;
  return Math.abs(pixelOf(data[lo]) - target) < Math.abs(pixelOf(data[lo - 1]) - target) ? lo : lo - 1;
}
