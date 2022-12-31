function sortPlayersByName(a, b) {
  if (a > b) {
    return 1;
  }
  if (a < b) {
    return -1;
  }
  return 0;
}

function getLineupHash(lineup) {
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
  return lineup.reduce((agg, player) => {
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

function parseHalf(plays, lineupData) {
  let skipIndex = -1;
  // console.log("plays", plays);
  plays.forEach((play, index) => {
    // console.log("skipIndex", skipIndex);
    if (index > skipIndex) {
      // console.log("not a skip play");
      if (play.action === "SUB" && play.team === "BYU") {
        // console.log("it was a sub for BYU");
        const subData = collectSubs(plays, index);
        // console.log("subs collected", subData);
        const newLineup = formNewLineup(subData.subs, lineupData.currentLineup);
        // console.log('new lineup is now', newLineup);
        const newHash = getLineupHash(newLineup);
        // console.log('their new hash is', newHash);
        lineupData.currentLineup = newLineup;
        if (!lineupData.lineups[newHash]) {
          lineupData.lineups[newHash] = newLineup;
        }
        skipIndex = subData.lastSubIndex;
      }
    }
  });
}

const generateLineupData = (game) => {
  // console.log("gen lineups", game);
  const teamData = game.team.find((t) => t.id === "BYU");
  // console.log("teamData", teamData);
  const starters = getStarters(teamData.player);
  const starterNames = starters.map((s) => s.name.toUpperCase());
  const lineupData = {
    currentLineup: starterNames,
    starterHash: getLineupHash(starterNames),
    lineups: {
      [getLineupHash(starterNames)]: starterNames
    }
  };
  parseHalf(game.plays.period[0].play, lineupData);
  parseHalf(game.plays.period[1].play, lineupData);
  console.log("lineupDatas", lineupData);
  return lineupData;
};

export default generateLineupData;
