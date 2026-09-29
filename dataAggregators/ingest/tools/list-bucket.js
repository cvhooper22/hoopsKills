// Read-only: lists keys in the shared stats bucket, to see what's already there.
// Usage: node ingest/tools/list-bucket.js [prefix]
//
// Credentials come from stat_explorer/.env.local (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
// / AWS_SESSION_TOKEN / AWS_REGION / BUCKET_NAME) — explicit keys, not a shared profile,
// so this never touches ~/.aws/config or ~/.aws/credentials.
const fs = require('fs');
const path = require('path');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

function loadEnv() {
  const file = path.join(__dirname, '../../../stat_explorer/.env.local');
  fs.readFileSync(file, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

async function main() {
  const prefix = process.argv[2] || '';

  loadEnv();
  const { AWS_ACCESS_KEY_ID: accessKeyId, AWS_SECRET_ACCESS_KEY: secretAccessKey,
    AWS_SESSION_TOKEN: sessionToken, AWS_REGION: region, BUCKET_NAME: bucket } = process.env;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set (add them to stat_explorer/.env.local)');
  }
  if (!bucket) throw new Error('BUCKET_NAME not set (add it to stat_explorer/.env.local)');

  const client = new S3Client({
    ...(region ? { region } : {}),
    credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) },
  });

  let continuationToken;
  let total = 0;
  do {
    const { Contents = [], IsTruncated, NextContinuationToken } = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    for (const obj of Contents) {
      console.log(`${obj.Key}\t${obj.Size}B\t${obj.LastModified?.toISOString()}`);
    }
    total += Contents.length;
    continuationToken = IsTruncated ? NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`\n${total} object(s) under prefix "${prefix}"`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
