// Sums the per-game net of a set of lineups. Each lineup game is { gameId, net, mins, date, ... }
// (the season file's game info is merged in by SeasonLineups), returned in date order.
export function aggregateGamesForLineups (lineups) {
  const byGame = new Map();
  lineups.forEach(l => {
    l.games.forEach(g => {
      const existing = byGame.get(g.gameId);
      byGame.set(g.gameId, existing ? { ...existing, net: existing.net + g.net, mins: existing.mins + g.mins } : g);
    });
  });
  return [...byGame.values()].sort((a, b) => a.date.localeCompare(b.date) || a.gameId.localeCompare(b.gameId));
}
