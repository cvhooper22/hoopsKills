const LINEUP_VIEW = "Lineups";
const CLUTCH_VIEW = "Clutch";
const KILLS_VIEW = "Kills";
const HOME_VIEW = "Home";
const ALMUNI_VIEW = "Alumni";
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
export { views, HOME_VIEW, LINEUP_VIEW, CLUTCH_VIEW, KILLS_VIEW, ALMUNI_VIEW };