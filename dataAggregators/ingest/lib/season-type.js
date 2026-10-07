// Sets games.season_type / is_postseason (regular | conf_tourney | postseason) from the per-season
// markers in config/season-boundaries.json. WMT carries no season type, so the markers are the
// source of truth; they win over anything already on the row. Seasons without markers are left alone.
// A conference tournament game is a conference game even where the source says otherwise (WMT
// flags the Big 12 tournament as non-conference; ESPN flags it as conference).
const fs = require('fs');
const path = require('path');

const CONFIG = path.join(__dirname, '../../config/season-boundaries.json');

function loadBoundaries(file = CONFIG) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
}

// `dates` are YYYY-MM-DD strings, which compare correctly as text.
function classify(date, { confTourneyAfter, postseasonAfter }) {
  if (postseasonAfter && date > postseasonAfter) return 'postseason';
  if (confTourneyAfter && date > confTourneyAfter) return 'conf_tourney';
  return 'regular';
}

async function markerDate(client, gameId) {
  if (!gameId) return null;
  const { rows } = await client.query(`SELECT to_char(game_date, 'YYYY-MM-DD') AS d FROM games WHERE game_id = $1`, [gameId]);
  if (!rows.length) throw new Error(`season-boundaries marker ${gameId} is not in the games table`);
  return rows[0].d;
}

// Apply to every game of every configured season, or just one game. Returns the games it changed.
async function applySeasonTypes(client, { gameId = null, boundaries = loadBoundaries() } = {}) {
  const changed = [];
  for (const [season, markers] of Object.entries(boundaries)) {
    const bounds = {
      confTourneyAfter: await markerDate(client, markers.confTourneyStartsAfter),
      postseasonAfter: await markerDate(client, markers.postseasonStartsAfter),
    };
    const { rows } = await client.query(
      `SELECT game_id, to_char(game_date, 'YYYY-MM-DD') AS d, season_type, is_postseason, is_conference_game
       FROM games WHERE season_year = $1 ${gameId ? 'AND game_id = $2' : ''}`,
      gameId ? [Number(season), gameId] : [Number(season)]);
    for (const g of rows) {
      const type = classify(g.d, bounds);
      const isPostseason = type !== 'regular';
      const isConference = type === 'conf_tourney' ? true : g.is_conference_game;
      if (g.season_type === type && g.is_postseason === isPostseason && g.is_conference_game === isConference) continue;
      await client.query(
        `UPDATE games SET season_type = $2, is_postseason = $3, is_conference_game = $4 WHERE game_id = $1`,
        [g.game_id, type, isPostseason, isConference]);
      changed.push({ gameId: g.game_id, seasonType: type });
    }
  }
  return changed;
}

module.exports = { loadBoundaries, classify, applySeasonTypes };
