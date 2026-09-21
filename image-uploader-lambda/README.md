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
  - `ASSET_BASE_URL` = `https://dd0v7fgd2sjsh.cloudfront.net` (optional — if
    set, the response `url` is built through your CloudFront domain instead
    of the raw S3 URL)
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

- Actions -> Create Resource -> name `images`, path `/images`
- Select `/images` -> Actions -> Create Method -> `POST`
  - Integration type: Lambda Function
  - Use Lambda Proxy integration: **checked**
  - Lambda Function: `image-uploader`
  - Save (accept the "add permission" prompt so API Gateway can invoke it)
- On the `POST` method -> **Method Request** -> set **API Key Required** to
  `true`

### CORS (needed since the admin UI calls this from the browser)

- Select `/images` -> Actions -> Enable CORS
  - Access-Control-Allow-Headers: add `x-api-key` to the default list
    (`Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token`)
  - Access-Control-Allow-Origin: `*` for now, or lock to your site's origin
    later
- Confirm and replace existing values when prompted, then re-deploy (below)

### Deploy

- Actions -> Deploy API -> New stage -> name it `prod`
- Note the **Invoke URL**, e.g.
  `https://abc123xyz.execute-api.YOUR_REGION.amazonaws.com/prod`

### API key + usage plan

- API Gateway -> API Keys -> Create API key -> name it, save the generated
  key value somewhere safe (you won't see it again in full)
- API Gateway -> Usage Plans -> Create -> name it, set whatever throttle/quota
  you're comfortable with (this is just for you, so generous limits are fine)
  - Add API stage: your API -> `prod`
  - Add the API key you just created to this usage plan

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
  `image/svg+xml` are accepted; anything else 400s.
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
