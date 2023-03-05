const games = [
  {
    name: "Idaho State",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Idaho%20State%20Bengals%20Logo.png",
    id: "1299924",
    path: "idaho-st",
    order: 1,
  },
  {
    name: "San Diego State (A)",
    imageSrc: 'https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/San_Diego_State_Aztecs_logo.svg_.png?itok=QvopGyHg',
    id: '1299925',
    path: "sdsu",
    order: 2,
  },
  {
    name: "Missouri State",
    imageSrc: 'https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Missouri_State_Athletics_logo.svg__0.png?itok=4amo9Ooi',
    id: "1300377",
    path: "mo-st",
    order: 3,
  },
  {
    name: "Nicholls",
    imageSrc: 'https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/Nicholls-State-University_0.png?itok=AiaVW_0m',
    id: "1300378",
    path: "nicholls",
    order: 4,
  },
  {
    name: "USC (N)",
    imageSrc: 'https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/interlock-cardinal-web_1.png?itok=ZMxm3tYp',
    id: "1300379",
    path: "usc",
    order: 5,
  },
  {
    name: "Butler",
    imageSrc: 'https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Butler_Bulldogs_logo.svg__1.png?itok=Qvi-BiDD',
    id: "1300382",
    path: "butler",
    order: 6,
  },
  {
    name: "Dayton (N)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/i%20%286%29_1.png?itok=5MfNUelP",
    id: "1300383",
    path: "dayton",
    order: 7,
  },
  {
    name: "South Dakota",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/South%20dakota%20univ%20logo.png?itok=vf5ujeZW",
    id: "1300532",
    path: "south-dakota",
    order: 8,
  },
  {
    name: "UVU",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/UVU_WolverineHead_1.png?itok=v4qgBD0A",
    id: "1300384",
    path: "uvu",
    order: 9,
  },
  {
    name: "Creighton (N)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Creighton_Bluejays_logo.svg__0.png?itok=pl6dDba0",
    id: "1300389",
    path: "creighton",
    order: 10,
  },
  {
    name: "Utah",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/University-of-Utah_0.png?itok=1_PXQ9yo",
    id: "1300385",
    path: "utah",
    order: 11,
  },
  {
    name: "Lindenwood",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/Lindenwood-University_0.png?itok=dvAPnpvE",
    id: "1300386",
    path: "lindenwood",
    order: 12,
  },
  {
    name: "Weber State",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/weber_state_primary_logo_0.png?itok=yMn4qv_8",
    id: "1300387",
    path: "weber-st",
    order: 13,
  },
  {
    name: "Pacific (A)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Pacific_Primary.png?itok=N0uI2x4p",
    id: "1300198",
    path: "pacific-a",
    order: 14,
  },
  {
    name: "Portland",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/NauticalMrk_2Clr_w.png?itok=MNek5uQu",
    id: "1300200",
    path: "portland",
    order: 15,
  },
  {
    name: "Loyola Marymount (A)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/LMU_Primary.png?itok=qoTvDhkP",
    id: "1300201",
    path: "lmu-a",
    order: 16,
  },
  {
    name: "San Diego (A)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/USD_0.png?itok=fAaWm7y6",
    id: "1300202",
    path: "usd-a",
    order: 17,
  },
  {
    name: "Gonzaga",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Gonzaga_Primary.png?itok=LcpDQizp",
    id: "1300204",
    path: "gonzaga",
    order: 18,
  },
  {
    name: "Pepperdine",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/pepp_0.png?itok=lc3Z2_eL",
    id: "1300215",
    path: "pepp",
    order: 19,
  },
  {
    name: "Santa Clara (A)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/school_logo_detail_page_0.png?itok=rmpq8YAE",
    id: "1300216",
    path: "santa-clara-a",
    order: 20,
  },
  {
    name: "San Francisco (A)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/usf_0.png?itok=eH1z_OPe",
    id: "1300217",
    path: "san-fran-a",
    order: 21,
  },
  {
    name: "Saint Mary's",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/SaintMarys_Primary.png?itok=z_9PneIT",
    id: "1300218",
    path: "smc",
    order: 22,
  },
  {
    name: "Loyola Marymount",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/LMU_Primary.png?itok=qoTvDhkP",
    id: "1300219",
    path: "lmu",
    order: 23,
  },
  {
    name: "Pacific",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Pacific_Primary.png?itok=N0uI2x4p",
    id: "1300220",
    path: "pacific",
    order: 24,
  },
  {
    name: "Pepperdine (A)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/pepp_0.png?itok=lc3Z2_eL",
    id: "1300221",
    path: "pepp-a",
    order: 25,
  },
  {
    name: "Gonzaga (A)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Gonzaga_Primary.png?itok=LcpDQizp",
    id: "1300222",
    path: "gonzaga-a",
    order: 26,
  },
  {
    name: "Santa Clara",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/school_logo_detail_page_0.png?itok=rmpq8YAE",
    id: "1300223",
    path: "santa-clara",
    order: 27,
  },
  {
    name: "Saint Mary's (A)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/SaintMarys_Primary.png?itok=z_9PneIT",
    id: "1300224",
    path: "smc-a",
    order: 28,
  },
  {
    name: "San Francisco",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/usf_0.png?itok=eH1z_OPe",
    id: "1300225",
    path: "san-fran",
    order: 29,
  },
  {
    name: "Portland (WCC)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/NauticalMrk_2Clr_w.png?itok=MNek5uQu",
    id: "1302986",
    path: "portland-wcc",
    order: 30,
  },
  {
    name: "Loyola Marymount (WCC)",
    imageSrc: "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/LMU_Primary.png?itok=qoTvDhkP",
    id: "1303030",
    path: "lmu-wcc",
    order: 31,
  },
];

export const gameNameToUrl = {
    "Idaho State": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Idaho%20State%20Bengals%20Logo.png",
    "San Diego State (A)": 'https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/San_Diego_State_Aztecs_logo.svg_.png?itok=QvopGyHg',
    "Missouri State": 'https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Missouri_State_Athletics_logo.svg__0.png?itok=4amo9Ooi',
    "Nicholls": 'https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/Nicholls-State-University_0.png?itok=AiaVW_0m',
    "USC (N)": 'https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/interlock-cardinal-web_1.png?itok=ZMxm3tYp',
    "Butler": 'https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Butler_Bulldogs_logo.svg__1.png?itok=Qvi-BiDD',
    "Dayton (N)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/i%20%286%29_1.png?itok=5MfNUelP",
    "South Dakota": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/South%20dakota%20univ%20logo.png?itok=vf5ujeZW",
    "UVU": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/UVU_WolverineHead_1.png?itok=v4qgBD0A",
    "Creighton (N)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Creighton_Bluejays_logo.svg__0.png?itok=pl6dDba0",
    "Utah": "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/University-of-Utah_0.png?itok=1_PXQ9yo",
    "Lindenwood": "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/Lindenwood-University_0.png?itok=dvAPnpvE",
    "Weber State": "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/weber_state_primary_logo_0.png?itok=yMn4qv_8",
    "Pacific (A)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Pacific_Primary.png?itok=N0uI2x4p",
    "Portland": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/NauticalMrk_2Clr_w.png?itok=MNek5uQu",
    "Portland (WCC)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/NauticalMrk_2Clr_w.png?itok=MNek5uQu",
    "Loyola Marymount (A)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/LMU_Primary.png?itok=qoTvDhkP",
    "San Diego (A)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/USD_0.png?itok=fAaWm7y6",
    "Gonzaga": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Gonzaga_Primary.png?itok=LcpDQizp",
    "Pepperdine": "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/pepp_0.png?itok=lc3Z2_eL",
    "Santa Clara (A)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/school_logo_detail_page_0.png?itok=rmpq8YAE",
    "Santa Clara": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/school_logo_detail_page_0.png?itok=rmpq8YAE",
    "San Francisco (A)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/usf_0.png?itok=eH1z_OPe",
    "San Francisco": "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/usf_0.png?itok=eH1z_OPe",
    "Saint Mary's": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/SaintMarys_Primary.png?itok=z_9PneIT",
    "Saint Mary's (A)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/SaintMarys_Primary.png?itok=z_9PneIT",
    "Loyola Marymount": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/LMU_Primary.png?itok=qoTvDhkP",
    "Loyola Marymount (WCC)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/LMU_Primary.png?itok=qoTvDhkP",
    "Pacific": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Pacific_Primary.png?itok=N0uI2x4p",
    "Pepperdine (A)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/files/university_logos/pepp_0.png?itok=lc3Z2_eL",
    "Gonzaga (A)": "https://byucougars.com/sites/default/files/styles/thumbnail/public/Athletic_Logo/Gonzaga_Primary.png?itok=LcpDQizp",
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