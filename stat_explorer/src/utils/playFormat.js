// Shared play-by-play formatting. Works on the normalized plays from export-game-plays.js (the raw
// play_category / play_type / play_subtype / player_name / is_made fields), so any view that has
// plays can describe them the same way.

const SHOT_PREFIX = { pullup: "pull-up", tipin: "tip-in" };
const TURNOVER_LABEL = {
  badpass: "bad pass", lostball: "lost ball", outofbounds: "out of bounds", shotclock: "shot clock",
  offensive: "offensive foul", dribbling: "dribbling", travel: "travel", "3sec": "3 seconds",
};
const NAME_SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;

// "turnaroundjumpshot" -> "turnaround jumpshot", "tipinlayup" -> "tip-in layup"
export function shotDescriptor(subtype) {
  if (!subtype) return "";
  if (subtype === "alleyoop") return "alley-oop";
  const m = subtype.match(/^(.*?)(jumpshot|layup|dunk|hookshot)$/);
  if (!m) return subtype;
  const prefix = SHOT_PREFIX[m[1]] ?? m[1];
  return prefix ? `${prefix} ${m[2]}` : m[2];
}

// Short phrase for narration: "three", "free throw", "turnaround jumper", "driving layup"
export function shotWord(play) {
  if (play.play_category === "free_throw") return "free throw";
  if (play.shot_value === 3) return "three";
  return shotDescriptor(play.play_subtype).replace("jumpshot", "jumper").replace("hookshot", "hook") || "bucket";
}

// "Robert Wright III" -> "Wright", "AJ Dybantsa" -> "Dybantsa"
export function lastName(name) {
  const parts = (name ?? "").split(/\s+/).filter(Boolean);
  while (parts.length > 1 && NAME_SUFFIX.test(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1] ?? "";
}

// One line of text for a play, for play-by-play lists.
export function describePlay(p) {
  const name = p.player_name;
  const result = p.is_made ? "made" : "missed";
  switch (p.play_category) {
    case "shot_attempt":
      return `${name} ${p.shot_value}pt ${shotDescriptor(p.play_subtype)} ${result}`;
    case "free_throw": {
      const m = (p.play_subtype ?? "").match(/^(\d+)of(\d+)$/);
      return m ? `${name} free throw ${m[1]} of ${m[2]} ${result}` : `${name} free throw ${result}`;
    }
    case "turnover": {
      const label = TURNOVER_LABEL[p.play_type] ?? p.play_type;
      return `${name ?? "Team"} turnover${label ? ` (${label})` : ""}`;
    }
    case "steal": return `Steal: ${name}`;
    case "block": return `Block: ${name}`;
    default: return p.play_description;
  }
}

export const periodLabel = (n) => (n === 1 ? "H1" : n === 2 ? "H2" : n === 3 ? "OT" : `OT${n - 2}`);

// 300 -> "5:00", 52.4 -> "0:52.4"
export function formatClock(seconds) {
  const whole = Math.floor(seconds);
  const tenths = Math.round((seconds - whole) * 10);
  const base = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  return tenths && seconds < 60 ? `${base}.${tenths}` : base;
}

const signed = (n) => (n > 0 ? `+${n}` : String(n));

// Plays -> rows for <PlayByPlayTable>. Scoring plays carry the running score (focus team first) and
// the focus team's margin; misses are marked muted.
//   toPlayRows(plays, { focusId, homeId, labelOf: (teamId) => "BYU" })
export function toPlayRows(plays, { focusId, homeId, labelOf }) {
  const sign = homeId === focusId ? 1 : -1;
  return plays.map((p) => {
    const scored = p.is_made === true && (p.play_category === "shot_attempt" || p.play_category === "free_throw");
    const us = sign === 1 ? p.home_score_after : p.away_score_after;
    const them = sign === 1 ? p.away_score_after : p.home_score_after;
    return {
      key: p.sequence_number,
      clock: (p.clock_display ?? "").replace(/\.\d+$/, ""),
      teamLabel: labelOf(p.team_id),
      teamTone: p.team_id === focusId ? "primary" : "secondary",
      text: describePlay(p),
      muted: p.is_made === false,
      score: scored ? `${us}-${them}` : null,
      net: scored ? us - them : null,
      netText: scored ? signed(us - them) : null,
    };
  });
}
