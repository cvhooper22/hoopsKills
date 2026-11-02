// NCAA.com game-center play-by-play, straight from the site's own GraphQL backend (persisted query).
// The hash is tied to NCAA's frontend deploy; if it stops working (PersistedQueryNotFound), copy the new
// sha256Hash from the sdataprod.ncaa.com NCAA_GetGamecenterPbpBasketballById_web request on a game's play-by-play page
// and pass it with NCAA_PBP_HASH or fetchPbp(id, { hash }).
const META = 'NCAA_GetGamecenterPbpBasketballById_web';
const DEFAULT_HASH = '6b1232714a3598954c5bacabc0f81570e16d6ee017c9a6b93b601a3d40dafb98';

async function fetchPbp(contestId, { hash = process.env.NCAA_PBP_HASH || DEFAULT_HASH } = {}) {
  const url = new URL('https://sdataprod.ncaa.com/');
  url.searchParams.set('meta', META);
  url.searchParams.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } }));
  url.searchParams.set('variables', JSON.stringify({ contestId: String(contestId), staticTestEnv: null }));
  const res = await fetch(url, { headers: { Origin: 'https://www.ncaa.com', Referer: 'https://www.ncaa.com/', 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`NCAA pbp ${contestId}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors && json.errors.length) throw new Error(`NCAA pbp ${contestId}: ${json.errors[0].message}`);
  const pbp = json.data && json.data.playbyplay;
  if (!pbp) throw new Error(`NCAA pbp ${contestId}: no playbyplay in response`);
  return pbp;
}

module.exports = { fetchPbp };

// Header facts (start time, venue, linescore) and the box score come from sibling persisted queries on the same endpoint.
const QUERIES = {
  game: { meta: 'GetGamecenterGameById_web', hash: '26d14df5714c5cd454c9032a1f8ebb1b1dc35173065ab858709b0fa84dd07b5f', vars: id => ({ id: String(id), week: null, staticTestEnv: null }) },
  box: { meta: 'NCAA_GetGamecenterBoxscoreBasketballById_web', hash: '4a7fa26398db33de3ff51402a90eb5f25acef001cca28d239fe5361315d1419a', vars: id => ({ contestId: String(id), staticTestEnv: null }) },
};

async function query(kind, contestId) {
  const q = QUERIES[kind];
  const url = new URL('https://sdataprod.ncaa.com/');
  url.searchParams.set('meta', q.meta);
  url.searchParams.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: process.env[`NCAA_${kind.toUpperCase()}_HASH`] || q.hash } }));
  url.searchParams.set('variables', JSON.stringify(q.vars(contestId)));
  const res = await fetch(url, { headers: { Origin: 'https://www.ncaa.com', Referer: 'https://www.ncaa.com/', 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`NCAA ${kind} ${contestId}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors && json.errors.length) throw new Error(`NCAA ${kind} ${contestId}: ${json.errors[0].message}`);
  return json.data;
}

const fetchGame = async id => { const d = await query('game', id); const c = d.contests && d.contests[0]; if (!c) throw new Error(`NCAA game ${id}: no contest`); return c; };
const fetchBoxscore = async id => (await query('box', id)).boxscore;

// Everything one cycle needs. The header and box score are optional extras, so a failure there doesn't lose the plays.
async function fetchBundle(contestId) {
  const [pbp, game, box] = await Promise.all([fetchPbp(contestId), fetchGame(contestId).catch(() => null), fetchBoxscore(contestId).catch(() => null)]);
  return { contestId: String(contestId), pbp, game, box };
}

module.exports.fetchGame = fetchGame;
module.exports.fetchBoxscore = fetchBoxscore;
module.exports.fetchBundle = fetchBundle;
