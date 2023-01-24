import { makeSortAscByKey } from "./lineupSorters";
import { gameFromName } from "../constants/games";

export function aggregateGamesForLineups (lineups) {
  const lineupGames = lineups.reduce((games, l) => {
    const updatedGames = [...games];
    l.games.forEach(g => {
      const existingGameIndex = updatedGames.findIndex(existing => existing.name === g.name);
      if (existingGameIndex < 0) {
        updatedGames.push(g);
      } else {
        const updatedGame = {...updatedGames[existingGameIndex]};
        updatedGame.net = updatedGame.net + g.net;
        updatedGames[existingGameIndex] = updatedGame;
      }
    });
    return updatedGames;
  }, []);
  const gamesWithOrder = lineupGames.map(g => {
    const gameData = gameFromName(g.name);
    return {
      ...g,
      order: gameData.order,
    }
  });
  const sortByOrder = makeSortAscByKey('order');
  const sortedGames = gamesWithOrder.sort(sortByOrder);
  return sortedGames;
}