// Fetches everything one ESPN game needs into a single "bundle" so it can be stored raw and
// normalized offline: the competition header, every plays page, and the linked team, score,
// status, athlete and personnel documents.
const fetch = require('node-fetch');

const BASE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball';
const PAUSE_MS = 80;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  const secure = url.replace(/^http:/, 'https:');
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(secure, { timeout: 30000 }).catch(err => ({ ok: false, status: 0, err }));
    if (res.ok) { await sleep(PAUSE_MS); return res.json(); }
    if (attempt >= tries || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
      throw new Error(`GET ${secure} -> ${res.status || res.err.message}`);
    }
    await sleep(500 * attempt);
  }
}

const athleteIdOf = ref => (ref.match(/athletes\/(\d+)/) || [])[1];
const inPlay = entry => entry.whereabouts && entry.whereabouts.name === 'ROSTER_WHEREABOUTS_IN_PLAY';

async function fetchBundle(gameId, { verifySamples = 0 } = {}) {
  const compUrl = `${BASE}/events/${gameId}/competitions/${gameId}?lang=en&region=us`;
  const competition = await getJson(compUrl);

  const plays = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    const body = await getJson(`${BASE}/events/${gameId}/competitions/${gameId}/plays?limit=100&page=${page}`);
    pages = body.pageCount;
    plays.push(...body.items);
  }

  const refs = {};
  const grab = async ref => { if (ref && !refs[ref]) refs[ref] = await getJson(ref); return refs[ref]; };

  for (const c of competition.competitors) {
    await grab(c.team && c.team.$ref);
    await grab(c.score && c.score.$ref);
  }
  await grab(competition.status && competition.status.$ref);

  const teamStats = {};
  for (const c of competition.competitors) {
    teamStats[c.id] = await getJson(`${BASE}/events/${gameId}/competitions/${gameId}/competitors/${c.id}/statistics/0?lang=en&region=us`);
  }

  // Personnel at the first play of each period seeds the lineup reconstruction; optional extra
  // snapshots spread through the game are only used to verify it.
  const ordered = [...plays].sort((a, b) =>
    a.period.number - b.period.number || b.clock.value - a.clock.value || Number(a.sequenceNumber) - Number(b.sequenceNumber));
  const seeds = new Map();
  for (const p of ordered) if (!seeds.has(p.period.number)) seeds.set(p.period.number, p);
  const samples = [];
  if (verifySamples) {
    const seedSet = new Set(seeds.values());
    const pool = ordered.filter(p => p.type.text !== 'Substitution' && !seedSet.has(p));
    for (let i = 1; i <= verifySamples; i++) samples.push(pool[Math.floor((pool.length * i) / (verifySamples + 1))]);
  }
  for (const p of [...seeds.values(), ...samples]) {
    const snap = await grab(p.personnel && p.personnel.$ref);
    for (const side of snap.playPersonnel) {
      for (const e of side.entries.filter(inPlay)) await grab(e.athlete.$ref);
    }
  }
  for (const p of plays) for (const part of p.participants || []) await grab(part.athlete && part.athlete.$ref);

  return {
    gameId: String(gameId),
    fetchedAt: new Date().toISOString(),
    competition,
    plays,
    refs,
    teamStats,
    verify: samples.map(p => p.id),
  };
}

module.exports = { fetchBundle, athleteIdOf, inPlay, BASE };
