// Every feature flag the app knows about. Flags are temporary: when a feature ships,
// delete its entry here and the dead branches it gated.
//
// A flag resolves in this order (first one that has a value wins):
//   1. personal override  - ?ff=<name> / ?ff=-<name> / ?ff=clear, kept in localStorage
//   2. runtime flags.json - on the data CloudFront (urls.flags()), so prod can flip without a redeploy
//   3. build-time env     - REACT_APP_FF_<NAME> (set in .env.local for local dev)
//   4. off
const COLLECTION = 'collection';

const FLAGS = {
  [COLLECTION]: { envVar: 'REACT_APP_FF_COLLECTION' },
};

const OVERRIDES_STORAGE_KEY = 'ff_overrides';
const OVERRIDES_QUERY_PARAM = 'ff';
const FLAGS_FETCH_TIMEOUT_MS = 3000;

export { FLAGS, COLLECTION, OVERRIDES_STORAGE_KEY, OVERRIDES_QUERY_PARAM, FLAGS_FETCH_TIMEOUT_MS };
