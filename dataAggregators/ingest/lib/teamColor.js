// Picks the colour the app paints an opponent with: ESPN's primary, else its alternate, else null (the app's slate).
// A candidate must read under white header text (contrast >= 3:1) and not look like BYU's blue.
const COLORS = require('../../config/team-colors.json');

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrastOnWhite = (h) => 1.05 / (lum(h) + 0.05);
function hueSat(h) {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return { hue: 0, sat: 0 };
  const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: (hue * 60 + 360) % 360, sat: d / (1 - Math.abs(max + min - 1)) };
}
const BYU_HUE = hueSat('#0047ba').hue;
const likeBYU = (h) => { const { hue, sat } = hueSat(h); const diff = Math.abs(((hue - BYU_HUE + 540) % 360) - 180); return sat > 0.3 && diff < 30; };
const usable = (h) => h && contrastOnWhite(h) >= 3 && !likeBYU(h);

function teamColor(teamId) {
  const c = COLORS[teamId];
  if (!c) return null;
  return [c.color, c.altColor].find(usable) || null;
}

module.exports = { teamColor };
