// Resolves source entities (teams, players, games) to stable internal ids.
const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');

const TEAM_CONFIG = path.join(__dirname, '..', '..', 'config', 'teams.json');

async function seedTeamsFromConfig(client) {
  const teams = JSON.parse(fs.readFileSync(TEAM_CONFIG, 'utf8'));
  for (const [teamId, t] of Object.entries(teams)) {
    await client.query(
      `INSERT INTO teams (team_id, name, abbrev) VALUES ($1, $2, $3)
       ON CONFLICT (team_id) DO UPDATE SET name = EXCLUDED.name, abbrev = EXCLUDED.abbrev`,
      [teamId, t.name, t.abbrev || null]);
    for (const [source, externalId] of Object.entries(t.external || {})) {
      await client.query(
        `INSERT INTO team_external_ids (team_id, source, external_id) VALUES ($1, $2, $3)
         ON CONFLICT (team_id, source) DO UPDATE SET external_id = EXCLUDED.external_id`,
        [teamId, source, String(externalId)]);
    }
  }
}

// Existing mapping wins. A new team gets a slug from its name; a clash stops the ingest.
async function resolveTeam(client, source, externalId, name) {
  const found = await client.query(
    'SELECT team_id FROM team_external_ids WHERE source = $1 AND external_id = $2', [source, externalId]);
  if (found.rows.length) return found.rows[0].team_id;

  const teamId = slugify(name);
  const clash = await client.query('SELECT 1 FROM teams WHERE team_id = $1', [teamId]);
  if (clash.rows.length) {
    throw new Error(`Team slug "${teamId}" (from "${name}", ${source} id ${externalId}) already exists ` +
      `without a ${source} mapping. Add it to config/teams.json or pick a different slug.`);
  }
  await client.query('INSERT INTO teams (team_id, name) VALUES ($1, $2)', [teamId, name]);
  await client.query('INSERT INTO team_external_ids (team_id, source, external_id) VALUES ($1, $2, $3)',
    [teamId, source, externalId]);
  return teamId;
}

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
function nameKey(name) {
  return slugify(name).split('-').filter(p => !NAME_SUFFIXES.has(p)).join('-');
}

// Same last name, and one first name is the start of the other ("chris" / "christian").
function sameLastNameFirstPrefix(a, b) {
  const ka = nameKey(a).split('-'), kb = nameKey(b).split('-');
  if (ka.length < 2 || kb.length < 2 || ka[ka.length - 1] !== kb[kb.length - 1]) return false;
  const [fa, fb] = [ka[0], kb[0]];
  return Math.min(fa.length, fb.length) >= 3 && (fa.startsWith(fb) || fb.startsWith(fa));
}

const notes = [];
function drainNotes() { return notes.splice(0, notes.length); }

// Existing mapping wins. Otherwise, with a team known, a player already seen for that team (from
// another source) with the same name (ignoring Jr./III) gets this source's id attached. Otherwise a
// new player is created; slugs get a numeric suffix on a clash, and the mapping is permanent.
async function resolvePlayer(client, source, externalId, name, teamId = null) {
  const found = await client.query(
    'SELECT player_id FROM player_external_ids WHERE source = $1 AND external_id = $2', [source, externalId]);
  if (found.rows.length) return found.rows[0].player_id;

  if (teamId) {
    const pool = (await client.query(
      `SELECT p.player_id, p.name FROM players p
       WHERE EXISTS (SELECT 1 FROM plays WHERE player_id = p.player_id AND team_id = $1)
         AND NOT EXISTS (SELECT 1 FROM player_external_ids e WHERE e.player_id = p.player_id AND e.source = $2)`,
      [teamId, source])).rows;
    let cands = pool.filter(c => nameKey(c.name) === nameKey(name));
    if (!cands.length) cands = pool.filter(c => sameLastNameFirstPrefix(c.name, name)); // Chris / Christian
    if (cands.length === 1) {
      await client.query('INSERT INTO player_external_ids (player_id, source, external_id) VALUES ($1, $2, $3)',
        [cands[0].player_id, source, externalId]);
      if (cands[0].name !== name) notes.push(`matched ${source} player "${name}" to existing "${cands[0].name}" (${cands[0].player_id})`);
      return cands[0].player_id;
    }
    if (cands.length > 1) {
      throw new Error(`${source} player "${name}" (${externalId}) matches several existing players on ${teamId}: ` +
        cands.map(c => c.player_id).join(', '));
    }
    if (pool.length) {
      notes.push(`NEW ${source} player "${name}" on ${teamId} matched no existing player; unmatched there: ` +
        pool.map(c => c.name).join(', '));
    }
  }

  const base = slugify(name);
  let playerId = base;
  for (let n = 2; ; n++) {
    const clash = await client.query('SELECT 1 FROM players WHERE player_id = $1', [playerId]);
    if (!clash.rows.length) break;
    playerId = `${base}-${n}`;
  }
  await client.query('INSERT INTO players (player_id, name) VALUES ($1, $2)', [playerId, name]);
  await client.query('INSERT INTO player_external_ids (player_id, source, external_id) VALUES ($1, $2, $3)',
    [playerId, source, externalId]);
  if (teamId && playerId !== base) notes.push(`created ${source} player "${name}" as ${playerId} (slug clash)`);
  return playerId;
}

// Resolves every team in a game. A team with no mapping for this source is matched through an
// existing game: if a mapped team (usually BYU) already has one game within a day of this date, its
// opponent there is the same team. Otherwise a new team is created from the name (a slug clash stops).
async function resolveTeams(client, source, comps, date) {
  const out = new Map();
  const unmapped = [];
  for (const c of comps) {
    const r = await client.query(
      'SELECT team_id FROM team_external_ids WHERE source = $1 AND external_id = $2', [source, c.externalId]);
    if (r.rows.length) out.set(c.externalId, r.rows[0].team_id); else unmapped.push(c);
  }
  for (const c of unmapped) {
    const known = [...out.values()];
    let teamId = null;
    if (known.length) {
      const opp = (await client.query(
        `SELECT DISTINCT CASE WHEN home_team_id = ANY($1::text[]) THEN away_team_id ELSE home_team_id END AS opp
         FROM games
         WHERE (home_team_id = ANY($1::text[]) OR away_team_id = ANY($1::text[]))
           AND game_date BETWEEN $2::date - 1 AND $2::date + 1`, [known, date])).rows
        .filter(r => !known.includes(r.opp));
      if (opp.length === 1) {
        const has = await client.query(
          'SELECT 1 FROM team_external_ids WHERE team_id = $1 AND source = $2', [opp[0].opp, source]);
        if (!has.rows.length) {
          await client.query('INSERT INTO team_external_ids (team_id, source, external_id) VALUES ($1, $2, $3)',
            [opp[0].opp, source, c.externalId]);
          notes.push(`mapped ${source} team ${c.externalId} "${c.name}" to existing ${opp[0].opp} via the game on ${date}`);
          teamId = opp[0].opp;
        }
      }
    }
    out.set(c.externalId, teamId || await resolveTeam(client, source, c.externalId, c.name));
  }
  return out;
}

function seasonYear(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return m >= 8 ? y : y - 1;
}

// Existing source_games row wins. Otherwise same team pair within one day matches;
// several candidates stops the ingest; none creates the game.
async function resolveGame(client, source, sourceGameId, g) {
  const mapped = await client.query(
    'SELECT game_id FROM source_games WHERE source = $1 AND source_game_id = $2', [source, sourceGameId]);
  if (mapped.rows.length) return { gameId: mapped.rows[0].game_id, created: false, matchedBy: 'existing' };

  const cand = await client.query(
    `SELECT game_id, to_char(game_date, 'YYYY-MM-DD') AS game_date FROM games
     WHERE ((home_team_id = $1 AND away_team_id = $2) OR (home_team_id = $2 AND away_team_id = $1))
       AND game_date BETWEEN $3::date - 1 AND $3::date + 1`,
    [g.homeTeamId, g.awayTeamId, g.date]);
  if (cand.rows.length > 1) {
    throw new Error(`Game ${source}:${sourceGameId} matches several games: ${cand.rows.map(r => r.game_id).join(', ')}`);
  }
  if (cand.rows.length === 1) {
    return { gameId: cand.rows[0].game_id, created: false, matchedBy: 'auto', flagged: cand.rows[0].game_date !== g.date };
  }
  return { gameId: `${g.date}-${g.awayTeamId}-at-${g.homeTeamId}`, created: true, matchedBy: 'auto' };
}

module.exports = { seedTeamsFromConfig, resolveTeam, resolveTeams, resolvePlayer, resolveGame, seasonYear, drainNotes };
