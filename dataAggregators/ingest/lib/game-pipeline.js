// What is deployed for each game, and the steps that get a game there: build its files into a local stage
// directory, then upload them (plus the shared indexes and the season rollups) to S3. The pure parts (file
// layout, state classification) are exported for tests; the CLI is ingest/tools/game-pipeline.js and the
// admin page /admin/games drives that CLI. Everything here mirrors the manual steps in ../../README.md.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const fetch = require('node-fetch');

const ROOT = path.join(__dirname, '..', '..');          // dataAggregators/
const CDN = 'https://dd0v7fgd2sjsh.cloudfront.net';
const STAGE = process.env.HOOPS_STAGE_DIR || path.join(os.tmpdir(), 'hoops-stage');   // laid out like the S3 keys

// One entry per per-game file. `argv` builds the export command that writes `out` (or, for box, an out dir).
const GAME_FILES = [
  { step: 'plays', key: (id) => `pbp/games/${id}.json`, argv: (id, out) => ['ingest/tools/export-game-plays.js', id, out] },
  { step: 'meta', key: (id) => `pbp/games/${id}.meta.json`, argv: (id, out) => ['ingest/tools/export-game-meta.js', id, out] },
  { step: 'kills', key: (id) => `kills/games/${id}.json`, argv: (id, out) => ['ingest/tools/export-game-kills.js', id, out] },
  { step: 'clutch', key: (id) => `clutch/games/${id}.json`, argv: (id, out) => ['ingest/tools/export-game-clutch.js', id, out] },
  { step: 'lineups', key: (id) => `lineups/games/${id}.json`, argv: (id, out) => ['ingest/tools/export-game-lineups.js', id, out] },
  { step: 'box', key: (id) => `box/games/${id}.json`, box: true },
];
const STEPS = GAME_FILES.map((f) => f.step);
const ROLLUPS = ['kills', 'clutch', 'lineups'];
// The site's game pages read pbp (plays, meta) and box directly. The per-game kills / clutch / lineups files are only
// inputs to the season rollups, which leave exhibitions out, so an exhibition doesn't need them on S3.
const needsFile = (step, isExhibition) => !(isExhibition && ROLLUPS.includes(step));
const SHARED_KEYS = { gamesIndex: 'games/index.json', teams: 'meta/teams.json', boxIndex: 'box/index.json' };

const stagePath = (key) => path.join(STAGE, key);

// ---- pure ----

// Where a game stands. `ingestedAt` / `uploadedAt` are epoch ms (or null).
//   live          the game is still being collected
//   not-deployed  none of its files are on S3
//   partial       some files, the games index entry, or an expected season rollup entry is missing
//   stale         everything is there but the data was ingested after the newest upload
//   deployed      everything is there and nothing newer is waiting
function classify({ live, filesPresent, inIndex, missingRollups, ingestedAt, uploadedAt }) {
  if (live) return 'live';
  const have = filesPresent.filter(Boolean).length;
  if (have === 0) return 'not-deployed';
  if (have < filesPresent.length || !inIndex || missingRollups.length) return 'partial';
  if (ingestedAt && uploadedAt && ingestedAt > uploadedAt) return 'stale';
  return 'deployed';
}

// Ids that appear in a season rollup file (kills/clutch use byGame[], lineups uses games{}).
function rollupGameIds(season) {
  if (!season) return null;
  if (Array.isArray(season.byGame)) return new Set(season.byGame.map((g) => g.gameId));
  if (season.games && typeof season.games === 'object') return new Set(Object.keys(season.games));
  return null;
}

// ---- process helpers ----

function run(argv, { log = console.log, cwd = ROOT } = {}) {
  return new Promise((resolve, reject) => {
    log(`$ node ${argv.join(' ')}`);
    const child = spawn('node', argv, { cwd });
    let tail = '';
    const onData = (d) => {
      String(d).split('\n').filter(Boolean).forEach((l) => { log(`  ${l}`); tail = l; });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${argv[0]} exited ${code}: ${tail}`))));
  });
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

async function head(key) {
  try {
    const res = await fetch(`${CDN}/${key}`, { method: 'HEAD' });
    if (!res.ok) return { exists: false };
    const lm = res.headers.get('last-modified');
    return { exists: true, lastModified: lm ? new Date(lm).toISOString() : null, bytes: Number(res.headers.get('content-length')) || null };
  } catch (e) {
    return { exists: false, error: e.message };
  }
}

async function getJson(key) {
  try {
    const res = await fetch(`${CDN}/${key}`);
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}

// ---- status ----

async function status(client) {
  const { rows } = await client.query(`
    SELECT g.game_id, to_char(g.game_date, 'YYYY-MM-DD') AS date, g.season_year, g.status, g.primary_source,
           g.home_team_id, g.away_team_id, ht.name AS home_name, at.name AS away_name,
           g.final_score_home, g.final_score_away,
           (SELECT count(*)::int FROM plays p WHERE p.game_id = g.game_id) AS plays,
           (SELECT max(r.fetched_at) FROM raw_payloads r JOIN source_games s
              ON s.source = r.source AND s.source_game_id = r.source_game_id WHERE s.game_id = g.game_id) AS last_ingest,
           (SELECT coalesce(json_object_agg(s.source, s.source_game_id), '{}'::json) FROM source_games s WHERE s.game_id = g.game_id) AS sources
    FROM games g JOIN teams ht ON ht.team_id = g.home_team_id JOIN teams at ON at.team_id = g.away_team_id
    ORDER BY g.game_date DESC, g.game_id DESC`);

  const seasons = [...new Set(rows.map((g) => g.season_year))];
  const [index, ...rollupFiles] = await Promise.all([
    getJson(SHARED_KEYS.gamesIndex),
    ...seasons.flatMap((y) => ROLLUPS.map((k) => getJson(`${k}/seasons/${y}.json`))),
  ]);
  const indexById = new Map((index || []).map((g) => [g.gameId, g]));
  const rollupIds = {};                                    // `${kind}:${year}` -> Set | null
  seasons.forEach((y, i) => ROLLUPS.forEach((k, j) => { rollupIds[`${k}:${y}`] = rollupGameIds(rollupFiles[i * ROLLUPS.length + j]); }));

  const keys = rows.flatMap((g) => GAME_FILES.map((f) => ({ id: g.game_id, step: f.step, key: f.key(g.game_id) })));
  const heads = await pool(keys, 12, (k) => head(k.key));
  const headBy = new Map(keys.map((k, i) => [`${k.id}:${k.step}`, heads[i]]));
  const shared = {};
  for (const [name, key] of Object.entries(SHARED_KEYS)) shared[name] = await head(key);

  const games = rows.map((g) => {
    const files = {};
    const entry = indexById.get(g.game_id);
    const isExhibition = !!(entry && entry.isExhibition);
    for (const f of GAME_FILES) {
      const h = headBy.get(`${g.game_id}:${f.step}`);
      const sp = stagePath(f.key(g.game_id));
      files[f.step] = { required: needsFile(f.step, isExhibition), deployed: h.exists, lastModified: h.lastModified || null,
        olderThanIngest: !!(h.lastModified && g.last_ingest && Date.parse(h.lastModified) < Date.parse(g.last_ingest)),
        staged: fs.existsSync(sp) ? fs.statSync(sp).mtime.toISOString() : null };
    }
    const inRollups = {};
    const missingRollups = [];
    for (const k of ROLLUPS) {
      const ids = rollupIds[`${k}:${g.season_year}`];
      inRollups[k] = ids ? ids.has(g.game_id) : null;      // null: that season file isn't on S3 or isn't readable
      // Exhibitions are left out of the season rollups on purpose.
      if (ids && !ids.has(g.game_id) && !isExhibition && g.plays > 0) missingRollups.push(k);
    }
    const uploads = Object.values(files).map((f) => f.lastModified).filter(Boolean).map((d) => Date.parse(d));
    const state = g.plays === 0 ? 'no-plays' : classify({
      live: g.status === 'live',
      filesPresent: STEPS.filter((s) => files[s].required).map((s) => files[s].deployed),
      inIndex: !!entry,
      missingRollups,
      ingestedAt: g.last_ingest ? Date.parse(g.last_ingest) : null,
      uploadedAt: uploads.length ? Math.max(...uploads) : null,   // newest upload: anything exported after the last ingest means a deploy followed it
    });
    const stagedAll = STEPS.every((s) => files[s].staged);
    const stagedBehind = stagedAll && g.last_ingest && STEPS.some((s) => Date.parse(files[s].staged) < Date.parse(g.last_ingest));
    return {
      gameId: g.game_id, date: g.date, seasonYear: g.season_year, status: g.status, primarySource: g.primary_source,
      home: g.home_name, away: g.away_name, homeId: g.home_team_id, awayId: g.away_team_id,
      score: g.final_score_home === null ? null : `${g.final_score_home}-${g.final_score_away}`,
      plays: g.plays, lastIngest: g.last_ingest ? new Date(g.last_ingest).toISOString() : null, sources: g.sources,
      state, files, inIndex: !!entry, isExhibition, inRollups, missingRollups,
      stagedAll, stagedBehind: !!stagedBehind,
    };
  });
  const seasonInfo = {};
  seasons.forEach((y, i) => ROLLUPS.forEach((k, j) => {
    const f = rollupFiles[i * ROLLUPS.length + j];
    seasonInfo[`${k}:${y}`] = f ? { generatedAt: f.generatedAt || null, games: f.gamesIncluded ?? null } : null;
  }));
  return { generatedAt: new Date().toISOString(), cdn: CDN, stageDir: STAGE, games, shared, seasons: seasonInfo };
}

// ---- build ----

const mkdirFor = (file) => fs.mkdirSync(path.dirname(file), { recursive: true });

async function buildGame(gameId, steps, log) {
  for (const s of steps) if (!STEPS.includes(s)) throw new Error(`unknown step "${s}" (known: ${STEPS.join(', ')})`);
  for (const f of GAME_FILES.filter((x) => steps.includes(x.step))) {
    const out = stagePath(f.key(gameId));
    mkdirFor(out);
    if (f.box) {   // the box exporter rewrites box/index.json with only this game, so it goes to a scratch dir
      const tmp = path.join(STAGE, '_box', gameId);
      fs.rmSync(tmp, { recursive: true, force: true });
      await run(['ingest/tools/export-game-box.js', gameId, '--out-dir', tmp], { log });
      fs.copyFileSync(path.join(tmp, 'box', 'games', `${gameId}.json`), out);
      fs.rmSync(tmp, { recursive: true, force: true });
    } else {
      await run(f.argv(gameId, out), { log });
    }
  }
  log(`built ${steps.join(', ')} for ${gameId} in ${STAGE}`);
}

// ---- deploy ----

async function upload(key, log) {
  const file = stagePath(key);
  if (!fs.existsSync(file)) throw new Error(`nothing staged for ${key}: build first`);
  await run(['ingest/tools/upload.js', file, key], { log });
}

// The shared files are always rebuilt from the database right before they go up, so they match the games being sent.
async function buildShared(log) {
  mkdirFor(stagePath(SHARED_KEYS.gamesIndex));
  await run(['ingest/tools/export-games-index.js', stagePath(SHARED_KEYS.gamesIndex)], { log });
  mkdirFor(stagePath(SHARED_KEYS.teams));
  await run(['ingest/tools/export-teams-meta.js', stagePath(SHARED_KEYS.teams)], { log });
  const tmp = path.join(STAGE, '_box_all');          // every game: the index lists them all
  fs.rmSync(tmp, { recursive: true, force: true });
  await run(['ingest/tools/export-game-box.js', '--all', '--out-dir', tmp], { log });
  mkdirFor(stagePath(SHARED_KEYS.boxIndex));
  fs.copyFileSync(path.join(tmp, 'box', 'index.json'), stagePath(SHARED_KEYS.boxIndex));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Season rollups read the per-game summaries back from the CDN, so they go up after the game files.
async function rollups(seasons, log) {
  for (const season of seasons) {
    for (const k of ROLLUPS) {
      const out = path.join(STAGE, `_${k}_out`);
      fs.rmSync(out, { recursive: true, force: true });
      await run([`derivations/aggregate-${k}.js`, '--season', String(season), '--index', stagePath(SHARED_KEYS.gamesIndex), '--out-dir', out], { log });
      for (const rel of [`seasons/${season}.json`, 'seasons/index.json']) {
        const key = `${k}/${rel}`;
        mkdirFor(stagePath(key));
        fs.copyFileSync(path.join(out, rel), stagePath(key));
        await upload(key, log);
      }
      fs.rmSync(out, { recursive: true, force: true });
    }
  }
}

async function deploy(client, gameIds, log) {
  const { rows } = await client.query('SELECT game_id, season_year, (SELECT max(r.fetched_at) FROM raw_payloads r JOIN source_games s ON s.source = r.source AND s.source_game_id = r.source_game_id WHERE s.game_id = g.game_id) AS last_ingest FROM games g WHERE game_id = ANY($1)', [gameIds]);
  const known = new Map(rows.map((r) => [r.game_id, r]));
  for (const id of gameIds) {
    if (!known.has(id)) throw new Error(`unknown game ${id}`);
    const r = known.get(id);
    for (const f of GAME_FILES) {
      const p = stagePath(f.key(id));
      if (!fs.existsSync(p)) throw new Error(`${id}: ${f.step} isn't built yet (build it first)`);
      if (r.last_ingest && fs.statSync(p).mtime < r.last_ingest) throw new Error(`${id}: ${f.step} was built before the latest ingest (rebuild it)`);
    }
  }
  log(`uploading ${gameIds.length} game(s)`);
  for (const id of gameIds) for (const f of GAME_FILES) await upload(f.key(id), log);
  log('rebuilding the shared indexes');
  await buildShared(log);
  for (const key of Object.values(SHARED_KEYS)) await upload(key, log);
  const seasons = [...new Set(gameIds.map((id) => known.get(id).season_year))];
  log(`season rollups for ${seasons.join(', ')} (read back from CloudFront; a game that was already deployed may need its rollups rerun after the 5 minute cache)`);
  await rollups(seasons, log);
  log('deployed');
}

module.exports = { GAME_FILES, STEPS, ROLLUPS, SHARED_KEYS, STAGE, classify, rollupGameIds, status, buildGame, buildShared, rollups, deploy, run };
