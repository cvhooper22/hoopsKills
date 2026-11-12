import { elapsedSec, matches, bucketOf, BUCKETS } from './playGroups';

// Searching the box payload's event log (`data.events`, written by dataAggregators/derivations/game-box-prototype.js): one
// row per play, with who did it, when, and the score after.

export const KINDS = [
  ['fg', 'Field goals'], ['ft', 'Free throws'], ['ast', 'Assists'], ['reb', 'Rebounds'], ['tov', 'Turnovers'], ['stl', 'Steals'],
  ['blk', 'Blocks'], ['foul', 'Fouls'], ['to', 'Timeouts'], ['sub', 'Substitutions'], ['jump', 'Jump balls'],
];
const KIND_OF = {
  shot_attempt: 'fg', free_throw: 'ft', assist: 'ast', rebound: 'reb', turnover: 'tov', steal: 'stl', block: 'blk', foul: 'foul',
  timeout: 'to', substitution: 'sub', jumpball: 'jump',
};
export const kindOf = (e) => KIND_OF[e.cat] || e.cat;

export const emptySearch = () => ({ side: 'both', player: '', kinds: [], result: 'all', points: 'all', reb: 'all', situations: [], inGroup: false, on: [], off: [] });

const SHOT_NAMES = { jumpshot: 'jump shot', layup: 'layup', dunk: 'dunk', tip: 'tip-in', hookshot: 'hook shot', stepback: 'step-back', alleyoop: 'alley-oop', driving: 'driving layup', tipinlayup: 'tip-in layup' };
const shotName = (type, sub) => {
  const t = SHOT_NAMES[type], u = SHOT_NAMES[sub];
  if (!u) return t || type || 'shot';
  return !t || u.includes(t) ? u : `${u} ${t}`;
};
const TOV = { badpass: 'bad pass', lostball: 'lost ball', offensive: 'offensive foul', outofbounds: 'out of bounds', shotclock: 'shot clock', travel: 'traveling' };
const TIMEOUT = { commercial: 'Media timeout', full: 'Full timeout', short: 'Short timeout' };

export function eventText(e) {
  switch (e.cat) {
    case 'shot_attempt': {
      const t = `${e.made ? 'Made' : 'Missed'} ${e.val}-pt ${shotName(e.type, e.sub)}`;
      return t + (e.ast ? ` (assist: ${e.ast})` : '') + (e.blk ? ` (blocked by ${e.blk})` : '');
    }
    case 'free_throw': return `${e.made ? 'Made' : 'Missed'} free throw${e.sub ? ` (${e.sub.replace('of', ' of ')})` : ''}`;
    case 'assist': return e.of ? `Assist to ${e.of.player} on a ${e.of.val}-pt ${shotName(e.of.type, e.of.sub)}` : 'Assist';
    case 'rebound': return e.type === 'offensive' ? 'Offensive rebound' : e.type === 'defensive' ? 'Defensive rebound' : 'Team rebound (dead ball)';
    case 'turnover': return `Turnover (${TOV[e.type] || e.type || 'other'})`;
    case 'steal': return 'Steal';
    case 'block': return 'Block';
    case 'foul': return e.type === 'offensive' ? 'Offensive foul' : 'Personal foul';
    case 'timeout': return TIMEOUT[e.type] || 'Timeout';
    case 'substitution': return e.sub === 'in' ? 'Subbed in' : 'Subbed out';
    case 'jumpball': return e.type === 'heldball' ? 'Held ball' : 'Won the jump ball';
    default: return e.cat;
  }
}

export const eventElapsed = (e) => elapsedSec({ per: e.per, startRem: e.rem });

// Situations: the Box page's chance types plus squeezed and havoc plays, tagged onto events by clock (the payload has no
// per-event link). Each event gets `sit`, an array of keys (chance bucket keys, 'squeezed', 'havoc').
export const SITUATIONS = [...BUCKETS, ['squeezed', 'Squeezed'], ['havoc', 'Havoc']];
const flip = (s) => (s === 'byu' ? 'opp' : 'byu');
// Steals, blocks and defensive rebounds are logged to the defense; every other event's side is the team on offense.
const defensive = (e) => e.cat === 'steal' || e.cat === 'block' || (e.cat === 'rebound' && e.type === 'defensive');
const offenseOf = (e) => (e.side ? (defensive(e) ? flip(e.side) : e.side) : null);
const within = (e, per, from, to) => e.per === per && e.rem <= from && e.rem >= to;

export function tagSituations(events, plays = [], havoc = null) {
  const squeezed = [];
  for (const d of ['byu', 'opp']) for (const q of (havoc && havoc[d] && havoc[d].squeeze.plays) || []) squeezed.push({ ...q, offense: flip(d) });
  // Events are in game order, so on a boundary shared by two chances a shot or free throw goes to the earlier chance only while
  // it still has unassigned attempts (its fga / fta); an offensive rebound opens the next chance; the rest close the earlier one.
  const used = new Map();
  const usedOf = (p, key) => (used.get(p) || {})[key] || 0;
  const take = (p, key) => used.set(p, { ...(used.get(p) || {}), [key]: usedOf(p, key) + 1 });
  return events.map((e) => {
    const o = offenseOf(e), sit = [];
    if (o && e.cat !== 'foul' && e.cat !== 'substitution' && e.cat !== 'timeout') {
      const hits = plays.filter((p) => p.offense === o && within(e, p.per, p.startRem, p.startRem - p.dur));
      const cap = e.cat === 'shot_attempt' ? 'fga' : e.cat === 'free_throw' ? 'fta' : null;
      let hit = hits[0];
      if (e.cat === 'rebound' && e.type === 'offensive') hit = hits[hits.length - 1];
      else if (cap) hit = hits.find((p) => usedOf(p, cap) < p[cap]) || hits[hits.length - 1];
      if (hit) { sit.push(bucketOf(hit)); if (cap) take(hit, cap); }
      if (squeezed.some((q) => q.offense === o && within(e, q.per, q.startRem, q.endRem))) sit.push('squeezed');
    }
    // Havoc: the defense's steals and blocks, and the offense's turnovers.
    if (e.side && (e.cat === 'steal' || e.cat === 'block' || e.cat === 'turnover')) sit.push('havoc');
    return sit.length ? { ...e, sit } : e;
  });
}

// Sub-filters (result, shot value, rebound type) only constrain their own kind, and only when that kind is picked.
// `floorAt(seq)` -> { byu: [names], opp: [names] } (the lineup model's `lineupAtSeq`) enables the on/off floor filter: every name in
// `f.on` must be on the floor for the play, and none in `f.off`. Names are matched against whichever team's five they are in.
export function searchEvents(events, f, group = null, floorAt = null) {
  const useFloor = floorAt && ((f.on && f.on.length) || (f.off && f.off.length));
  return events.filter((e, i) => {
    if (useFloor) {
      const fl = floorAt(i);
      const here = [...fl.byu, ...fl.opp];
      if (!f.on.every((n) => here.includes(n)) || f.off.some((n) => here.includes(n))) return false;
    }
    if (f.side !== 'both' && e.side !== f.side) return false;
    if (f.player && e.player !== f.player) return false;
    if (f.situations && f.situations.length && !f.situations.some((x) => e.sit && e.sit.includes(x))) return false;
    const k = kindOf(e);
    if (f.kinds.length && !f.kinds.includes(k)) return false;
    if (f.kinds.includes(k)) {
      if ((k === 'fg' || k === 'ft') && f.result !== 'all' && (f.result === 'made') !== !!e.made) return false;
      if (k === 'fg' && f.points !== 'all' && e.val !== f.points) return false;
      if (k === 'reb' && f.reb !== 'all' && e.type !== f.reb) return false;
    }
    if (f.inGroup && group && !matches({ offense: group.side, per: e.per, startRem: e.rem }, { ...group, buckets: [] })) return false;
    return true;
  });
}

// made-att for the shots and free throws among a result set
export function shotTotals(list) {
  const t = { fgm: 0, fga: 0, ftm: 0, fta: 0 };
  for (const e of list) {
    if (e.cat === 'shot_attempt') { t.fga++; if (e.made) t.fgm++; }
    else if (e.cat === 'free_throw') { t.fta++; if (e.made) t.ftm++; }
  }
  return t;
}

// Everyone with a play in the log, by side, for the player picker.
export function logPlayers(events) {
  const by = { byu: new Set(), opp: new Set() };
  for (const e of events) if (e.player && by[e.side]) by[e.side].add(e.player);
  return { byu: [...by.byu].sort(), opp: [...by.opp].sort() };
}
