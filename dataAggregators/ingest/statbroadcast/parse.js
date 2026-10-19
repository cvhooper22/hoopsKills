// Pure functions: rendered StatBroadcast play-by-play page (HTML) -> canonical plays. No database, no network.
//
// StatBroadcast has no structured feed we can use, only the rendered page: one table per period, and
// everything beyond time / team / score / type is recovered from the free-text "Play" column. Players
// carry no ids, only "TEAM #jersey last, first", so they come out as player refs ({team, jersey, name})
// for a later step to resolve against a roster.
//
// Row order in the table is the play order (feed is ascending), so the position in the period is the
// only play identity there is. source_play_id is `p{period}-{index}`.
const { gameSecondsElapsed, REGULATION_PERIODS } = require('../wmt/normalize');
const { toCanonical } = require('./canonical');
const { parseBox } = require('./box');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = s => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m);
const squash = s => s.replace(/\s+/g, ' ').trim();
const textOf = html => squash(decode(html.replace(/<[^>]+>/g, ' ')));

const PLAYER_RE = /([A-Z]{2,6}) #(\w+)\s*<span class="capitalize">([^<]*)<\/span>/;

function parseClock(display) {
  const m = /^(\d+):(\d{2})(?:\.(\d+))?$/.exec(display);
  return m ? Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number('0.' + m[3]) : 0) : null;
}

// Header facts are only what the page states; home/away comes from the V (visitor) / H (home) markers.
// The home score span is mislabelled sb-teamscoreV in the page, so scores are taken positionally.
function extractHeader(html) {
  // The team name cell can hold an icon (the possession arrow on a live page) and a seed span before the name, so take the
  // cell's text rather than assuming the name follows the opening tag.
  const name = side => { const m = new RegExp(`sb-teamname${side}">(.*?)</div>`, 's').exec(html); return m ? textOf(m[1]) || null : null; };
  const scores = [...html.matchAll(/sb-teamscore[^"]*">(\d+)</g)].map(m => Number(m[1]));
  const eventId = /window\._sbe="(\d+)"/.exec(html);
  // Final / Halftime sit in one big cell; during play the status cell holds the period and the clock in two divs ("1st", "15:35").
  const big = /font-size-300[^>]*>([^<]+)</.exec(html);
  const clockCell = /sb-statusbar-clock[^>]*>(.*?)<\/div><\/div><\/div>/s.exec(html);
  const statusText = big ? squash(big[1]) : clockCell ? textOf(clockCell[1]) || null : null;
  return {
    sbEventId: eventId ? eventId[1] : null,
    awayName: name('V'),
    homeName: name('H'),
    awayScore: scores[0] ?? null,
    homeScore: scores[1] ?? null,
    statusText,
    isFinal: /completedGame = true/.test(html) || /^final/i.test(statusText || ''),
  };
}

// ---- play text -> structured fields ---------------------------------------------------------------

const QUALIFIERS = [
  [/\bsecond-chance\b/g, '2ndchance'],
  [/\bon the fast break\b/g, 'fastbreak'],
  [/\boff an opponent turnover\b/g, 'off_turnover'],
  [/\bin the paint\b/g, 'in_paint'],
];

function takeQualifiers(text) {
  const quals = [];
  for (const [re, q] of QUALIFIERS) if (re.test(text)) { quals.push(q); text = text.replace(re, ' '); }
  return { text: squash(text), quals };
}

// "DRIVING driving layup" / "TIPINDUNK tipindunk jumper" / "3PT jumper" / "layup".
// The all-caps token is StatBroadcast's shot code; the lowercase word that ends the phrase is the family
// (the tipin* codes end in "jumper" but are tip-ins, so the code wins).
function parseShot(descriptor) {
  const is3 = /\b3PT\b/.test(descriptor);
  const words = descriptor.replace(/\b3PT\b/, ' ').split(' ').filter(Boolean);
  const code = words.find(w => /^[A-Z]+$/.test(w));
  const word = words.filter(w => !/^[A-Z]+$/.test(w)).pop();
  let family = word === 'jumper' ? 'jumpshot' : word || null;
  if (code && code.startsWith('TIPIN')) family = 'tip';
  return { value: is3 ? 3 : 2, family, subtype: code ? code.toLowerCase() : null };
}

const FOUL_DETAILS = [[/shooting foul/, 'shooting'], [/one and one awarded on the bonus/, 'bonus_one_and_one'], [/two shots? awarded/, 'bonus_two_shots']];

/**
 * Classify one row. `tail` is the play text with the player replaced by "§P"; `who` is the player ref
 * (or null); `team` is the abbreviation in the Team column. Returns the category fields.
 */
function classify(rowClass, typeCell, tail, who, team) {
  const t = tail.replace(/^Substitution (IN|OUT): /, 'Substitution $1 ');
  let m;

  if (/^HELDBALL/i.test(t)) return { category: 'other', type: 'heldball' };
  if ((m = /^JUMPBALL WON BY (\w+)/i.exec(t))) return { category: 'jumpball', type: 'won', teamOverride: m[1] };

  if (/^(Made|Missed|Blocked) /.test(t)) {
    const outcome = t.split(' ')[0].toLowerCase();
    const body = t.replace(/^(Made|Missed|Blocked) /, '');
    if (/\bFree Throw\b/.test(body)) {
      const n = /\((\d)OF(\d)\)/.exec(body);
      const { quals } = takeQualifiers(body);
      return { category: 'free_throw', type: 'free_throw', made: outcome === 'made', value: 1, quals,
        extra: n ? { ft_number: Number(n[1]), ft_total: Number(n[2]) } : {} };
    }
    const descriptor = body.replace(/\s*by §P.*$/, '').replace(/\s*(\(|;).*$/, '');
    const { text, quals } = takeQualifiers(descriptor);
    const s = parseShot(text);
    return { category: 'shot_attempt', type: s.family, subtype: s.subtype, made: outcome === 'made', value: s.value, quals,
      blocked: outcome === 'blocked' };
  }

  if (/^assist by/i.test(t)) return { category: 'assist' };
  if (/^block by/i.test(t)) return { category: 'block' };
  if (/^steal by/i.test(t)) return { category: 'steal' };

  if ((m = /^(Offensive|Defensive|Deadball) rebound by/i.exec(t))) {
    const type = m[1].toLowerCase();
    return type === 'deadball' ? { category: 'rebound', type: 'deadball', subtype: 'deadball' } : { category: 'rebound', type };
  }
  if ((m = /^(\S+) Turnover by/i.exec(t))) return { category: 'turnover', type: m[1].toLowerCase() };
  if ((m = /^(\w+) Foul on/i.exec(t))) {
    const detail = FOUL_DETAILS.filter(([re]) => re.test(t)).map(([, d]) => d);
    return { category: 'foul', type: m[1].toLowerCase(), extra: detail.length ? { foul_detail: detail } : {} };
  }
  if ((m = /^Substitution (IN|OUT) /.exec(t))) return { category: 'substitution', subtype: m[1].toLowerCase() };
  if (/Timeout/i.test(t)) {
    const kind = /media/i.test(t) ? 'media' : /(\d+)-second/i.test(t) ? `${/(\d+)-second/i.exec(t)[1]}s` : 'other';
    return { category: 'timeout', type: kind };
  }
  return { category: 'other', type: null };
}

// ---- table walking ---------------------------------------------------------------------------------

function parsePeriod(html) {
  const title = /<div class="card-header card-title">([^<]*)</.exec(html);
  const period = title && /Period (\d+)/i.exec(title[1]);
  if (!period) throw new Error(`no "Period N Plays" heading found (got ${title ? JSON.stringify(title[1]) : 'none'}); OT pages are untested`);
  const order = /Play Sort Order: <span class="fw-bold">(\w+)/.exec(html);
  const body = html.slice(html.indexOf('<tbody class="text-start">'));
  const rows = [...body.matchAll(/<tr([^>]*)>(.*?)<\/tr>/gs)].map(m => ({ attrs: m[1], cells: [...m[2].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(c => c[1]) }));
  return { period: Number(period[1]), order: order ? order[1] : null, rows };
}

function parseRow(row, header) {
  const [, timeCell, teamCell, scoreCell, , typeCell, playCell] = row.cells;
  const clockDisplay = textOf(timeCell);
  const team = textOf(teamCell) || null;
  const pm = PLAYER_RE.exec(playCell);
  const who = pm ? { team: pm[1], jersey: pm[2], name: squash(decode(pm[3])) } : null;
  const tail = squash(decode(playCell.replace(PLAYER_RE, ' §P ').replace(/<[^>]+>/g, ' ')));
  const score = /^(\d+)-(\d+)$/.exec(textOf(scoreCell)); // visitor-home
  const c = classify(row.attrs, textOf(typeCell), tail, who, team);
  const teamAbbrev = c.teamOverride || team || (who && who.team) || null;
  return { clockDisplay, teamAbbrev, who, tail, score: score ? [Number(score[1]), Number(score[2])] : null, c, typeLabel: textOf(typeCell) };
}

/**
 * html: one rendered period page. ctx: { gameId, sourceGameId? }. Team side is inferred from the header
 * (V = away, H = home), and team abbreviations are mapped to a side by their order of appearance on
 * pxpteam_V / pxpteam_H rows, so no roster or team table is needed.
 */
function normalizePeriodPlays(html, ctx = {}) {
  const header = extractHeader(html);
  const { period, order, rows } = parsePeriod(html);
  if (order && order !== 'Ascending') throw new Error(`period ${period} page is sorted ${order}; the parser relies on ascending order`);

  const sideByAbbrev = {};
  for (const r of rows) {
    const m = /pxpteam_([VH])\b/.exec(r.attrs);
    const abbrev = m && textOf(r.cells[2]);
    if (m && abbrev) sideByAbbrev[abbrev] = m[1] === 'H' ? 'home' : 'away';
  }

  const warnings = [];
  const plays = [];
  const participants = [];
  let away = null, home = null; // running score, filled from made shots; carried until then
  const gameId = ctx.gameId || null;

  rows.forEach((row, i) => {
    const p = parseRow(row, header);
    const { c } = p;
    if (p.score) [away, home] = p.score;
    const side = p.teamAbbrev ? sideByAbbrev[p.teamAbbrev] || null : null;
    const scored = c.category === 'shot_attempt' || c.category === 'free_throw';
    const remaining = parseClock(p.clockDisplay);
    const seq = i + 1;

    const play = {
      play_id: gameId ? `${gameId}-p${period}-${seq}` : null,
      game_id: gameId,
      sequence_number: null, // assigned when periods are merged
      source: 'statbroadcast',
      source_play_id: `p${period}-${seq}`,
      period_number: period,
      period_type: period > REGULATION_PERIODS ? 'ot' : 'regulation',
      clock_seconds_remaining: remaining,
      clock_display: p.clockDisplay,
      game_seconds_elapsed: remaining == null ? null : gameSecondsElapsed(period, remaining),
      team_abbrev: p.teamAbbrev,
      team_side: side,
      is_neutral_event: !p.teamAbbrev,
      player: p.who,                    // {team, jersey, name} or null; resolved to player_id downstream
      play_category: c.category,
      play_type: c.type || null,
      play_subtype: c.subtype || null,
      play_description: p.tail.replace('§P', p.who ? `${p.who.team} #${p.who.jersey} ${p.who.name}` : '').replace(/\s+/g, ' ').trim(),
      home_score_after: home,
      away_score_after: away,
      shot_value: c.value ?? null,
      is_shot_attempt: scored,
      is_made: scored ? !!c.made : null,
      made_is_inferred: false,
      is_assisted: c.category === 'shot_attempt' && c.made ? false : null, // flipped when an assist row attaches
      linked_play_id: null,
      play_qualifiers: c.quals && c.quals.length ? c.quals : null,
      sources: { statbroadcast: { period, row: seq } },
      extra: { ...(c.extra || {}), ...(c.blocked ? { blocked: true } : {}), type_label: p.typeLabel || null },
    };
    plays.push(play);
  });

  // Child rows (assist / block / steal) follow the play they belong to, usually immediately. Attach them to the
  // nearest earlier row of the right kind at the same clock and record the player as a participant of the
  // parent, mirroring the WMT normalizer (child rows keep their own play row too).
  const parentTest = {
    assist: q => q.play_category === 'shot_attempt' && q.is_made,
    block: q => q.play_category === 'shot_attempt' && q.extra.blocked,
    steal: q => q.play_category === 'turnover',
  };
  const childRole = { assist: 'assister', block: 'blocker', steal: 'stealer' };
  plays.forEach((q, i) => {
    const test = parentTest[q.play_category];
    if (!test) return;
    let parent = null;
    for (let j = i - 1; j >= 0 && j >= i - 4 && plays[j].clock_display === q.clock_display; j--) {
      if (test(plays[j]) && plays[j].team_side !== q.team_side || (q.play_category === 'assist' && test(plays[j]) && plays[j].team_side === q.team_side)) { parent = plays[j]; break; }
    }
    if (!parent) { warnings.push(`p${period} row ${i + 1}: ${q.play_category} has no parent play (${q.play_description})`); return; }
    q.linked_play_id = parent.source_play_id;
    if (q.play_category === 'assist') parent.is_assisted = true;
    if (q.player) participants.push({ source_play_id: parent.source_play_id, player: q.player, role: childRole[q.play_category] });
  });

  // Main-actor participants.
  const mainRole = { shot_attempt: 'shooter', free_throw: 'shooter', rebound: 'rebounder', turnover: 'turned_over_by', foul: 'fouler' };
  for (const q of plays) {
    let role = mainRole[q.play_category];
    if (q.play_category === 'substitution') role = q.play_subtype === 'in' ? 'sub_in' : 'sub_out';
    if (role && q.player) participants.push({ source_play_id: q.source_play_id, player: q.player, role });
  }

  const unmapped = plays.filter(q => q.play_category === 'other' && q.play_type !== 'heldball').map(q => q.play_description);
  return { header, period, plays, participants, warnings, unmapped, sideByAbbrev };
}

/**
 * Merge period pages (any order) into one game: plays sorted by period then page order, sequence numbers
 * assigned, scores carried across rows that have none, and basic reconciliation reported in `checks`.
 */
function normalizeGame(pages, ctx = {}, { boxHtml = null } = {}) {
  const parsed = pages.map(h => normalizePeriodPlays(h, ctx)).sort((a, b) => a.period - b.period);
  const header = parsed[0].header;
  const participants = parsed.flatMap(p => p.participants);
  // canonical vocabulary, synthetic period rows and (with the box score) lineups: all StatBroadcast-specific, see canonical.js
  const canon = toCanonical({ plays: parsed.flatMap(p => p.plays), header, box: boxHtml ? parseBox(boxHtml) : null }, ctx);
  const plays = canon.plays;

  let seq = 0, home = 0, away = 0;
  for (const p of plays) {
    p.sequence_number = ++seq;
    if (p.home_score_after == null) { p.home_score_after = home; p.away_score_after = away; }
    else { home = p.home_score_after; away = p.away_score_after; }
  }

  const checks = [];
  const last = plays[plays.length - 1];
  if (header.isFinal) {
    if (last.home_score_after !== header.homeScore || last.away_score_after !== header.awayScore)
      checks.push(`last play score ${last.away_score_after}-${last.home_score_after} (away-home) != header ${header.awayScore}-${header.homeScore}`);
  }
  let prev = null;
  for (const p of plays) {
    if (prev && p.home_score_after < prev.home_score_after || prev && p.away_score_after < prev.away_score_after) checks.push(`score goes backwards at ${p.source_play_id}`);
    if (prev && p.period_number === prev.period_number && p.clock_seconds_remaining > prev.clock_seconds_remaining) checks.push(`clock goes backwards at ${p.source_play_id}`);
    const pts = p.is_made ? p.shot_value : 0;
    if (pts && prev) {
      const d = p.team_side === 'home' ? p.home_score_after - prev.home_score_after : p.away_score_after - prev.away_score_after;
      if (d !== pts) checks.push(`${p.source_play_id}: ${pts}-pt make moved the score by ${d}`);
    }
    prev = p;
  }

  return {
    header: { ...header, periods: parsed.map(p => p.period), sideByAbbrev: Object.assign({}, ...parsed.map(p => p.sideByAbbrev)) },
    plays, participants,
    warnings: [...parsed.flatMap(p => p.warnings), ...canon.warnings],
    unmapped: parsed.flatMap(p => p.unmapped),
    checks,
  };
}

module.exports = { extractHeader, normalizePeriodPlays, normalizeGame, classify, parseShot, parseClock };
