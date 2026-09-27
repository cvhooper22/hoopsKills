// Games with normalized plays in public/data/<id>.json, for the stops editor
// and the kills preview. `defense` is the side BYU is on (BYU's stops are tracked).
export const KILL_GAMES = [
  { id: '2025-11-03-villanova-at-byu', label: 'Villanova at BYU · 2025-11-03', home: 'BYU', away: 'Villanova', defense: 'home' },
  { id: '2025-11-28-byu-at-dayton', label: 'BYU at Dayton · 2025-11-28', home: 'Dayton', away: 'BYU', defense: 'away' },
  { id: '2026-01-03-byu-at-kansas-st', label: 'BYU at Kansas St. · 2026-01-03', home: 'Kansas St.', away: 'BYU', defense: 'away' },
];

export function killGameById(id) {
  return KILL_GAMES.find((g) => g.id === id) || KILL_GAMES[0];
}
