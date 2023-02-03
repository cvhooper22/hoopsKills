const fs = require('fs');
const fetch = require('node-fetch');
const lineupUtils = require("./modules/lineupUtils");
const generateLineupData = lineupUtils.generateLineupData
const { default: games } = require("./modules/games");
const { default: urls } = require("./modules/assetUrls");

/*
Season Lineup Data
{ [lineupHash]: { 
    names: string[],
    totalMinutes: int,
    totalNet: int,
    games: Game[]
  }
}

Game Data
{
  name: string,
  net: int,
}
*/
function updateSeasonData (seasonLineupData, gameData, gameName) {
  // console.log('in updateSeasonData')
  const lineupHashes = Object.keys(gameData.lineups);
  lineupHashes.forEach(hash => {
    // console.log('lineup for Each, this lineup is; ', hash);
    const gameLineup = gameData.lineups[hash];
    let seasonLineup = seasonLineupData[hash];
    if (!seasonLineup) {
      seasonLineupData[hash] = {
        names: gameLineup.names,
        totalMinutes: gameLineup.totalTime,
        totalNet: gameLineup.totalNet,
        games: [{
          name: gameName,
          net: gameLineup.totalNet,
          mins: gameLineup.totalTime,
        }],
      };
      return;
    }
    const updatedSeasonLineup = {
      ...seasonLineup,
      totalMinutes: seasonLineup.totalMinutes + gameLineup.totalTime,
      totalNet: seasonLineup.totalNet + gameLineup.totalNet,
    };
    updatedSeasonLineup.games.push({name: gameName, net: gameLineup.totalNet, mins: gameLineup.totalTime});
    seasonLineupData[hash] = updatedSeasonLineup;
  });
  // console.log('end of updateSeasonData', Object.keys(seasonLineupData).length);
}

async function generateSeasonLineupData () {
  const seasonLineupData = {};
  for (let idx = 0; idx < games.length; idx++) {
    const g = games[idx];
    try {
      console.log('fetching data for game: ', g.name);
      const resp = await fetch(`${urls.gameBoxScore}${g.id}`);
      const data = await resp.json();
      const lineups = generateLineupData(data[0].bbgame);
      // console.log('lineups parsed');
      // const opponent = data[0].bbgame.team.find(t => t.id !== 'BYU');
      // console.log('opponent is: ', opponent.name);
      // const location = opponent.vh === 'H' ? ' (A)' : '';
      // console.log('call updateSeasonData');
      updateSeasonData(seasonLineupData, lineups, g.name);
      console.log('\tupdateSeasonData complete, next iteration');
    } catch(err) {
        console.error(`Error fetching game info for ${g.name}: ${err.toString()}`);
        seasonLineupData.error = g.name;
    };
  };
  // console.log('seasonlineupdata', seasonLineupData);
  return seasonLineupData;
}

async function doTheThing () {
  const data = await generateSeasonLineupData();
  // console.log('data', data);
  const dataString = JSON.stringify(data);
  fs.writeFile('./data/seasonLineupsFULL.json', dataString, 'utf8', (arg1) => {
    console.log('write done arg is', arg1);
  });
}

doTheThing();