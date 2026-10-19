// Top player combinations by net, from a game's five-man lineups. Pure; no I/O.
//
// A lineup is { names: [five checknames], totalTime: minutes, totalNet: points for minus against } (see lineupUtils.js). The
// net for any group of k players is the net of every lineup that contained all of them, added together: the five-man
// lineups never overlap in time, so that is exactly the net while those k players shared the floor.
//
// topCombos(lineups, { sizes: [5, 4, 3, 2], limit: 5 }) -> { 5: [combo], 4: [...], ... } with
// combo = { names: [checknames], minutes, net, lineups: number of five-man lineups that contained the group },
// each list sorted by net (best first), then minutes, then names so the order is stable.
const combinations = (items, k) => {
  const out = [];
  const pick = (start, chosen) => {
    if (chosen.length === k) { out.push(chosen.slice()); return; }
    for (let i = start; i < items.length; i++) { chosen.push(items[i]); pick(i + 1, chosen); chosen.pop(); }
  };
  pick(0, []);
  return out;
};

export function topCombos(lineups, { sizes = [5, 4, 3, 2], limit = 5 } = {}) {
  const result = {};
  sizes.forEach((k) => {
    const groups = new Map();
    lineups.forEach((l) => {
      const players = [...l.names].sort();
      combinations(players, k).forEach((group) => {
        const key = group.join('|');
        const g = groups.get(key) || { names: group, minutes: 0, net: 0, lineups: 0 };
        g.minutes += l.totalTime;
        g.net += l.totalNet;
        g.lineups += 1;
        groups.set(key, g);
      });
    });
    result[k] = [...groups.values()]
      .sort((a, b) => b.net - a.net || b.minutes - a.minutes || a.names.join('|').localeCompare(b.names.join('|')))
      .slice(0, limit);
  });
  return result;
}
