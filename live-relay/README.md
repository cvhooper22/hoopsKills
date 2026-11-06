# Live relay: deploy and run

Public viewers read from a Cloudflare Worker. Your laptop only pushes to it (outbound, bearer token). Nothing connects
inbound to your machine.

```
capture -> Postgres -> live-box-server.js (127.0.0.1:4610) -> live-relay-push.js --PUT--> Worker -> viewers
```

## One-time setup

1. **Install the Worker's tooling** (from the repo root):
   ```bash
   cd live-relay && npm install
   ```
2. **Log in to Cloudflare** (opens a browser tab; you approve it, nothing is stored in the repo):
   ```bash
   npx wrangler login
   ```
3. **Make a push token** and keep it somewhere private (password manager). It is the only thing that can write:
   ```bash
   openssl rand -hex 32
   ```
4. **Deploy the Worker**:
   ```bash
   npx wrangler deploy
   ```
   It prints the URL, like `https://hoops-live-relay.<your-subdomain>.workers.dev`.
5. **Store the token as a Worker secret** (paste the token from step 3 when asked):
   ```bash
   npx wrangler secret put PUSH_TOKEN
   ```
   Or in the Cloudflare dashboard: Workers & Pages -> hoops-live-relay -> Settings -> Variables and Secrets -> Add,
   type **Secret**, name `PUSH_TOKEN`.
6. **Check it is up** (should print `[]`):
   ```bash
   curl https://hoops-live-relay.<your-subdomain>.workers.dev/games
   ```
   And that writes are locked (should be 401):
   ```bash
   curl -i -X PUT https://hoops-live-relay.<your-subdomain>.workers.dev/games -d '[]'
   ```

## Each game

1. Start capture and the local server as usual (`node derivations/live-box-server.js` from `dataAggregators/`).
2. In another terminal, start the pusher (from `dataAggregators/`):
   ```bash
   RELAY_URL=https://hoops-live-relay.<your-subdomain>.workers.dev RELAY_TOKEN=<token> node derivations/live-relay-push.js
   ```
   By default it follows games marked `live` that changed in the last 10 minutes, so stale ones from earlier captures are
   skipped; add `--game <id>` to push exactly the game you want. Only games it pushes appear on the public games list. Stop it with Ctrl-C to go private again.
3. Point the front end at the relay. Either:
   - **Build time:** `REACT_APP_LIVE_BOX_BASE=https://hoops-live-relay.<your-subdomain>.workers.dev` for the deployed build.
   - **Runtime switch** (dev or a build that has `REACT_APP_LIVE_RELAY_BASE` set): open the live page with `?live=relay`
     or `?live=local`. Reload after changing it.

## After the game

The pusher stops following a game once it is final. If a game is still marked live but nothing has been pushed for 5 minutes,
the relay lists it as "not updating". The relay drops a game's data about 36 hours after its last push,
and the normal S3 export is still the permanent record. Nothing needs to be spun down.

## Rotating the token

Make a new one (step 3), run `npx wrangler secret put PUSH_TOKEN` again, and use the new value in `RELAY_TOKEN`.
