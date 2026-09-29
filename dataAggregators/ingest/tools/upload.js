// Uploads a local file to the shared stats bucket at a given S3 key.
// Usage: node ingest/tools/upload.js <localFile> <s3Key>
//   e.g. node ingest/tools/upload.js /tmp/kills-401827596.json kills/games/401827596.json
//
// Credentials come from stat_explorer/.env.local (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
// / AWS_SESSION_TOKEN / AWS_REGION / BUCKET_NAME / KEY_PREFIX) — explicit keys, not a shared
// profile, so this never touches ~/.aws/config or ~/.aws/credentials. Same convention as
// list-bucket.js and collect-headshots.js's IMAGE_UPLOAD_API_URL.
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

function loadEnv() {
  const file = path.join(__dirname, '../../../stat_explorer/.env.local');
  fs.readFileSync(file, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

async function main() {
  const [localFile, s3Key] = process.argv.slice(2);
  if (!localFile || !s3Key) throw new Error('usage: upload.js <localFile> <s3Key>');

  loadEnv();
  const { AWS_ACCESS_KEY_ID: accessKeyId, AWS_SECRET_ACCESS_KEY: secretAccessKey,
    AWS_SESSION_TOKEN: sessionToken, AWS_REGION: region, BUCKET_NAME: bucket } = process.env;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set (add them to stat_explorer/.env.local)');
  }
  if (!bucket) throw new Error('BUCKET_NAME not set (add it to stat_explorer/.env.local)');
  const keyPrefix = (process.env.KEY_PREFIX || '').replace(/^\/+|\/+$/g, '');
  const key = keyPrefix ? `${keyPrefix}/${s3Key}` : s3Key;

  const body = fs.readFileSync(localFile);
  const client = new S3Client({
    ...(region ? { region } : {}),
    credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) },
  });
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/json',
    CacheControl: 'public, max-age=300',
  }));
  console.log(`uploaded ${localFile} -> s3://${bucket}/${key}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
