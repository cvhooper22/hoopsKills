const urls = {
  espnPhotoStart: 'https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full/',
  espnPhotoEnd: '.png&h=110&w=110&scale=crop',
  gameBoxScore: 'https://gamestats.byucougars.com/boxscore/',
  seasonLineups: 'https://dd0v7fgd2sjsh.cloudfront.net/seasonLineups.json',
  assetBase: 'https://dd0v7fgd2sjsh.cloudfront.net',
  logosPath: 'assets/logos',
  flagBasePath: `https://flagcdn.com/w40`, 
  pbpGame: id => `${urls.assetBase}/pbp/games/${id}.json`,
  pbpGameMeta: id => `${urls.assetBase}/pbp/games/${id}.meta.json`,
  killsGame: id => `${urls.assetBase}/kills/games/${id}.json`,
  clutchGame: id => `${urls.assetBase}/clutch/games/${id}.json`,
  lineupsGame: id => `${urls.assetBase}/lineups/games/${id}.json`,
  teamLogo: slug => `${urls.assetBase}/${urls.logosPath}/${slug}.png`,
  gamesIndex: () => `${urls.assetBase}/games/index.json`,
};

export default urls;