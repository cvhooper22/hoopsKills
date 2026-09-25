// Pure functions: ESPN game bundle -> canonical rows. No database access.
const { athleteIdOf, inPlay } = require('./fetch');

const REGULATION_PERIODS = 2;
const PERIOD_SECONDS = 1200;
const OT_SECONDS = 300;

const idOf = (ref, kind) => (String(ref).match(new RegExp(`${kind}/(\\d+)`)) || [])[1];
const body = (bundle, obj) => (obj && obj.$ref ? bundle.refs[obj.$ref] : null);

// ESPN dates are UTC with no timezone. US tip-offs before 10:00 UTC are the previous local day.
function localDate(utcIso) {
  const d = new Date(utcIso);
  if (d.getUTCHours() < 10) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function extractHeader(bundle) {
  const c = bundle.competition;
  const status = body(bundle, c.status);
  const competitors = c.competitors.map(x => {
    const team = body(bundle, x.team);
    return {
      espnTeamId: String(x.id),
      isHome: x.homeAway === 'home',
      name: team.shortDisplayName || team.location,
      score: body(bundle, x.score).value,
    };
  });
  return {
    espnGameId: bundle.gameId,
    date: localDate(c.date),
    utcDate: c.date,
    venue: c.venue && c.venue.fullName,
    attendance: c.attendance,
    isNeutralSite: c.neutralSite,
    isConferenceGame: c.conferenceCompetition,
    status: status && status.type && status.type.completed ? 'final' : status && status.type && status.type.state === 'in' ? 'live' : 'scheduled',
    competitors,
    // every athlete seen in plays or on-court snapshots, with the team they appeared for
    athletes: collectAthletes(bundle),
  };
}

function collectAthletes(bundle) {
  const found = new Map(); // athleteId -> { name, espnTeamId }
  const add = (obj, espnTeamId) => {
    const id = obj && obj.$ref && athleteIdOf(obj.$ref);
    const a = body(bundle, obj);
    if (id && a && !found.has(id)) found.set(id, { athleteId: id, name: a.fullName || a.displayName, espnTeamId });
  };
  for (const p of bundle.plays) {
    const team = p.team && idOf(p.team.$ref, 'teams');
    for (const part of p.participants || []) add(part.athlete, team);
  }
  for (const [url, snap] of Object.entries(bundle.refs)) {
    if (!snap.playPersonnel) continue;
    for (const side of snap.playPersonnel) {
      const team = idOf(side.competitor.$ref, 'competitors');
      for (const e of side.entries.filter(inPlay)) add(e.athlete, team);
    }
  }
  return [...found.values()];
}

// personnel snapshots keyed by play id: { espnTeamId: Set(athleteId) } of players in play
function snapshots(bundle) {
  const out = new Map();
  for (const [url, snap] of Object.entries(bundle.refs)) {
    if (!snap.playPersonnel) continue;
    const playId = (url.match(/plays\/(\d+)\/personnel/) || [])[1];
    const bySide = {};
    for (const side of snap.playPersonnel) {
      bySide[idOf(side.competitor.$ref, 'competitors')] = new Set(side.entries.filter(inPlay).map(e => athleteIdOf(e.athlete.$ref)));
    }
    out.set(playId, bySide);
  }
  return out;
}

const SHOT_TYPES = { 558: 'jumpshot', 572: 'layup', 574: 'dunk', 437: 'tip' };

function categorize(item) {
  const id = String(item.type.id), text = item.type.text || '';
  if (SHOT_TYPES[id]) return { category: 'shot_attempt', type: SHOT_TYPES[id] };
  switch (id) {
    case '540': return { category: 'free_throw', type: 'free_throw' };
    case '586': return { category: 'rebound', type: 'offensive' };
    case '587': return { category: 'rebound', type: 'defensive' };
    case '449': return { category: 'rebound', subtype: 'deadball' };
    case '598': return { category: 'turnover', type: 'lostball' };
    case '607': return { category: 'steal' };
    case '618': return { category: 'block' };
    case '519': return { category: 'foul', type: 'personal' };
    case '584': return { category: 'substitution', subtype: /subbing in/i.test(item.text) ? 'in' : /subbing out/i.test(item.text) ? 'out' : null };
    case '578': return { category: 'timeout', type: 'full' };
    case '579': return { category: 'timeout', type: 'short' };
    case '580': return { category: 'timeout', type: 'commercial' };
    case '615': return { category: 'jumpball', type: 'won' };
    case '412': return { category: 'period_admin', type: 'period', subtype: 'end' };
    case '402': return { category: 'period_admin', type: 'game', subtype: 'end' };
  }
  if (/turnover/i.test(text)) return { category: 'turnover', type: text.replace(/\s*turnover/i, '').trim().toLowerCase() || null };
  if (/foul/i.test(text)) return { category: 'foul', type: text.replace(/foul/i, '').trim().toLowerCase() || null };
  return { category: 'other', type: text, unmappedKey: `${id}:${text}` };
}

const ADMIN_RANK = { '412': 8, '402': 9 };
const gameSeconds = (period, rem) => period <= REGULATION_PERIODS
  ? (period - 1) * PERIOD_SECONDS + (PERIOD_SECONDS - rem)
  : REGULATION_PERIODS * PERIOD_SECONDS + (period - REGULATION_PERIODS - 1) * OT_SECONDS + (OT_SECONDS - rem);

/**
 * ctx: { gameId, rawId, teamByEspnId: Map(espnTeamId -> {teamId, side}),
 *        playerByAthlete: Map(athleteId -> internal player_id) }
 */
function normalizePlays(bundle, ctx) {
  const unmapped = {};
  const snaps = snapshots(bundle);

  const prepared = bundle.plays.map(item => {
    const c = categorize(item);
    if (c.unmappedKey) unmapped[c.unmappedKey] = (unmapped[c.unmappedKey] || 0) + 1;
    const espnTeamId = item.team ? idOf(item.team.$ref, 'teams') : null;
    return {
      item, c, espnTeamId,
      seq: Number(item.sequenceNumber),
      period: item.period.number,
      remaining: item.clock.value,
      total: item.homeScore + item.awayScore,
      athletes: (item.participants || []).map(p => ({ athleteId: athleteIdOf(p.athlete.$ref), type: p.type || null })),
    };
  });

  // Order: period, clock, running score (ESPN's own sequence numbers have small inversions), the
  // scoring play ahead of rows that already show its score, period/game end last, then sequence number.
  prepared.sort((x, y) =>
    x.period - y.period || y.remaining - x.remaining || x.total - y.total ||
    (y.item.scoringPlay ? 1 : 0) - (x.item.scoringPlay ? 1 : 0) ||
    (ADMIN_RANK[x.item.type.id] || 5) - (ADMIN_RANK[y.item.type.id] || 5) || x.seq - y.seq);

  // Steals and blocks have no link to their parent: attach each to the nearest turnover
  // (for a steal) or missed shot (for a block) at the same period and clock, and sort it just after.
  const parentOf = new Map();
  for (const child of prepared.filter(p => p.c.category === 'steal' || p.c.category === 'block')) {
    const want = child.c.category === 'steal'
      ? p => p.c.category === 'turnover'
      : p => p.c.category === 'shot_attempt' && !p.item.scoringPlay;
    const cands = prepared.filter(p => p !== child && !parentOf.has(p) && p.period === child.period
      && p.remaining === child.remaining && want(p) && p.espnTeamId !== child.espnTeamId);
    if (!cands.length) continue;
    cands.sort((a, b) => Math.abs(a.seq - child.seq) - Math.abs(b.seq - child.seq));
    parentOf.set(cands[0], child);
    child.parent = cands[0];
  }
  for (const child of prepared.filter(p => p.parent)) {
    prepared.splice(prepared.indexOf(child), 1);
    prepared.splice(prepared.indexOf(child.parent) + 1, 0, child);
  }

  // On-court snapshot taken at the first play of each period. Snapshots fetched only to verify the
  // reconstruction (bundle.verify) are never used to seed it.
  const verifyIds = new Set(bundle.verify || []);
  const seedSnapshot = new Map();
  for (const p of prepared) {
    if (!seedSnapshot.has(p.period) && snaps.has(p.item.id) && !verifyIds.has(p.item.id)) seedSnapshot.set(p.period, snaps.get(p.item.id));
  }

  const plays = [];
  const participants = [];
  const state = {}; // espnTeamId -> Set(athleteId) on court
  let lastPeriod = null;
  const internal = athleteId => ctx.playerByAthlete.get(athleteId) || null;
  const lineup = espnTeamId => (state[espnTeamId] && state[espnTeamId].size ? [...state[espnTeamId]].map(internal).sort() : null);
  const homeId = [...ctx.teamByEspnId].find(([, t]) => t.side === 'home')[0];
  const awayId = [...ctx.teamByEspnId].find(([, t]) => t.side === 'away')[0];

  const playIdOf = p => `${ctx.gameId}-${p.item.id}`;

  prepared.forEach((p, i) => {
    const { item, c } = p;
    if (p.period !== lastPeriod) {
      lastPeriod = p.period;
      const snap = seedSnapshot.get(p.period);
      if (snap) for (const [team, set] of Object.entries(snap)) state[team] = new Set(set);
    }
    // substitutions move players on and off the court; state shown is after the row
    if (c.category === 'substitution' && p.espnTeamId && p.athletes[0]) {
      state[p.espnTeamId] = state[p.espnTeamId] || new Set();
      if (c.subtype === 'in') state[p.espnTeamId].add(p.athletes[0].athleteId);
      if (c.subtype === 'out') state[p.espnTeamId].delete(p.athletes[0].athleteId);
    }

    const team = p.espnTeamId ? ctx.teamByEspnId.get(p.espnTeamId) : null;
    const main = p.athletes.find(a => a.type === 'shooter' || a.type === 'offense' || a.type === 'subin' || a.type === null) || null;
    const playerId = main ? internal(main.athleteId) : null;
    const isShot = c.category === 'shot_attempt';
    const isFt = c.category === 'free_throw';
    const scored = isShot || isFt;
    const assister = p.athletes.find(a => a.type === 'assister');

    plays.push({
      play_id: playIdOf(p),
      game_id: ctx.gameId,
      sequence_number: i + 1,
      source: 'espn',
      source_play_id: item.id,
      source_play_ref: `raw:${ctx.rawId}:plays:${item.id}`,
      period_number: p.period,
      period_type: p.period > REGULATION_PERIODS ? 'ot' : 'regulation',
      clock_seconds_remaining: p.remaining,
      clock_display: item.clock.displayValue,
      game_seconds_elapsed: gameSeconds(p.period, p.remaining),
      wallclock_utc: item.wallclock || null,
      team_id: team ? team.teamId : null,
      team_side: team ? team.side : null,
      is_neutral_event: !team,
      player_id: playerId,
      play_category: c.category,
      play_type: c.type || null,
      play_subtype: c.subtype || null,
      play_description: item.text,
      home_score_after: item.homeScore,
      away_score_after: item.awayScore,
      shot_value: isShot ? item.pointsAttempted || null : isFt ? 1 : null,
      is_shot_attempt: scored,
      is_made: scored ? !!item.scoringPlay : null,
      made_is_inferred: false,
      is_assisted: isShot && item.scoringPlay ? !!assister : null,
      linked_play_id: p.parent ? playIdOf(p.parent) : null,
      court_x: isShot && item.coordinate ? item.coordinate.x : null,
      court_y: isShot && item.coordinate ? item.coordinate.y : null,
      raw_x: null, raw_y: null, goal_side: null, area_of_action: null,
      has_valid_location: isShot && !!item.coordinate && !(item.coordinate.x === 25 && item.coordinate.y === 0),
      play_qualifiers: null,
      shot_clock_seconds: null,
      lineup_home: lineup(homeId),
      lineup_away: lineup(awayId),
      win_probability_home: null,
      sources: { espn: { id: item.id, sequenceNumber: item.sequenceNumber } },
      extra: { modified: item.modified, priority: item.priority, valid: item.valid },
    });

    // Steal and block players are recorded on the parent play when one was found, as with WMT.
    const targetPlayId = (c.category === 'steal' || c.category === 'block') && p.parent ? playIdOf(p.parent) : playIdOf(p);
    const add = (role, athleteId) => {
      const pid = athleteId && internal(athleteId);
      if (pid) participants.push({ play_id: targetPlayId, player_id: pid, role });
    };
    if (main) {
      const a = main.athleteId;
      if (isShot || isFt) add('shooter', a);
      else if (c.category === 'rebound') add('rebounder', a);
      else if (c.category === 'turnover') add('turned_over_by', a);
      else if (c.category === 'foul') add('fouler', a);
      else if (c.category === 'steal') add('stealer', a);
      else if (c.category === 'block') add('blocker', a);
      else if (c.category === 'substitution') add(c.subtype === 'in' ? 'sub_in' : 'sub_out', a);
      else if (c.category === 'jumpball') add('jumpball_won_by', a);
    }
    if (assister) add('assister', assister.athleteId);
  });

  return { plays, participants, unmapped };
}

module.exports = { extractHeader, normalizePlays, snapshots, localDate, REGULATION_PERIODS };
