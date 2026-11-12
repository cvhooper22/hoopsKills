// Builds the "Ask AI about this game" prompt from a box payload (public/data/box/<gameId>.json). Pure; no I/O.
// The prompt is the game's play-by-play (data.events) plus a short guide to reading it and how to compute things from it,
// so a person can paste it into any AI chat. The guide is there because the AI knows nothing about this site's definitions.
//
// buildParts() makes every piece of text once; assemblePrompt() joins the pieces the person left switched on. They are split
// so the UI can show what each switch costs in tokens without rebuilding anything.
import { formatClock, fromMinute } from './playGroups';
import { buildLineupModel } from './lineupModel';
import { lineupStints, playerFloorTime } from './lineupTimeline';

export const SECTIONS = [
  { key: 'lineups', label: 'Lineups on the floor', hint: 'Who is on the court after every substitution. Needed for any lineup or stint question.' },
  { key: 'onOff', label: 'On/off and stint splits', hint: 'Points and possessions per player on vs. off the floor, plus a row per lineup stint. Needed for net rating, defensive rating, or "with X on the floor" questions.' },
  { key: 'playerBox', label: 'Player box score', hint: 'Final stat lines, so the AI can check its own counting.' },
  { key: 'definitions', label: 'How to compute things', hint: 'Formulas for eFG%, possessions, runs, stints, and what a kill or clutch is.' },
];

export const DEFAULT_INCLUDE = { lineups: true, onOff: true, playerBox: true, definitions: true };

// {team} becomes the followed team's name.
export const QUESTION_IDEAS = [
  { label: 'Biggest runs', text: 'What were the biggest scoring runs by each team, and what ended each one (timeout, substitution, turnover, a made shot)?' },
  { label: 'Starters vs. bench', text: 'Compare how {team}\'s starters and bench shot (FG, 3P, FT, eFG%) and what the score margin did while each group was on the floor.' },
  { label: 'Best and worst stretch', text: 'What was {team}\'s best and worst 4-minute stretch by net points, and who was on the floor for each?' },
  { label: 'On/off defense', text: 'Which {team} players had the best and worst defensive rating (points allowed per 100 possessions) while on the floor vs. off it? Use the on/off table and show the rows.' },
  { label: 'Lineup comparison', text: 'Compare the five-man lineups that played the most minutes together: net points, points per minute, and how each one scored.' },
  { label: 'After timeouts', text: 'What happened in the three possessions after each timeout, for each team?' },
  { label: 'Scoring droughts', text: 'What was the longest scoring drought for each team, and what shots did they take during it?' },
  { label: 'Turning point', text: 'When was the game effectively decided (the last time the margin was within 5 points), and what happened right then?' },
  { label: 'Foul trouble', text: 'Which players got into foul trouble, when, and how did {team} do while they sat?' },
  { label: 'Three surprises', text: 'Give me three surprising things about this game that a normal box score would not show.' },
  { label: 'Announcer recap', text: 'Write a short radio-announcer style recap of this game using only what happened in the data.' },
];

export const fillIdea = (text, teamName) => text.replace(/\{team\}/g, teamName);

// Rough: about four characters to a token in English text.
export const estimateTokens = (text) => Math.ceil(text.length / 4);

const periodTag = (p) => (p === 1 ? '1H' : p === 2 ? '2H' : `OT${p - 2}`);
// `rem` counts down through all of regulation (2400s at tip, 1200s at halftime), so the first half's clock is rem - 1200.
const periodClock = (e) => formatClock(e.per === 1 ? Math.max(0, e.rem - 1200) : e.rem);
const sideName = (teams, side) => teams[side];
const nameList = (names) => names.join(', ');

function eventDetail(e) {
  switch (e.cat) {
    case 'shot_attempt': {
      const kind = [e.type, e.sub].filter(Boolean).join('/');
      const tail = [e.ast ? `ast ${e.ast}` : null, e.blk ? `blk ${e.blk}` : null].filter(Boolean).join(', ');
      return `${e.val}PT ${kind} ${e.made ? 'MAKE' : 'MISS'}${tail ? ` (${tail})` : ''}`;
    }
    case 'free_throw': return `FT ${e.sub || ''} ${e.made ? 'MAKE' : 'MISS'}`.replace('  ', ' ');
    case 'rebound': return `REB ${e.type === 'deadball' ? 'dead-ball/team' : e.type}`;
    case 'turnover': return `TO ${e.type || ''}`.trim();
    case 'foul': return `FOUL ${e.type || ''}`.trim();
    case 'timeout': return `TIMEOUT ${e.type || ''}`.trim();
    case 'jumpball': return `JUMPBALL ${e.type || ''}`.trim();
    default: return e.cat.toUpperCase(); // steal, block, assist
  }
}

// Assists live on the shot row ("ast Name"); a separate assist row is only kept when no shot row carries it.
function assistKeys(events) {
  const keys = new Set();
  events.forEach((e) => { if (e.cat === 'shot_attempt' && e.ast) keys.add(`${e.per}|${e.rem}|${e.ast}`); });
  return keys;
}

function startingLineups(plays) {
  const lu = plays && plays[0] && plays[0].lu;
  return lu && lu.byu && lu.opp ? { byu: [...lu.byu], opp: [...lu.opp] } : null;
}

const row = (e, text, who, detail) => `${periodTag(e.per)} ${periodClock(e)} | ${text} | ${who} | ${detail} | ${e.sc[0]}-${e.sc[1]}`;

// One line per event, oldest first. With `lineups`, a LINEUP row follows every batch of substitutions.
function playByPlayRows(data, lineups) {
  const { plays, header } = data;
  const events = data.events || [];
  const teams = header.teams;
  const start = lineups ? startingLineups(plays) : null;
  const on = start ? { byu: new Set(start.byu), opp: new Set(start.opp) } : null;
  const pending = {}; // side -> the substitution event that opened its current batch
  const skip = assistKeys(events);
  const rows = [];

  const flush = (side) => {
    const at = pending[side];
    if (!at) return;
    rows.push(`${periodTag(at.per)} ${periodClock(at)} | LINEUP | ${sideName(teams, side)} | ${nameList([...on[side]])} | ${at.sc[0]}-${at.sc[1]}`);
    delete pending[side];
  };

  if (on) ['byu', 'opp'].forEach((side) => rows.push(`${periodTag(1)} ${formatClock(1200)} | LINEUP | ${sideName(teams, side)} | ${nameList([...on[side]])} | 0-0`));

  events.forEach((e) => {
    if (on) {
      ['byu', 'opp'].forEach((side) => {
        const p = pending[side];
        if (p && !(e.cat === 'substitution' && e.side === side && e.per === p.per && e.rem === p.rem)) flush(side);
      });
    }
    if (e.cat === 'substitution') {
      if (!on || !e.player) return;
      if (e.sub === 'out') on[e.side].delete(e.player);
      else on[e.side].add(e.player);
      pending[e.side] = pending[e.side] || e;
      return;
    }
    if (e.cat === 'assist' && skip.has(`${e.per}|${e.rem}|${e.player}`)) return;
    rows.push(row(e, e.side ? sideName(teams, e.side) : '-', e.player || '-', eventDetail(e)));
  });
  if (on) ['byu', 'opp'].forEach(flush);
  return rows;
}

function pbpSection(data, lineups) {
  const { teams } = data.header;
  const legend = [
    `Columns: period+clock | team | player | event | score (${teams.byu}-${teams.opp}, running, after the event). Fields separated by " | ".`,
    'Period: 1H = first half, 2H = second half, OT1.. = overtimes. The clock is the time REMAINING in the period (20:00 counts down to 0:00 in a half; OT periods are 5:00).',
    'Events: nPT = a shot worth n points (kind of shot, MAKE or MISS, with the assister and blocker in parentheses); FT 1of2 = first of two free throws; REB offensive/defensive; TO = turnover (type); STEAL and BLOCK are credited to the player who made the play, FOUL to the player who committed it.',
    lineups ? 'LINEUP rows: the five players on the floor for that team from that time until that team\'s next LINEUP row. The first two rows are the starters.' : null,
  ].filter(Boolean);
  return `${legend.join('\n')}\n\n${playByPlayRows(data, lineups).join('\n')}`;
}

function gameSection(data, inProgress) {
  const { header } = data;
  const t = header.teams;
  const start = startingLineups(data.plays);
  const lines = [
    `${t.byu} vs ${t.opp}, ${header.date}${header.venue ? ` at ${header.venue}` : ''}. ${inProgress ? 'The game is still in progress; score so far' : 'Final'}: ${t.byu} ${header.final.byu}, ${t.opp} ${header.final.opp}.`,
    `${t[header.focus]} is the team I follow.`,
  ];
  if (start) lines.push(`Starters - ${t.byu}: ${nameList(start.byu)}. ${t.opp}: ${nameList(start.opp)}.`);
  return lines.join('\n');
}

function playerBoxSection(data) {
  const { teams } = data.header;
  const start = startingLineups(data.plays);
  const starters = start ? new Set([...start.byu, ...start.opp]) : new Set();
  const head = 'team,player,starter,min,pts,fg,3p,ft,oreb,dreb,ast,stl,blk,tov,pf';
  const lines = (data.players || []).filter((p) => p.name !== 'unattributed').map((p) => [
    teams[p.side], p.name, p.name === 'TEAM' ? '-' : starters.has(p.name) ? 'Y' : 'N', Math.round(p.min * 10) / 10, p.pts,
    `${p.fgm}-${p.fga}`, `${p.tpm}-${p.tpa}`, `${p.ftm}-${p.fta}`, p.oreb, p.dreb, p.ast, p.stl, p.blk, p.tov, p.pf,
  ].join(','));
  const poss = data.split;
  const possLine = poss ? `Possessions (counted from the play-by-play): ${teams.byu} ${poss.byu.poss}, ${teams.opp} ${poss.opp.poss}.` : null;
  return [head, ...lines, possLine].filter(Boolean).join('\n');
}

const per100 = (pts, poss) => (poss ? Math.round((pts / poss) * 1000) / 10 : null);
const fmtRtg = (v) => (v === null ? '' : v);
const stampOf = (min, isEnd) => { const { per, clockSec } = fromMinute(min, isEnd); return `${periodTag(per)} ${formatClock(clockSec)}`; };
const zero = () => ({ mins: 0, scored: 0, allowed: 0, offPoss: 0, defPoss: 0 });
const addStint = (t, s) => { t.mins += s.mins; t.scored += s.scored; t.allowed += s.allowed; t.offPoss += s.offPoss; t.defPoss += s.defPoss; };
const splitCells = (t) => [
  Math.round(t.mins * 10) / 10, t.scored, t.allowed, t.offPoss, t.defPoss,
  fmtRtg(per100(t.scored, t.offPoss)), fmtRtg(per100(t.allowed, t.defPoss)),
  fmtRtg(t.offPoss && t.defPoss ? Math.round((per100(t.scored, t.offPoss) - per100(t.allowed, t.defPoss)) * 10) / 10 : null),
];

// Per player: team totals while he was on the floor and while he was not (team total minus on), plus one row per lineup stint.
// Every number is summed from the same stints, so any other combination ("Bahr or Rueckert", a pair) can be re-added from the
// stint rows. Possessions in a stint are the chances that ended on the floor under that five (see lineupModel), so they add up
// to each team's possession count.
function onOffSection(data) {
  const teams = data.header.teams;
  const model = buildLineupModel(data.events, data.plays);
  const stintsFor = (side) => (model ? model.stints(side) : lineupStints(data.plays, side));
  const sides = ['byu', 'opp'].map((side) => ({ side, stints: stintsFor(side).filter((s) => s.names.length) })).filter((x) => x.stints.length);
  if (!sides.length) return null;

  const playerRows = [], stintRows = [];
  sides.forEach(({ side, stints }) => {
    const all = zero();
    stints.forEach((s) => addStint(all, s));
    playerFloorTime(stints).forEach((pl) => {
      const on = zero();
      stints.filter((s) => s.names.includes(pl.name)).forEach((s) => addStint(on, s));
      const off = zero();
      ['mins', 'scored', 'allowed', 'offPoss', 'defPoss'].forEach((k) => { off[k] = all[k] - on[k]; });
      playerRows.push([teams[side], pl.name, ...splitCells(on), ...splitCells(off)].join(','));
    });
    stints.forEach((s, i) => {
      stintRows.push([teams[side], i + 1, stampOf(s.startMin, false), stampOf(s.endMin, true), Math.round(s.mins * 100) / 100,
        `"${s.names.join(', ')}"`, s.scored, s.allowed, s.offPoss, s.defPoss].join(','));
    });
  });

  const cols = ['mins', 'pts_for', 'pts_against', 'off_poss', 'def_poss', 'ortg', 'drtg', 'net'];
  return [
    'Per player, for the team named in the first column. "on_" columns are that team\'s numbers while the player was on the floor; "off_" columns are the same team while he was not. pts_for = points the team scored, pts_against = points it allowed, off_poss = its possessions on offense, def_poss = the opponent\'s possessions (its defense). ortg = pts_for per 100 off_poss, drtg = pts_against per 100 def_poss (lower is better defense), net = ortg - drtg. Blank means no possessions.',
    ['team', 'player', ...cols.map((c) => `on_${c}`), ...cols.map((c) => `off_${c}`)].join(','),
    ...playerRows,
    '',
    'Per lineup stint (the time a team\'s five stayed the same). Add stint rows together to get any combination: for "one of A or B on the floor", sum the rows whose lineup contains A or B; "the rest" is every other row for that team. Rating = points per 100 possessions from the summed pts and poss.',
    'team,stint,start,end,min,lineup,pts_for,pts_against,off_poss,def_poss',
    ...stintRows,
  ].join('\n');
}

function definitionsSection(data) {
  const t = data.header.teams[data.header.focus];
  return [
    '- Points: made 2PT = 2, made 3PT = 3, made FT = 1.',
    '- FG% = FGM / FGA. eFG% = (FGM + 0.5 * 3PM) / FGA. TS% = PTS / (2 * (FGA + 0.44 * FTA)). 3-point rate = 3PA / FGA. Free-throw rate = FTA / FGA.',
    '- Possessions (per team) are counted from the play-by-play: a possession ends on a made shot, a defensive rebound, or a turnover (the box data gives the count). Points per possession = points / possessions.',
    '- Margin = the first team\'s score minus the second\'s, from the score column. A run is consecutive points by one team with none by the other (a 10-0 run).',
    '- A stint is the time between two LINEUP rows for a team. Its length is the clock at the start minus the clock at the end (within one half). Its plus/minus is the change in score margin over that time.',
    '- Offensive rating = points scored per 100 possessions. Defensive rating = points allowed per 100 possessions (the opponent\'s points over the opponent\'s possessions; lower is better). Net rating = offensive rating minus defensive rating. "On the floor" / "off the floor" splits come from the on/off tables, not from counting the play-by-play by hand.',
    '- Starters are the first LINEUP row for each team. Everyone else is the bench.',
    '- Free throws: "1of2" is the first of two attempts; "1of1" is a single (usually an and-one or a technical).',
    `- A stop is an opponent possession of ${t}'s that ends without the opponent scoring. A kill is three stops in a row by ${t}'s defense; "pure" if all three were clean, "dirty" if any needed an offensive rebound by the opponent or came only from a missed free throw.`,
    `- Clutch time: the last 5:00 of the game while the score is within 5 points.`,
  ].join('\n');
}

// Every piece of prompt text, keyed. Each is built once for the whole game.
export function buildParts(data, { inProgress = false } = {}) {
  return {
    game: gameSection(data, inProgress),
    pbp: pbpSection(data, true),
    pbpBare: pbpSection(data, false),
    onOff: onOffSection(data),
    playerBox: playerBoxSection(data),
    definitions: definitionsSection(data),
  };
}

const INTRO = 'I want to analyze one college basketball game with you. Use only the data below. If the data cannot answer something, say so instead of guessing. '
  + 'When you count or add things up, go through the rows carefully and show the rows you used (period, clock, score) so I can check you.';

export const NO_QUESTION = 'No specific question yet. Start with the five most interesting things this data shows, each backed by specific plays.';

export function assemblePrompt(parts, include, question) {
  const out = [INTRO, `# The game\n${parts.game}`];
  out.push(`# Play-by-play\n${include.lineups ? parts.pbp : parts.pbpBare}`);
  if (include.onOff && parts.onOff) out.push(`# On/off and stint splits (use these for defensive and net rating questions)\n${parts.onOff}`);
  if (include.playerBox) out.push(`# Final player stats (use to check your counts)\n${parts.playerBox}`);
  if (include.definitions) out.push(`# How to compute things\n${parts.definitions}`);
  out.push(`# My question\n${question.trim() || NO_QUESTION}`);
  return out.join('\n\n');
}

// What each switch adds, in tokens, for the UI. Lineups is the difference between the two play-by-play variants.
export function sectionTokens(parts) {
  return {
    lineups: Math.max(0, estimateTokens(parts.pbp) - estimateTokens(parts.pbpBare)),
    onOff: parts.onOff ? estimateTokens(parts.onOff) : 0,
    playerBox: estimateTokens(parts.playerBox),
    definitions: estimateTokens(parts.definitions),
  };
}
