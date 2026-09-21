const fs = require('fs');
const path = require('path');
const express = require('express');

// Dev-only endpoint used by the hidden /admin/alumni editor to write
// edits straight back to src/assets/alum.js. Only runs under `npm start`
// (react-scripts dev server) — it is not part of the production build.
module.exports = function (app) {
  app.use('/api/alum', express.json({ limit: '5mb' }));

  app.post('/api/alum', (req, res) => {
    const alumData = req.body;
    if (!Array.isArray(alumData)) {
      res.status(400).json({ error: 'Expected an array of alumni' });
      return;
    }

    const filePath = path.join(__dirname, 'assets', 'alum.js');
    const body = JSON.stringify(alumData, null, 2);
    const fileContents = `const alum = ${body};\n\nexport default alum;\n`;

    try {
      fs.writeFileSync(filePath, fileContents, 'utf8');
      res.json({ ok: true });
    } catch (err) {
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
      res.status(500).json({ error: 'IMAGE_UPLOAD_API_URL / IMAGE_UPLOAD_API_KEY not set in .env.local' });
      return;
    }

    try {
      const upstream = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(req.body),
      });
      const data = await upstream.json();
      res.status(upstream.status).json(data);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });
};
