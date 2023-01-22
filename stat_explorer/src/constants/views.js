const LINEUP_VIEW = "Lineups";
const CLUTCH_VIEW = "Clutch";
const KILLS_VIEW = "Kills";
const HOME_VIEW = "Home";
const views = [
    {
      title: HOME_VIEW,
      route: '/'
    },
    {
      title: LINEUP_VIEW,
      route: '/lineups/san-fran-a'
    },
    {
      title: KILLS_VIEW,
      disabled: true,
      route: '/kills'
    },
    {
      title: CLUTCH_VIEW,
      disabled: true,
      route: '/clutch'
    } 
  ];
export { views, HOME_VIEW, LINEUP_VIEW, CLUTCH_VIEW, KILLS_VIEW };