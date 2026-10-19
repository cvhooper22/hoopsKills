import { Section, BoxTable, NetBars, NetChip } from './BoxParts';
import { f1, f2, f3, pct, signed, dash, isNum } from './boxFormat';

const SIDES = ['byu', 'opp'];

// "scored on X of Y" is how the handoff shows small samples: never a rate under MIN_N_FOR_RATE.
const scoredOn = (b) => (b.n ? `${b.scored} of ${b.n} (${b.pts} pts)` : dash);

// Points per chance, always calculated (small samples included); a dash only when there were no chances.
const perChance = (pts, n) => (n ? f2(pts / n) : dash);

export function PointsBySource({ data }) {
  const { header: h, margin, params, split } = data;
  const live = margin.filter((r) => r.byu.n || r.opp.n || r.byu.pts || r.opp.pts);
  const head = [
    { label: 'Source' }, { label: `${h.teams.byu} pts` }, { label: 'Chances', title: 'Plays: every shot opportunity, so each offensive rebound starts a new one' }, { label: 'Pts / chance' },
    { label: `${h.teams.opp} pts` }, { label: 'Chances' }, { label: 'Pts / chance' }, { label: 'Net' },
  ];
  const rows = live.map((r) => [
    r.label, r.byu.pts, r.byu.n, perChance(r.byu.pts, r.byu.n), r.opp.pts, r.opp.n, perChance(r.opp.pts, r.opp.n), { v: <NetChip value={r.net} /> },
  ]);
  const totals = ['Total', h.final.byu, split.byu.plays, f2(split.byu.ppPlay), h.final.opp, split.opp.plays, f2(split.opp.ppPlay), { v: <NetChip value={h.margin} /> }];
  return (
    <Section title="What decided the game" sub="Every point belongs to exactly one source, so each team's column adds up to its final score">
      <NetBars rows={live} focusName={h.teams.byu} oppName={h.teams.opp} />
      <BoxTable head={head} rows={rows} totals={totals} oppCols={[4, 5, 6]} />
      <p className="box-foot">Quick off a make uses a placeholder {params.QUICK_MAKE_WINDOW_SEC}-second window.</p>
    </Section>
  );
}

// How the points were taken. 3-point rate = 3PA / FGA and free-throw rate = FTA / FGA.
export function Shooting({ data }) {
  const { header: h, shooting } = data;
  if (!shooting) return null;
  const made = (x, m, a, p) => `${x[m]}-${x[a]} (${pct(x[p])})`;
  const row = (label, unit, fn) => [{ v: <>{label}<small>{unit}</small></> }, ...SIDES.map((s) => fn(shooting[s]))];
  const rows = [
    row('Field goals', 'made-att (%)', (x) => made(x, 'fgm', 'fga', 'fgPct')),
    row('Three-pointers', 'made-att (%)', (x) => made(x, 'tpm', 'tpa', 'tpPct')),
    row('3-point rate', '3PA / FGA', (x) => ({ v: pct(x.tpRate), strong: true })),
    row('Free throws', 'made-att (%)', (x) => made(x, 'ftm', 'fta', 'ftPct')),
    row('Free-throw rate', 'FTA / FGA', (x) => ({ v: pct(x.ftRate), strong: true })),
    row('Effective FG%', '(FGM + 0.5 × 3PM) / FGA', (x) => pct(x.efg)),
    row('True shooting %', 'PTS / (2 × (FGA + 0.44 × FTA))', (x) => pct(x.ts)),
  ];
  return (
    <Section title="Shooting" sub="How each team's points were taken: how often it shot threes and got to the line, and how efficiently">
      <BoxTable head={[{ label: '' }, { label: h.teams.byu }, { label: h.teams.opp }]} rows={rows} />
    </Section>
  );
}

export function DefenseSplit({ data }) {
  const { header: h, split } = data;
  const S = (side) => split[side];
  const row = (label, unit, fn) => [{ v: <>{label}<small>{unit}</small></> }, ...SIDES.map((s) => fn(S(s)))];
  const lbl = (b) => `${perChance(b.pts, b.n)} (${b.n})`;
  const rows = [
    row('Possessions', 'count', (x) => x.poss),
    row('Plays', 'count', (x) => x.plays),
    row('Total points', 'per possession', (x) => f2(x.ppp)),
    row('Plays per possession', 'ratio', (x) => f2(x.playsPerPoss)),
    row('Points', 'per play', (x) => f2(x.ppPlay)),
    row('First-shot half-court', 'per play (plays)', (x) => lbl(x.firstShot)),
    row('…without quick-off-make', 'per play (plays)', (x) => lbl(x.firstShotNoQuick)),
    row('Set half-court, incl. resets', 'per play (plays)', (x) => lbl(x.setHC)),
    row('Transition', 'per play (plays)', (x) => lbl(x.transition)),
    row('Quick putbacks', 'per play (plays)', (x) => lbl(x.quickPutback)),
    row('Resets', 'per play (plays)', (x) => lbl(x.reset)),
    row('Second-chance points', 'points', (x) => ({ v: x.secondChancePts, strong: true })),
    row('Offensive rebound rate', 'live misses', (x) => `${pct(x.orebRate)} (${x.oreb} of ${x.oreb + x.dreb})`),
  ];
  return (
    <Section title="Defense split" sub={`Each team on offense. ${h.teams.byu}'s defense is the ${h.teams.opp} column.`}>
      <BoxTable head={[{ label: 'Metric (unit)' }, { label: `${h.teams.byu} offense` }, { label: `${h.teams.opp} offense` }]} rows={rows} />
      <p className="box-foot">First-shot half-court is each possession's first play when it is not a transition play. Quick putbacks come within {data.params.QUICK_WINDOW_SEC} seconds of an offensive rebound; later ones are resets.</p>
    </Section>
  );
}

export function PossessionBattle({ data }) {
  const { header: h, split, battle, afterMake, ato, params } = data;
  const two = (fn) => SIDES.map((s) => fn(s));
  const rows = [
    ['Possessions (event count / box formula)', ...two((s) => `${split[s].poss} / ${f1(battle[s].formula.poss)}`)],
    ['Chances (possessions + offensive rebounds)', ...two((s) => f1(battle[s].formula.poss + battle[s].formula.orb))],
    ['Turnovers (live-ball / dead-ball)', ...two((s) => `${battle[s].tov} (${battle[s].liveTO} / ${battle[s].deadTO})`)],
    [`Pushed after a make (scored within ${params.QUICK_MAKE_WINDOW_SEC}s)`, ...two((s) => `${afterMake[s].quick} of ${afterMake[s].pop} · ${afterMake[s].quickPts} pts`)],
    ['After own timeout, scored on', ...two((s) => scoredOn(ato[s].own))],
    ['After opponent timeout, scored on', ...two((s) => scoredOn(ato[s].opponent))],
    ['After media timeout, scored on', ...two((s) => scoredOn(ato[s].media))],
    ['Transition and quick-off-make plays that scored nothing', ...two((s) => `${battle[s].advScoreless} of ${battle[s].advN}`)],
    ['Points left at the rim (missed rim shots × 2 × rim FG%)', ...two((s) => f1(battle[s].rimLeft))],
  ];
  return (
    <Section title="Possession battle" sub="Who won the extra chances, and what each team did with its good ones">
      <BoxTable head={[{ label: '' }, { label: h.teams.byu }, { label: h.teams.opp }]} rows={rows} />
      <p className="box-foot">Rim FG% is the pooled rate across the {data.notes.rimAttemptsInDb.toLocaleString()} rim attempts in the loaded BYU games ({pct(data.notes.rimPct)}), not a D-I average.</p>
    </Section>
  );
}

export function HavocSqueeze({ data }) {
  const { header: h, havoc: H, params } = data;
  const two = (fn) => SIDES.map((s) => fn(H[s]));
  // Two separate facts per kind of havoc, so they are shown as two rows: how many turned into a shot or free throws quickly,
  // and the points on the possessions that followed (the whole possession, with no time limit).
  const convCount = (c) => (c.n ? `${c.quick} of ${c.n}` : dash);
  const convPts = (c) => (c.n ? `${c.pts} (${f2(c.ppe)} each)` : dash);
  const sub = (label) => ({ v: label, className: 'box-table__indent' });
  const rows = [
    ['Opponent possessions', ...two((x) => x.oppPoss)],
    ['Steals · blocks (recovered) · forced turnovers', ...two((x) => `${x.steals} · ${x.blocks} (${x.recBlocks}) · ${x.forced}`)],
    // [`Havoc rate, weighted (placeholder weights ${params.HAVOC_W_LATE} late, ${params.HAVOC_W_EARLY} early)`, ...two((x) => `${pct(x.rate.mid)} (${f1(x.mid)})`)],
    [`Havoc rate`, ...two((x) => `${pct(x.rate.mid)} (${f1(x.mid)})`)],
    [`Squeeze rate`, ...two((x) => `${pct(x.squeeze.rate)} (${x.squeeze.n} of ${x.oppPoss})`)],
    [`Live-ball havoc turned into a shot or free throws within ${params.CONVERT_WINDOW_SEC}s`, ...two((x) => convCount(x.convLive))],
    [sub('Points on the possessions that followed'), ...two((x) => convPts(x.convLive))],
    [`Dead-ball havoc turned into a shot or free throws within ${params.CONVERT_WINDOW_SEC}s`, ...two((x) => convCount(x.convDead))],
    [sub('Points on the possessions that followed'), ...two((x) => convPts(x.convDead))],
    ['Havoc rate, broad (every turnover)', ...two((x) => `${pct(x.rate.broad)} (${x.broad})`)],
    ['Havoc rate, strict', ...two((x) => ({ v: `${pct(x.rate.strict)} (${x.strict})`, strong: true }))],
    ['Opponent pts per possession: squeezed vs. other', ...two((x) => `${f2(x.squeeze.ppp)} vs. ${f2(x.squeeze.otherPPP)}`)],
  ];
  return (
    <Section title="Havoc and squeeze" sub="Disruption by each defense: steals, blocks, forced turnovers, and how long it held the other offense">
      <BoxTable head={[{ label: '' }, { label: `${h.teams.byu} defense` }, { label: `${h.teams.opp} defense` }]} rows={rows} />
      <p className="box-foot">The data has no shot clock, so squeeze is estimated from game-clock time since the play started. The weighted rate uses placeholder weights; one game cannot fit them.</p>
    </Section>
  );
}

export function AtTheLine({ data }) {
  const { header: h, line, params } = data;
  const two = (fn) => SIDES.map((s) => fn(line[s]));
  const rows = [
    ['Trips to the line', ...two((x) => x.trips)],
    [`Points vs. league ${Math.round(params.LEAGUE_FT_PCT * 100)}% (negative = better)`, ...two((x) => signed(x.shortLeague, 2))],
    ['Points vs. their own free-throw rates', ...two((x) => signed(x.shortOwn, 2))],
    ['Cost incl. possession effect: league / own', ...two((x) => `${signed(x.costLeague, 2)} / ${signed(x.costOwn, 2)}`)],
    ['Missed front ends of a 1-and-1', ...two((x) => x.front)],
    ['Opponent points after a missed final free throw (context)', ...two((x) => x.oppPtsAfter)],
  ];
  return (
    <Section title="At the line" sub="What the free throws were worth, against a league-average shooter and against the shooters' own rates">
      <BoxTable head={[{ label: '' }, { label: h.teams.byu }, { label: h.teams.opp }]} rows={rows} />
      <p className="box-foot">Negative means the team shot better than the baseline. Opponent players have almost no season history here, so their own-rate baseline is close to the league average.</p>
    </Section>
  );
}

export function PossessionValue({ data }) {
  const { header: h, E, players } = data;
  const sum = (side, k) => players.filter((p) => p.side === side).reduce((a, p) => a + (isNum(p[k]) ? p[k] : 0), 0);
  const two = (fn) => SIDES.map((s) => fn(s));
  const rows = [
    ['Points per possession, all possessions', ...two((s) => f2(E[s].norm))],
    ['Points per possession after a live-ball turnover (this game / shrunk toward normal)', ...two((s) => `${f2(E[s].liveRaw)} (${E[s].liveN}) → ${f2(E[s].live)}`)],
    ['Points left in a possession after an offensive rebound', ...two((s) => `${f2(E[s].oreb)} (${E[s].orebN})`)],
    ['Possessions gained / lost', ...two((s) => `${sum(s, 'gains')} / ${sum(s, 'losses')}`)],
    ['Expected points from those events: expected / actual', ...two((s) => ({ v: `${signed(sum(s, 'epaExp'), 1)} / ${signed(sum(s, 'epaAct'), 1)}`, strong: true }))],
  ];
  return (
    <Section title="Possession value" sub="Steals, offensive rebounds, charges and recovered blocks gained; turnovers lost, valued in expected points">
      <BoxTable head={[{ label: '' }, { label: h.teams.byu }, { label: h.teams.opp }]} rows={rows} />
      <p className="box-foot">Baselines come from this game only. Possessions alternate, so a steal erases the other team's possession rather than adding one; only offensive rebounds add a new chance.</p>
    </Section>
  );
}
