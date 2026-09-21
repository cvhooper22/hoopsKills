import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({});

const BUCKET_NAME = process.env.BUCKET_NAME;
const ASSET_BASE_URL = process.env.ASSET_BASE_URL; // optional, e.g. https://dd0v7fgd2sjsh.cloudfront.net
const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const FETCH_TIMEOUT_MS = 10_000;

const CATEGORY_PREFIXES = {
  player: 'assets/alum/players/',
  teamLogo: 'assets/alum/teamLogos/',
};

const EXT_BY_CONTENT_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function sanitizeFileName(raw) {
  return raw
    .trim()
    .replace(/\.[a-zA-Z0-9]+$/, '') // strip any extension the caller included
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
}

async function downloadImage(imageUrl) {
  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new HttpError(400, 'imageUrl is not a valid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'imageUrl must be http or https');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(parsed, { signal: controller.signal });
  } catch (err) {
    throw new HttpError(502, `Failed to fetch imageUrl: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new HttpError(502, `imageUrl returned HTTP ${res.status}`);
  }

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
  const ext = EXT_BY_CONTENT_TYPE[contentType];
  if (!ext) {
    throw new HttpError(400, `Unsupported or missing image content-type: ${contentType || '(none)'}`);
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength && contentLength > MAX_BYTES) {
    throw new HttpError(400, `Image is too large (${contentLength} bytes, max ${MAX_BYTES})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    throw new HttpError(400, `Image is too large (${buffer.byteLength} bytes, max ${MAX_BYTES})`);
  }

  return { buffer, contentType, ext };
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const handler = async (event) => {
  if (!BUCKET_NAME) {
    return jsonResponse(500, { error: 'Lambda misconfigured: BUCKET_NAME env var is not set' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Body must be valid JSON' });
  }

  const { imageUrl, category, fileName } = body;

  if (!imageUrl || typeof imageUrl !== 'string') {
    return jsonResponse(400, { error: 'imageUrl is required' });
  }
  const prefix = CATEGORY_PREFIXES[category];
  if (!prefix) {
    return jsonResponse(400, { error: `category must be one of: ${Object.keys(CATEGORY_PREFIXES).join(', ')}` });
  }
  if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
    return jsonResponse(400, { error: 'fileName is required' });
  }
  const safeName = sanitizeFileName(fileName);
  if (!safeName) {
    return jsonResponse(400, { error: 'fileName has no valid characters after sanitizing' });
  }

  try {
    const { buffer, contentType, ext } = await downloadImage(imageUrl);
    const key = `${prefix}${safeName}.${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const url = ASSET_BASE_URL ? `${ASSET_BASE_URL.replace(/\/$/, '')}/${key}` : `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

    return jsonResponse(200, { key, url });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(err.statusCode, { error: err.message });
    }
    console.error(err);
    return jsonResponse(500, { error: 'Failed to upload image' });
  }
};
