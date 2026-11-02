import urls from '../constants/assetUrls';
import playerInfo from '../constants/playerInfo';
import { elapsedSec, clockSec } from './playGroups';

// Event timeline: every counting stat in the box payload's event log, placed on the game clock. All of it is derived in the
// browser from `data.events`, so the finished-game and live pages share it.

// One entry per stat shown. `shape` / `filled` name a mark in components/ShapeIcons (filled = made / the plain version, hollow =
// missed). `defensive` stats are drawn on the OPPONENT's score line in the game-flow view: they are what a team does to the other
// side's possession.
export const KINDS = [
  { key: 'fg2m', label: '2PT made', shape: 'circle', filled: true, color: '#1b6ec2' },
  { key: 'fg2x', label: '2PT missed', shape: 'circle', filled: false, color: '#1b6ec2' },
  { key: 'fg3m', label: '3PT made', shape: 'triangle', filled: true, color: '#0a8a5c' },
  { key: 'fg3x', label: '3PT missed', shape: 'triangle', filled: false, color: '#0a8a5c' },
  { key: 'ftm', label: 'FT made', shape: 'square', filled: true, color: '#7b4fc9' },
  { key: 'ftx', label: 'FT missed', shape: 'square', filled: false, color: '#7b4fc9' },
  { key: 'oreb', label: 'Off. rebound', shape: 'plus', filled: true, color: '#d98200' },
  { key: 'dreb', label: 'Def. rebound', shape: 'bar', filled: true, color: '#a15f00', defensive: true },
  { key: 'tov', label: 'Turnover', shape: 'cross', filled: true, color: '#c62d2d' },
  { key: 'stl', label: 'Steal', shape: 'diamond', filled: true, color: '#00897b', defensive: true },
  { key: 'blk', label: 'Block', shape: 'hexagon', filled: true, color: '#5b3a8c', defensive: true },
  { key: 'foul', label: 'Foul', shape: 'star', filled: true, color: '#6b6b6b' },
];
export const KIND_BY_KEY = Object.fromEntries(KINDS.map((k) => [k.key, k]));

export const otherSide = (side) => (side === 'byu' ? 'opp' : 'byu');

// The line (whose score) an event is drawn on in the game-flow view.
export const lineSideOf = (e) => (KIND_BY_KEY[e.kind].defensive ? otherSide(e.side) : e.side);

function kindOf(e) {
  if (e.cat === 'shot_attempt') return e.val === 3 ? (e.made ? 'fg3m' : 'fg3x') : (e.made ? 'fg2m' : 'fg2x');
  if (e.cat === 'free_throw') return e.made ? 'ftm' : 'ftx';
  if (e.cat === 'rebound') return e.type === 'offensive' ? 'oreb' : e.type === 'defensive' ? 'dreb' : null; // dead-ball rebounds belong to no one
  if (e.cat === 'turnover') return 'tov';
  if (e.cat === 'steal') return 'stl';
  if (e.cat === 'block') return 'blk';
  if (e.cat === 'foul') return 'foul';
  return null;
}

const TYPE_LABELS = { jumpshot: 'Jump shot', badpass: 'Bad pass', lostball: 'Lost ball', outofbounds: 'Out of bounds', shotclock: 'Shot clock', offensivegoaltending: 'Offensive goaltending', free_throw: null };
function detailOf(e) {
  if (e.cat === 'free_throw') return e.sub ? e.sub.replace('of', ' of ') : null;
  if (e.cat === 'rebound' || e.cat === 'steal' || e.cat === 'block' || !e.type) return null;
  if (e.type in TYPE_LABELS) return TYPE_LABELS[e.type];
  return e.type.charAt(0).toUpperCase() + e.type.slice(1).replace(/_/g, ' ');
}

// The events that count, both teams, in game order: { id, seq (place in the event log), kind, side, player (or null), t (game minute), per, clock (seconds left in
// the period), byu, opp (the score right after it), detail }.
export function timelineEvents(events = []) {
  const out = [];
  let byu = 0, opp = 0;
  for (const [seq, e] of events.entries()) {
    if (e.sc && e.sc[0] != null && e.sc[1] != null) [byu, opp] = e.sc;
    const kind = kindOf(e);
    if (!kind || !e.side) continue;
    const row = { per: e.per, startRem: e.rem };
    out.push({
      id: out.length, seq, kind, side: e.side,
      player: e.player && e.player !== 'TEAM' && e.player !== 'unattributed' ? e.player : null,
      t: elapsedSec(row) / 60, per: e.per, clock: clockSec(row), byu, opp, detail: detailOf(e),
    });
  }
  return out;
}

// Time between occurrences, in game minutes. `times` are the occurrences, `now` the current game minute. With fewer than two
// there is no gap to measure, so avg / longest / shortest are null.
export function gapStats(times, now) {
  const ts = [...times].sort((a, b) => a - b);
  const gaps = ts.slice(1).map((t, i) => t - ts[i]);
  return {
    n: ts.length,
    since: ts.length ? Math.max(0, now - ts[ts.length - 1]) : null,
    avg: gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null,
    longest: gaps.length ? Math.max(...gaps) : null,
    shortest: gaps.length ? Math.min(...gaps) : null,
  };
}

export function formatGap(min) {
  if (min === null || min === undefined) return '—';
  const s = Math.round(min * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Spread markers that land close together along x across vertical lanes (0, -1, +1, -2, +2, ...) so none hides another. `items` are
// { x (px), group }; only items in the same group compete for space. Returns one lane number per item, in the same order.
const LANE_ORDER = [0, -1, 1, -2, 2, -3, 3];
export function assignLanes(items, minGap) {
  const lanes = new Array(items.length).fill(0);
  const last = new Map(); // group -> { lane: x of the last marker put in it }
  items.map((it, i) => i).sort((a, b) => items[a].x - items[b].x).forEach((i) => {
    const { x, group } = items[i];
    if (!last.has(group)) last.set(group, {});
    const used = last.get(group);
    let lane = LANE_ORDER.find((l) => used[l] === undefined || x - used[l] >= minGap);
    if (lane === undefined) lane = LANE_ORDER.reduce((best, l) => (used[l] < used[best] ? l : best), 0); // all busy: the one that has waited longest
    used[lane] = x;
    lanes[i] = lane;
  });
  return lanes;
}

// ---- players: events carry "First Last"; the shared avatar filter and playerInfo use "LAST,FIRST".
export function toCheckname(name) {
  const parts = name.trim().split(/\s+/);
  return `${parts.slice(1).join(' ')},${parts[0]}`.toUpperCase();
}

export function playerPhotoUrl(name) {
  const [last, first] = toCheckname(name).split(',');
  const info = playerInfo[first + last];
  return info?.id ? `${urls.espnPhotoStart}${info.id}${urls.espnPhotoEnd}` : null;
}

export const initialsOf = (name) => name.trim().split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((p) => p[0]).join('').toUpperCase();
