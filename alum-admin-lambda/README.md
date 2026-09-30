# Alumni admin API (Lambda authorizer + alum.json read/write)

The alumni data lives in S3 at `<KEY_PREFIX>/data/alum.json` and is served to the
public Alumni page through CloudFront (`https://<cloudfront>/data/alum.json`).
The hidden `/admin/alumni` editor reads and writes that file through this API, so
editing alumni no longer needs a commit or deploy.

Everything here is enforced server-side. The browser bundle contains only the API
URL; the password is typed into the editor's login box and is never in the
source. The bucket stays private (CloudFront reads it through Origin Access
Control) and only these Lambdas can write, each scoped to specific keys.

```
Editor --Authorization: <password>--> API Gateway --[authorizer.mjs]--> allow/deny
    GET  /whoami  -> index.mjs   { ok: true }   (the editor's login check)
    GET  /alum    -> index.mjs   current alum.json straight from S3 (never cached)
    PUT  /alum    -> index.mjs   validate.mjs, then PutObject alum.json
    POST /images  -> ../image-uploader-lambda   (same authorizer)
```

Everywhere below, replace `YOUR_BUCKET_NAME`, `YOUR_KEY_PREFIX`, `YOUR_REGION`
and `YOUR_SITE_ORIGIN` (e.g. `https://yoursite.com`) with your real values.

## 1. Pick the password and hash it

Generate 30+ random characters in your password manager. Then hash it (this
prompts for it so it never lands in shell history):

```bash
read -rs P && printf %s "$P" | shasum -a 256 | cut -d' ' -f1; unset P
```

Only the hash goes into AWS. Keep the password itself in the password manager.

## 2. Seed `data/alum.json` in S3 (once)

The editor and public page both fail with an error until this file exists. From
`stat_explorer/src/assets/alum.js`, write the array as plain JSON to a temp file,
then upload it with the existing tool:

```bash
node dataAggregators/ingest/tools/upload.js /path/to/alum.json data/alum.json
```

Turn on **S3 bucket versioning** (bucket -> Properties -> Bucket Versioning) so any
bad write can be rolled back. That replaces the history git used to give you.

## 3. The alum-admin Lambda

Console: Lambda -> Create function -> `alum-admin`, Node.js 20.x.

- IAM role: `AWSLambdaBasicExecutionRole` plus an inline policy from
  [iam-policy.json](iam-policy.json) (edit the bucket/prefix). It can read/write
  exactly one key, `data/alum.json`, and nothing else.
- Code: upload `index.mjs` and `validate.mjs` together (zip them, or paste each
  file into the console editor). No `npm install` needed.
- Environment variables:
  - `BUCKET_NAME` = bare bucket name
  - `KEY_PREFIX` = same folder the image uploader uses (optional)
  - `ALLOWED_ORIGIN` = `YOUR_SITE_ORIGIN,http://localhost:3000` (comma-separated;
    drop localhost once you no longer run the editor locally)
- Timeout 10 sec, memory 256 MB.

## 4. The authorizer Lambda

Create a second function `alum-admin-authorizer`, Node.js 20.x, code from
[authorizer.mjs](authorizer.mjs), no IAM permissions beyond basic logging.

- Environment variable `ADMIN_PASSWORD_SHA256` = the hash from step 1.

If that variable is missing or malformed the authorizer denies everything.

## 5. API Gateway

Use the existing REST API (`image-uploader-api`).

- **Authorizers -> Create authorizer**: type **Lambda**, function
  `alum-admin-authorizer`, payload **Token**, token source header
  `Authorization`, **caching off (TTL 0)**.
- Resources/methods, each with **Lambda proxy integration** and the authorizer
  above selected under Method request -> Authorization:
  - `/whoami` -> `GET` -> `alum-admin`
  - `/alum` -> `GET` and `PUT` -> `alum-admin`
  - `/images` -> `POST` -> `image-uploader` (already exists; switch it from
    "API key required" to the authorizer)
- **CORS**: on each of `/whoami`, `/alum`, `/images` choose Enable CORS with the
  applicable methods (`GET`/`PUT`/`POST`) and allowed headers
  `Content-Type,Authorization`. The generated `OPTIONS` preflight methods must
  **not** use the authorizer (the console's don't). Leave the preflight origin
  as `*`: a preflight carries no data or credentials, and the real per-origin
  restriction is enforced by the Lambdas via `ALLOWED_ORIGIN`, which only send
  `Access-Control-Allow-Origin` back to the listed origins.
- **Gateway responses**: for `Unauthorized (401)`, `Access denied (403)` and
  `Default 4XX/5XX`, add the response header `Access-Control-Allow-Origin` = `'*'`
  so the browser can read auth failures instead of seeing an opaque network
  error (these responses contain no data).
- **Stage throttling**: on the `prod` stage set a low default rate/burst (e.g.
  2 req/s, burst 5). This is what slows down password guessing.
- Update `image-uploader`'s environment with `ALLOWED_ORIGIN` (same value as
  step 3), then **Deploy API** to `prod`.

The editor needs the invoke URL as `REACT_APP_ADMIN_API_URL` (no trailing slash,
e.g. `https://abc123xyz.execute-api.YOUR_REGION.amazonaws.com/prod`). It's a URL,
not a secret. Set it in `stat_explorer/.env.local` for local runs and in your
hosting environment for production builds.

## Running the editor locally (no password prompt)

Under `npm start` the admin pages skip the login screen. The dev server proxies
`/api/admin/*` to the deployed API and adds the password itself, read from
`stat_explorer/.env.local`:

```
REACT_APP_ADMIN_API_URL=https://abc123xyz.execute-api.YOUR_REGION.amazonaws.com/prod
ADMIN_PASSWORD=<the password from step 1>
```

`ADMIN_PASSWORD` is deliberately not `REACT_APP_`-prefixed, so it never enters the
browser bundle, and the proxy only exists in the dev server. Production builds
always show the login gate (the local bypass is a compile-time constant that is
`false` there). Restart `npm start` after editing `.env.local`. Local edits change
the live S3 data, since there is only one copy.

## 6. Cache

`PUT /alum` writes `Cache-Control: public, max-age=60`, so edits reach the public
page in about a minute if CloudFront's cache policy respects origin headers. The
editor itself always reads fresh data through `GET /alum`.

## 7. Test it

```bash
API=https://abc123xyz.execute-api.YOUR_REGION.amazonaws.com/prod

curl -i $API/whoami                                   # 401, no header
curl -i -H "Authorization: wrong" $API/whoami          # 403
curl -i -H "Authorization: $PASSWORD" $API/whoami    # 200 {"ok":true}
curl -i -X PUT -H "Authorization: $PASSWORD" -d '{}' $API/alum   # 400 (not an array)
```

## What PUT /alum rejects

Body over 300KB or more than 500 alumni; unknown fields; duplicate names;
statuses outside the known list; and any link/image URL that isn't `http(s)`
(images: `https` only), which blocks `javascript:`/`data:` URLs that the public
page would otherwise render as links. Validation lives in
[validate.mjs](validate.mjs); update its key list if the editor gains a field.
