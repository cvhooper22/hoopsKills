// Names, colors and number formats for the rankings timeline.
// Soft hues for the individual systems; they are drawn dashed and translucent so the average, in the app's royal blue,
// is the one strong line on the chart.
export const SYSTEM_COLORS = {
  torvik: '#5fae6e',
  kenpom: '#8f7fc4',
  evanmiya: '#e2ac1b',
  haslam: '#d9726f',
  net: '#7d7d7d',
};
export const AVERAGE_COLOR = '#003fa2';

export const colorOf = (system) => SYSTEM_COLORS[system] || '#8f8f8f';

export const formatDate = (iso, opts = { month: 'short', day: 'numeric' }) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
};

// +3 = moved up three places (the rank number fell); a rank gets a "#", WAB does not.
export const signed = (n, digits = 0) => (n > 0 ? `+${n.toFixed(digits)}` : n < 0 ? `−${Math.abs(n).toFixed(digits)}` : '0');
export const rank = (n) => (n === null || n === undefined ? '–' : `#${n}`);
// an average of ranks keeps a decimal: whole numbers would hide most of the movement between two days
export const rankAvg = (n) => (n === null || n === undefined ? '–' : `#${n.toFixed(1)}`);
