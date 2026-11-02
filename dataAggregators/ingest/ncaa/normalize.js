// Pure functions: NCAA.com play-by-play -> plays shaped like the other sources' normalized rows (no database access).
// NCAA gives free text only: no play ids, no shot coordinates, no on-court lineups. Players are identified by team + name,
// and a play's id is its position in the (chronological) feed, so ids are stable while NCAA only appends plays.
const REGULATION_PERIODS = 2;
const PERIOD_SECONDS = 1200;
const OT_SECONDS = 300;

const clockSeconds = display => { const m = /^(\d+):(\d+)/.exec(display || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const gameSeconds = (period, rem) => period <= REGULATION_PERIODS
  ? (period - 1) * PERIOD_SECONDS + (PERIOD_SECONDS - rem)
  : REGULATION_PERIODS * PERIOD_SECONDS + (period - REGULATION_PERIODS - 1) * OT_SECONDS + (OT_SECONDS - rem);

const SHOT_TYPES = { jumper: 'jumpshot', layup: 'layup', 'slam dunk': 'dunk', dunk: 'dunk', 'tip in': 'tip', tip: 'tip' };

// "<Event> [MISSED] by <Team>'s <Player>" -> parts; the team name may carry a stray space ("Winthrop 's").
const BY = /^(.*?)\s+by\s+(.+?)\s*'s\s+(.+?)\s*$/;
// Foul text names the drawer: "Personal Foul on X's A (B draws the foul)".
const FOUL = /^(.*?foul)\s+on\s+(.+?)\s*'s\s*([^()]+?)\s*(?:\(([^()]+?) draws the foul\))?\s*$/i;
const SUB = /^Subbing (in|out) for (.+?)-(.+?)\s*$/;

// The second grammar (seen on Villanova / Notre Dame): "<Player> makes two point jump shot", "<Player> turnover (lost ball)
// (<Stealer> steals)", "Team defensive rebound". The team comes from the row's teamId, not the text. The feed doubles many
// rows: the shot is repeated with the verb glued to the name ("Smithmisses ..."), and a made shot is repeated with
// "(X assists)" appended; normalizePlays drops/merges those. `isTeam` says a name is really the team (mascot) itself.
const SHOT_KINDS = { 'jump shot': 'jumpshot', jumpshot: 'jumpshot', layup: 'layup', dunk: 'dunk', 'hook shot': 'hook', 'tip shot': 'tip', tip: 'tip' };
function classifyB(text, isTeam) {
  const who = n => (n && !isTeam(n) ? n.trim() : null);
  let m = /^(.*?)(\s*)(makes|misses)\s+(two|three) point\s+(.+?)\s*(?:\((.+?) assists\))?$/.exec(text);
  if (m && SHOT_KINDS[m[5].toLowerCase()]) {
    return { category: 'shot_attempt', type: SHOT_KINDS[m[5].toLowerCase()], value: m[4] === 'two' ? 2 : 3, made: m[3] === 'makes', player: who(m[1]), assister: m[6] || null, glued: !m[2] && /\S$/.test(m[1]), byRow: true };
  }
  if ((m = /^(.*?)(\s*)(makes|misses)\s+(?:regular |technical |flagrant )?free throw\s+(\d) of (\d)$/.exec(text))) {
    return { category: 'free_throw', type: 'free_throw', subtype: `${m[4]}of${m[5]}`, value: 1, made: m[3] === 'makes', player: who(m[1]), glued: !m[2], byRow: true };
  }
  if ((m = /^(.+?) (offensive|defensive) rebound$/.exec(text))) return { category: 'rebound', type: m[2], player: who(m[1]), byRow: true };
  if ((m = /^(.+?) turnover \((.+?)\)(?: \((.+?) steals\))?$/.exec(text))) {
    return m[3] ? { category: 'steal', player: m[3].trim(), turnoverBy: who(m[1]), byRow: true }
      : { category: 'turnover', type: m[2].toLowerCase().replace(/\s+/g, ' ') === 'lost ball' ? 'lostball' : m[2].toLowerCase(), player: who(m[1]), byRow: true };
  }
  if ((m = /^(.+?) blocks (.+?)'s (.+)$/.exec(text))) return { category: 'block', player: who(m[1]), blockedPlayer: m[2], byRow: true };
  if ((m = /^(.*?)\s*(personal|shooting|offensive|technical|flagrant ?\d?|team) foul(?: \((.+?) draws the foul\))?$/i.exec(text))) {
    // the row's team is the player who drew the foul, so the fouler is on the other side
    return { category: 'foul', type: m[2].toLowerCase(), player: who(m[1]), drawnBy: m[3] || null, byRow: true, flip: !!m[3] };
  }
  if (/timeout|time out/i.test(text)) return { category: 'timeout', type: /tv|media|commercial/i.test(text) ? 'commercial' : /\b(30|20|60)\b|second/i.test(text) ? 'short' : 'full', byRow: true };
  if (/^End of /i.test(text)) return { category: 'period_admin', type: 'period', subtype: 'end', feedRow: true };
  return null;
}

function classify(text, isTeam = () => false) {
  let m = SUB.exec(text);
  if (m) return { category: 'substitution', subtype: m[1], team: m[2], player: m[3] };
  m = /^(.*?foul)\s+on\s+(.+?)\s*'s\s*\2\s*$/i.exec(text); // team foul: "Foul on X's X"
  if (m) return { category: 'foul', type: m[1].replace(/\s*foul$/i, '').trim().toLowerCase() || 'team', team: m[2], player: null };
  m = FOUL.exec(text);
  if (m) return { category: 'foul', type: m[1].replace(/\s*foul$/i, '').trim().toLowerCase() || 'personal', team: m[2], player: m[3] === m[2] ? null : m[3], drawnBy: m[4] || null };
  m = /^Turnover by (.+?)\s*\[(.+?)\]\s*$/i.exec(text);
  if (m) return { category: 'turnover', type: m[2].toLowerCase(), team: m[1], player: null };
  if (!BY.test(text)) { const b = classifyB(text, isTeam); if (b) return b; }
  m = BY.exec(text) || [];
  const [, event, team, player] = m;
  const ev = (event || '').trim();
  const missed = /\bMISSED\b/i.test(ev);
  const base = ev.replace(/\s*MISSED\s*/i, '').trim().toLowerCase();
  const who = { team, player };
  let n;
  if ((n = /^(\d) pointer$/.exec(base))) return { category: 'shot_attempt', type: null, value: Number(n[1]), made: !missed, ...who };
  if (SHOT_TYPES[base]) return { category: 'shot_attempt', type: SHOT_TYPES[base], value: null, made: !missed, ...who };
  if (base === 'free throw') return { category: 'free_throw', type: 'free_throw', value: 1, made: !missed, ...who };
  if (base === 'offensive rebound') return { category: 'rebound', type: 'offensive', ...who };
  if (base === 'defensive rebound') return { category: 'rebound', type: 'defensive', ...who };
  if (base === 'assist') return { category: 'assist', ...who };
  if (base === 'steal') return { category: 'steal', ...who };
  if (base === 'block') return { category: 'block', ...who };
  if (base === 'turnover') return { category: 'turnover', type: 'lostball', ...who };
  if (/^(personal|technical|flagrant|offensive|player control)?\s*foul$/.test(base) || /^[\w ]*foul$/.test(base)) return { category: 'foul', type: base.replace(/\s*foul$/, '') || 'personal', ...who };
  if (/time ?out/i.test(text)) return { category: 'timeout', type: /commercial/i.test(text) ? 'commercial' : /30|short/i.test(text) ? 'short' : 'full' };
  if (/rebound from a dead ball/i.test(text)) return { category: 'rebound', subtype: 'deadball' };
  if (/gains posses/i.test(text)) return { category: 'jumpball', type: 'won' };
  if (/end of (period|half|game)/i.test(text)) return { category: 'period_admin', type: /game/i.test(text) ? 'game' : 'period', subtype: 'end' };
  return { category: 'other', type: text };
}


function teamSideOf(play, teams) {
  if (play.teamId && play.teamId !== 0) { const t = teams.find(x => Number(x.teamId) === Number(play.teamId)); return t ? (t.isHome ? 'home' : 'away') : null; }
  return null;
}

// What the second grammar leaves out, put back from context (all flagged made_is_inferred / extra.inferred):
//  - rebounds are all labelled "defensive": a rebound by the shooter's own team after a miss is offensive
//  - made free throws have no rows at all: a point that no shot or free throw row accounts for is a made free throw, credited to
//    the player who drew the last foul for that team
//  - an offensive-foul turnover has no foul row: add the foul
function repairSecondGrammar(plays, gameId) {
  const out = [];
  const score = { home: 0, away: 0 };
  const anchor = { home: -1, away: -1 }; // index in `out` of the last row of the foul / free-throw trip that gave each side its shots
  const drawer = { home: null, away: null }; // last player to draw a foul, by the side that drew it
  let n = 0;
  const clone = (ref, over) => ({ ...ref, ...over, play_id: `${gameId}-r${++n}`, _assister: null, _glued: false, _b: true, inferred: true });
  for (const p of plays) {
    // points on this row that no earlier row explains: made free throws the feed never logged. They belong right after the foul
    // (or the last free throw of the trip), not on this later row, so they go there and the rows in between take the new score.
    for (const side of ['home', 'away']) {
      const now = side === 'home' ? p.home_score_after : p.away_score_after;
      const own = p.is_made && p.team_side === side ? (p.shot_value || (p.play_category === 'free_throw' ? 1 : 0)) : 0;
      let missing = now - score[side] - own;
      while (missing > 0 && missing <= 3 && !p.synthetic) {
        const at = anchor[side] >= 0 && out[anchor[side]].period_number === p.period_number ? anchor[side] : out.length - 1;
        const ref = out[at] || p, base = side === 'home' ? ref.home_score_after : ref.away_score_after;
        const ft = clone(ref, { team_side: side, player_name: drawer[side], play_category: 'free_throw', play_type: 'free_throw', play_subtype: null,
          play_description: 'Made free throw (inferred from the score)', shot_value: 1, is_shot_attempt: true, is_made: true, made_is_inferred: true, drawn_by: null, linked_play_id: null,
          is_neutral_event: false, home_score_after: ref.home_score_after + (side === 'home' ? 1 : 0), away_score_after: ref.away_score_after + (side === 'away' ? 1 : 0) });
        out.splice(at + 1, 0, ft);
        for (let k = at + 2; k < out.length; k++) { if (side === 'home') out[k].home_score_after += 1; else out[k].away_score_after += 1; }
        for (const sd of ['home', 'away']) if (anchor[sd] > at) anchor[sd] += 1;
        anchor[side] = at + 1;
        score[side] += 1; missing--;
      }
    }
    score.home = p.home_score_after; score.away = p.away_score_after;
    out.push(p);
    if (p.play_category === 'foul' && p.team_side) {
      const drawn = p.team_side === 'home' ? 'away' : 'home';
      if (p.drawn_by) drawer[drawn] = p.drawn_by;
      anchor[drawn] = out.length - 1;
    } else if (p.play_category === 'free_throw' && p.team_side && !p.inferred) anchor[p.team_side] = out.length - 1;
    if (p.play_category === 'turnover' && /offensive foul/.test(p.play_description) && p._b) {
      out.push(clone(p, { play_category: 'foul', play_type: 'offensive', play_description: 'Offensive foul (from the turnover)', shot_value: null, is_shot_attempt: false, is_made: null }));
    }
  }
  // rebounds: offensive when the team rebounding is the team that just missed
  let lastMiss = null;
  for (const p of out) {
    if (p.is_shot_attempt && p.is_made === false) {
      const m = /(\d)of(\d)/.exec(p.play_subtype || '');
      lastMiss = p.play_category === 'free_throw' && m && m[1] !== m[2] ? null : p; // a miss on the first of two free throws isn't live
    } else if (p.is_shot_attempt || p.play_category === 'turnover') lastMiss = null;
    else if (p.play_category === 'rebound' && p._b && p.play_type) {
      p.play_type = lastMiss && lastMiss.team_side === p.team_side ? 'offensive' : 'defensive';
      lastMiss = null;
    }
  }
  plays.length = 0; plays.push(...out);
}

/** bundle: the `playbyplay` object from fetchPbp. Returns { plays, unmapped }. */
function normalizePlays(pbp, { gameId = `ncaa-${pbp.contestId}` } = {}) {
  const teams = pbp.teams;
  const teamNames = new Set(teams.flatMap(t => ['Team', t.nameShort, t.nameFull, t.teamName, t.name6Char]).filter(Boolean));
  const isTeam = n => teamNames.has(String(n).trim());
  const plays = [];
  const unmapped = {};
  let i = 0;
  for (const period of pbp.periods) {
    for (const raw of period.playbyplayStats) {
      const text = raw.eventDescription;
      let c = classify(text, isTeam);
      if (c.category === 'other') unmapped[text.replace(/\s+/g, ' ')] = (unmapped[text.replace(/\s+/g, ' ')] || 0) + 1;

      const rem = clockSeconds(raw.clock);
      const side = c.team ? (teams.find(t => t.nameShort === c.team || t.nameFull === c.team) || {}).isHome : undefined;
      let team_side = c.byRow || side === undefined ? teamSideOf(raw, teams) : (side ? 'home' : 'away');
      if (c.flip && team_side) team_side = team_side === 'home' ? 'away' : 'home';
      const scored = c.category === 'shot_attempt' || c.category === 'free_throw';
      i++;
      plays.push({
        play_id: `${gameId}-${i}`,
        game_id: gameId,
        sequence_number: i,
        source: 'ncaa',
        source_play_id: String(i),
        period_number: period.periodNumber,
        period_type: period.periodNumber > REGULATION_PERIODS ? 'ot' : 'regulation',
        clock_seconds_remaining: rem,
        clock_display: raw.clock,
        game_seconds_elapsed: rem == null ? null : gameSeconds(period.periodNumber, rem),
        team_side,
        is_neutral_event: !team_side,
        player_name: c.player && c.player !== c.team ? c.player : c.player ? null : (raw.firstName && raw.lastName && raw.firstName !== raw.lastName ? `${raw.firstName} ${raw.lastName}` : null),
        play_category: c.category,
        play_type: c.type || null,
        play_subtype: c.subtype || null,
        play_description: text,
        home_score_after: raw.homeScore,
        away_score_after: raw.visitorScore,
        shot_value: scored ? c.value : null,
        is_shot_attempt: scored,
        is_made: scored ? c.made : null,
        drawn_by: c.drawnBy || null,
        _assister: c.assister || null, _glued: !!c.glued, _b: !!c.byRow && c.category !== 'timeout', _flip: !!c.flip, _feedRow: !!c.feedRow, _turnoverBy: c.turnoverBy || null,
        linked_play_id: null,
        has_valid_location: false,
      });
    }
  }

  // Second grammar only: drop the verb-glued duplicate rows and the end-of-period markers, and fold the "(X assists)" repeat of a
  // made shot into the made shot just before it.
  const kept = [];
  for (const p of plays) {
    if (p._feedRow) continue;
    const prev = kept[kept.length - 1];
    const twin = prev && prev.play_category === p.play_category && prev.period_number === p.period_number && prev.clock_display === p.clock_display
      && prev.team_side === p.team_side && prev.player_name === p.player_name && prev.is_made === p.is_made && prev.shot_value === p.shot_value;
    if (p._glued && twin) continue; // the verb-glued repeat of the row just before it; a glued row on its own is the only copy, so it stays
    if (twin && prev._glued && !p._glued) kept.pop(); // ...or the glued copy came first
    else if (twin && p._b && p.play_category === 'shot_attempt' && prev.play_description === p.play_description) continue; // layups are logged twice, word for word
    if (p._assister && p.play_category === 'shot_attempt' && prev && prev.is_made && prev.play_category === 'shot_attempt' && !prev._assister
        && prev.period_number === p.period_number && prev.clock_display === p.clock_display && prev.team_side === p.team_side
        && prev.player_name === p.player_name && prev.shot_value === p.shot_value) { prev._assister = p._assister; continue; }
    kept.push(p);
  }
  plays.length = 0; plays.push(...kept);
  if (plays.some(p => p._b)) repairSecondGrammar(plays, gameId);

  // The feed occasionally carries a bad running score on a run of rows (seen: 16-22 between 4-8 and 6-8). A score above any
  // later row's can't be right. Against ESPN the shot on such a row was a phantom (ESPN has no such shot and one fewer assist),
  // so those rows keep the running score, score no points, and are flagged suspect for consumers to drop.
  const sufMin = [Infinity, Infinity];
  const bad = new Array(plays.length);
  for (let k = plays.length - 1; k >= 0; k--) {
    const p = plays[k];
    bad[k] = p.home_score_after > sufMin[0] || p.away_score_after > sufMin[1];
    if (!bad[k]) { sufMin[0] = Math.min(sufMin[0], p.home_score_after); sufMin[1] = Math.min(sufMin[1], p.away_score_after); }
  }

  // Shot values: "Jumper"/"Layup" rows don't say 2 or 3; a made one is the score change.
  // Assists / steals / blocks / rebounds hang off the row just before them at the same clock.
  const prevScore = [0, 0];
  plays.forEach((p, idx) => {
    if (bad[idx]) {
      p.home_score_after = prevScore[0]; p.away_score_after = prevScore[1]; p.score_repaired = true;
      p.suspect = true;
    }
    const dh = p.home_score_after - prevScore[0], da = p.away_score_after - prevScore[1];
    if (p.play_category === 'shot_attempt' && p.is_made && p.shot_value == null) {
      p.shot_value = Math.max(dh, da) || 2; // no score change on a made shot: a stale feed score; assume a two
      if (!Math.max(dh, da)) p.shot_value_inferred = true;
    }
    prevScore[0] = p.home_score_after; prevScore[1] = p.away_score_after;
    if (p.play_category === 'assist' || p.play_category === 'steal' || p.play_category === 'block') {
      const want = p.play_category === 'assist' ? q => q.is_shot_attempt && q.is_made
        : p.play_category === 'steal' ? q => q.play_category === 'turnover'
        : q => q.play_category === 'shot_attempt' && q.is_made === false;
      for (let j = idx - 1; j >= Math.max(0, idx - 4); j--) {
        const q = plays[j];
        if (q.period_number === p.period_number && q.clock_seconds_remaining === p.clock_seconds_remaining && want(q) && !q._linked && q.team_side !== p.team_side === (p.play_category !== 'assist')) { p.linked_play_id = q.play_id; q._linked = true; break; }
      }
    }
  });
  plays.forEach(p => { delete p._linked; });
  return { plays, unmapped };
}

function extractHeader(pbp) {
  const home = pbp.teams.find(t => t.isHome), away = pbp.teams.find(t => !t.isHome);
  const last = [].concat(...pbp.periods.map(p => p.playbyplayStats)).pop();
  return {
    ncaaContestId: String(pbp.contestId), status: pbp.status, period: pbp.period,
    clock: `${pbp.minutes}:${pbp.seconds}`, home, away,
    homeScore: last ? last.homeScore : 0, awayScore: last ? last.visitorScore : 0,
  };
}

module.exports = { normalizePlays, extractHeader, classify };
