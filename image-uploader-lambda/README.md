# Image uploader Lambda

Takes `{ imageUrl, category, fileName }`, downloads the image server-side, and
writes it to S3 under:

- `category: "player"` -> `assets/alum/players/<fileName>.<ext>`
- `category: "teamLogo"` -> `assets/alum/teamLogos/<fileName>.<ext>`

Extension is derived from the source image's `Content-Type` (jpg/png/webp/gif/svg).
Response: `{ "key": "...", "url": "..." }`.

Everywhere below, replace `YOUR_BUCKET_NAME`, `YOUR_REGION` (e.g. `us-west-2`),
and `YOUR_ACCOUNT_ID` with your real values.

## 1. IAM role for the Lambda

Console: IAM -> Roles -> Create role -> Trusted entity **Lambda**.

Attach the AWS managed policy `AWSLambdaBasicExecutionRole` (log group access),
then add an inline policy using [iam-policy.json](iam-policy.json) (edit the
bucket name in it first). This scopes the Lambda to only `PutObject` under
`assets/alum/*` in your bucket — nothing else.

Name the role something like `image-uploader-lambda-role`.

## 2. Create the Lambda function

Console: Lambda -> Create function.

- Author from scratch
- Name: `image-uploader`
- Runtime: **Node.js 20.x**
- Architecture: arm64 (cheaper) or x86_64, either is fine
- Execution role: use the existing role from step 1

After creation, open the function -> **Code** tab -> paste the contents of
[index.mjs](index.mjs) into `index.mjs` (rename the default `index.js` file
to `index.mjs`, or use "Upload from" -> .zip if you'd rather zip it locally).
No `npm install` needed — `@aws-sdk/client-s3` ships in the Node 20 Lambda
runtime already.

Then set:

- **Configuration -> Environment variables**
  - `BUCKET_NAME` = `YOUR_BUCKET_NAME`
  - `KEY_PREFIX` = e.g. `hoopstats` (optional — folder inside the bucket
    everything is written under. `BUCKET_NAME` must be the bare bucket name
    with no `/`; a folder goes here instead. Drop `YOUR_KEY_PREFIX/` from the
    IAM policy resource if you leave this unset)
  - `ASSET_BASE_URL` = `https://dd0v7fgd2sjsh.cloudfront.net` (optional — if
    set, the response `url` is built through your CloudFront domain instead
    of the raw S3 URL. The `KEY_PREFIX` is left out of that URL, so the
    CloudFront origin path should be set to `/<KEY_PREFIX>`)
- **Configuration -> General configuration**
  - Timeout: 15 sec (default 3s is too short for a download + upload)
  - Memory: 256 MB is plenty

Click **Deploy** on the code editor if you pasted directly in the console.

## 3. API Gateway (REST API, with an API key)

Console: API Gateway -> Create API -> **REST API** (not HTTP API — REST API
is what supports API-key/usage-plan auth natively).

- API name: `image-uploader-api`
- Endpoint type: Regional

### Resource + method

(The console no longer has a per-resource "Actions" menu; everything below
uses the current buttons. The **API actions** dropdown only has import/delete.)

- On the Resources page, click **Create resource** (left panel)
  - Resource path: `/`, Resource name: `images`
  - Leave **CORS** unchecked (see the CORS note below)
  - Create resource
- Select `/images` in the left tree -> **Create method** (in the Methods box)
  - Method type: `POST`
  - Integration type: **Lambda function**
  - **Lambda proxy integration**: toggle on
  - Lambda function: pick your region, then `image-uploader`
  - Expand **Method settings** -> check **API key required**
  - Create method (the console adds the invoke permission on the Lambda for you)

### CORS (optional)

The admin UI reaches this API through the `setupProxy.js` server-side proxy,
not directly from the browser, so CORS isn't needed for the editor. Only set
it up if you later call the API straight from browser code: select `/images`
-> **Enable CORS** (in Resource details), tick `POST`, and add `x-api-key` to
the allowed headers. Then redeploy.

### Deploy

- Click **Deploy API** (orange button, top right) -> Stage: **New stage** ->
  name it `prod` -> Deploy. Redeploy after any later change to methods.
- The **Invoke URL** is shown on the stage page, e.g.
  `https://abc123xyz.execute-api.YOUR_REGION.amazonaws.com/prod`. The full
  endpoint is that URL plus `/images`.

### API key + usage plan

These live in the API Gateway left-hand nav (outside your API), not inside
the API's Resources page.

- **API keys** -> Create API key -> name it, Auto generate. Open the key and
  click **Show** to copy the value.
- **Usage plans** -> Create usage plan -> name it, set throttle/quota (a low
  daily quota like 100 requests limits the damage if the key leaks)
  - **Add API stage**: your API -> `prod`
  - **Add API key**: the key you just created

## 4. Test it

```bash
curl -X POST "https://abc123xyz.execute-api.YOUR_REGION.amazonaws.com/prod/images" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "imageUrl": "https://example.com/some-headshot.jpg",
    "category": "player",
    "fileName": "john-doe"
  }'
```

Expected response:

```json
{ "key": "assets/alum/players/john-doe.jpg", "url": "https://dd0v7fgd2sjsh.cloudfront.net/assets/alum/players/john-doe.jpg" }
```

A request missing the `x-api-key` header should get a `403` straight from
API Gateway (the Lambda never runs).

## Notes

- `fileName` is sanitized (any extension you pass is stripped and
  re-derived from the real content-type; unsafe characters become `-`), so
  it can't be used for a path-traversal write outside the two prefixes.
- Only `image/jpeg`, `image/png`, `image/webp`, `image/gif`, and
  `image/svg+xml` are accepted; anything else 400s. If the source serves
  the file with a missing or generic type (`application/octet-stream`), the
  Lambda checks the file's first bytes instead and accepts real
  jpg/png/gif/webp files (SVG has no signature, so it still needs a proper
  `image/svg+xml` header).
- Downloads are capped at 20MB and a 10s fetch timeout.
- Wired into [AlumniEditor.js](../stat_explorer/src/views/Admin/AlumniEditor.js):
  the Team Logo and Cover Photo sections each have a "Fetch & Host" row where
  you paste a source URL + filename, and it fills the URL field in with the
  hosted S3/CloudFront URL. The browser never talks to API Gateway directly —
  it hits a dev-only proxy in
  [setupProxy.js](../stat_explorer/src/setupProxy.js) at `/api/upload-image`,
  which forwards to this Lambda with the API key attached server-side. Set
  `IMAGE_UPLOAD_API_URL` and `IMAGE_UPLOAD_API_KEY` in
  `stat_explorer/.env.local` (see `.env.local.example`) — like the rest of
  the admin editor, this only works under `npm start`, not in production
  builds.
