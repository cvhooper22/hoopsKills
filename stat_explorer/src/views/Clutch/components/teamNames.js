const TEAM_NAMES = { byu: "BYU" };
const TEAM_ABBREVS = { byu: "BYU", dayton: "UD" };

export function teamName(id) {
  return TEAM_NAMES[id] ?? id.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ");
}

// Short label for badges and compact score headers. Known teams are listed; others fall back to
// the first three letters of the name.
export function teamAbbrev(id) {
  return TEAM_ABBREVS[id] ?? teamName(id).replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}
