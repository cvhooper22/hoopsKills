// Single-game Villanova preview of the Lineups view (data from public/data/*.json).
// Hides the game sidebar, retitles the page, and tags the nav item "Preview".
// Turn off with REACT_APP_LINEUPS_DEMO=false in .env.local, or flip the default here.
export const LINEUPS_DEMO = process.env.REACT_APP_LINEUPS_DEMO !== 'false';
export const LINEUPS_DEMO_TITLE = 'Villanova';
