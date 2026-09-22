import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({});

const BUCKET_NAME = process.env.BUCKET_NAME;
const ASSET_BASE_URL = process.env.ASSET_BASE_URL; // optional, e.g. https://dd0v7fgd2sjsh.cloudfront.net
// Optional folder inside the bucket that everything is written under, e.g. "hoopstats".
// Not part of the returned URL when ASSET_BASE_URL is set: the CloudFront origin path is
// expected to already point at this folder.
const KEY_PREFIX = (process.env.KEY_PREFIX || '').replace(/^\/+|\/+$/g, '');
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

// Some hosts serve images with a generic (or no) Content-Type. For those we fall
// back to the file's magic bytes; any other declared type is still rejected.
const GENERIC_CONTENT_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

function sniffImageType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  const gifHeader = buf.toString('latin1', 0, 6);
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') return 'image/gif';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

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

  const declaredType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  let contentType = declaredType;
  let ext = EXT_BY_CONTENT_TYPE[declaredType];
  if (!ext && !GENERIC_CONTENT_TYPES.has(declaredType)) {
    throw new HttpError(400, `Unsupported or missing image content-type: ${declaredType}`);
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength && contentLength > MAX_BYTES) {
    throw new HttpError(400, `Image is too large (${contentLength} bytes, max ${MAX_BYTES})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    throw new HttpError(400, `Image is too large (${buffer.byteLength} bytes, max ${MAX_BYTES})`);
  }

  if (!ext) {
    contentType = sniffImageType(buffer);
    if (!contentType) {
      throw new HttpError(400, `Unsupported or missing image content-type: ${declaredType || '(none)'}, and the file contents are not a recognized image (jpg/png/webp/gif)`);
    }
    ext = EXT_BY_CONTENT_TYPE[contentType];
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
    const relativeKey = `${prefix}${safeName}.${ext}`;
    const key = KEY_PREFIX ? `${KEY_PREFIX}/${relativeKey}` : relativeKey;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const url = ASSET_BASE_URL ? `${ASSET_BASE_URL.replace(/\/$/, '')}/${relativeKey}` : `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

    return jsonResponse(200, { key, url });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(err.statusCode, { error: err.message });
    }
    console.error(err);
    return jsonResponse(500, { error: 'Failed to upload image' });
  }
};
