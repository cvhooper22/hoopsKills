// Uploads the rankings timeline files and the opponent logos they use to the shared stats bucket, the same keys the
// app reads from the data CloudFront: rankings/timeline-<season>.json and assets/logos/<id>.png.
//   node ingest/tools/upload-rankings.js [--season 2026 ...] [--json]
// Every stat_explorer/public/data/rankings/timeline-*.json is uploaded unless --season picks some. A logo is uploaded
// when a game in an uploaded timeline names it (opponentLogo) and assets/logos/<id>.png exists. Re-uploading is harmless
// (same key, same bytes). Credentials come from stat_explorer/.env.local, as for upload.js. This is also what the
// "Upload to S3" button on /admin/rankings runs (--json prints one result line for it).
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../lib/env');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const RANKINGS_DIR = path.join(__dirname, '../../../stat_explorer/public/data/rankings');
const LOGOS_DIR = path.join(__dirname, '../../assets/logos');
const args = process.argv.slice(2);
const seasons = args.flatMap((a, i) => (a === '--season' ? [args[i + 1]] : []));
const json = args.includes('--json');

async function main() {
  loadEnv();
  const { AWS_ACCESS_KEY_ID: accessKeyId, AWS_SECRET_ACCESS_KEY: secretAccessKey, AWS_SESSION_TOKEN: sessionToken, AWS_REGION: region, BUCKET_NAME: bucket } = process.env;
  if (!accessKeyId || !secretAccessKey) throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set (add them to stat_explorer/.env.local)');
  if (!bucket) throw new Error('BUCKET_NAME not set (add it to stat_explorer/.env.local)');
  const keyPrefix = (process.env.KEY_PREFIX || '').replace(/^\/+|\/+$/g, '');
  const client = new S3Client({ ...(region ? { region } : {}), credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } });

  const files = fs.readdirSync(RANKINGS_DIR).filter((f) => /^timeline-\d{4}\.json$/.test(f))
    .filter((f) => !seasons.length || seasons.includes(f.slice(9, 13))).sort();
  if (!files.length) throw new Error(`no timeline files to upload in ${RANKINGS_DIR}`);

  const jobs = [];   // { file, key, type }
  const logos = new Set();
  for (const f of files) {
    jobs.push({ file: path.join(RANKINGS_DIR, f), key: `rankings/${f}`, type: 'application/json' });
    JSON.parse(fs.readFileSync(path.join(RANKINGS_DIR, f), 'utf8')).games.forEach((g) => { if (g.opponentLogo) logos.add(g.opponentLogo); });
  }
  for (const id of [...logos].sort()) {
    const file = path.join(LOGOS_DIR, `${id}.png`);
    if (fs.existsSync(file)) jobs.push({ file, key: `assets/logos/${id}.png`, type: 'image/png' });
  }

  const uploaded = [], failed = [];
  const put = async (j) => {
    try {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: keyPrefix ? `${keyPrefix}/${j.key}` : j.key, Body: fs.readFileSync(j.file), ContentType: j.type, CacheControl: 'public, max-age=300' }));
      uploaded.push(j.key);
    } catch (err) {
      failed.push({ key: j.key, error: err.message });
    }
  };
  for (let i = 0; i < jobs.length; i += 8) await Promise.all(jobs.slice(i, i + 8).map(put));   // a few at a time

  if (json) console.log(JSON.stringify({ bucket, uploaded, failed }));
  else {
    uploaded.forEach((k) => console.log(`uploaded ${k}`));
    failed.forEach((f) => console.error(`FAILED ${f.key}: ${f.error}`));
  }
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => { console.error(err.message); process.exit(1); });
