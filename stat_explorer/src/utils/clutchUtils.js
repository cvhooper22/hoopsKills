// Clutch = 2nd half or overtime, `seconds` or less on the clock, score margin of `margin` or fewer
// (margin measured going into the play). A game can enter and leave clutch several times, so the
// result is a list of "stretches". Pure function of a game's plays (the export-game-plays shape),
// so it works the same whether the plays come from a static file or an API.
export const DEFAULT_CLUTCH = { seconds: 300, margin: 5 };

const STAT_KEYS = ["pts", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "reb", "oreb", "ast", "stl", "blk", "tov", "pf", "plusMinus", "seconds"];
const EVENT_CATEGORIES = ["shot_attempt", "free_throw", "turnover", "steal", "block"];

function newLine(id, name, teamId) {
  const line = { id, name, teamId };
  STAT_KEYS.forEach((k) => { line[k] = 0; });
  return line;
}

function slugToName(slug) {
  return slug.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ");
}

function scoreEvent(p, prev, leaderOf) {
  return {
    seq: p.sequence_number,
    period: p.period_number,
    clock: p.clock_display,
    clockSeconds: p.clock_seconds_remaining,
    description: p.play_description,
    teamId: p.team_id,
    home: p.home_score_after,
    away: p.away_score_after,
    marginBefore: Math.abs(prev.home - prev.away),
    marginAfter: Math.abs(p.home_score_after - p.away_score_after),
    leaderId: leaderOf(p.home_score_after, p.away_score_after),
    play: p, // the raw play, for callers that describe it
  };
}

export function genClutchData(plays, { seconds: limit, margin: maxMargin } = DEFAULT_CLUTCH) {
  const players = {};
  const teams = {};
  const stretches = [];
  const homeId = plays.find((p) => p.team_side === "home")?.team_id;
  const awayId = plays.find((p) => p.team_side === "away")?.team_id;
  const leaderOf = (home, away) => (home === away ? null : home > away ? homeId : awayId);
  const teamFor = (id) => (teams[id] ??= { id, pts: 0 });
  const lineFor = (p) => {
    const line = (players[p.player_id] ??= newLine(p.player_id, p.player_name, p.team_id));
    line.name = p.player_name;
    return line;
  };

  let prev = { home: 0, away: 0, clock: 1200, period: 1, lineup: [] };
  let stretch = null;
  let lastScore = null;
  let totalSeconds = 0;

  const closeStretch = (reason) => {
    // the exit play is the last score change: the play that pushed the margin out of range
    stretch.exit = { reason, play: reason === "margin" ? lastScore : null };
    stretches.push(stretch);
    stretch = null;
  };

  plays.forEach((p) => {
    const samePeriod = p.period_number === prev.period;
    const clutch = p.period_number >= 2
      && p.clock_seconds_remaining <= limit
      && Math.abs(prev.home - prev.away) <= maxMargin;

    if (!clutch && stretch) {
      closeStretch(Math.abs(prev.home - prev.away) > maxMargin ? "margin" : "time");
    }

    if (clutch) {
      if (!stretch) {
        // a scoring play that brought the game back within range is the "cut it to" play
        const cutBack = lastScore && lastScore.marginBefore > maxMargin && lastScore.marginAfter <= maxMargin
          && lastScore.period >= 2 && lastScore.clockSeconds <= limit;
        stretch = {
          id: stretches.length + 1,
          // clockSeconds: when the stretch began. A cut-back begins at the scoring play; otherwise the
          // clutch clock is what started it, so it begins at the time limit.
          start: {
            period: p.period_number, clock: p.clock_display, home: prev.home, away: prev.away,
            clockSeconds: cutBack ? lastScore.clockSeconds : (samePeriod ? Math.min(limit, prev.clock) : p.clock_seconds_remaining),
          },
          startSeq: p.sequence_number,
          endSeq: p.sequence_number,
          end: null,
          entry: cutBack ? lastScore : null,
          seconds: 0,
          pts: {},
          events: [],
          exit: null,
        };
      }
      prev.lineup.forEach(({ id, teamId }) => { players[id] ??= newLine(id, slugToName(id), teamId); });
      // time since the previous play was played at the score `prev` held, by that play's lineup
      const elapsed = samePeriod ? Math.min(prev.clock, limit) - p.clock_seconds_remaining : 0;
      if (elapsed > 0) {
        totalSeconds += elapsed;
        stretch.seconds += elapsed;
        prev.lineup.forEach(({ id }) => { players[id].seconds += elapsed; });
      }
      const line = p.player_id ? lineFor(p) : null;
      const cat = p.play_category;
      if (line) {
        if (cat === "shot_attempt") {
          line.fga += 1;
          if (p.shot_value === 3) line.tpa += 1;
          if (p.is_made) {
            line.fgm += 1;
            line.pts += p.shot_value;
            if (p.shot_value === 3) line.tpm += 1;
          }
        } else if (cat === "free_throw") {
          line.fta += 1;
          if (p.is_made) { line.ftm += 1; line.pts += 1; }
        } else if (cat === "rebound") {
          line.reb += 1;
          if (p.play_type === "offensive") line.oreb += 1;
        }
        else if (cat === "assist") line.ast += 1;
        else if (cat === "steal") line.stl += 1;
        else if (cat === "block") line.blk += 1;
        else if (cat === "turnover") line.tov += 1;
        else if (cat === "foul") line.pf += 1;
      }
      const homeDelta = p.home_score_after - prev.home;
      const awayDelta = p.away_score_after - prev.away;
      if (homeDelta || awayDelta) {
        (p.lineup_home ?? []).forEach((id) => { if (players[id]) players[id].plusMinus += homeDelta - awayDelta; });
        (p.lineup_away ?? []).forEach((id) => { if (players[id]) players[id].plusMinus += awayDelta - homeDelta; });
        teamFor(homeId).pts += homeDelta;
        teamFor(awayId).pts += awayDelta;
        stretch.pts[homeId] = (stretch.pts[homeId] ?? 0) + homeDelta;
        stretch.pts[awayId] = (stretch.pts[awayId] ?? 0) + awayDelta;
      }
      if (EVENT_CATEGORIES.includes(cat)) {
        stretch.events.push({
          seq: p.sequence_number,
          clock: p.clock_display,
          period: p.period_number,
          description: p.play_description,
          teamId: p.team_id,
          scoring: Boolean(p.is_made),
          home: p.home_score_after,
          away: p.away_score_after,
          play: p,
        });
      }
      stretch.end = {
        period: p.period_number, clock: p.clock_display, clockSeconds: p.clock_seconds_remaining,
        home: p.home_score_after, away: p.away_score_after,
      };
      stretch.endSeq = p.sequence_number;
    }

    if (p.home_score_after !== prev.home || p.away_score_after !== prev.away) {
      lastScore = scoreEvent(p, prev, leaderOf);
    }
    prev = {
      home: p.home_score_after ?? prev.home,
      away: p.away_score_after ?? prev.away,
      clock: p.clock_seconds_remaining,
      period: p.period_number,
      lineup: [
        ...(p.lineup_home ?? []).map((id) => ({ id, teamId: homeId })),
        ...(p.lineup_away ?? []).map((id) => ({ id, teamId: awayId })),
      ],
    };
  });
  if (stretch) closeStretch("final");

  const last = plays[plays.length - 1];
  return {
    stretches,
    seconds: totalSeconds,
    homeId,
    awayId,
    final: { home: last.home_score_after, away: last.away_score_after },
    teams,
    players: Object.values(players),
  };
}

export function formatClutchTime(seconds) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
