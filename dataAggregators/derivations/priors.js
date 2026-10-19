// Pregame priors for the win-probability model, read from config/game-priors.csv (hand-maintained, one row per game).
//
// Columns (header row required; lines starting with # are ignored):
//   game_id            e.g. 2026-03-12-byu-at-houston
//   byu_net_rating     BYU's net rating (points per 100 poss, e.g. KenPom AdjEM)
//   opp_net_rating     the opponent's
//   site               home | away | neutral   (optional: taken from the game row when blank)
//   expected_margin    optional: BYU's expected margin directly; overrides the ratings
// expected BYU margin (mu) = byu_net_rating - opp_net_rating, plus/minus HOME_COURT_PTS at a non-neutral site.
// A game with no row has no prior: callers fall back to an even matchup (mu = 0) and say so in their output.
const fs = require('fs');
const path = require('path');

const HOME_COURT_PTS = 3.5;
const DEFAULT_FILE = path.join(__dirname, '..', 'config', 'game-priors.csv');

function loadPriors(file = DEFAULT_FILE) {
  if (!fs.existsSync(file)) return new Map();
  const lines = fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const [head, ...rows] = lines;
  if (!head) return new Map();
  const cols = head.split(',').map((c) => c.trim());
  const out = new Map();
  for (const line of rows) {
    const cells = line.split(',').map((c) => c.trim());
    const row = Object.fromEntries(cols.map((c, i) => [c, cells[i] === undefined || cells[i] === '' ? null : cells[i]]));
    if (row.game_id) out.set(row.game_id, row);
  }
  return out;
}

/** BYU's expected margin for a game row ({game_id, home_team_id, is_neutral_site}), or null with no usable prior. */
function expectedMargin(priors, game, focus = 'byu') {
  const row = priors.get(game.game_id);
  if (!row) return null;
  if (row.expected_margin !== null && Number.isFinite(Number(row.expected_margin))) return Number(row.expected_margin);
  const byu = Number(row.byu_net_rating), opp = Number(row.opp_net_rating);
  if (!Number.isFinite(byu) || !Number.isFinite(opp)) return null;
  const site = row.site || (game.is_neutral_site ? 'neutral' : game.home_team_id === focus ? 'home' : 'away');
  return byu - opp + (site === 'home' ? HOME_COURT_PTS : site === 'away' ? -HOME_COURT_PTS : 0);
}

module.exports = { loadPriors, expectedMargin, HOME_COURT_PTS, DEFAULT_FILE };
