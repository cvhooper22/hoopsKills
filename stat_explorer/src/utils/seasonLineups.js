import generateLineupData from "../utils/lineupUtils";
import games from "../constants/games";
import urls from "../constants/assetUrls";

/*
Season Lineup Data
{ [lineupHash]: { 
    names: string[],
    totalMinutes: int,
    totalNet: int,
    games: string[]
  }
}

Game Data
{
  id: string,
  name: string,
  oppScore: int,
  teamScore: int,
}
*/

function updateSeasonData (seasonLineupData, gameData, gameName) {
  const lineupHashes = Object.keys(gameData);
  lineupHashes.forEach(hash => {
    const gameLineup = gameLineups[hash];
    let seasonLineup = seasonLineupData[hash];
    if (!seasonLineup) {
      seasonLineup[hash] = {
        names: gameLineup.names,
        totalMinutes: gameLineup.totalTime,
        totalNet: gameLineup.totalNet,
        games: [gameName],
      };
      return;
    }
    const updatedSeasonLineup = {
      ...seasonLineup,
      totalMinutes: seasonLineup.totalMinutes + gameLineup.totalTime,
      totalNet: seasonLineup.totalNet + gameLineup.totalNet,
    };
    updatedSeasonLineup.games.push(gameName);
  });
}

async function generateSeasonLineupData () {
  const seasonLineupData = {};
  const demoGames = games.slice(0,3);
  for (let idx = 0; idx < demoGames.length; idx++) {
    try {
      const resp = await fetch(`${urls.gameBoxScore}${g.id}`);
      const data = resp.json;
      const lineups = generateLineupData(data[0].bbgame);
      const opponent = data[0].bbgame.team.find(t => t.id !== 'BYU');
      const location = opponent.vh === 'H' ? ' (A)' : '';
      updateSeasonData(seasonLineupData, lineups, `${opponent.name}${location}`);
    } catch(err) {
        console.error(`Error fetching game info for ${g.name}: ${err.toString()}`);
    };
  };
  return seasonLineupData;
}

const data = generateSeasonLineupData();
console.log('Finished');
console.log(data);