import { useState } from 'react';
import { Section, BoxTable } from './BoxParts';
import { f1, pct, signed, mmss, isNum, dash } from './boxFormat';

const sumOf = (rows, k) => rows.reduce((a, r) => a + (isNum(r[k]) ? r[k] : 0), 0);
const shots = (r, m, a) => `${r[m]}-${r[a]}`;

// Sorted by total impact (expected points from possession events), not points, per the handoff.
function rowsFor(players, side) {
  return players
    .filter((p) => p.side === side && (p.min > 0 || p.pts || p.fga || p.gains || p.losses))
    .sort((a, b) => (a.name === 'TEAM') - (b.name === 'TEAM') || b.epaAct - a.epaAct || b.pts - a.pts);
}

const label = (p) => (p.name === 'TEAM' ? 'Team (unassigned)' : p.name);

function TradTable({ rows }) {
  const head = ['Player', 'MIN', 'PTS', 'FG', '3P', 'FT', 'OREB', 'DREB', 'AST', 'STL', 'BLK', 'TO', 'PF', 'Poss +/−'].map((l) => ({ label: l }));
  const body = rows.map((r) => [
    label(r), r.min > 0 ? mmss(r.min) : dash, { v: r.pts, strong: true }, shots(r, 'fgm', 'fga'), shots(r, 'tpm', 'tpa'), shots(r, 'ftm', 'fta'),
    r.oreb, r.dreb, r.ast, r.stl, r.blk, r.tov, r.pf,
    `+${r.gains} / −${r.losses}`, // EPA exp / EPA act columns hidden for now: signed(r.epaExp, 1), { v: signed(r.epaAct, 1), strong: true }
  ]);
  const totals = ['Team', mmss(sumOf(rows, 'min')), sumOf(rows, 'pts'), `${sumOf(rows, 'fgm')}-${sumOf(rows, 'fga')}`, `${sumOf(rows, 'tpm')}-${sumOf(rows, 'tpa')}`, `${sumOf(rows, 'ftm')}-${sumOf(rows, 'fta')}`,
    sumOf(rows, 'oreb'), sumOf(rows, 'dreb'), sumOf(rows, 'ast'), sumOf(rows, 'stl'), sumOf(rows, 'blk'), sumOf(rows, 'tov'), sumOf(rows, 'pf'),
    `+${sumOf(rows, 'gains')} / −${sumOf(rows, 'losses')}`];
  return <BoxTable head={head} rows={body} totals={totals} />;
}

// The first five columns add up to PTS. After a one-column break: PTS, assists (the count), assist points (points on baskets he assisted, plus a
// made and-one free throw that came with an assisted basket), and points produced = PTS + assist points, i.e. every point
// he had a hand in. A basket counts for both its scorer and its passer there, so that last column does not total to the team.
const GAP = { label: '', className: 'box-table__gap' };
function CreatedTable({ rows }) {
  const head = [
    { label: 'Player' }, { label: 'Free throws' },
    { label: 'Putbacks', title: 'Unassisted points on quick putbacks' }, { label: 'Early', title: 'Unassisted points in transition or quick off a make' },
    { label: 'Self-created', title: 'Other unassisted points: first-shot half-court, after own timeout, and resets' },
    { label: 'Assisted', title: 'Field-goal points on shots with an assist (a free throw that followed counts under Free throws)' },
    GAP,
    { label: 'PTS', title: 'Total points: free throws + assisted + putbacks + early + self-created' },
    { label: 'Assists', title: 'Assists: passes that led directly to a made basket' },
    { label: 'Assist pts', title: 'Points on the baskets he assisted, including a made and-one free throw that came with an assisted basket' },
    { label: 'Pts produced', title: 'Points scored plus points assisted: every point he had a hand in. The percentage is his share of the team\'s points. A basket he scored off a teammate\'s pass counts for both players, so the column does not add up to the team total (and the percentages add past 100%).' },
  ];
  const scorers = rows.filter((r) => r.pts || r.pts_produced);
  const gap = { v: '', className: 'box-table__gap' };
  const teamPts = sumOf(scorers, 'pts');
  const share = (r) => (teamPts ? ` (${pct(r.pts_produced / teamPts)})` : ''); // share of the team's points he had a hand in; shares overlap, so they add past 100%
  const body = scorers.map((r) => [label(r), r.pts_ft, r.pts_putback, r.pts_early, r.pts_self_created_hc, r.pts_assisted, gap, { v: r.pts, strong: true }, r.ast, r.assist_pts, { v: `${r.pts_produced}${share(r)}`, strong: true }]);
  const sums = (keys) => keys.map((k) => sumOf(scorers, k));
  const totals = ['Team', ...sums(['pts_ft', 'pts_putback', 'pts_early', 'pts_self_created_hc', 'pts_assisted']), gap, ...sums(['pts', 'ast', 'assist_pts']), dash];
  return <BoxTable head={head} rows={body} totals={totals} />;
}

// Context columns overlap by design (one basket can credit a scorer and an assister), so no totals row.
// Each group is a header over its sub-columns; the first column of every group gets a divider.
const SEP = 'box-table__sep';
const hasOnoff = (r) => r.onoff && r.onoff.on;
const onoffCol = (which, key, label, title, fmt = (v) => v) => ({ label, title, get: (r) => (hasOnoff(r) && isNum(r.onoff[which][key]) ? fmt(r.onoff[which][key]) : dash) });

const TURNOVER_GROUPS = [
  { label: 'Turnovers', cols: [
    { label: 'TO', title: 'Turnovers he committed', get: (r) => r.tov },
    { label: 'TO rate', title: 'Turnovers / (FGA + 0.44 x FTA + turnovers)', get: (r) => (isNum(r.tovRate) ? pct(r.tovRate) : dash) },
  ] },
  { label: 'Opp pts off his turnovers', title: 'Points the opponent scored on the possession after his turnovers', cols: [
    { label: 'Live', title: 'After live-ball turnovers (steals), which give the opponent transition chances', get: (r) => r.opp_pts_off_to_live, dim: true },
    { label: 'Dead', title: 'After dead-ball turnovers (out of bounds, travels, offensive fouls)', get: (r) => r.opp_pts_off_to_dead, dim: true },
    { label: 'Total', title: 'Live plus dead', get: (r) => (r.opp_pts_off_to_live || 0) + (r.opp_pts_off_to_dead || 0) },
  ] },
  { label: 'Steals', cols: [
    { label: 'STL', title: 'Steals', get: (r) => r.stl },
    { label: 'Team pts', title: 'Points his team scored on the possession after his steals', get: (r) => r.pts_off_steal },
  ] },
  { label: 'Charges drawn', cols: [
    { label: 'Drawn', title: 'Charges drawn', get: (r) => (r.cnt ? r.cnt.chg : dash) },
    { label: 'Team pts', title: 'Points his team scored on the possession after his charges drawn', get: (r) => r.pts_off_charge },
  ] },
  { label: 'Blocks', cols: [
    { label: 'BLK', title: 'Blocked shots', get: (r) => r.blk },
    { label: 'Team pts', title: 'Points his team scored on the possession after his blocks that his team recovered', get: (r) => r.pts_off_block },
  ] },
];

const FREE_THROW_GROUPS = [
  { label: 'Free throws', title: 'His free throws, and the points left at the line versus an expected rate', cols: [
    { label: 'FT', title: 'Made / attempted', get: (r) => `${r.ftm} / ${r.fta}` },
    { label: 'Pts lost', title: 'Points lost to missed free throws: 1 per miss, plus the second shot he never got to take after missing the front end of a one-and-one, valued at his own free-throw percentage', get: (r) => (isNum(r.ftLostMiss) ? f1((r.ftLostMiss || 0) + (r.ftLostSecond || 0)) : '0.0'), strong: true },
    { label: 'Adj pts lost', title: 'Points lost beyond what his own free-throw percentage predicts for those attempts. Never below 0: if he did better than his rate predicts, nothing was lost', get: (r) => f1(Math.max(0, r.pts_left_ft_own)) },
  ] },
  { label: 'After a missed final FT the defense rebounded', title: 'Only misses on the last free throw of a trip that the opponent rebounded. They get the ball after a made free throw too, so this is context for the miss, not its cost.', cols: [
    { label: 'Misses', title: 'Missed final free throws the opponent rebounded', get: (r) => r.ftMissDefN || 0 },
    { label: 'Opp expected', title: 'Points the opponent would be expected to score on those possessions: their points per possession in this game before each free throw (their whole-game rate until 10 possessions have been played)', get: (r) => (r.ftMissDefN ? f1(r.ftMissOppExp) : '0.0') },
    { label: 'Opp pts', title: 'Points the opponent scored on the possession right after those rebounds', get: (r) => (r.ftMissDefN ? r.ftMissOppPts : 0) },
    { label: 'Luck', title: 'Opp expected minus Opp pts. Negative is bad luck: the opponent scored more than they normally would on those possessions. Positive is good luck: they scored less.', get: (r) => (r.ftMissDefN ? signed(r.ftMissOppExp - r.ftMissOppPts, 1) : signed(0, 1)) },
  ] },
  { label: 'Swing', title: 'Points the opponent scored after his missed final free throws, plus the points he lost at the line', cols: [
    { label: 'Net swing', title: 'Opp pts plus Pts lost', get: (r) => f1((r.ftMissDefN ? r.ftMissOppPts : 0) + (r.ftLostMiss || 0) + (r.ftLostSecond || 0)) },
    { label: 'Adj net swing', title: 'Opp pts plus Adj pts lost', get: (r) => f1((r.ftMissDefN ? r.ftMissOppPts : 0) + Math.max(0, r.pts_left_ft_own)) },
  ] },
];

const OTHER_GROUPS = [
  { label: 'Offensive rebounds', title: 'His offensive rebounds and the points scored after them', cols: [
    { label: 'OREB', get: (r) => r.oreb },
    { label: 'Putback pts', title: 'Points scored on an immediate putback after his offensive rebounds', get: (r) => r.pts_off_oreb_quick },
    { label: 'Reset pts', title: 'Points scored after his offensive rebounds when the team reset and ran the offense again', get: (r) => r.pts_off_oreb_reset },
  ] },
  { label: 'Fouls', cols: [
    { label: 'PF', title: 'Fouls he committed', get: (r) => r.pf },
    { label: 'Opp FT pts', title: 'Free-throw points the opponent scored after fouls he committed', get: (r) => r.opp_pts_off_fouls },
  ] },
  { label: 'Rim', cols: [
    { label: 'Rim FG', title: 'Made / attempted at the rim (layups, dunks, tips, alley-oops)', get: (r) => (isNum(r.rimAtt) ? `${r.rimMade} / ${r.rimAtt}` : dash) },
    { label: 'Pts left', title: 'Missed rim attempts x 2 x the pooled rim FG%', get: (r) => f1(r.rimLeft) },
  ] },
];

const ONOFF_GROUPS = [
  { label: 'On the floor', title: 'While he was on the floor', cols: [
    onoffCol('on', 'net', 'Net pts', 'His team\'s points minus the opponent\'s over the possessions he was on the floor', (v) => signed(v, 0)),
    onoffCol('on', 'off', 'Off poss', 'His team\'s possessions on offense while he was on the floor'),
    onoffCol('on', 'def', 'Def poss', 'The opponent\'s possessions (his team on defense) while he was on the floor'),
  ] },
  { label: 'On the bench', title: 'While he was on the bench. Small samples swing wildly, so read net next to the possession counts.', cols: [
    onoffCol('bench', 'net', 'Net pts', 'His team\'s points minus the opponent\'s over the possessions he was on the bench', (v) => signed(v, 0)),
    onoffCol('bench', 'off', 'Off poss', 'His team\'s possessions on offense while he was on the bench'),
    onoffCol('bench', 'def', 'Def poss', 'The opponent\'s possessions (his team on defense) while he was on the bench'),
  ] },
];

function GroupedTable({ rows, groups }) {
  const head = [{ label: 'Player' }];
  const heads = [{ label: '', span: 1 }];
  groups.forEach((g) => {
    heads.push({ label: g.label, span: g.cols.length, title: g.title });
    g.cols.forEach((c, i) => head.push({ label: c.label, title: c.title, className: [i === 0 ? SEP : '', c.dim ? 'box-table__dim' : ''].filter(Boolean).join(' ') || undefined }));
  });
  // 'unattributed' collects events with no player (a charge with no drawer named, say), so per-player context and on/off mean nothing for it
  const body = rows.filter((r) => r.name !== 'TEAM' && r.name !== 'unattributed').map((r) => [
    label(r),
    ...groups.flatMap((g) => g.cols.map((c, i) => ({ v: c.get(r), strong: c.strong, className: [i === 0 ? SEP : '', c.dim ? 'box-table__dim' : ''].filter(Boolean).join(' ') || undefined }))),
  ]);
  return <BoxTable head={head} groups={heads} rows={body} />;
}

function TeamPlayers({ data, side }) {
  const rows = rowsFor(data.players, side);
  const name = data.header.teams[side];
  return (
    <div className="box-team">
      <h3 className="box-team__title">{name}</h3>
      <TradTable rows={rows} />
      <h4 className="box-team__sub">How the points were created</h4>
      <CreatedTable rows={rows} />
      <h4 className="box-team__sub">Turnovers and takeaways</h4>
      <GroupedTable rows={rows} groups={TURNOVER_GROUPS} />
      <h4 className="box-team__sub">On and off the floor</h4>
      <GroupedTable rows={rows} groups={ONOFF_GROUPS} />
      <h4 className="box-team__sub">Free throws</h4>
      <GroupedTable rows={rows} groups={FREE_THROW_GROUPS} />
      <details className="box-details">
        <summary>More on each player (rebounds, fouls, rim)</summary>
        <GroupedTable rows={rows} groups={OTHER_GROUPS} />
      </details>
    </div>
  );
}

export default function PlayerBox({ data }) {
  const [showOpp, setShowOpp] = useState(false);
  const { header: h } = data;
  return (
    <Section title="Player box">
      <TeamPlayers data={data} side="byu" />
      <button type="button" className="box-toggle" aria-expanded={showOpp} onClick={() => setShowOpp((s) => !s)}>
        {showOpp ? 'Hide' : 'View'} {h.teams.opp} box score
        <span className={`box-chevron${showOpp ? ' box-chevron--open' : ''}`} aria-hidden="true" />
      </button>
      {showOpp && <TeamPlayers data={data} side="opp" />}
      <p className="box-foot">
        Poss +/− counts possessions gained (steals, offensive rebounds, charges drawn, recovered blocks) against lost (turnovers).
        Minutes come from the lineup data and can come up a few minutes short when a lineup is missing a player.
      </p>
    </Section>
  );
}
