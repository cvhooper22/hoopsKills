import urls from './assetUrls';

const games = [
  {
    name: "Idaho State",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/idst.webp`,
    id: "1299924",
    path: "idaho-st",
    order: 1,
  },
  {
    name: "San Diego State (A)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/sdsu.webp`,
    id: '1299925',
    path: "sdsu",
    order: 2,
  },
  {
    name: "Missouri State",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/most.webp`,
    id: "1300377",
    path: "mo-st",
    order: 3,
  },
  {
    name: "Nicholls",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/nicholls.webp`,
    id: "1300378",
    path: "nicholls",
    order: 4,
  },
  {
    name: "USC (N)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/usc.webp`,
    id: "1300379",
    path: "usc",
    order: 5,
  },
  {
    name: "Butler",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/butler.webp`,
    id: "1300382",
    path: "butler",
    order: 6,
  },
  {
    name: "Dayton (N)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/dayton.webp`,
    id: "1300383",
    path: "dayton",
    order: 7,
  },
  {
    name: "South Dakota",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/southdakota.webp`,
    id: "1300532",
    path: "south-dakota",
    order: 8,
  },
  {
    name: "UVU",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/uvu.webp`,
    id: "1300384",
    path: "uvu",
    order: 9,
  },
  {
    name: "Creighton (N)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/creighton.webp`,
    id: "1300389",
    path: "creighton",
    order: 10,
  },
  {
    name: "Utah",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/utah.webp`,
    id: "1300385",
    path: "utah",
    order: 11,
  },
  {
    name: "Lindenwood",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/lindenwood.webp`,
    id: "1300386",
    path: "lindenwood",
    order: 12,
  },
  {
    name: "Weber State",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/weberst.webp`,
    id: "1300387",
    path: "weber-st",
    order: 13,
  },
  {
    name: "Pacific (A)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/pacific.webp`,
    id: "1300198",
    path: "pacific-a",
    order: 14,
  },
  {
    name: "Portland",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/portland.webp`,
    id: "1300200",
    path: "portland",
    order: 15,
  },
  {
    name: "Loyola Marymount (A)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/lmu.webp`,
    id: "1300201",
    path: "lmu-a",
    order: 16,
  },
  {
    name: "San Diego (A)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/sandiego.webp`,
    id: "1300202",
    path: "usd-a",
    order: 17,
  },
  {
    name: "Gonzaga",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/gonzaga.webp`,
    id: "1300204",
    path: "gonzaga",
    order: 18,
  },
  {
    name: "Pepperdine",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/pepperdine.webp`,
    id: "1300215",
    path: "pepp",
    order: 19,
  },
  {
    name: "Santa Clara (A)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/santaclara.webp`,
    id: "1300216",
    path: "santa-clara-a",
    order: 20,
  },
  {
    name: "San Francisco (A)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/usf.webp`,
    id: "1300217",
    path: "san-fran-a",
    order: 21,
  },
  {
    name: "Saint Mary's",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/smc.webp`,
    id: "1300218",
    path: "smc",
    order: 22,
  },
  {
    name: "Loyola Marymount",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/lmu.webp`,
    id: "1300219",
    path: "lmu",
    order: 23,
  },
  {
    name: "Pacific",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/pacific.webp`,
    id: "1300220",
    path: "pacific",
    order: 24,
  },
  {
    name: "Pepperdine (A)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/pepperdine.webp`,
    id: "1300221",
    path: "pepp-a",
    order: 25,
  },
  {
    name: "Gonzaga (A)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/gonzaga.webp`,
    id: "1300222",
    path: "gonzaga-a",
    order: 26,
  },
  {
    name: "Santa Clara",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/santaclara.webp`,
    id: "1300223",
    path: "santa-clara",
    order: 27,
  },
  {
    name: "Saint Mary's (A)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/smc.webp`,
    id: "1300224",
    path: "smc-a",
    order: 28,
  },
  {
    name: "San Francisco",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/usf.webp`,
    id: "1300225",
    path: "san-fran",
    order: 29,
  },
  {
    name: "Portland (WCC)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/portland.webp`,
    id: "1302986",
    path: "portland-wcc",
    order: 30,
  },
  {
    name: "Loyola Marymount (WCC)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/lmu.webp`,
    id: "1303030",
    path: "lmu-wcc",
    order: 31,
  },
  {
    name: "Saint Mary's (WCC)",
    imageSrc: `${urls.assetBase}/${urls.logosPath}/smc.webp`,
    id: "1303044",
    path: "smc-wcc",
    order: 32,
  },
];

export const gameNameToUrl = {
    "Idaho State": `${urls.assetBase}/${urls.logosPath}/idst.webp`,
    "San Diego State (A)": `${urls.assetBase}/${urls.logosPath}/sdsu.webp`,
    "Missouri State": `${urls.assetBase}/${urls.logosPath}/most.webp`,
    "Nicholls": `${urls.assetBase}/${urls.logosPath}/nicholls.webp`,
    "USC (N)": `${urls.assetBase}/${urls.logosPath}/usc.webp`,
    "Butler": `${urls.assetBase}/${urls.logosPath}/butler.webp`,
    "Dayton (N)": `${urls.assetBase}/${urls.logosPath}/dayton.webp`,
    "South Dakota": `${urls.assetBase}/${urls.logosPath}/southdakota.webp`,
    "UVU": `${urls.assetBase}/${urls.logosPath}/uvu.webp`,
    "Creighton (N)": `${urls.assetBase}/${urls.logosPath}/creighton.webp`,
    "Utah": `${urls.assetBase}/${urls.logosPath}/utah.webp`,
    "Lindenwood": `${urls.assetBase}/${urls.logosPath}/lindenwood.webp`,
    "Weber State": `${urls.assetBase}/${urls.logosPath}/weberst.webp`,
    "Pacific (A)": `${urls.assetBase}/${urls.logosPath}/pacific.webp`,
    "Portland": `${urls.assetBase}/${urls.logosPath}/portland.webp`,
    "Portland (WCC)": `${urls.assetBase}/${urls.logosPath}/portland.webp`,
    "Loyola Marymount (A)": `${urls.assetBase}/${urls.logosPath}/lmu.webp`,
    "San Diego (A)": `${urls.assetBase}/${urls.logosPath}/sandiego.webp`,
    "Gonzaga": `${urls.assetBase}/${urls.logosPath}/gonzaga.webp`,
    "Pepperdine": `${urls.assetBase}/${urls.logosPath}/pepperdine.webp`,
    "Santa Clara (A)": `${urls.assetBase}/${urls.logosPath}/santaclara.webp`,
    "Santa Clara": `${urls.assetBase}/${urls.logosPath}/santaclara.webp`,
    "San Francisco (A)": `${urls.assetBase}/${urls.logosPath}/usf.webp`,
    "San Francisco": `${urls.assetBase}/${urls.logosPath}/usf.webp`,
    "Saint Mary's": `${urls.assetBase}/${urls.logosPath}/smc.webp`,
    "Saint Mary's (A)": `${urls.assetBase}/${urls.logosPath}/smc.webp`,
    "Saint Mary's (WCC)": `${urls.assetBase}/${urls.logosPath}/smc.webp`,
    "Loyola Marymount": `${urls.assetBase}/${urls.logosPath}/lmu.webp`,
    "Loyola Marymount (WCC)": `${urls.assetBase}/${urls.logosPath}/lmu.webp`,
    "Pacific": `${urls.assetBase}/${urls.logosPath}/pacific.webp`,
    "Pepperdine (A)": `${urls.assetBase}/${urls.logosPath}/pepperdine.webp`,
    "Gonzaga (A)": `${urls.assetBase}/${urls.logosPath}/gonzaga.webp`,
};

export function gameFromId (gameId) {
  const game = games.find(g => g.id === gameId);
  if (game) {
    return game;
  }
  return undefined;
}

export function gameFromName (gameName) {
  const game = games.find(g => g.name === gameName);
  if (game) {
    return game;
  }
  return undefined;
}

export function nameFromId (gameId) {
  const game = games.find(g => g.id === gameId);
  // console.log('nameFromId, id givem', gameId);
  if (game?.name) {
    return game.name;
  }
  return '';
}

export function idFromName (gameName) {
  const game = games.find(g => g.name === gameName);
  // console.log('nameFromId, id givem', gameId);
  if (game?.id) {
    return game.id;
  }
  return '';
}

export function nameFromPath (path) {
  const game = games.find(g => g.path === path);
  if (game?.name) {
    return game.name;
  }
  return '';
}

export function idFromPath (path) {
  // console.log('idFromPath, path given', path);
  const game = games.find(g => g.path === path);
  if (game?.id) {
    return game.id;
  }
  return '';
}
export default games;