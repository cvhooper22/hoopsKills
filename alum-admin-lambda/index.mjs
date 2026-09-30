import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { validateAlumni, MAX_BODY_BYTES } from './validate.mjs';

// Admin API for the alumni data file. Every route sits behind the API Gateway
// Lambda authorizer (authorizer.mjs), so a request only reaches this handler
// with a valid admin password. Routes (REST API, Lambda proxy):
//   GET /whoami -> { ok: true }               (used by the editor's login gate)
//   GET /alum   -> the current alum.json from S3, never cached
//   PUT /alum   -> validate, then overwrite alum.json in S3

const s3 = new S3Client({});

const BUCKET_NAME = process.env.BUCKET_NAME;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN; // e.g. https://yoursite.com (comma-separate to allow several)
const KEY_PREFIX = (process.env.KEY_PREFIX || '').replace(/^\/+|\/+$/g, '');
const ALUM_KEY = `${KEY_PREFIX ? `${KEY_PREFIX}/` : ''}data/alum.json`;
const PUBLIC_CACHE_CONTROL = 'public, max-age=60';

const allowedOrigins = (ALLOWED_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  const headers = { Vary: 'Origin' };
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function respond(event, statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(event) },
    body: JSON.stringify(body),
  };
}

async function readAlum() {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: ALUM_KEY }));
  return res.Body.transformToString('utf8');
}

export const handler = async (event) => {
  if (!BUCKET_NAME || !allowedOrigins.length) {
    return respond(event, 500, { error: 'Lambda misconfigured: BUCKET_NAME / ALLOWED_ORIGIN env vars are not set' });
  }

  const method = event.httpMethod;
  const route = (event.resource || event.path || '').replace(/\/+$/, '');

  try {
    if (method === 'GET' && route.endsWith('/whoami')) {
      return respond(event, 200, { ok: true });
    }

    if (method === 'GET' && route.endsWith('/alum')) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(event) },
        body: await readAlum(),
      };
    }

    if (method === 'PUT' && route.endsWith('/alum')) {
      const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        return respond(event, 413, { error: `Body is too large (max ${MAX_BODY_BYTES} bytes)` });
      }
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return respond(event, 400, { error: 'Body must be valid JSON' });
      }
      const errors = validateAlumni(data);
      if (errors.length) {
        return respond(event, 400, { error: errors.join('; ') });
      }
      // Re-serialise the validated value rather than storing the raw body.
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: ALUM_KEY,
          Body: JSON.stringify(data, null, 2) + '\n',
          ContentType: 'application/json',
          CacheControl: PUBLIC_CACHE_CONTROL,
        })
      );
      return respond(event, 200, { ok: true, count: data.length });
    }

    return respond(event, 404, { error: 'Not found' });
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      return respond(event, 404, { error: 'alum.json has not been uploaded to S3 yet' });
    }
    console.error(err);
    return respond(event, 500, { error: 'Internal error' });
  }
};
