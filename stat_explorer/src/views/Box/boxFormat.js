// Number formatting for the Box view. The prototype's JSON writes NaN as null, so every
// formatter treats a missing value as a dash instead of "NaN".
export const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
export const dash = '–';
export const f1 = (x) => (isNum(x) ? x.toFixed(1) : dash);
export const f2 = (x) => (isNum(x) ? x.toFixed(2) : dash);
export const f3 = (x) => (isNum(x) ? x.toFixed(3) : dash);
export const pct = (x) => (isNum(x) ? `${(x * 100).toFixed(1)}%` : dash);
export const signed = (x, digits = 0) => {
  if (!isNum(x)) return dash;
  const n = Math.abs(x).toFixed(digits);
  if (Number(n) === 0) return n; // never "−0.0"
  return x > 0 ? `+${n}` : `−${n}`;
};
export const mmss = (minutes) => {
  if (!isNum(minutes)) return dash;
  const total = Math.round(minutes * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
export const formatDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Period 1/2 are halves, later periods are overtimes.
export const periodLabel = (p) => (p === 1 ? '1st half' : p === 2 ? '2nd half' : `OT${p - 2}`);
