import { STOP_TYPES, STOP_TYPE_LABEL } from '../constants/stopTypes.js';

// Derived views over detectKills() output, for the "What broke the streaks" and
// "Rhythm and mix" sections of the Kills page. Nothing here changes the rules in
// src/utils/kills.js — this only reshapes its output for display.

// Only streaks of 2+ stops have a breaker and belong in the streaks table
// (a lone stop never becomes a PK or a kill; see kills-rules.md).
export function streaksForTable(result) {
  return result.streaks.filter((s) => s.length >= 2);
}

export function halfLabel(period) {
  return period === 1 ? '1H' : period === 2 ? '2H' : `OT${period - 2}`;
}

// Credit abbreviation for a stop's type. Kept deliberately distinct from the
// single-letter stop-type badges (src/constants/stopTypes.js), per the user's
// ask not to reuse those abbreviations in a stops list. A tie-up that also carried a steal
// credit (the defense tied the ball up right as it stole it) is labelled like
// a steal, matching how creditedTable() below groups it.
export const CREDIT_ABBR = { steal: 'Stl', block: 'Blk', tie_up: 'Stl' };

// The swing this kill created: BYU's margin change from the kill's first stop to the end of BYU's
// possession right after its third stop (what the defense turned into on offense, like a "five
// point swing" on a missed layup and a three). Points BYU scores between the stops count; the
// streak's breaker and any later stops are left out, so a kill inside a long streak doesn't
// absorb the rest of it. Can be negative if the opponent outscored BYU within the kill.
export function killGain(kill) {
  return kill.gainEnd - kill.start.margin;
}

// Average points gained per kill, for the header KPI. null with no kills yet.
export function avgKillGain(kills) {
  if (!kills.length) return null;
  return kills.reduce((sum, k) => sum + killGain(k), 0) / kills.length;
}

// 'pos' | 'flat' | 'neg', for styling a points-gained value. Negative is real,
// not a bug: the breaker's own basket always counts against a streak's gain,
// so one big shot right at the end can outweigh what was scored while it built.
export function gainTone(gain) {
  return gain > 0 ? 'pos' : gain < 0 ? 'neg' : 'flat';
}

// "What cost us": how many shown streaks ended on a play the defense could have
// prevented (a second-chance bucket or a shooting foul), and what that cost.
export function breakerSummary(streaksShown) {
  const avoidable = streaksShown.filter((s) => s.breaker && s.breaker.avoidable);
  const secondChance = avoidable.filter((s) => s.breaker.causes.includes('second_chance')).length;
  const foulCounts = {};
  avoidable.forEach((s) => {
    if (!s.breaker.causes.includes('foul')) return;
    const name = s.breaker.fouler || 'unknown';
    foulCounts[name] = (foulCounts[name] || 0) + 1;
  });
  const pksLost = avoidable.filter((s) => s.potentialKill).length;
  return { total: streaksShown.length, avoidableCount: avoidable.length, secondChance, foulCounts, pksLost };
}

// Gaps between consecutive kills' start times, start to start, in game seconds.
// `kills` must already be in chronological order (detectKills returns it that way).
export function killGaps(kills) {
  const gaps = [];
  for (let i = 0; i < kills.length - 1; i++) {
    gaps.push({ from: i + 1, to: i + 2, seconds: kills[i + 1].start.gameSeconds - kills[i].start.gameSeconds });
  }
  return gaps;
}

// Stop counts by type, in the fixed display order from src/constants/stopTypes.js,
// skipping types with no stops.
export function stopMix(stops) {
  const counts = {};
  stops.forEach((s) => { counts[s.type] = (counts[s.type] || 0) + 1; });
  return STOP_TYPES.filter((t) => counts[t.type]).map((t) => ({ type: t.type, label: STOP_TYPE_LABEL[t.type], count: counts[t.type] }));
}

// Per-player steal/block credit, plus a separate charge count (charges have no
// player in the data). A tie-up that also carried a steal credit (the defense
// tied the ball up right as it stole it) counts as a steal here.
export function creditedTable(stops) {
  const byPlayer = {};
  let charges = 0;
  stops.forEach((s) => {
    if (s.type === 'charge') { charges++; return; }
    if (!s.credit) return;
    const row = byPlayer[s.credit] || (byPlayer[s.credit] = { player: s.credit, steals: 0, blocks: 0 });
    if (s.type === 'block') row.blocks += 1;
    else row.steals += 1; // steal, or a tie-up credited like one
  });
  const rows = Object.values(byPlayer).sort((a, b) => (b.steals + b.blocks) - (a.steals + a.blocks) || a.player.localeCompare(b.player));
  return { rows, charges };
}
