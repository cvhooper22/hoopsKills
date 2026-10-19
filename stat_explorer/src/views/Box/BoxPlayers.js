import { useState } from 'react';
import { Section, BoxTable } from './BoxParts';
import { f1, f2, pct, signed, mmss, isNum, dash } from './boxFormat';

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
  const head = ['Player', 'MIN', 'PTS', 'FG', '3P', 'FT', 'OREB', 'DREB', 'AST', 'STL', 'BLK', 'TO', 'PF', 'Poss +/−', 'EPA exp', 'EPA act'].map((l) => ({ label: l }));
  const body = rows.map((r) => [
    label(r), r.min > 0 ? mmss(r.min) : dash, { v: r.pts, strong: true }, shots(r, 'fgm', 'fga'), shots(r, 'tpm', 'tpa'), shots(r, 'ftm', 'fta'),
    r.oreb, r.dreb, r.ast, r.stl, r.blk, r.tov, r.pf,
    `+${r.gains} / −${r.losses}`, signed(r.epaExp, 1), { v: signed(r.epaAct, 1), strong: true },
  ]);
  const totals = ['Team', mmss(sumOf(rows, 'min')), sumOf(rows, 'pts'), `${sumOf(rows, 'fgm')}-${sumOf(rows, 'fga')}`, `${sumOf(rows, 'tpm')}-${sumOf(rows, 'tpa')}`, `${sumOf(rows, 'ftm')}-${sumOf(rows, 'fta')}`,
    sumOf(rows, 'oreb'), sumOf(rows, 'dreb'), sumOf(rows, 'ast'), sumOf(rows, 'stl'), sumOf(rows, 'blk'), sumOf(rows, 'tov'), sumOf(rows, 'pf'),
    `+${sumOf(rows, 'gains')} / −${sumOf(rows, 'losses')}`, signed(sumOf(rows, 'epaExp'), 1), signed(sumOf(rows, 'epaAct'), 1)];
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
function ContextTable({ rows }) {
  const head = [
    { label: 'Player' },
    { label: 'Opp pts off his TOs', title: 'Live-ball / dead-ball: points the opponent scored on the possession after his turnovers' },
    { label: 'Team pts off his steals · charges · blocks' }, { label: 'Pts after his OREBs', title: 'Quick putback / reset' },
    { label: 'Opp FT pts off his fouls' }, { label: 'Pts left at the line', title: 'Versus a league-average / his own free-throw rate' }, { label: 'Pts left at the rim' },
    { label: 'TO rate' }, { label: 'On/off net per 100', title: 'Team points-per-possession margin with him on, with possessions on / off' },
  ];
  const body = rows.filter((r) => r.name !== 'TEAM').map((r) => [
    label(r), `${r.opp_pts_off_to_live} / ${r.opp_pts_off_to_dead}`, `${r.pts_off_steal} · ${r.pts_off_charge} · ${r.pts_off_block}`,
    `${r.pts_off_oreb_quick} / ${r.pts_off_oreb_reset}`, r.opp_pts_off_fouls, `${signed(r.pts_left_ft_league, 2)} / ${signed(r.pts_left_ft_own, 2)}`, f1(r.rimLeft),
    isNum(r.tovRate) ? pct(r.tovRate) : dash, r.onoff && isNum(r.onoff.net) ? `${signed(r.onoff.net, 0)} (${r.onoff.onN}/${r.onoff.offN})` : dash,
  ]);
  return <BoxTable head={head} rows={body} />;
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
      <details className="box-details">
        <summary>More on each player (overlapping columns, so they don't add up to the team)</summary>
        <ContextTable rows={rows} />
      </details>
    </div>
  );
}

export default function PlayerBox({ data }) {
  const [showOpp, setShowOpp] = useState(false);
  const { header: h } = data;
  return (
    <Section title="Player box" sub="Sorted by expected points added from possession events, not by points">
      <TeamPlayers data={data} side="byu" />
      <button type="button" className="box-toggle" aria-expanded={showOpp} onClick={() => setShowOpp((s) => !s)}>
        {showOpp ? 'Hide' : 'View'} {h.teams.opp} box score
        <span className={`box-chevron${showOpp ? ' box-chevron--open' : ''}`} aria-hidden="true" />
      </button>
      {showOpp && <TeamPlayers data={data} side="opp" />}
      <p className="box-foot">
        Poss +/− counts possessions gained (steals, offensive rebounds, charges drawn, recovered blocks) against lost (turnovers); EPA values each one in expected points.
        Minutes come from the lineup data and can come up a few minutes short when a lineup is missing a player.
      </p>
    </Section>
  );
}
