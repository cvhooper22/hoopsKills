// Writes one StatBroadcast snapshot of a game into the normalized tables, incrementally: only plays that
// are new or whose content changed are upserted, plays the feed no longer has are deleted, and sequence
// numbers are re-derived only when something changed. Safe to call every few seconds.
const crypto = require('crypto');
const { resolvePlayer, seasonYear } = require('../lib/entities');
const { insertRaw, upsertGame, linkSourceGame } = require('../lib/store');
const { normalizeGame } = require('./parse');

const SOURCE = 'statbroadcast';

// "keita, keba" -> "Keba Keita"; short first names ("aj", "jj") are initials, so upper-case them.
function displayName(raw) {
  const cap = w => (w.length <= 2 || /^(iii|iv)$/.test(w) ? w.toUpperCase() : w.replace(/(^|[-'])([a-z])/g, (_, a, b) => a + b.toUpperCase()));
  const [last, ...rest] = raw.split(',');
  const first = rest.join(',').trim();
  return [first, last.trim()].filter(Boolean).map(s => s.split(/\s+/).map(cap).join(' ')).join(' ');
}

// "nebraska" -> "Nebraska", "kansas-st" -> "Kansas St": the name a team gets when the page doesn't give one
const titleCaseSlug = slug => slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const hashOf = o => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);

// Everything about a play except the parts that legitimately change between polls with no real change.
function contentHash(p, participants) {
  const { sequence_number, play_id, ...rest } = p;
  return hashOf({ rest, participants });
}

/**
 * ctx: { eventId, date, homeTeamId, awayTeamId, homeName, awayName, state: {playerCache: Map, gameId} }
 * Returns { gameId, header, changed, inserted, updated, deleted, playCount }.
 */
async function syncSnapshot(client, ctx, pageHtmls, { boxHtml = null } = {}) {
  const snap = normalizeGame(pageHtmls, {}, { boxHtml });
  const { header } = snap;
  if (header.sbEventId && header.sbEventId !== String(ctx.eventId)) {
    throw new Error(`page is for event ${header.sbEventId}, expected ${ctx.eventId}`);
  }

  await client.query('BEGIN');
  try {
    const gameId = await ensureGame(client, ctx, header);
    const teamBySide = { home: ctx.homeTeamId, away: ctx.awayTeamId };
    const cache = ctx.state.playerCache;

    // A play's player is {team: abbrev, name}; a lineup entry is {side, name}. Both end up as the same player id.
    const resolveNamed = async (teamId, name) => {
      const key = `${teamId}:${name}`;
      if (!cache.has(key)) cache.set(key, await resolvePlayer(client, SOURCE, key, displayName(name), teamId));
      return cache.get(key);
    };
    const resolve = ref => resolveNamed(teamBySide[snap.header.sideByAbbrev[ref.team]], ref.name);
    const resolveLineup = async list => (list ? Promise.all(list.filter(e => e.name).map(e => resolveNamed(teamBySide[e.side], e.name))) : null);

    // Participants grouped by play, with player ids resolved.
    const partsByPlay = new Map();
    for (const q of snap.participants) {
      const player_id = await resolve(q.player);
      if (!partsByPlay.has(q.source_play_id)) partsByPlay.set(q.source_play_id, []);
      partsByPlay.get(q.source_play_id).push({ player_id, role: q.role });
    }

    const existing = new Map((await client.query(
      `SELECT source_play_id, sources->'statbroadcast'->>'hash' AS hash FROM plays WHERE game_id = $1 AND source = $2`,
      [gameId, SOURCE])).rows.map(r => [r.source_play_id, r.hash]));

    const rows = [];
    let inserted = 0, updated = 0;
    for (const p of snap.plays) {
      const parts = partsByPlay.get(p.source_play_id) || [];
      const hash = contentHash(p, parts);
      const old = existing.get(p.source_play_id);
      if (old === hash) continue;
      old === undefined ? inserted++ : updated++;
      rows.push({ p, parts, hash });
    }

    const keep = snap.plays.map(p => p.source_play_id);
    const gone = [...existing.keys()].filter(id => !keep.includes(id));
    const changed = rows.length > 0 || gone.length > 0;

    if (changed) {
      // Keep the page only for periods that changed, so raw storage grows with plays, not with polls.
      const rawIds = new Map();
      for (const period of new Set(rows.map(r => r.p.period_number))) {
        const html = pageHtmls[header.periods.indexOf(period)];
        rawIds.set(period, await insertRaw(client, SOURCE, String(ctx.eventId), 'pxp_html', { period, html }));
      }
      for (const { p, parts, hash } of rows) {
        const playerId = p.player ? await resolve(p.player) : null;
        const lineups = { home: await resolveLineup(p.lineup_home), away: await resolveLineup(p.lineup_away) };
        await upsertPlay(client, gameId, p, hash, playerId, lineups, rawIds.get(p.period_number), teamBySide);
        await client.query('DELETE FROM play_participants WHERE play_id = $1', [`${gameId}-${p.source_play_id}`]);
        for (const q of parts) {
          await client.query(
            'INSERT INTO play_participants (play_id, player_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
            [`${gameId}-${p.source_play_id}`, q.player_id, q.role]);
        }
      }
      if (gone.length) await client.query('DELETE FROM plays WHERE game_id = $1 AND source = $2 AND source_play_id = ANY($3)', [gameId, SOURCE, gone]);
      await client.query(
        `UPDATE plays SET sequence_number = x.n
         FROM (SELECT play_id, row_number() OVER (ORDER BY period_number, (sources->'statbroadcast'->>'row')::int) AS n
               FROM plays WHERE game_id = $1) x
         WHERE plays.play_id = x.play_id AND plays.sequence_number <> x.n`, [gameId]);
      await client.query('DELETE FROM derivation_runs WHERE game_id = $1', [gameId]);
    }

    const last = snap.plays[snap.plays.length - 1];
    await client.query(
      `UPDATE games SET status = $2, final_score_home = $3, final_score_away = $4, winner_team_id = $5 WHERE game_id = $1`,
      [gameId, header.isFinal ? 'final' : 'live', last.home_score_after, last.away_score_after,
        header.isFinal && last.home_score_after !== last.away_score_after
          ? (last.home_score_after > last.away_score_after ? ctx.homeTeamId : ctx.awayTeamId) : null]);
    await client.query(
      `INSERT INTO live_game_state (game_id, source, source_game_id, status_text, period_number, clock_display, home_score,
         away_score, play_count, last_polled_at, last_changed_at, consecutive_failures, last_error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), now(), 0, NULL)
       ON CONFLICT (game_id) DO UPDATE SET status_text = EXCLUDED.status_text, period_number = EXCLUDED.period_number,
         clock_display = EXCLUDED.clock_display, home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score,
         play_count = EXCLUDED.play_count, last_polled_at = now(), consecutive_failures = 0, last_error = NULL,
         last_changed_at = CASE WHEN $10 THEN now() ELSE live_game_state.last_changed_at END`,
      [gameId, SOURCE, String(ctx.eventId), header.statusText, last.period_number, last.clock_display,
        last.home_score_after, last.away_score_after, snap.plays.length, changed]);
    if (changed) {
      await client.query('SELECT pg_notify($1, $2)', ['live_game_updated',
        JSON.stringify({ gameId, playCount: snap.plays.length, final: header.isFinal })]);
    }
    await client.query('COMMIT');
    ctx.state.gameId = gameId;
    return { gameId, header, changed, inserted, updated, deleted: gone.length, playCount: snap.plays.length,
      warnings: snap.warnings, checks: snap.checks, unmapped: snap.unmapped };
  } catch (err) {
    await client.query('ROLLBACK');
    // Players resolved inside the transaction that just rolled back were never saved, but their ids are in the cache:
    // keeping them would make every later snapshot fail on plays.player_id. Start the next attempt from the database.
    ctx.state.playerCache.clear();
    throw err;
  }
}

async function ensureGame(client, ctx, header) {
  if (ctx.state.gameId) return ctx.state.gameId;
  for (const [id, name] of [[ctx.homeTeamId, header.homeName || ctx.homeName], [ctx.awayTeamId, header.awayName || ctx.awayName]]) {
    await client.query('INSERT INTO teams (team_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, name]);
  }
  const mapped = await client.query('SELECT game_id FROM source_games WHERE source = $1 AND source_game_id = $2', [SOURCE, String(ctx.eventId)]);
  const gameId = mapped.rows.length ? mapped.rows[0].game_id : `${ctx.date}-${ctx.awayTeamId}-at-${ctx.homeTeamId}`;
  await upsertGame(client, {
    gameId, date: ctx.date, tipoffLocal: null, venueTz: null, seasonYear: seasonYear(ctx.date),
    homeTeamId: ctx.homeTeamId, awayTeamId: ctx.awayTeamId, isNeutralSite: null, isConferenceGame: null,
    venue: null, attendance: null, finalScoreHome: null, finalScoreAway: null, winnerTeamId: null,
    status: 'live', source: SOURCE,
  });
  await linkSourceGame(client, SOURCE, String(ctx.eventId), gameId, 'manual');
  return gameId;
}

const PLAY_COLS = ['play_id', 'game_id', 'sequence_number', 'source', 'source_play_id', 'source_play_ref', 'period_number',
  'period_type', 'clock_seconds_remaining', 'clock_display', 'game_seconds_elapsed', 'team_id', 'team_side',
  'is_neutral_event', 'player_id', 'play_category', 'play_type', 'play_subtype', 'play_description', 'home_score_after',
  'away_score_after', 'shot_value', 'is_shot_attempt', 'is_made', 'made_is_inferred', 'is_assisted', 'linked_play_id',
  'play_qualifiers', 'lineup_home', 'lineup_away', 'sources', 'extra'];
const UPSERT = `INSERT INTO plays (${PLAY_COLS.join(',')}) VALUES (${PLAY_COLS.map((_, i) => '$' + (i + 1)).join(',')})
  ON CONFLICT (play_id) DO UPDATE SET ${PLAY_COLS.slice(1).map(c => `${c} = EXCLUDED.${c}`).join(',')}`;

async function upsertPlay(client, gameId, p, hash, playerId, lineups, rawId, teamBySide) {
  const playId = `${gameId}-${p.source_play_id}`;
  const row = {
    ...p,
    play_id: playId,
    game_id: gameId,
    source_play_ref: `raw:${rawId}:period:${p.period_number}:row:${p.sources.statbroadcast.row}`,
    team_id: p.team_side ? teamBySide[p.team_side] : null,
    player_id: playerId,
    lineup_home: lineups.home,
    lineup_away: lineups.away,
    linked_play_id: p.linked_play_id ? `${gameId}-${p.linked_play_id}` : null,
    sources: { statbroadcast: { ...p.sources.statbroadcast, hash } },
    extra: { ...p.extra, player_ref: p.player || null, team_abbrev: p.team_abbrev },
  };
  await client.query(UPSERT, PLAY_COLS.map(c => (c === 'sources' || c === 'extra' ? JSON.stringify(row[c]) : row[c])));
}

module.exports = { syncSnapshot, displayName, titleCaseSlug, SOURCE };
