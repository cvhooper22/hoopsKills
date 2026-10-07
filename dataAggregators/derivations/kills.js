// The kill detector lives in the app (stat_explorer/src/utils/kills.js) and is the single source
// of truth. Node can require() an ES module, so this just re-exports it for the aggregation tools.
// detectKills(plays, defenseSide) -> { stops, streaks, kills, potentialKills, completion }
module.exports = require('../../stat_explorer/src/utils/kills.js');
