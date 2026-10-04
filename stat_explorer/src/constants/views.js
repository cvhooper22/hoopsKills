const LINEUP_VIEW = "Lineups";
const CLUTCH_VIEW = "Clutch";
const KILLS_VIEW = "Kills";
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
export { views, COLLECTION_VIEW, COLLECTION_VIEW_TITLE, HOME_VIEW, LINEUP_VIEW, CLUTCH_VIEW, KILLS_VIEW, ALMUNI_VIEW };