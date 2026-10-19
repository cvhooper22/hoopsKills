# StatBroadcast capture extension

Reads the play-by-play out of a StatBroadcast game tab in your own Chrome and sends it to a local receiver,
which parses it and keeps `plays` / `live_game_state` current in Postgres.

## Run it

1. Start the receiver (use a scratch database while testing):
   `DATABASE_URL=postgres://postgres:postgres@localhost:5544/pbp_live_test node ingest/statbroadcast/receiver.js`
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → this folder.
3. Open the game (`https://stats.statbroadcast.com/broadcast/?id=<event>`) in its **own window**. Reload it once
   after installing the extension.
4. Click the extension icon, fill in game date, home and away team ids (`byu`, `villanova`), **Start capture**.

Capture clicks through the period tabs, so that tab stays on the play-by-play view while it runs. It stops by
itself when the game is final. A reload of the tab resumes capture.

## Things to check on the first live game

- Chrome slows timers in hidden or covered tabs; keep the game tab visible (own window, side by side) and watch
  whether the poll interval holds. If it drifts, the capture needs a keep-alive.
- Whether clicking a period tab always returns fresh plays (on the finished game every click re-rendered).
- What the page shows for the status/clock during play (`live_game_state.status_text`), and overtime period naming
  (the parser expects "Period N Plays").

## Whole live path

```
Chrome tab + extension ──▶ receiver.js ──▶ Postgres (plays, live_game_state) ──NOTIFY──▶ derivations/live-box-server.js ──SSE──▶ scoreboard
```

- `node derivations/live-box-server.js` serves `GET /games`, `GET /box/:gameId` and `GET /box/:gameId/stream` (SSE).
- Each capture also reads the box score view (starters, for lineups). StatBroadcast-specific vocabulary and lineup
  derivation live in `canonical.js`; the derivations only see the canonical shape.
- Pregame priors for win probability: `config/game-priors.csv` (columns in `derivations/priors.js`). Games without a
  row are modelled as an even matchup.
- Test the whole path without a live game: `sim-server.js` + `poll.js --sim ...` (see their headers).
