// Pure functions: WMT game payload -> canonical rows. No database access.
const REGULATION_PERIODS = 2;      // men's college: two 20-minute halves
const PERIOD_SECONDS = 1200;
const OT_SECONDS = 300;

// WMT play_time is MM:SS:cc, where cc is hundredths of a second.
function parseClock(playTime) {
  const [m, s, cs] = String(playTime).split(':').map(Number);
  return m * 60 + s + (cs || 0) / 100;
}

function displayClock(playTime) {
  const [m, s, cs] = String(playTime).split(':');
  return `${Number(m)}:${s}${Number(cs) ? '.' + cs.replace(/0+$/, '') : ''}`;
}

function gameSecondsElapsed(period, remaining) {
  if (period <= REGULATION_PERIODS) return (period - 1) * PERIOD_SECONDS + (PERIOD_SECONDS - remaining);
  return REGULATION_PERIODS * PERIOD_SECONDS + (period - REGULATION_PERIODS - 1) * OT_SECONDS + (OT_SECONDS - remaining);
}

// game_date is local wall time (the trailing Z is misleading); game_date_utc is true UTC.
function extractHeader(payload) {
  const g = payload.data;
  return {
    wmtGameId: String(g.id),
    date: g.game_date.slice(0, 10),
    tipoffLocal: g.game_date.slice(11, 16),
    venueTz: g.local_time_zone,
    venue: g.venue && g.venue.name,
    attendance: g.attendance,
    isNeutralSite: g.neutral_site,
    isConferenceGame: g.conference_contest,
    isFinal: !!g.stats_finalized,
    competitors: g.competitors.map(c => ({
      competitorId: c.id,
      schoolId: String(c.schoolId),
      wmtTeamId: c.teamId,
      name: c.nameTabular,
      isHome: c.schoolId === g.home_school_id,
      score: c.score,
    })),
    players: g.players.data.map(p => ({
      wmtPlayerId: String(p.player_id),
      gamePlayerId: String(p.game_player_id),
      teamWmtId: p.team_id,
      name: p.xml_name,
    })),
  };
}

const SHOT_TYPES = { '2pt': 2, '3pt': 3 };

function shotFamily(subType) {
  if (!subType) return null;
  if (subType.startsWith('tipin')) return 'tip';
  if (subType.includes('layup')) return 'layup';
  if (subType.includes('dunk')) return 'dunk';
  if (subType.includes('jumpshot')) return 'jumpshot';
  return subType;
}

const ADMIN_RANK = { 'game:start': 0, 'period:start': 1, 'jumpball:startperiod': 2, 'period:end': 8, 'game:end': 9 };

function categorize(a) {
  const t = a.play_action_type, sub = a.play_action_sub_type;
  if (SHOT_TYPES[t]) return { category: 'shot_attempt', type: shotFamily(sub), subtype: sub };
  switch (t) {
    case 'freethrow': return { category: 'free_throw', type: 'free_throw', subtype: sub };
    case 'assist': return { category: 'assist' };
    case 'block': return { category: 'block' };
    case 'steal': return { category: 'steal' };
    case 'rebound':
      // Dead-ball rebounds are credited separately and are not in the official rebound totals.
      return sub && sub.endsWith('deadball')
        ? { category: 'rebound', type: sub.replace('deadball', ''), subtype: 'deadball' }
        : { category: 'rebound', type: sub };
    case 'turnover': return { category: 'turnover', type: sub };
    case 'foul': return { category: 'foul', type: sub };
    case 'substitution': return { category: 'substitution', subtype: sub };
    case 'timeout': return { category: 'timeout', type: sub };
    case 'jumpball': return { category: 'jumpball', type: sub };
    case 'game':
    case 'period': return { category: 'period_admin', type: t, subtype: sub };
    default: return { category: 'other', type: t, subtype: sub };
  }
}

const MAIN_ROLE = {
  shot_attempt: 'shooter', free_throw: 'shooter', rebound: 'rebounder',
  turnover: 'turned_over_by', foul: 'fouler',
};

/**
 * ctx: { gameId, rawId, teamByCompetitor: Map(competitorId -> {teamId, side}),
 *        playerByGamePlayer: Map(gamePlayerId -> internal player_id) }
 */
function normalizePlays(payload, ctx) {
  const rows = payload.data.actions.data;
  const byId = new Map(rows.map(r => [r.id, r]));
  const unmapped = {};

  // foulon rows only say who was fouled; they become a participant on the foul.
  const fouledBy = new Map();
  const assisted = new Set();
  const attached = new Map(); // parent action id -> [{role, playerId}]
  const attach = (parentId, role, playerId) => {
    if (!playerId) return;
    if (!attached.has(parentId)) attached.set(parentId, []);
    attached.get(parentId).push({ role, playerId });
  };
  const playerOf = r => (r.game_player_id ? ctx.playerByGamePlayer.get(String(r.game_player_id)) || null : null);

  for (const r of rows) {
    const a = r.action, t = a.play_action_type, parent = a.play_by_play_id;
    if (t === 'foulon') attach(parent, 'fouled', playerOf(r));
    else if (t === 'assist') { attach(parent, 'assister', playerOf(r)); assisted.add(parent); }
    else if (t === 'block') attach(parent, 'blocker', playerOf(r));
    else if (t === 'steal') attach(parent, 'stealer', playerOf(r));
  }

  const kept = rows.filter(r => r.action.play_action_type !== 'foulon');

  const prepared = kept.map(r => {
    const a = r.action;
    const c = categorize(a);
    if (c.category === 'other') unmapped[a.play_action_type] = (unmapped[a.play_action_type] || 0) + 1;
    return { r, a, c, remaining: parseClock(a.play_time) };
  });

  // Order within a period: clock, then running score, then admin position, then feed id.
  // Row ids alone are unreliable at equal clocks (a substitution can be entered after the free throw
  // it preceded), while each row's score is reliable. Assists, blocks and steals sort right after
  // the play they attach to.
  const rank = p => ADMIN_RANK[`${p.a.play_action_type}:${p.a.play_action_sub_type}`] ?? 5;
  const preparedById = new Map(prepared.map(p => [p.r.id, p]));
  const ATTACHED = new Set(['assist', 'block', 'steal']);
  for (const p of prepared) {
    const parent = ATTACHED.has(p.a.play_action_type) ? preparedById.get(p.a.play_by_play_id) : null;
    p.anchor = parent || p;
    p.isChild = parent ? 1 : 0;
  }
  const total = p => p.a.home_score + p.a.visitor_score;
  prepared.sort((x, y) =>
    x.anchor.a.period_number - y.anchor.a.period_number ||
    y.anchor.remaining - x.anchor.remaining ||
    total(x.anchor) - total(y.anchor) ||
    rank(x.anchor) - rank(y.anchor) ||
    x.anchor.r.id - y.anchor.r.id ||
    x.isChild - y.isChild ||
    x.r.id - y.r.id);

  const plays = [];
  const participants = [];

  prepared.forEach((p, i) => {
    const { r, a, c, remaining } = p;
    const team = r.competitor_id ? ctx.teamByCompetitor.get(r.competitor_id) : null;
    const playerId = playerOf(r);
    const isShot = c.category === 'shot_attempt';
    const isFt = c.category === 'free_throw';
    const scored = isShot || isFt;
    const playId = `${ctx.gameId}-${r.id}`;
    const lineup = s => (s ? s.split(';').filter(Boolean).map(id => ctx.playerByGamePlayer.get(id) || null) : null);
    const quals = a.play_qualifiers ? a.play_qualifiers.split(';').filter(Boolean) : null;
    const who = a.dsp_name === 'Team' ? 'Team' : a.dsp_name;
    const outcome = scored ? (a.play_successful ? ' made' : ' missed') : '';

    plays.push({
      play_id: playId,
      game_id: ctx.gameId,
      sequence_number: i + 1,
      source: 'wmt',
      source_play_id: String(r.id),
      source_play_ref: `raw:${ctx.rawId}:actions:${r.id}`,
      period_number: a.period_number,
      period_type: a.period_number > REGULATION_PERIODS ? 'ot' : 'regulation',
      clock_seconds_remaining: remaining,
      clock_display: displayClock(a.play_time),
      game_seconds_elapsed: gameSecondsElapsed(a.period_number, remaining),
      wallclock_utc: a.utc_time_of_play,
      team_id: team ? team.teamId : null,
      team_side: team ? team.side : null,
      is_neutral_event: !r.competitor_id,
      player_id: playerId,
      play_category: c.category,
      play_type: c.type || null,
      play_subtype: c.subtype || null,
      play_description: [who, a.play_action_type, a.play_action_sub_type].filter(Boolean).join(' ') + outcome,
      home_score_after: a.home_score,
      away_score_after: a.visitor_score,
      shot_value: isShot ? SHOT_TYPES[a.play_action_type] : isFt ? 1 : null,
      is_shot_attempt: scored,
      is_made: scored ? !!a.play_successful : null,
      made_is_inferred: false,
      is_assisted: isShot && a.play_successful ? assisted.has(r.id) : null,
      linked_play_id: a.play_by_play_id && byId.has(a.play_by_play_id) ? `${ctx.gameId}-${a.play_by_play_id}` : null,
      court_x: null,
      court_y: null,
      raw_x: isShot ? a.x_coordinate : null,
      raw_y: isShot ? a.y_coordinate : null,
      goal_side: isShot ? a.side_of_teams_goal : null,
      area_of_action: isShot ? a.area_of_action : null,
      has_valid_location: isShot && a.x_coordinate != null && a.y_coordinate != null && !!a.area_of_action,
      play_qualifiers: quals,
      shot_clock_seconds: null, // WMT reports 00:00:00 on every row in the sampled games
      lineup_home: lineup(a.home_players_on_court),
      lineup_away: lineup(a.visitor_players_on_court),
      win_probability_home: null,
      sources: { wmt: { id: r.id } },
      extra: {
        description_generated: true,
        game_period_id: a.game_period_id,
        dsp_name: a.dsp_name,
        competitor_id: r.competitor_id,
        game_player_id: r.game_player_id,
      },
    });

    // Assist, block and steal rows are attached to their parent play, so their player is
    // recorded once, on the parent, to keep role counts from double counting.
    let role = MAIN_ROLE[c.category];
    if (c.category === 'substitution') role = c.subtype === 'in' ? 'sub_in' : c.subtype === 'out' ? 'sub_out' : null;
    if (c.category === 'jumpball' && playerId) {
      role = c.type === 'won' ? 'jumpball_won_by'
        : c.type === 'lost' && team ? (team.side === 'home' ? 'jumpball_home' : 'jumpball_away') : null;
    }
    if (role && playerId) participants.push({ play_id: playId, player_id: playerId, role });
    for (const x of attached.get(r.id) || []) participants.push({ play_id: playId, player_id: x.playerId, role: x.role });
  });

  return { plays, participants, unmapped };
}

module.exports = { extractHeader, normalizePlays, parseClock, gameSecondsElapsed, REGULATION_PERIODS };
