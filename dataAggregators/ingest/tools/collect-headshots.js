// Copies ESPN headshots for every player with an ESPN id into our S3 bucket, through the
// same image-uploader Lambda the alumni editor uses, and records the hosted URL in player_images.
// Skips players that already have a row. Usage: node ingest/tools/collect-headshots.js [--dry-run]
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { connect } = require('../../db/client');

const ESPN_HEADSHOT = id => `https://a.espncdn.com/i/headshots/mens-college-basketball/players/full/${id}.png`;

// The Lambda credentials live in the app's .env.local (IMAGE_UPLOAD_API_URL / IMAGE_UPLOAD_API_KEY).
function loadEnv() {
  const file = path.join(__dirname, '../../../stat_explorer/.env.local');
  fs.readFileSync(file, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// API Gateway throttles the key, so back off and retry on 429.
async function upload(apiUrl, apiKey, imageUrl, fileName) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ imageUrl, category: 'player', fileName }),
    });
    if (res.status === 429 && attempt < 4) { await sleep(3000 * (attempt + 1)); continue; }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || body.message || `HTTP ${res.status}`);
    return body; // { key, url }
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  loadEnv();
  const { IMAGE_UPLOAD_API_URL: apiUrl, IMAGE_UPLOAD_API_KEY: apiKey } = process.env;
  if (!dryRun && (!apiUrl || !apiKey)) throw new Error('IMAGE_UPLOAD_API_URL / IMAGE_UPLOAD_API_KEY not set');

  const client = await connect();
  try {
    const { rows } = await client.query(
      `SELECT p.player_id, e.external_id AS espn_id
         FROM players p
         JOIN player_external_ids e ON e.player_id = p.player_id AND e.source = 'espn'
         LEFT JOIN player_images i ON i.player_id = p.player_id
        WHERE i.player_id IS NULL
        ORDER BY p.player_id`);
    console.log(`${rows.length} players to fetch${dryRun ? ' (dry run)' : ''}`);
    let ok = 0;
    const failed = [];
    for (const { player_id, espn_id } of rows) {
      const sourceUrl = ESPN_HEADSHOT(espn_id);
      if (dryRun) { console.log(`  ${player_id} <- ${sourceUrl}`); continue; }
      try {
        const { key, url } = await upload(apiUrl, apiKey, sourceUrl, player_id);
        await client.query(
          `INSERT INTO player_images (player_id, source, source_url, hosted_url, s3_key)
           VALUES ($1, 'espn', $2, $3, $4)`, [player_id, sourceUrl, url, key]);
        ok++;
        console.log(`  ok   ${player_id} -> ${url}`);
        await sleep(1000);
      } catch (err) {
        failed.push(player_id);
        console.log(`  FAIL ${player_id}: ${err.message}`);
      }
    }
    if (!dryRun) console.log(`done: ${ok} uploaded, ${failed.length} failed${failed.length ? ` (${failed.join(', ')})` : ''}`);
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
