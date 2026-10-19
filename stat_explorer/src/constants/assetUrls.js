// Local preview of data that is not uploaded yet: set REACT_APP_PREVIEW_DATA_BASE (e.g.
// http://localhost:4444/data, i.e. public/data) to read the season kills and lineups files and the team
// lookup from there instead of the CloudFront. Everything else still comes from the CloudFront.
const previewBase = process.env.REACT_APP_PREVIEW_DATA_BASE;
const liveBase = process.env.REACT_APP_LIVE_BOX_BASE || 'http://127.0.0.1:4610';

const urls = {
  espnPhotoStart: 'https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full/',
  espnPhotoEnd: '.png&h=110&w=110&scale=crop',
  gameBoxScore: 'https://gamestats.byucougars.com/boxscore/',
  assetBase: 'https://dd0v7fgd2sjsh.cloudfront.net',
  logosPath: 'assets/logos',
  flagBasePath: `https://flagcdn.com/w40`, 
  pbpGame: id => `${urls.assetBase}/pbp/games/${id}.json`,
  pbpGameMeta: id => `${urls.assetBase}/pbp/games/${id}.meta.json`,
  killsGame: id => `${urls.assetBase}/kills/games/${id}.json`,
  killsSeason: season => `${previewBase || urls.assetBase}/kills/seasons/${season}.json`,
  killsSeasonsIndex: () => `${previewBase || urls.assetBase}/kills/seasons/index.json`,
  lineupsSeason: season => `${previewBase || urls.assetBase}/lineups/seasons/${season}.json`,
  lineupsSeasonsIndex: () => `${previewBase || urls.assetBase}/lineups/seasons/index.json`,
  teamsMeta: () => `${previewBase || urls.assetBase}/meta/teams.json`,
  clutchSeason: season => `${previewBase || urls.assetBase}/clutch/seasons/${season}.json`,
  clutchSeasonsIndex: () => `${previewBase || urls.assetBase}/clutch/seasons/index.json`,
  // Box scores are local-only for now: the prototype in dataAggregators/derivations writes them to public/data/box.
  boxGame: id => `${previewBase || '/data'}/box/${id}.json`,
  boxIndex: () => `${previewBase || '/data'}/box/index.json`,
  // In-game data comes from derivations/live-box-server.js (local only), not from the data CloudFront.
  liveGames: () => `${liveBase}/games`,
  liveBox: id => `${liveBase}/box/${id}`,
  liveBoxStream: id => `${liveBase}/box/${id}/stream`,
  clutchGame: id => `${urls.assetBase}/clutch/games/${id}.json`,
  lineupsGame: id => `${urls.assetBase}/lineups/games/${id}.json`,
  teamLogo: slug => `${urls.assetBase}/${urls.logosPath}/${slug}.png`,
  gamesIndex: () => `${urls.assetBase}/games/index.json`,
  alumJson: () => `${urls.assetBase}/data/alum.json`,
  flags: () => `${urls.assetBase}/data/flags.json`,
};

export default urls;