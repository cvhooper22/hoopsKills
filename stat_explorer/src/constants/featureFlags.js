// Every feature flag the app knows about. Flags are temporary: when a feature ships,
// delete its entry here and the dead branches it gated.
//
// A flag resolves in this order (first one that has a value wins):
//   1. personal override  - ?ff=<name> / ?ff=-<name> / ?ff=clear, kept in localStorage
//   2. runtime flags.json - on the data CloudFront (urls.flags()), so prod can flip without a redeploy
//   3. build-time env     - REACT_APP_FF_<NAME> (set in .env.local for local dev)
//   4. off
const COLLECTION = 'collection';
const LIVE_GAME = 'liveGame'; // the in-game page (/live), fed by the local live box server
const RANKINGS = 'rankings'; // BYU's ratings timeline (/rankings), read from public/data/rankings
const EXHIBITIONS = 'exhibitions'; // the temporary combined exhibition box score (/exhibitions)
const ASK_AI = 'askAi'; // the "Ask AI" side tab on the box score: builds a copy-paste prompt from the game's play-by-play

const FLAGS = {
  [COLLECTION]: { envVar: 'REACT_APP_FF_COLLECTION' },
  [LIVE_GAME]: { envVar: 'REACT_APP_FF_LIVE_GAME' },
  [RANKINGS]: { envVar: 'REACT_APP_FF_RANKINGS' },
  [EXHIBITIONS]: { envVar: 'REACT_APP_FF_EXHIBITIONS' },
  [ASK_AI]: { envVar: 'REACT_APP_FF_ASK_AI' },
};

const OVERRIDES_STORAGE_KEY = 'ff_overrides';
const OVERRIDES_QUERY_PARAM = 'ff';
const FLAGS_FETCH_TIMEOUT_MS = 3000;

export { FLAGS, COLLECTION, LIVE_GAME, RANKINGS, EXHIBITIONS, ASK_AI, OVERRIDES_STORAGE_KEY, OVERRIDES_QUERY_PARAM, FLAGS_FETCH_TIMEOUT_MS };
