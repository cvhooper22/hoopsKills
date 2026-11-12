import { timelineEvents } from './eventTimeline';
import { periodStartMin, periodLenMin } from './playGroups';

// "Analytically Final" (Haslametrics): a lead is safe once the seconds left are at most (lead - 5)^2. Leads of 5 or less are only
// safe when the clock hits zero. The same formula is used in every period, overtime included (the clock is the one in that
// period), and who has the ball is ignored.
//
// analyzeGame walks the event log and reports, for one game: when it went final and on which play, how many times it got close
// to final and for how long, and any time it went final and was lost again.

export const CLOSE_POINTS = 3; // "close" = within this many points of the lead needed for final
const SAMPLE_SEC = 10; // spacing of the points that draw the points-short line between plays

export const secondsToSafe = (lead) => (lead > 5 ? (lead - 5) ** 2 : 0);
export const requiredLead = (secs) => 5 + Math.sqrt(Math.max(secs, 0));
export const isFinalState = (lead, secs) => lead > 0 && secs <= secondsToSafe(lead);
// Points the leader is short of final right now (0 once final); the trailing team's distance is the same number.
export const pointsShort = (lead, secs) => (isFinalState(lead, secs) ? 0 : requiredLead(secs) - lead);

// Seconds left in the game as the formula counts it: both halves together, then the overtime clock on its own.
const secsLeft = (e) => (e.per === 1 ? e.clock + 1200 : e.clock);
const elapsedAt = (per, secs) => (per <= 2 ? 2400 - secs : 2400 + (per - 3) * 300 + (300 - secs));

// The stretches of seconds-left a stretch of play covers going from state a to state b: one when the clock runs on, two when it
// goes through the end of regulation or an overtime ([secs from 0 to a's] then [b's to the full overtime]).
function stretches(a, b) {
  if (a.per === b.per || (a.per <= 2 && b.per <= 2)) return [{ per: b.per, lo: b.secs, hi: a.secs }];
  return [{ per: a.per, lo: 0, hi: a.secs }, { per: b.per, lo: b.secs, hi: 300 }];
}

// Seconds inside a stretch [lo, hi] where a lead is not final yet but within `close` points of it.
function closeWindow(lead, { lo, hi }, close) {
  const reach = close + lead - 5;
  if (reach < 0) return null;
  const from = Math.max(lo, secondsToSafe(lead)), to = Math.min(hi, reach ** 2);
  return to > from ? { from, to } : null;
}

const STOPS_BY_TRAILING = ['fg2x', 'fg3x', 'ftx', 'tov']; // a trailing team's possession ending without points
const STOPS_BY_LEADER = ['stl', 'blk', 'dreb']; // the leading team ending the other side's possession

// What put the game over the line: the leader scoring ('score'), the trailing team's possession ending with nothing ('stop'),
// the clock just running with nothing in the log that mattered ('clock'), or the final buzzer ('buzzer').
function causeOf(s, prev) {
  if (s.kind === 'buzzer') return 'buzzer';
  if (s.byu + s.opp > prev.byu + prev.opp && s.side === s.leader) return 'score';
  if (s.side !== s.leader && STOPS_BY_TRAILING.includes(s.kind)) return 'stop';
  if (s.side === s.leader && STOPS_BY_LEADER.includes(s.kind)) return 'stop';
  return 'clock';
}

const START = { per: 1, secs: 2400, t: 0, byu: 0, opp: 0, lead: 0, leader: null, final: false, short: requiredLead(2400) };

function stateOf(e) {
  const secs = secsLeft(e), margin = e.byu - e.opp, lead = Math.abs(margin);
  return {
    id: e.id, seq: e.seq, kind: e.kind, side: e.side, player: e.player, detail: e.detail, per: e.per, clock: e.clock, secs, t: e.t,
    byu: e.byu, opp: e.opp, lead, leader: margin > 0 ? 'byu' : margin < 0 ? 'opp' : null,
    final: isFinalState(lead, secs), short: pointsShort(lead, secs),
  };
}

// `final`: the game is over, so the buzzer is the last moment (a lead of 5 or less becomes final there).
export function analyzeGame(events = [], { final = false, close = CLOSE_POINTS } = {}) {
  const raw = timelineEvents(events);
  const out = { crossings: [], reversals: [], episodes: [], series: [], secondsClose: 0, timesClose: 0, nearMisses: 0, dips: 0, finalAt: null, finalNow: false, states: [] };
  if (!raw.length) return out;

  const states = raw.map(stateOf);
  const last = states[states.length - 1];
  if (final) {
    const per = last.per;
    states.push({ ...last, id: last.id + 1, kind: 'buzzer', side: null, player: null, detail: null, clock: 0, secs: 0, t: periodStartMin(per) + periodLenMin(per), final: isFinalState(last.lead, 0), short: pointsShort(last.lead, 0) });
  }

  let prev = START, episode = null, inRange = false; // inRange: the last state was inside the close range
  out.series.push({ t: 0, short: START.short });
  for (const s of states) {
    let inClose = 0, entry = null;
    stretches(prev, s).forEach((st) => {
      for (let secs = st.hi; secs > st.lo; secs -= SAMPLE_SEC) out.series.push({ t: elapsedAt(st.per, secs) / 60, short: pointsShort(prev.lead, secs) });
      out.series.push({ t: elapsedAt(st.per, st.lo) / 60, short: pointsShort(prev.lead, st.lo) });
      const w = closeWindow(prev.lead, st, close);
      if (!w) return;
      inClose += w.to - w.from;
      if (!entry) entry = { per: st.per, secs: w.to, t: elapsedAt(st.per, w.to) / 60 };
    });
    out.series.push({ t: s.t, short: s.short });
    out.secondsClose += inClose;
    // A dip is a lead that was in range being pushed back out of it, with no buffer (unlike a near miss, which waits for one more point).
    const wasIn = inRange || inClose > 0;
    if (wasIn && !s.final && s.short > close) out.dips += 1;
    inRange = !s.final && s.short > 0 && s.short <= close;
    if (inClose > 0 && !episode) episode = { ...entry, leader: prev.leader, lead: prev.lead, outcome: 'open', endT: null };

    if (s.final && !prev.final) out.crossings.push({ ...s, cause: causeOf(s, prev) });
    if (!s.final && prev.final) out.reversals.push(s);
    if (episode && (s.final || s.short > close + 1)) {
      out.episodes.push({ ...episode, outcome: s.final ? 'final' : 'faded', endT: s.t });
      episode = null;
    }
    prev = s;
  }
  if (episode) out.episodes.push(episode);

  out.states = states;
  out.finalNow = prev.final;
  out.finalAt = prev.final ? out.crossings[out.crossings.length - 1] : null;
  out.timesClose = out.episodes.length;
  out.nearMisses = out.episodes.filter((e) => e.outcome === 'faded').length;
  return out;
}

// "Utah missed 3", "BYU steal", "BYU 3PT made" - the play, for the crossing and the list of close calls.
const PLAY_TEXT = {
  fg2m: '2PT made', fg2x: 'missed 2', fg3m: '3PT made', fg3x: 'missed 3', ftm: 'FT made', ftx: 'missed FT',
  oreb: 'offensive rebound', dreb: 'defensive rebound', tov: 'turnover', stl: 'steal', blk: 'block', foul: 'foul',
};
export function playText(s, teams) {
  if (s.kind === 'buzzer') return 'Final buzzer';
  return `${teams[s.side]} ${PLAY_TEXT[s.kind] || s.kind}`;
}
