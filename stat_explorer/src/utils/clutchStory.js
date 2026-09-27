// The narrative around each clutch stretch: how it began, how it ended, and what happened between
// stretches. Pure functions of the stretches and the margin series, returning plain data
// ({ tone, label, headline, details }) that a component lays out.
import { formatClock, lastName, periodLabel, shotWord } from "./playFormat";

const mmss = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

// ctx: { sign, focusId, focusName, oppName, margin }  (sign: +1 when the focus team is home)
export function buildStretchStories(stretches, points, ctx) {
  const { sign, focusId, focusName, oppName, margin } = ctx;
  const usThem = (home, away) => (sign === 1 ? [home, away] : [away, home]);
  const line = (home, away) => usThem(home, away).join("-");
  const marginOf = (home, away) => sign * (home - away);
  const nameOf = (teamId) => (teamId === focusId ? focusName : oppName);

  function startStory(stretch) {
    const { start, entry } = stretch;
    if (entry) {
      const word = shotWord(entry.play);
      const who = lastName(entry.play.player_name);
      const m = marginOf(entry.home, entry.away);
      const scorerLeads = m !== 0 && (m > 0) === (entry.teamId === focusId);
      const verb = m === 0
        ? `ties it at ${usThem(entry.home, entry.away)[0]}`
        : scorerLeads ? `puts ${nameOf(entry.teamId)} up ${Math.abs(m)}` : `cuts it to ${Math.abs(m)}`;
      return {
        tone: "in", label: "Back in it", headline: `${who} ${word} ${verb}.`,
        details: [line(entry.home, entry.away), `${periodLabel(entry.period)} ${entry.clock}`],
      };
    }
    const m = marginOf(start.home, start.away);
    const tied = m === 0;
    const leader = m > 0 ? focusName : oppName;
    return {
      tone: "neutral", label: `Clock hits ${formatClock(start.clockSeconds)}`,
      headline: tied ? `Tied at ${usThem(start.home, start.away)[0]}.` : `${leader} up ${Math.abs(m)}, ${line(start.home, start.away)}.`,
      details: [`${periodLabel(start.period)} ${formatClock(start.clockSeconds)}`],
    };
  }

  function endStory(stretch) {
    const { end, exit } = stretch;
    if (exit.reason === "margin" && exit.play) {
      const play = exit.play;
      const leaderName = nameOf(play.leaderId);
      return {
        tone: "out",
        label: play.leaderId === focusId ? "Breathing room" : `${oppName} pulls away`,
        headline: `${lastName(play.play.player_name)} ${shotWord(play.play)}. ${leaderName} by ${play.marginAfter}.`,
        details: [line(play.home, play.away), `${periodLabel(play.period)} ${play.clock}`, `Out of clutch (lead over ${margin})`],
      };
    }
    const m = marginOf(end.home, end.away);
    const clockText = `${periodLabel(end.period)} ${end.clock}`;
    if (exit.reason === "final") {
      const [us, them] = usThem(end.home, end.away);
      const winner = m > 0 ? focusName : oppName;
      return {
        tone: "neutral", label: "To the horn",
        headline: m === 0
          ? `All tied at the buzzer, ${us}-${them}.`
          : `Still a ${Math.abs(m)}-point game at the buzzer. ${winner} wins ${Math.max(us, them)}-${Math.min(us, them)}.`,
        details: [clockText],
      };
    }
    return { tone: "neutral", label: "End of period", headline: m === 0 ? "All square." : `${m > 0 ? focusName : oppName} up ${Math.abs(m)}.`, details: [clockText] };
  }

  // the stretch between one stretch's exit and the next one's entry
  function gapStory(stretch, next) {
    if (!next || stretch.exit.reason !== "margin" || !stretch.exit.play || stretch.end.period !== next.start.period) return null;
    const until = next.entry ? next.entry.seq : next.startSeq;
    const margins = [marginOf(stretch.exit.play.home, stretch.exit.play.away)];
    points.forEach((p) => { if (p.seq > stretch.endSeq && p.seq < until) margins.push(p.margin); });
    const peak = margins.reduce((best, m) => (Math.abs(m) > Math.abs(best) ? m : best), 0);
    const duration = mmss(stretch.end.clockSeconds - next.start.clockSeconds);
    return `Out of clutch for ${duration}. ${peak > 0 ? focusName : oppName} led by as many as ${Math.abs(peak)}.`;
  }

  return stretches.map((s, i) => ({ start: startStory(s), end: endStory(s), gapAfter: gapStory(s, stretches[i + 1]) }));
}
