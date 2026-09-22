const fs = require('fs');
const path = require('path');
const express = require('express');

// Console logging for the admin endpoints below, so failures show up in the
// `npm start` terminal instead of only in the browser.
function log(tag, ...args) {
  console.log(`[${new Date().toISOString()}] [${tag}]`, ...args);
}

function logError(tag, ...args) {
  console.error(`[${new Date().toISOString()}] [${tag}] ERROR`, ...args);
}

// Secrets are masked to their first 3 chars + length: enough to tell a wrong
// or truncated value apart without leaving the real one in terminal scrollback.
const SECRET_HEADERS = ['x-api-key', 'authorization', 'cookie', 'set-cookie'];

function maskSecrets(headers) {
  const out = {};
  Object.keys(headers).forEach((name) => {
    const value = String(headers[name]);
    out[name] = SECRET_HEADERS.includes(name.toLowerCase()) ? `${value.slice(0, 3)}... (len=${value.length})` : headers[name];
  });
  return out;
}

// Dev-only endpoint used by the hidden /admin/alumni editor to write
// edits straight back to src/assets/alum.js. Only runs under `npm start`
// (react-scripts dev server) — it is not part of the production build.
module.exports = function (app) {
  app.use('/api/alum', express.json({ limit: '5mb' }));

  app.post('/api/alum', (req, res) => {
    const alumData = req.body;
    if (!Array.isArray(alumData)) {
      logError('api/alum', `400 expected an array of alumni, got ${typeof alumData}`);
      res.status(400).json({ error: 'Expected an array of alumni' });
      return;
    }

    const filePath = path.join(__dirname, 'assets', 'alum.js');
    const body = JSON.stringify(alumData, null, 2);
    const fileContents = `const alum = ${body};\n\nexport default alum;\n`;

    try {
      fs.writeFileSync(filePath, fileContents, 'utf8');
      log('api/alum', `200 wrote ${alumData.length} alumni to ${filePath}`);
      res.json({ ok: true });
    } catch (err) {
      logError('api/alum', `500 failed writing ${filePath}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // Dev-only proxy to the image-uploader Lambda (see ../../image-uploader-lambda).
  // Keeps the API key server-side — it never reaches the browser bundle.
  // Configure via .env.local: IMAGE_UPLOAD_API_URL, IMAGE_UPLOAD_API_KEY.
  app.use('/api/upload-image', express.json({ limit: '1mb' }));

  app.post('/api/upload-image', async (req, res) => {
    const apiUrl = process.env.IMAGE_UPLOAD_API_URL;
    const apiKey = process.env.IMAGE_UPLOAD_API_KEY;
    if (!apiUrl || !apiKey) {
      logError(
        'api/upload-image',
        `500 missing env: IMAGE_UPLOAD_API_URL ${apiUrl ? 'set' : 'NOT SET'}, IMAGE_UPLOAD_API_KEY ${apiKey ? 'set' : 'NOT SET'} (restart npm start after editing .env.local)`
      );
      res.status(500).json({ error: 'IMAGE_UPLOAD_API_URL / IMAGE_UPLOAD_API_KEY not set in .env.local' });
      return;
    }

    log('api/upload-image', `browser -> proxy: ${req.method} ${req.originalUrl}`, {
      headers: maskSecrets(req.headers),
      body: req.body,
    });

    const upstreamHeaders = { 'Content-Type': 'application/json', 'x-api-key': apiKey };
    const upstreamBody = JSON.stringify(req.body);
    log('api/upload-image', `proxy -> upstream: POST ${apiUrl}`, {
      headers: maskSecrets(upstreamHeaders),
      body: upstreamBody,
    });
    const startedAt = Date.now();

    try {
      const upstream = await fetch(apiUrl, {
        method: 'POST',
        headers: upstreamHeaders,
        body: upstreamBody,
      });
      const elapsed = `${Date.now() - startedAt}ms`;
      const text = await upstream.text();
      const summary = {
        status: `${upstream.status} ${upstream.statusText}`.trim(),
        elapsed,
        headers: maskSecrets(Object.fromEntries(upstream.headers.entries())),
        body: text,
      };
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        logError('api/upload-image', 'upstream -> proxy: body was not JSON', summary);
        res.status(502).json({ error: `Upstream returned ${upstream.status} with a non-JSON body: ${text.slice(0, 200)}` });
        return;
      }

      if (upstream.ok) {
        log('api/upload-image', 'upstream -> proxy', summary);
      } else {
        logError('api/upload-image', 'upstream -> proxy', summary);
      }
      log('api/upload-image', `proxy -> browser: ${upstream.status}`, data);
      res.status(upstream.status).json(data);
    } catch (err) {
      logError('api/upload-image', `502 request to ${apiUrl} failed after ${Date.now() - startedAt}ms:`, err, err.cause || '');
      res.status(502).json({ error: err.message });
    }
  });

  // Catches errors from the body parsers above (malformed JSON, payload too
  // large) which otherwise never reach the route handlers or the terminal.
  app.use(['/api/alum', '/api/upload-image'], (err, req, res, next) => {
    logError(req.originalUrl, `${err.status || 500} ${err.type || ''} ${err.message}`);
    res.status(err.status || 500).json({ error: err.message });
  });
};
