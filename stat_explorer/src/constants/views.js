const LINEUP_VIEW = "Lineups";
const CLUTCH_VIEW = "Clutch";
const KILLS_VIEW = "Kills";
const GAMES_VIEW = "Games";
const EXHIBITIONS_VIEW = "Exhibitions";
const HOME_VIEW = "Home";
const ALMUNI_VIEW = "Alumni";
const COLLECTION_VIEW_TITLE = "Collection";
const views = [
    {
      title: HOME_VIEW,
      route: '/'
    },
    {
      title: LINEUP_VIEW,
      route: '/lineups',
      routeRoot: '/lineups',
    },
    {
      title: GAMES_VIEW,
      route: '/games',
      routeRoot: '/games',
    },
    {
      title: KILLS_VIEW,
      route: '/kills',
      routeRoot: '/kills',
    },
    {
      title: CLUTCH_VIEW,
      route: '/clutch',
      routeRoot: '/clutch',
    },
    {
      title: ALMUNI_VIEW,
      route: '/alumni',
      routeRoot: '/alumni',
    } 
  ];
// Added to the nav only while the `collection` feature flag is on.
const COLLECTION_VIEW = {
  title: COLLECTION_VIEW_TITLE,
  route: '/collection',
  routeRoot: '/collection',
};
// Added to the nav only while the `exhibitions` feature flag is on.
const EXHIBITIONS_NAV_VIEW = {
  title: EXHIBITIONS_VIEW,
  route: '/exhibitions',
  routeRoot: '/exhibitions',
};
// Added to the nav only while the `rankings` feature flag is on.
const RANKINGS_VIEW = {
  title: 'Rankings',
  route: '/rankings',
  routeRoot: '/rankings',
};
export { views, EXHIBITIONS_NAV_VIEW, RANKINGS_VIEW, COLLECTION_VIEW, COLLECTION_VIEW_TITLE, HOME_VIEW, LINEUP_VIEW, CLUTCH_VIEW, KILLS_VIEW, GAMES_VIEW, ALMUNI_VIEW };