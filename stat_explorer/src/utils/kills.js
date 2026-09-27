// Stops, streaks and kills from normalized plays. Rules: /kills-rules.md.
// Keep in sync with dataAggregators/derivations/kills.js (same logic, CommonJS export).
//
// detectKills(plays, defenseSide) -> { stops, streaks, kills, potentialKills, completion }
// `plays` is the array from ingest/tools/export-game-plays.js, ordered by sequence_number.

const KILL_SIZE = 3;
const CLUTCH_SECONDS = 300;
const CLUTCH_MARGIN = 5;
const CRITICAL_MARGIN = 5;
const GARBAGE_MARGIN = 15;
const GARBAGE_SECONDS = 480;
const LATE_STOP_SECONDS = 5;

// Plays that can sit inside a free-throw trip, or between a block and its
// rebound, without changing what happened.
function isFiller(p) {
  return p.play_category === 'substitution'
    || p.play_category === 'timeout'
    || (p.play_category === 'rebound' && p.play_subtype === 'deadball');
}

// Index of the previous meaningful play before i, or -1.
function prevIndex(plays, i) {
  let j = i - 1;
  while (j >= 0 && isFiller(plays[j])) j--;
  return j;
}

function nextIndex(plays, i) {
  let j = i + 1;
  while (j < plays.length && plays[j].play_category === 'substitution') j++;
  return j;
}

// A held ball logged at the same clock time right before p means the defense forced a
// tie-up that switched possession. Only caught when the play-by-play also logs a
// turnover or steal for it; a bare held ball with no turnover is not a stop.
function isTieUp(plays, i) {
  const prev = plays[prevIndex(plays, i)];
  const p = plays[i];
  return !!prev && prev.play_category === 'jumpball' && prev.play_type === 'heldball'
    && prev.period_number === p.period_number && prev.clock_display === p.clock_display;
}

// True when p is the offense's last free throw of a trip (subtype "2of2", "1of1", ...).
function endsTrip(p, offense) {
  const m = p && p.play_category === 'free_throw' && p.team_side === offense && /^(\d+)of(\d+)$/.exec(p.play_subtype || '');
  return !!m && m[1] === m[2];
}

// True when the free-throw trip just before index i had every attempt missed.
function isEmptyTrip(plays, i, offense) {
  let j = prevIndex(plays, i);
  if (j < 0 || plays[j].play_category !== 'free_throw' || plays[j].team_side !== offense) return false;
  while (j >= 0) {
    const p = plays[j];
    if (isFiller(p)) { j--; continue; }
    if (p.play_category !== 'free_throw' || p.team_side !== offense) break;
    if (p.is_made) return false;
    j--;
  }
  return true;
}

// The defender whose foul started the free-throw trip containing index i, if any.
function foulerForTrip(plays, i, defense) {
  let j = i - 1;
  while (j >= 0 && (isFiller(plays[j]) || plays[j].play_category === 'free_throw')) j--;
  const p = plays[j];
  return p && p.play_category === 'foul' && p.team_side === defense ? p : null;
}

function marginFor(p, defense) {
  return defense === 'home' ? p.home_score_after - p.away_score_after : p.away_score_after - p.home_score_after;
}

function makeStop(p, defense, extra) {
  const margin = marginFor(p, defense);
  return {
    seq: p.sequence_number,
    seqs: [p.sequence_number], // every play that makes up the stop (turnover + steal)
    period: p.period_number,
    clock: p.clock_display,
    clockSeconds: p.clock_seconds_remaining,
    gameSeconds: p.game_seconds_elapsed,
    margin,
    type: 'rebound', // rebound | turnover | steal | charge | tie_up | block
    credit: null, // stealer or blocker
    dirty: false,
    dirtyReasons: [],
    late: p.clock_seconds_remaining < LATE_STOP_SECONDS,
    inClutchWindow: p.period_number >= 2 && p.clock_seconds_remaining <= CLUTCH_SECONDS && Math.abs(margin) <= CLUTCH_MARGIN,
    ...extra,
  };
}

// Pass 1: walk the plays in order, emitting stops and offensive scores.
function scan(plays, defense) {
  const offense = defense === 'home' ? 'away' : 'home';
  const offKey = `${offense}_score_after`;
  const defKey = `${defense}_score_after`;
  const events = [];
  const consumed = new Set(); // steals folded into a turnover
  let offScore = 0;
  let defScore = 0;
  let scored = false; // offense already scored in the possession that is ending
  let oreb = false; // offense had a real offensive rebound in it

  const resetPossession = () => { scored = false; oreb = false; };
  const markDirty = (stop) => {
    if (oreb) { stop.dirty = true; stop.dirtyReasons.push('offensive_rebound'); }
  };

  plays.forEach((p, i) => {
    const cat = p.play_category;
    const side = p.team_side;

    // A held ball mid-possession does not reset it; only a period-start jump ball does.
    if (cat === 'period_admin' || (cat === 'jumpball' && p.play_type === 'startperiod')) resetPossession();

    if (p[offKey] > offScore) {
      const causes = [];
      if (oreb) causes.push('second_chance');
      let fouler = null;
      if (cat === 'free_throw') {
        causes.push('foul');
        fouler = foulerForTrip(plays, i, defense);
      }
      events.push({ kind: 'score', play: p, causes, fouler });
      scored = true;
      oreb = false;
    }
    offScore = p[offKey];

    if (p[defKey] > defScore) resetPossession();
    defScore = p[defKey];

    if (consumed.has(i)) return;

    if (cat === 'rebound' && side === offense) {
      if (p.play_type === 'offensive' && p.play_subtype !== 'deadball') oreb = true;
      if (p.play_type === 'defensive') resetPossession(); // offense got the ball back
      return;
    }
    if (cat === 'turnover' && side === defense) { resetPossession(); return; }

    if (cat === 'turnover' && side === offense) {
      const stop = makeStop(p, defense, { type: 'turnover' });
      const prev = plays[prevIndex(plays, i)];
      if (p.play_type === 'offensive' && prev && prev.play_category === 'foul'
        && prev.play_type === 'offensive' && prev.player_id === p.player_id) {
        stop.type = 'charge';
      }
      const k = nextIndex(plays, i);
      if (k < plays.length && plays[k].play_category === 'steal' && plays[k].team_side === defense) {
        stop.type = 'steal';
        stop.credit = plays[k].player_name;
        stop.seqs.push(plays[k].sequence_number);
        consumed.add(k);
      }
      if (isTieUp(plays, i)) stop.type = 'tie_up';
      markDirty(stop);
      events.push({ kind: 'stop', stop });
      resetPossession();
      return;
    }

    if (cat === 'steal' && side === defense) {
      const stop = makeStop(p, defense, { type: 'steal', credit: p.player_name });
      if (isTieUp(plays, i)) stop.type = 'tie_up';
      markDirty(stop);
      events.push({ kind: 'stop', stop });
      resetPossession();
      return;
    }

    if (cat === 'rebound' && side === defense && p.play_type === 'defensive') {
      // A dead-ball rebound between free throws is not the end of the trip; after the
      // last free throw of a trip it is.
      if (p.play_subtype === 'deadball' && !endsTrip(plays[prevIndex(plays, i)], offense)) return;
      const wasScored = scored;
      const empty = isEmptyTrip(plays, i, offense);
      const stop = makeStop(p, defense, {});
      markDirty(stop);
      resetPossession();
      if (wasScored) return; // e.g. made then missed free throw: not a stop
      if (empty) { stop.dirty = true; stop.dirtyReasons.push('empty_ft_trip'); }
      const before = plays[prevIndex(plays, i)];
      if (before && before.play_category === 'block' && before.team_side === defense) {
        stop.type = 'block';
        stop.credit = before.player_name;
      }
      events.push({ kind: 'stop', stop });
    }
  });
  return events;
}

// Pass 2: group stops into streaks, ended by the offense scoring.
function groupStreaks(events, lastPlay) {
  const streaks = [];
  let current = [];
  events.forEach((e) => {
    if (e.kind === 'stop') current.push(e.stop);
    else if (current.length) {
      streaks.push({ stops: current, breakerEvent: e });
      current = [];
    }
  });
  if (current.length) streaks.push({ stops: current, breakerEvent: null, endPlay: lastPlay });
  return streaks;
}

function describeBreaker(e, lastPlay, defense) {
  const p = e ? e.play : lastPlay;
  return {
    seq: p.sequence_number,
    period: p.period_number,
    clock: p.clock_display,
    gameSeconds: p.game_seconds_elapsed,
    margin: marginFor(p, defense),
    causes: e ? e.causes : [],
    avoidable: e ? e.causes.length > 0 : false,
    fouler: e && e.fouler ? e.fouler.player_name : null,
    gameEnded: !e,
  };
}

function tagKill(stops, breaker) {
  const first = stops[0];
  const inWindow = stops.filter((s) => s.inClutchWindow).length;
  return {
    stops: stops.map((s) => s.seq),
    start: { seq: first.seq, period: first.period, clock: first.clock, gameSeconds: first.gameSeconds, margin: first.margin },
    end: breaker,
    durationSeconds: Math.round((breaker.gameSeconds - first.gameSeconds) * 10) / 10,
    dirty: stops.some((s) => s.dirty),
    critical: Math.abs(first.margin) <= CRITICAL_MARGIN,
    garbage: Math.abs(first.margin) >= GARBAGE_MARGIN && first.period >= 2 && first.clockSeconds < GARBAGE_SECONDS,
    clutch: inWindow >= 2 ? 'clutch' : inWindow === 1 ? 'adjacent' : 'none',
    late: stops.some((s) => s.late),
  };
}

export function detectKills(plays, defense = 'home') {
  const lastPlay = plays[plays.length - 1];
  const events = scan(plays, defense);
  const stops = events.filter((e) => e.kind === 'stop').map((e) => e.stop);
  const kills = [];
  const potentialKills = [];

  const streaks = groupStreaks(events, lastPlay).map((s) => {
    const n = s.stops.length;
    // Breakers are only tracked for streaks of 2 or more.
    const breaker = n >= 2 ? describeBreaker(s.breakerEvent, lastPlay, defense) : null;
    const streakKills = [];
    for (let k = 0; k + KILL_SIZE <= n; k += KILL_SIZE) {
      streakKills.push(tagKill(s.stops.slice(k, k + KILL_SIZE), breaker));
    }
    const leftover = s.stops.slice(streakKills.length * KILL_SIZE);
    let potential = null;
    if (leftover.length === 2) {
      potential = { stops: leftover.map((x) => x.seq), dirty: leftover.some((x) => x.dirty), end: breaker };
      potentialKills.push(potential);
    }
    kills.push(...streakKills);
    return { length: n, stops: s.stops.map((x) => x.seq), kills: streakKills, potentialKill: potential, breaker };
  });

  const converted = kills.length;
  const total = converted + potentialKills.length;
  return { stops, streaks, kills, potentialKills, completion: total ? converted / total : null };
}
