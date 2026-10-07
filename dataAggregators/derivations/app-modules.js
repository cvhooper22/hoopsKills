// Loads the app's pure ES modules (stat_explorer/src/utils) into the Node tools via require().
// The app files are the single source of truth for kills logic; Node 22+ can require() them.
// Node prints a "module type not specified" warning for each one, which is only noise here.
process.removeAllListeners('warning');

const utils = '../../stat_explorer/src/utils';
module.exports = {
  kills: require(`${utils}/kills.js`),
  killsSummary: require(`${utils}/killsSummary.js`),
  killsSeason: require(`${utils}/killsSeason.js`),
};
