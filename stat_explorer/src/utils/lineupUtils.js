function sortPlayersByName(a, b) {
  if (a > b) {
    return 1;
  }
  if (a < b) {
    return -1;
  }
  return 0;
}

function timeToNumber (timeString, periodIndex = 0) {
  const [minute, seconds] = timeString.split(':').map(n => +n);
  const offsets = [0,20,40,45,50,55];
  const offset = offsets[periodIndex];
  const periodStart = periodIndex < 2 ? 20 : 5;
  const fractional = seconds/60;
  const timeFromPeriodStart = periodStart - (minute + fractional);
  return offset + timeFromPeriodStart;
}

export function numberToGameTime (timeNumber, includePostfix=true, isEndPeriod=false) {
  if (isEndPeriod) {
    return 'END';
  }
  const intPart = Math.floor(timeNumber);
  const decimal = timeNumber - intPart;
  const seconds = Math.floor(decimal * 60);
  let gameSeconds = 60 - seconds;
  let gameMinute = 0;
  let postFix = '';
  const otStarts = [40,45,50,55];
  if (intPart < 40) {
    const min = intPart % 20;
    gameMinute = 19 - min;
  } else if (intPart !== 40){ // need to check this for end of game in OT too
    const min = intPart % 5;
    gameMinute = 5 - min;
  } else if (otStarts.includes(intPart)) {
    gameMinute = 4; // will be corrected in next step to 5
  }
  if (gameSeconds === 60) {
    gameMinute = gameMinute + 1;
    gameSeconds = 0;
  }
  if (intPart >= 55) {
    postFix = ' 4OT';
  } else if (intPart >= 50) {
    postFix = ' 3OT';
  } else if (intPart >= 45) {
    postFix = ' 2OT';
  } else if (intPart >= 40) {
    postFix = ' OT';
  } else if (intPart >= 20) {
    postFix = ' 2H';
  }
  const secondString = gameSeconds.toString().padStart(2,'0');
  return `${gameMinute}:${secondString}${includePostfix ? postFix : ''}`;
}

export function getLineupHash(lineup) {
  // console.log('get hash for', lineup);
  const sortedLineup = lineup.sort(sortPlayersByName);
  return sortedLineup.reduce((agg, player) => {
    const name = player.split(",");
    // console.log('split names', name);
    const firstName = name[1];
    const lastName = name[0];
    const hash = `${firstName.slice(0, 2)}${lastName.slice(0, 2)}`;
    if (agg.length === 0) {
      return hash;
    }
    return `${agg}-${hash}`;
  }, "");
}

export function lineupToString(lineup) {
  return lineup.names.reduce((agg, player) => {
    const lastName = player.split(",")[0];
    if (agg.length === 0) {
      return lastName;
    }
    agg = `${agg} / ${lastName}`;
    return agg;
  }, "");
}

function getStarters(players) {
  const starters = players.filter((p) => p.gs === "1");
  return starters;
}

function collectSubs(plays, startIndex) {
  // console.log("collectSubs starting at: ", startIndex);
  let currPlayIdx = startIndex;
  let playIsSub = true;
  const subIns = [];
  const subOuts = [];
  while (playIsSub) {
    // console.log("we got a sub continue");
    const play = plays[currPlayIdx];
    // console.log("\tthe play: ", play);
    if (play.team === "BYU") {
      // console.log("it was a BYU sub");
      if (play.type === "IN") {
        // console.log("\t\tSUB IN: ", play.checkname);
        subIns.push(play.checkname);
      } else if (play.type === "OUT") {
        // console.log("\t\tSUB OUT: ", play.checkname);
        subOuts.push(play.checkname);
      }
    }
    const nextPlay = plays[currPlayIdx + 1];
    // console.log('\t\tThe next play: ', nextPlay);
    if (!nextPlay || nextPlay.action !== "SUB") {
      playIsSub = false;
    }
    currPlayIdx = currPlayIdx + 1;
  }
  return {
    lastSubIndex: currPlayIdx,
    subs: {
      in: subIns,
      out: subOuts
    }
  };
}

function formNewLineup(subs, oldLineup) {
  // console.log("formNewLineup");
  // console.log('oldLineup', oldLineup);
  const subOuts = subs.out;
  const subIns = [...subs.in];
  const lowerSubs = subOuts.map((p) => p.toLowerCase());
  // console.log('lowersubs', lowerSubs);
  return oldLineup.reduce(
    (agg, player, index) => {
      const name = player.toLowerCase();
      // console.log('name', name);
      if (lowerSubs.includes(name)) {
        // console.log('there was a subout, swap for', name);
        // console.log('at index: ', index);
        agg[index] = subIns.pop();
      }
      return agg;
    },
    [...oldLineup]
  );
}

function getUpdatedScore(meta) {
  const teamKey = meta.isVisitor ? 'vscore' : 'hscore';
  const oppKey = teamKey === 'vscore' ? 'hscore' : 'vscore';
  return {
    teamScore: meta[teamKey],
    oppScore: meta[oppKey],
  };
}

function getNetForStint(stint) {
  const startMargin = stint.startScore.teamScore - stint.startScore.oppScore;
  const endMargin = stint.endScore.teamScore - stint.endScore.oppScore;
  return endMargin - startMargin;
}

function parseHalf(plays, lineupData, halfIndex, numHalves) {
  let skipIndex = -1;
  // console.log("plays", plays);
  plays.forEach((play, index) => {
    // console.log("skipIndex", skipIndex);
    if (index > skipIndex) {
      // console.log("not a skip play");
      if (play.action === "GOOD") {
        lineupData.gameScore.vscore = +play.vscore;
        lineupData.gameScore.hscore = +play.hscore;
      }
      if (play.action === "SUB" && play.team === "BYU") {
        // console.log("it was a sub for BYU");
        const subData = collectSubs(plays, index);
        // console.log("subs collected", subData);
        const newLineup = formNewLineup(subData.subs, lineupData.currentLineup);
        // console.log('new lineup is now', newLineup);
        const newHash = getLineupHash(newLineup);
        // update old lineup end
        const oldHash = getLineupHash(lineupData.currentLineup);
        const oldStints = lineupData.lineups[oldHash].stints;
        const updateStint = oldStints[oldStints.length - 1];
        updateStint.end = timeToNumber(play.time, halfIndex);
        updateStint.endScore = getUpdatedScore(lineupData.gameScore);
        updateStint.net = getNetForStint(updateStint);
        // console.log('their new hash is', newHash);
        lineupData.currentLineup = newLineup;
        if (!lineupData.lineups[newHash]) {
          lineupData.lineups[newHash] = {
            names: newLineup,
            stints: [
              {
                start: timeToNumber(play.time, halfIndex),
                startScore: getUpdatedScore(lineupData.gameScore),
              }
            ]
          };
        } else {
          // console.log('\nnew start of lineup, the play, ', play);
          lineupData.lineups[newHash].stints.push({ start: timeToNumber(play.time, halfIndex), startScore: getUpdatedScore(lineupData.gameScore), });
        }
        skipIndex = subData.lastSubIndex;
      }
    }
  });
  const currentLineupKey = getLineupHash(lineupData.currentLineup);
  const lineup = lineupData.lineups[currentLineupKey];
  const lastStint = lineup.stints[lineup.stints.length - 1];
  const endingTimes = [20,40,45,50,55];
  let endTime = 40;
  endTime = endingTimes[halfIndex];
  lastStint.end = endTime;
  lastStint.endScore = getUpdatedScore(lineupData.gameScore);
  lastStint.net = getNetForStint(lastStint);
  lastStint.isEndPeriod = true;
  if (numHalves - 1 === halfIndex) {
    lineup.endGame = true;
    lineupData.endingHash = getLineupHash(lineup.names);
    lineup.isEndingLineup = true;
  }
}

const generateLineupData = (game) => {
  console.log("gen lineups");
  const teamData = game.team.find((t) => t.id === "BYU");
  const isVisitor = teamData.vh === "V";
  // console.log("teamData", teamData);
  const starters = getStarters(teamData.player);
  const starterNames = starters.map((s) => s.name.toUpperCase());
  const lineupData = {
    gameScore: {
      isVisitor,
      teamKey: "BYU",
      vscore: 0,
      hscore: 0,
    },
    currentLineup: starterNames,
    starterHash: getLineupHash(starterNames),
    lineups: {
      [getLineupHash(starterNames)]: {
        names: starterNames,
        stints: [
          {
            start: 0,
            startScore: {
              teamScore: 0,
              oppScore: 0,
            }
          }
        ],
        isStartingLineup: true,
      }
    }
  };
  const numHalves = game.plays.period.length;
  game.plays.period.forEach((p, idx) => {
    parseHalf(p.play, lineupData, idx, numHalves);
  });
  // parseHalf(game.plays.period[0].play, lineupData, 0, numHalves);
  // parseHalf(game.plays.period[1].play, lineupData, 1, numHalves);
  console.log('halves parsed');
  Object.keys(lineupData.lineups).forEach(lKey => {
    const lineup = lineupData.lineups[lKey];
    const { total, net } = lineup.stints.reduce((counts, stint) => {
      const duration = stint.end - stint.start;
      counts.total = counts.total + duration;
      counts.net = counts.net + stint.net;
      return counts;
    }, { total: 0, net: 0 });
    lineup.totalTime = total;
    lineup.totalNet = net;
  });
  console.log("lineupDatas", lineupData);
  return lineupData;
};

export default generateLineupData;
