const fs = require('fs');
const path = require('path');
const express = require('express');
const os = require('os');
const { spawn } = require('child_process');

// Console logging for the admin endpoints below, so failures show up in the
// `npm start` terminal instead of only in the browser.
function log(tag, ...args) {
  console.log(`[${new Date().toISOString()}] [${tag}]`, ...args);
}

function logError(tag, ...args) {
  console.error(`[${new Date().toISOString()}] [${tag}] ERROR`, ...args);
}

// Dev-only proxy to the production admin API (see ../../alum-admin-lambda). Lets the
// hidden admin pages work under `npm start` without typing the password: it is read from
// .env.local (ADMIN_PASSWORD, not REACT_APP_-prefixed so it never enters the bundle) and
// attached here. REACT_APP_ADMIN_API_URL is the target. Only these routes are forwarded.
const ADMIN_API_ROUTES = { '/whoami': ['GET'], '/alum': ['GET', 'PUT'], '/images': ['POST'] };

module.exports = function (app) {
  // TEMPORARY, dev-only: serves the gitignored design exports (../design/Hoops Stats (1)) so a
  // design can be viewed live while it's being refined, e.g.
  //   http://localhost:4444/design-preview/Landing%20Menu%20-%20Jumbotron.html
  // Remove once the landing page is implemented.
  app.use('/design-preview', express.static(path.join(__dirname, '..', '..', 'design', 'Hoops Stats (1)')));

  app.use('/api/admin', express.text({ type: '*/*', limit: '1mb' }));

  app.all('/api/admin/*', async (req, res) => {
    const route = req.path.replace(/^\/api\/admin/, '') || req.path;
    const apiUrl = (process.env.REACT_APP_ADMIN_API_URL || '').replace(/\/+$/, '');
    const password = process.env.ADMIN_PASSWORD;
    if (!apiUrl || !password) {
      logError('api/admin', `500 missing env: REACT_APP_ADMIN_API_URL ${apiUrl ? 'set' : 'NOT SET'}, ADMIN_PASSWORD ${password ? 'set' : 'NOT SET'} (restart npm start after editing .env.local)`);
      res.status(500).json({ error: 'REACT_APP_ADMIN_API_URL / ADMIN_PASSWORD not set in .env.local' });
      return;
    }
    if (!ADMIN_API_ROUTES[route] || !ADMIN_API_ROUTES[route].includes(req.method)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const headers = { Authorization: password };
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    try {
      const upstream = await fetch(`${apiUrl}${route}`, {
        method: req.method,
        headers,
        body: req.method === 'GET' ? undefined : req.body,
      });
      const text = await upstream.text();
      log('api/admin', `${req.method} ${route} -> ${upstream.status}`);
      if (upstream.status === 401 || upstream.status === 403) {
        res.status(upstream.status).json({ error: 'The admin API rejected ADMIN_PASSWORD from .env.local' });
        return;
      }
      res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(text);
    } catch (err) {
      logError('api/admin', `502 request to ${apiUrl}${route} failed:`, err, err.cause || '');
      res.status(502).json({ error: err.message });
    }
  });

  // Dev-only endpoint used by the hidden /admin/stops page to save which plays
  // are marked as stops (plus notes and where the user left off) for a game, to public/data/stops/<gameId>.json.
  app.use('/api/stops', express.json({ limit: '1mb' }));

  app.post('/api/stops/:gameId', (req, res) => {
    const { gameId } = req.params;
    if (!/^[\w-]+$/.test(gameId)) {
      res.status(400).json({ error: 'Bad game id' });
      return;
    }
    const stops = req.body;
    if (!stops || typeof stops !== 'object' || !Array.isArray(stops.plays)) {
      logError('api/stops', '400 expected { leftOff, plays: [] }');
      res.status(400).json({ error: 'Expected { leftOff, plays: [] }' });
      return;
    }

    const dir = path.join(__dirname, '..', 'public', 'data', 'stops');
    const filePath = path.join(dir, `${gameId}.json`);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(stops, null, 2) + '\n', 'utf8');
      log('api/stops', `200 wrote ${stops.plays.length} annotated plays to ${filePath}`);
      res.json({ ok: true });
    } catch (err) {
      logError('api/stops', `500 failed writing ${filePath}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // Dev-only: runs countdown/recent_games.py for ONE alum and returns its JSON
  // (last-N games ranked by Game Score, or a FIBA 3x3 event schedule). Called by
  // the hidden /admin/recent-games page once per alum so results stream in.
  // RealGM alumni open a Chrome window (Playwright), so allow several minutes.
  app.use('/api/recent-games', express.json({ limit: '10kb' }));

  app.post('/api/recent-games', (req, res) => {
    const { name } = req.body || {};
    const days = Number.isInteger(req.body && req.body.days) ? req.body.days : 7;
    const n = Number.isInteger(req.body && req.body.n) ? req.body.n : 7;
    if (typeof name !== 'string' || !name.trim() || name.length > 100 || days < 0 || days > 3650 || n < 1 || n > 50) {
      res.status(400).json({ error: 'Expected { name, days?: 0-3650, n?: 1-50 }' });
      return;
    }

    // Args passed as an array (no shell), and --name=<value> so a name can't be read as a flag.
    const cwd = path.join(__dirname, '..', '..', 'countdown');
    const args = ['recent_games.py', '--json', `--name=${name.trim()}`, `--days=${days}`, `-n=${n}`];
    log('api/recent-games', `python3 ${args.join(' ')}`);
    const child = spawn('python3', args, { cwd });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 5 * 60 * 1000);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      clearTimeout(timer);
      logError('api/recent-games', '500 could not start python3:', err);
      res.status(500).json({ error: `Could not start python3: ${err.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (res.headersSent) return;
      if (timedOut) {
        res.status(504).json({ error: 'Timed out after 5 minutes' });
        return;
      }
      try {
        if (code !== 0) throw new Error(stderr.trim().split('\n').slice(-3).join(' ') || `exit ${code}`);
        const payload = JSON.parse(stdout);
        const player = payload.players[0];
        if (!player) throw new Error('No player URL to look up (set a player stats URL or recent games URL first)');
        log('api/recent-games', `200 ${name}: ${player.status}, ${player.games.length} games`);
        res.json(player);
      } catch (err) {
        logError('api/recent-games', `500 ${name}:`, err.message);
        res.status(500).json({ error: err.message });
      }
    });
  });

  // Dev-only: saves the /admin/recent-games "Run all" results to
  // public/data/recent-games.json so the page can load them without re-running.
  app.use('/api/recent-games-save', express.json({ limit: '5mb' }));

  app.post('/api/recent-games-save', (req, res) => {
    const data = req.body;
    if (!data || typeof data !== 'object' || !data.players || typeof data.players !== 'object' || Array.isArray(data.players)) {
      logError('api/recent-games-save', '400 expected { generatedAt, players: { name: entry } }');
      res.status(400).json({ error: 'Expected { generatedAt, players: { name: entry } }' });
      return;
    }
    const dir = path.join(__dirname, '..', 'public', 'data');
    const filePath = path.join(dir, 'recent-games.json');
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      log('api/recent-games-save', `200 wrote ${Object.keys(data.players).length} players to ${filePath}`);
      res.json({ ok: true });
    } catch (err) {
      logError('api/recent-games-save', `500 failed writing ${filePath}:`, err);
      res.status(500).json({ error: err.message });
    }
  });


  // Dev-only: publishes the last saved "Run all" (public/data/recent-games.json) to S3 as a
  // timestamped file, via dataAggregators/ingest/tools/upload.js (same credentials/prefix as the
  // rest of the S3 uploads, from .env.local). The key sorts by run time, so a Lambda can list the
  // prefix and take the last key to get the latest:
  //   assets/alum/recent-games/recent-games-20260929T220428Z.json   (UTC run time)
  // The file itself carries generatedAt (ISO run time) + runDate for the frontend to display.
  // { dryRun: true } stops before uploading and just reports the key and file summary.
  const RECENT_GAMES_PREFIX = 'assets/alum/recent-games';
  app.use('/api/recent-games-publish', express.json({ limit: '10kb' }));

  app.post('/api/recent-games-publish', (req, res) => {
    const localFile = path.join(__dirname, '..', 'public', 'data', 'recent-games.json');
    let data;
    try {
      data = JSON.parse(fs.readFileSync(localFile, 'utf8'));
    } catch (err) {
      res.status(404).json({ error: 'No saved results yet. Run all first.' });
      return;
    }
    const runAt = new Date(data.generatedAt);
    if (!data.players || Number.isNaN(runAt.getTime())) {
      res.status(400).json({ error: 'Saved file is missing generatedAt/players. Run all again.' });
      return;
    }
    const stamp = runAt.toISOString().replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, ''); // 20260929T220428Z
    const key = `${RECENT_GAMES_PREFIX}/recent-games-${stamp}.json`;
    const published = { schemaVersion: 1, runDate: runAt.toISOString().slice(0, 10), ...data, publishedAt: new Date().toISOString() };
    const summary = { key, runDate: published.runDate, generatedAt: data.generatedAt, players: Object.keys(data.players).length };

    if (req.body && req.body.dryRun) {
      log('api/recent-games-publish', `dry run ${key}`);
      res.json({ ok: true, dryRun: true, ...summary });
      return;
    }

    const tmpFile = path.join(os.tmpdir(), `recent-games-${stamp}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(published, null, 2) + '\n', 'utf8');
    const uploader = path.join(__dirname, '..', '..', 'dataAggregators', 'ingest', 'tools', 'upload.js');
    log('api/recent-games-publish', `uploading ${tmpFile} -> ${key}`);
    const child = spawn('node', [uploader, tmpFile, key], { cwd: path.dirname(uploader) });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (err) => {
      logError('api/recent-games-publish', '500 could not start node:', err);
      res.status(500).json({ error: err.message });
    });
    child.on('close', (code) => {
      fs.unlink(tmpFile, () => {});
      if (res.headersSent) return;
      if (code !== 0) {
        logError('api/recent-games-publish', `500 upload failed: ${out.trim()}`);
        res.status(500).json({ error: out.trim().split('\n').slice(-2).join(' ') || `upload exit ${code}` });
        return;
      }
      log('api/recent-games-publish', `200 ${out.trim()}`);
      res.json({ ok: true, ...summary, url: `https://dd0v7fgd2sjsh.cloudfront.net/${key}` });
    });
  });

  // Dev-only: the hidden /admin/rankings page. "Run" collects the latest ratings snapshots (Torvik, NET, Haslametrics,
  // KenPom, EvanMiya) into the local Postgres by running dataAggregators/ingest/rankings/run.js; "status" reads what is
  // stored. KenPom opens a visible Chrome window for a few seconds (its bot check turns headless browsers away).
  // One run at a time. The database is whatever DATABASE_URL the `npm start` environment has, else the local default.
  app.use('/api/rankings', express.json({ limit: '10kb' }));

  const AGGREGATORS = path.join(__dirname, '..', '..', 'dataAggregators');
  const RANKING_SYSTEMS = ['torvik', 'net', 'haslam', 'kenpom', 'evanmiya'];
  let rankingsBusy = false;

  const runNode = (args, timeoutMs, tag, res, onDone) => {
    log(tag, `node ${args.join(' ')}`);
    const child = spawn('node', args, { cwd: AGGREGATORS });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      clearTimeout(timer);
      onDone();
      logError(tag, '500 could not start node:', err);
      if (!res.headersSent) res.status(500).json({ error: `Could not start node: ${err.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      onDone();
      if (res.headersSent) return;
      if (timedOut) { res.status(504).json({ error: `Timed out after ${Math.round(timeoutMs / 60000)} minutes` }); return; }
      if (code !== 0) {
        const msg = (stderr.trim().split('\n').slice(-3).join(' ') || `exit ${code}`);
        logError(tag, `500 ${msg}`);
        res.status(500).json({ error: msg });
        return;
      }
      try {
        const lines = stdout.trim().split('\n');
        res.json({ ...JSON.parse(lines[lines.length - 1]), stderr: stderr.trim() || undefined });
      } catch (err) {
        logError(tag, '500 unreadable output:', err.message);
        res.status(500).json({ error: 'The script printed something that is not JSON' });
      }
    });
  };

  app.get('/api/rankings/status', (req, res) => {
    runNode(['ingest/rankings/status.js'], 30 * 1000, 'api/rankings', res, () => {});
  });

  app.post('/api/rankings/run', (req, res) => {
    const { systems, backfill } = req.body || {};
    if (rankingsBusy) { res.status(409).json({ error: 'A rankings run is already in progress' }); return; }
    const args = ['ingest/rankings/run.js', '--json', '--trigger', 'admin'];
    if (backfill) {
      const { from, to } = backfill;
      const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
      if (!isDate(from) || !isDate(to) || from > to) { res.status(400).json({ error: 'backfill needs from and to as YYYY-MM-DD, from <= to' }); return; }
      args.push('--backfill', 'torvik', '--from', from, '--to', to);
    } else if (systems !== undefined) {
      if (!Array.isArray(systems) || !systems.length || systems.some((s) => !RANKING_SYSTEMS.includes(s))) {
        res.status(400).json({ error: `systems must be a non-empty subset of ${RANKING_SYSTEMS.join(', ')}` });
        return;
      }
      args.push('--systems', systems.join(','));
    }
    rankingsBusy = true;
    runNode(args, 10 * 60 * 1000, 'api/rankings', res, () => { rankingsBusy = false; });
  });

  // Uploads the timeline files (public/data/rankings) and the logos they use to the shared bucket, where the app reads them.
  app.post('/api/rankings/upload', (req, res) => {
    if (rankingsBusy) { res.status(409).json({ error: 'A rankings run is already in progress' }); return; }
    rankingsBusy = true;
    runNode(['ingest/tools/upload-rankings.js', '--json'], 2 * 60 * 1000, 'api/rankings', res, () => { rankingsBusy = false; });
  });


  // The app's canonical team list for ratings and the spelling -> team mapping (dataAggregators/config/rating-teams.json and
  // rating-team-synonyms.json), editable from the admin page. These edit files in the repo, so like everything in this
  // block they only exist under `npm start`.
  const textArg = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 100;
  const mappings = (res, args) => runNode(['ingest/rankings/mappings.js', ...args], 30 * 1000, 'api/rankings', res, () => {});
  app.get('/api/rankings/mappings', (req, res) => mappings(res, ['state']));
  app.post('/api/rankings/mappings', (req, res) => {          // map a site's spelling to a canonical team (id or name)
    const { alias, team } = req.body || {};
    if (!textArg(alias) || !textArg(team)) { res.status(400).json({ error: 'Expected { alias, team }' }); return; }
    mappings(res, ['map', '--alias', alias.trim(), '--team', team.trim()]);
  });
  app.delete('/api/rankings/mappings', (req, res) => {
    const { key } = req.body || {};
    if (!textArg(key)) { res.status(400).json({ error: 'Expected { key }' }); return; }
    mappings(res, ['unmap', '--key', key.trim()]);
  });
  app.post('/api/rankings/teams', (req, res) => {             // add a canonical team (optionally with the spelling that reported it)
    const { name, alias } = req.body || {};
    if (!textArg(name) || (alias !== undefined && !textArg(alias))) { res.status(400).json({ error: 'Expected { name, alias? }' }); return; }
    mappings(res, ['add-team', '--name', name.trim(), ...(alias ? ['--alias', alias.trim()] : [])]);
  });
  app.post('/api/rankings/teams/rename', (req, res) => {
    const { id, name } = req.body || {};
    if (!textArg(id) || !textArg(name)) { res.status(400).json({ error: 'Expected { id, name }' }); return; }
    mappings(res, ['rename', '--id', id.trim(), '--name', name.trim()]);
  });

  // Dev-only: the hidden /admin/games page. Shows what is deployed for each game ("status") and runs the steps that
  // get a game there (dataAggregators/ingest/tools/game-pipeline.js): ingest, build the per-game files, deploy
  // (upload + indexes + season rollups). Those take a while, so they run as a job: POST starts one (one at a time),
  // GET /api/games/job returns the latest job with its log so the page can poll it.
  app.use('/api/games', express.json({ limit: '10kb' }));

  const PIPELINE = 'ingest/tools/game-pipeline.js';
  const GAME_STEPS = ['plays', 'meta', 'kills', 'clutch', 'lineups', 'box'];
  const GAME_ID = /^[\w-]+$/;
  let gamesJob = null;

  const startGamesJob = (label, argv) => {
    const job = { id: String(Date.now()), label, status: 'running', log: [], startedAt: new Date().toISOString() };
    gamesJob = job;
    log('api/games', `job "${label}": node ${PIPELINE} ${argv.join(' ')}`);
    const child = spawn('node', [PIPELINE, ...argv], { cwd: AGGREGATORS });
    const push = (d) => String(d).split('\n').filter(Boolean).forEach((l) => { job.log.push(l); if (job.log.length > 2000) job.log.shift(); });
    child.stdout.on('data', push);
    child.stderr.on('data', push);
    const timer = setTimeout(() => { job.log.push('timed out after 15 minutes'); child.kill(); }, 15 * 60 * 1000);
    const finish = (status, error) => { clearTimeout(timer); job.status = status; job.error = error; job.finishedAt = new Date().toISOString(); };
    child.on('error', (err) => finish('error', `Could not start node: ${err.message}`));
    child.on('close', (code) => {
      if (job.status !== 'running') return;
      finish(code === 0 ? 'done' : 'error', code === 0 ? undefined : (job.log[job.log.length - 1] || `exit ${code}`));
      log('api/games', `job "${label}" ${job.status}`);
    });
    return job;
  };

  app.get('/api/games/status', (req, res) => {
    runNode([PIPELINE, 'status'], 2 * 60 * 1000, 'api/games', res, () => {});
  });

  app.get('/api/games/job', (req, res) => res.json({ job: gamesJob }));

  app.post('/api/games/jobs', (req, res) => {
    const { action, gameId, gameIds, steps, url, wmtId, espnId, seasons } = req.body || {};
    if (gamesJob && gamesJob.status === 'running') { res.status(409).json({ error: `"${gamesJob.label}" is still running` }); return; }
    const bad = (msg) => res.status(400).json({ error: msg });
    if (action === 'ingest') {
      if (typeof url === 'string') {
        let u;
        try { u = new URL(url); } catch (e) { return bad('url is not a valid URL'); }
        if (u.protocol !== 'https:') return bad('url must be https');
        return res.json({ job: startGamesJob('Ingest from box score link', ['ingest', '--url', u.href]) });
      }
      if (/^\d+$/.test(String(wmtId || ''))) return res.json({ job: startGamesJob(`Ingest WMT ${wmtId}`, ['ingest', '--wmt', String(wmtId)]) });
      if (/^\d+$/.test(String(espnId || ''))) return res.json({ job: startGamesJob(`Ingest ESPN ${espnId}`, ['ingest', '--espn', String(espnId)]) });
      return bad('ingest needs url, wmtId or espnId');
    }
    if (action === 'build') {
      if (typeof gameId !== 'string' || !GAME_ID.test(gameId)) return bad('Bad game id');
      if (steps !== undefined && (!Array.isArray(steps) || !steps.length || steps.some((s) => !GAME_STEPS.includes(s)))) return bad(`steps must be a non-empty subset of ${GAME_STEPS.join(', ')}`);
      return res.json({ job: startGamesJob(`Build ${gameId}${steps ? ` (${steps.join(', ')})` : ''}`, ['build', gameId, ...(steps ? ['--steps', steps.join(',')] : [])]) });
    }
    if (action === 'deploy') {
      if (!Array.isArray(gameIds) || !gameIds.length || gameIds.length > 50 || gameIds.some((g) => typeof g !== 'string' || !GAME_ID.test(g))) return bad('Expected gameIds: 1-50 game ids');
      return res.json({ job: startGamesJob(`Deploy ${gameIds.length === 1 ? gameIds[0] : `${gameIds.length} games`}`, ['deploy', ...gameIds]) });
    }
    if (action === 'rollups') {
      if (!Array.isArray(seasons) || !seasons.length || seasons.some((s) => !/^\d{4}$/.test(String(s)))) return bad('Expected seasons: 4-digit years');
      return res.json({ job: startGamesJob(`Rebuild season rollups ${seasons.join(', ')}`, ['rollups', ...seasons.map(String)]) });
    }
    return bad('Unknown action');
  });

  // Catches errors from the body parsers above (malformed JSON, payload too
  // large) which otherwise never reach the route handlers or the terminal.
  app.use(['/api/admin', '/api/recent-games', '/api/recent-games-save', '/api/recent-games-publish', '/api/stops', '/api/rankings', '/api/games'], (err, req, res, next) => {
    logError(req.originalUrl, `${err.status || 500} ${err.type || ''} ${err.message}`);
    res.status(err.status || 500).json({ error: err.message });
  });
};
