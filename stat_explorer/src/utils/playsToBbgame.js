// Adapts an array of normalized plays (see dataAggregators/ingest/tools/export-game-plays.js)
// into the `bbgame` shape that genLineupData in lineupUtils.js expects.
const TEAM_KEY = "BYU";

// "Kennard Davis Jr." -> "DAVIS JR.,KENNARD"
function toCheckname(name) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return `${rest.join(" ")},${first}`.toUpperCase();
}

function slugToName(slug) {
  return slug.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ");
}

export default function playsToBbgame(plays, teamId = "byu") {
  const teamPlay = plays.find((p) => p.team_id === teamId);
  const teamSide = teamPlay.team_side;
  const isHome = teamSide === "home";

  const names = {};
  plays.forEach((p) => {
    if (p.team_id === teamId && p.player_id) {
      names[p.player_id] = toCheckname(p.player_name);
    }
  });
  const nameOf = (id) => names[id] ?? toCheckname(slugToName(id));

  const lineupKey = isHome ? "lineup_home" : "lineup_away";
  const starterIds = plays.find((p) => p[lineupKey]?.length)[lineupKey];
  const playerIds = [...new Set([...starterIds, ...Object.keys(names)])];

  const periods = [];
  plays.forEach((p) => {
    const period = (periods[p.period_number - 1] ??= { play: [] });
    const isSub = p.play_category === "substitution";
    const isScore = p.is_made && (p.play_category === "shot_attempt" || p.play_category === "free_throw");
    period.play.push({
      action: isSub ? "SUB" : isScore ? "GOOD" : p.play_category.toUpperCase(),
      team: p.team_id === teamId ? TEAM_KEY : "OPP",
      type: isSub ? p.play_subtype.toUpperCase() : undefined,
      checkname: p.player_id ? nameOf(p.player_id) : undefined,
      time: p.clock_display,
      vscore: String(p.away_score_after),
      hscore: String(p.home_score_after),
    });
  });

  return {
    team: [{
      id: TEAM_KEY,
      name: TEAM_KEY,
      vh: isHome ? "H" : "V",
      player: playerIds.map((id) => ({
        name: nameOf(id),
        checkname: nameOf(id),
        gs: starterIds.includes(id) ? "1" : "0",
        gp: "1",
      })),
    }],
    plays: { period: periods },
  };
}
