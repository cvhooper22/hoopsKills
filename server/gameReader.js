const gameData = require('../data/sampleGame.json');

console.log('gameData test', gameData[0]._id)

/* Stop is
{
  playType: String (steal, block, def rebound)
  player: String (checkname of player or just TEAM)
}
*/

/* individual kill is 
{
  timeStart: String,
  timeEnd: String,
  scoreStart: Int,
  scoreEnd: Int,
  offTurnover: Int,
  efficiency: Float,
  stops: [Stop]
}
*/

/* Period Kills total

/* GameKills data in toto
{
  total: Int,
  kills: [
    {
      period: Int,

    },
    ...
  ]
}
*/

/*
isStop
play.action === 'REBOUND' && play.type === 'DEF' && prevPlay.type !== 'FT'
play.action === 'TURNOVER'
*/

/*
endsStop
made basket
play.action === 'GOOD' && play.team === opponent
foul leading to free throw
play.action === 'FOUL' && play.team === team && resultsInFreeThrow
--> results in free throw = while (nextPlay.action === 'SUB') { nextPlay === plays[nextplayIndex + 1]}
*/

function foulResultsInFT (play, playIndex, plays) {
  let nextPlayIndex = playIndex + 1;
  let nextPlay = plays[nextPlayIndex];
  while(nextPlay.action === 'SUB') {
    nextPlayIndex += 1;
    nextPlay = plays[nextPlayIndex];
  }
  if (nextPlay.type === 'FT') {
    return true;
  }
  return false;
}

/*
getStopType
Block
play.action === 'BLOCK' && nextPlay.action === 'REBOUND' && nextPlay.type === 'DEF' 
Charge
play.action === 'TURNOVER && prevPlay.action === 'FOUL' && (prevPlay.checkname === play.checkname)
Steal
play.action === 'TURNOVER' && nextPlay.action === 'STEAL'
Shot Clock violation ? (unconfirmed)
play.action === 'TURNOVER' && play.checkname === 'TEAM'
*/

// function isStop(play, prevPlay, nextPlay) {
//   const action = play.action;
//   const isStop = false;
//   switch(action)
// }

// function killsReducer(gameKills, currentPlay, i, )

// function parseHalf (plays, halfData) {
  
// }

function tallyKillsData (killsByPeriod) {
  const initialData = {
    total: 0,
    opportunities: 0,
    longestStreak : {},
  };
  return killsByPeriod.reduce((aggr, val) => {
    const periodData = val;
    aggr.total += periodData.total;
    aggr.opportunities += periodData.opportunities;
    return aggr;
  }, initialData);
}

function tallyPossessionData(possessionsByPeriod) {
  const teams = Object.keys(possessionsByPeriod[0]);
  return possessionsByPeriod.reduce((aggr, val) => {
    const teams = Object.keys(val);
    const visitor = teams[0];
    const home = teams[1];
    return {
      [visitor]: aggr[visitor] + val[visitor],
      [home]: aggr[home] + val[home],
    };
  }, {
    [teams[0]]: 0,
    [teams[1]]: 0,
  });
}

function makeCumalitiveData (dataByPeriod) {
  return {
    kills: tallyKillsData(dataByPeriod.kills),
    possessions: tallyPossessionData(dataByPeriod.possessions),
  };
}

function getNextIndices (playsByPeriod, playIndex, periodIndex) {
  const totalPlaysThisPeriod = playsByPeriod[periodIndex].play.length;
  if (playIndex < totalPlaysThisPeriod) {
    return playsByPeriod[periodIndex].play[playIndex + 1];
  }
}

const baseKillData = {
  total: 0,
  opportunities: 0,
};

const baseStopData = {
  stops: []
};

function makeBasePossession(visitor, home) {
  return {
    [visitor]: 0,
    [home]: 0,
  };
}

function addNewPeriodToData(dataByPeriod, visitor, home) {
  dataByPeriod.stopStreaks.push({ ...baseStopData });
  dataByPeriod.kills.push({ ...baseKillData });
  dataByPeriod.possessions.push({ ...makeBasePossession(visitor, home) });
}

function updateKills (dataByPeriod, play) {
  dataByPeriod.kills.total = dataByPeriod.kills.total + 1;
}

function updateKillOpps(dataByPeriod, play) {
  dataByPeriod.kills.opportunities = dataByPeriod.kills.opportunities + 1;
}

function getNextNonSubPlay(index, plays) {
  let currentIndex = index;
  let currentPlay = plays[index];
  while (currentPlay && currentPlay.action === 'SUB') {
    currentIndex = index + 1;
    currentPlay = plays[currentIndex]; 
  }
  return currentPlay;
}

function getNextNonFoulPlay(index, plays) {
  let currentIndex = index;
  let currentPlay = plays[index];
  while (currentPlay && currentPlay.action === 'FOUL') {
    currentIndex = index + 1;
    currentPlay = plays[currentIndex]; 
  }
  return currentPlay;
}

function wasFoulLeadingToFTs(playIndex, plays) {
  const play = plays[playIndex];
  let didLeadToFTs = false;
  if (play.action === 'FOUL'){
    const nextNonSubPlay = getNextNonSubPlay(playIndex + 1, plays);
    if (nextNonSubPlay.type === 'FT') {
      didLeadToFTs = true;
    }
  }
  return didLeadToFTs;
}

function playIsStop (playIndex, plays) {
  const play = plays[playIndex];
  let isStop = false;
  if (play.team === 'BYU') {
    if (play.action === 'REBOUND' && play.type === 'DEF') {
      if (plays[playIndex - 1] && plays[playIndex - 1].type !== 'FT') {
        isStop = true;
      }
    }
  } else if (play.action === 'TURNOVER') {
    isStop = true;
  }
  return isStop;
}

function playEndsStopStreak (playIndex, plays) {
  const play = plays[playIndex];
  let endsStreak = false;
  if (play.team !== 'BYU' && play.action === 'GOOD') {
    endsStreak = true;
  } else {
    endsStreak = wasFoulLeadingToFTs(playIndex, plays);
  }
  return endsStreak;
}

function playChangesPossession (index, plays, currentTeamInPossession) {
  let changesPossession = false;
  const play = plays[index];
  const actionsThatChange = ['TURNOVER', 'MISS', 'GOOD']
  if (actionsThatChange.includes(play.action)) {
    changesPossession = true;
    if (play.action === 'REBOUND' && play.type === 'OFF') {
      changesPossession = false;
    }
  }
  return changesPossession;
}

function newTeamInPossession (plays, playIndex) {
  let nextTeamsPlay = nextNonSubPlay
}

function processStop(playIndex, gameData, periodIndex, plays) {
  const play = plays[playIndex];
  const currentStops = gameData.currentStopCount;
  const periodData = gameData.dataByPeriod[periodIndex]
  gameData.currentStopCount = currentStops + 1;
  if (gameData.currentStopCount % 3 === 0) {
    updateKills(periodData, play);
  } else if (gameData.currentStopCount % 3 === 1) {
    updateKillOpps(periodData, play);
  }
}

function processPlay (play, gameData, playIndex, periodIndex, plays) {
  if (playIsStop(playIndex, plays)) {
    console.log('A stop!');
    processStop(playIndex, gameData, periodIndex, plays);
  }

  if (playEndsStopStreak(playIndex, plays)) {
    if (gameData.currentStopCount > gameData.longestStopStreak) {
      gameData.longestStopStreak = gameData.currentStopCount;
    }
    gameData.currentStopCount = 0;
  }

  if (playChangesPossession(playIndex, plays, gameData.currentTeamInPossession)) {
    gameData.currentTeamInPossession = newTeamInPossession(gameData.currentTeamInPossession, play);
  }
}

function parseGame(playsByPeriod, visitor, home) {
  // const myTeam = 'BYU'; may need to use this in the future
  const dataByPeriod = {
    stopStreaks: [{
      ...baseStopData,
    }],
    kills: [
      {
        ...baseKillData
      }
    ],
    possessions: [
      {
        ...makeBasePossession(visitor,home),
      }
    ],
  };

  const gameData = {
    currentTeamInPossession: '',
    currentStopCount: 0,
    longestStopStreak: 0,
    dataByPeriod,
    visitor,
    home
  }

  let periodIndex = 0;
  let playIndex = 0;
  let currentPlay = playsByPeriod[periodIndex]?.play?.[playIndex];

  gameData.currentTeamInPossession = currentPlay.team;
  dataByPeriod.possessions[0][gameData.currentTeamInPossession] = 1;
  // debugger;
  while (currentPlay) {
    const {nextPlayIndex, nextPeriodIndex} = getNextIndices(playsByPeriod, playIndex, periodIndex);
    if (periodIndex !== nextPeriodIndex) {
      addNewPeriodToData(dataByPeriod, visitor, home);
      const firstNonSubPlay = getNextNonSubPlay(0, playsByPeriod[periodIndex]?.play);
      gameData.currentTeamInPossession = firstNonSubPlay.team;
      dataByPeriod.possessions[periodIndex][gameData.currentTeamInPossession] = 1;
    }

    processPlay(currentPlay, gameData, playIndex, periodIndex, playsByPeriod[periodIndex]?.play);

    playIndex = nextPlayIndex;
    periodIndex = nextPeriodIndex;
    currentPlay = playsByPeriod[periodIndex]?.play?.[playIndex];
  }
  
  const data = makeCumalitiveData(dataByPeriod);

  return data;
}


function makeGameData (gameData) {
  const plays = gameData[0].bbgame.plays.period;
  const visitor = gameData[0].bbgame.venue.visid;
  const home = gameData[0].bbgame.venue.homeid;
  console.log('plays', plays[0].number);
  const firstPlayFirstHalf = plays[0].play[0].action;
  console.log('first play is a', firstPlayFirstHalf);
  console.log('\t by', plays[0].play[0].checkname);

  return parseGame(plays, visitor, home);
}

console.log(makeGameData(gameData));