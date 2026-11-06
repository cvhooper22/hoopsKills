import { Section, BoxTable, NetBars, NetChip } from './BoxParts';
import { tagRebounds, reboundLines, hasShotLines } from '../../utils/playGroups';
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
    { label: `${h.teams.opp} pts` }, { label: 'Chances' }, { label: 'Pts / chance' }, { label: 'Net', className: 'box-table__center' },
  ];
  const rows = live.map((r) => [
    r.label, r.byu.pts, r.byu.n, perChance(r.byu.pts, r.byu.n), r.opp.pts, r.opp.n, perChance(r.opp.pts, r.opp.n), { v: <NetChip value={r.net} />, className: 'box-table__center' },
  ]);
  const totals = ['Total', h.final.byu, split.byu.plays, f2(split.byu.ppPlay), h.final.opp, split.opp.plays, f2(split.opp.ppPlay), { v: <NetChip value={h.margin} />, className: 'box-table__center' }];
  return (
    <Section title="Chance Margins">
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
    row('Two-pointers', 'made-att (%)', (x) => made(x, 'twoM', 'twoA', 'twoPct')),
    row('Three-pointers', 'made-att (%)', (x) => made(x, 'tpm', 'tpa', 'tpPct')),
    row('3-point rate', '3PA / FGA', (x) => ({ v: pct(x.tpRate), strong: true })),
    row('Free throws', 'made-att (%)', (x) => made(x, 'ftm', 'fta', 'ftPct')),
    row('Free-throw rate', 'FTA / FGA', (x) => ({ v: pct(x.ftRate), strong: true })),
    row('Effective FG%', '(FGM + 0.5 × 3PM) / FGA', (x) => pct(x.efg)),
    row('True shooting %', 'PTS / (2 × (FGA + 0.44 × FTA))', (x) => pct(x.ts)),
  ];
  return (
    <Section title="Shooting">
      <BoxTable head={[{ label: '' }, { label: h.teams.byu }, { label: h.teams.opp }]} rows={rows} />
    </Section>
  );
}

export function DefenseSplit({ data }) {
  const { header: h, split } = data;
  const S = (side) => split[side];
  const row = (label, unit, fn) => [{ v: <>{label}<small>{unit}</small></> }, ...SIDES.map((s) => fn(S(s)))];
  const rows = [
    row('Possessions', ' ', (x) => x.poss),
    row('Chances', ' ', (x) => x.plays),
    row('PPP', ' ',(x) => f2(x.ppp)),
    row('Chances per possession', ' ', (x) => f2(x.playsPerPoss)),
    row('Points per chance', ' ', (x) => f2(x.ppPlay)),
    row('Second-chance points', '', (x) => ({ v: x.secondChancePts })),
    row('Offensive rebound rate', '', (x) => `${pct(x.orebRate)} (${x.oreb} of ${x.oreb + x.dreb})`),
  ];
  return (
    <Section title="Offensive summary">
      <BoxTable head={[{ label: 'Metric' }, { label: `${h.teams.byu} offense` }, { label: `${h.teams.opp} offense` }]} rows={rows} />
    </Section>
  );
}

export function PossessionBattle({ data }) {
  const { header: h, split, battle, afterMake, ato, params, margin } = data;
  // the points on those chances, summed from the two source rows of the Chance Margins table (same plays as battle.advN)
  const advPts = (s) => margin.filter((r) => r.k === 'transition' || r.k === 'quick_off_make').reduce((n, r) => n + r[s].pts, 0);
  const two = (fn) => SIDES.map((s) => fn(s));
  const sub = (label) => ({ v: label, className: 'box-table__indent' });
  // offensive rebound % needs the other team's defensive rebounds, which come from the per-chance rows (absent in older games)
  const tagged = data.plays?.length && hasShotLines(data.plays) ? tagRebounds(data.plays) : null;
  const orebPct = (s) => (tagged ? pct(reboundLines(tagged.filter((p) => p.offense === s), tagged.filter((p) => p.offense !== s)).orebPct) : dash);
  const rows = [
    ['Offensive rebounds per possession', ...two((s) => (split[s].poss ? f2(split[s].oreb / split[s].poss) : dash))],
    ['Offensive rebound % (of own misses)', ...two(orebPct)],
    ['Turnovers (live-ball / dead-ball)', ...two((s) => `${battle[s].tov} (${battle[s].liveTO} / ${battle[s].deadTO})`)],
    ['Scored on first chance after own timeout', ...two((s) => scoredOn(ato[s].own))],
    ['Scored on first chance after opponent timeout', ...two((s) => scoredOn(ato[s].opponent))],
    ['Scored on first chance after media timeout', ...two((s) => scoredOn(ato[s].media))],
    [`Pushed after a make (scored within ${params.QUICK_MAKE_WINDOW_SEC}s)`, ...two((s) => `${afterMake[s].quick} of ${afterMake[s].pop} (${afterMake[s].quickPts} pts)`)],
    ['Scored on transition and quick-off-make chances', ...two((s) => `${battle[s].advN - battle[s].advScoreless} of ${battle[s].advN} (${advPts(s)} pts)`)],
    [sub('Points per chance'), ...two((s) => f2(battle[s].advPPP))],
    // ['Points left at the rim (missed rim shots × 2 × rim FG%)', ...two((s) => f1(battle[s].rimLeft))], needs more data/refinement
  ];
  return (
    <Section title="Extras">
      <BoxTable head={[{ label: '' }, { label: h.teams.byu }, { label: h.teams.opp }]} rows={rows} />
      {/* <p className="box-foot">Rim FG% is the pooled rate across the {data.notes.rimAttemptsInDb.toLocaleString()} rim attempts in the loaded BYU games ({pct(data.notes.rimPct)}), not a D-I average.</p> */}
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
    ['Shot-clock violations forced', ...two((x) => x.shotClock.n)],
    [`Squeeze rate`, ...two((x) => `${pct(x.squeeze.rate)} (${x.squeeze.n} of ${x.oppPoss})`)],
    ['Opponent pts per possession: squeezed vs. other', ...two((x) => `${f2(x.squeeze.ppp)} vs. ${f2(x.squeeze.otherPPP)}`)],
    // How the opponent's late play ended on squeezed possessions (games ingested before this field existed have none)
    [sub('Ended in a turnover'), ...two((x) => (x.squeeze.ends ? `${x.squeeze.ends.turnover} of ${x.squeeze.n} (${pct(x.squeeze.ends.turnover / x.squeeze.n)})` : dash))],
    [sub('Ended in a shot or free throws'), ...two((x) => { const e = x.squeeze.ends; return e ? `${x.squeeze.n - e.turnover} of ${x.squeeze.n}` : dash; })],
    [sub('FG · 3P · FT'), ...two((x) => { const g = x.squeeze.shooting; return g ? `${g.fgm}-${g.fga} · ${g.tpm}-${g.tpa} · ${g.ftm}-${g.fta}` : dash; })],
    [sub('Possession finally finished off: made FG · FTs · turnover · defensive rebound'), ...two((x) => { const f = x.squeeze.finish; return f ? `${f.made_fg} · ${f.ft} · ${f.turnover} · ${f.def_rebound}${f.other ? ` (+${f.other} other)` : ''}` : dash; })],
    [sub('Offensive rebounds off a missed late play (points after)'), ...two((x) => (isNum(x.squeeze.misses) ? `${x.squeeze.oreb} of ${x.squeeze.misses} (${x.squeeze.orebPts})` : dash))],
    [sub('eFG% on those plays'), ...two((x) => { const g = x.squeeze.shooting; return g && g.fga ? pct((g.fgm + 0.5 * g.tpm) / g.fga) : dash; })],
    [`Live-ball havoc turned into a shot or free throws within ${params.CONVERT_WINDOW_SEC}s`, ...two((x) => convCount(x.convLive))],
    [sub('Points on the possessions that followed'), ...two((x) => convPts(x.convLive))],
    // [`Dead-ball havoc turned into a shot or free throws within ${params.CONVERT_WINDOW_SEC}s`, ...two((x) => convCount(x.convDead))],
    // [sub('Points on the possessions that followed'), ...two((x) => convPts(x.convDead))], probably don't need this one, doesn't make as much sense
  ];
  return (
    <Section title="Havoc and squeeze">
      <BoxTable head={[{ label: '' }, { label: `${h.teams.byu} defense` }, { label: `${h.teams.opp} defense` }]} rows={rows} />
    </Section>
  );
}

export function AtTheLine({ data }) {
  const { header: h, line, params } = data;
  const two = (fn) => SIDES.map((s) => fn(line[s]));
  const rows = [
    ['Trips to the line', ...two((x) => x.trips)],
    [`Points vs. generic ${Math.round(params.LEAGUE_FT_PCT * 100)}% shooter`, ...two((x) => signed(0 - x.shortLeague, 2))],
    // ['Points vs. season free-throw rates', ...two((x) => signed(0 - x.shortOwn, 2))], no data yet to support
    // ['Cost incl. possession effect: league / own', ...two((x) => `${signed(x.costLeague, 2)} / ${signed(x.costOwn, 2)}`)], needs more data/clarification
    ['Missed front ends of a 1-and-1', ...two((x) => x.front)],
    ['Opponent points after a missed final free throw', ...two((x) => x.oppPtsAfter)],
  ];
  return (
    <Section title="At the line">
      <BoxTable head={[{ label: '' }, { label: h.teams.byu }, { label: h.teams.opp }]} rows={rows} />
    </Section>
  );
}

export function PossessionValue({ data }) {
  const { header: h, E, players } = data;
  const sum = (side, k) => players.filter((p) => p.side === side).reduce((a, p) => a + (isNum(p[k]) ? p[k] : 0), 0);
  // gain events by kind, from the per-player counts
  const cnt = (side, keys) => players.filter((p) => p.side === side).reduce((n, p) => n + keys.reduce((m, k) => m + ((p.cnt && p.cnt[k]) || 0), 0), 0);
  const other = (side) => (side === 'byu' ? 'opp' : 'byu');
  // a shot chance is added by an offensive rebound and lost by a turnover or a shot the defense blocked and recovered
  const shotNet = (side) => cnt(side, ['oreb']) - cnt(side, ['tovL', 'tovD']) - cnt(other(side), ['recBlk']);
  const two = (fn) => SIDES.map((s) => fn(s));
  const sub = (label) => ({ v: label, className: 'box-table__indent' });
  const rows = [
    ['Points per possession, all possessions', ...two((s) => f2(E[s].norm))],
    ['Points per possession after a live-ball turnover', ...two((s) => f2(E[s].liveRaw))],
    [sub('Possessions'), ...two((s) => E[s].liveN)],
    [sub('Total points'), ...two((s) => Math.round((E[s].liveRaw || 0) * E[s].liveN))],
    [sub('Adjusted towards game PPP'), ...two((s) => f2(E[s].live))],
    ['Points per offensive rebound', ...two((s) => f2(E[s].oreb))],
    [sub('Offensive rebounds'), ...two((s) => E[s].orebN)],
    ['Net shot chances', ...two((s) => ({ v: signed(shotNet(s), 0), strong: true }))],
    [sub('Offensive rebounds (+1 each)'), ...two((s) => cnt(s, ['oreb']))],
    [sub('Turnovers (−1 each)'), ...two((s) => cnt(s, ['tovL', 'tovD']))],
    [sub('Shots blocked and recovered by the defense (−1 each)'), ...two((s) => cnt(other(s), ['recBlk']))],
    ['Shot chances taken away from opponent: STL + recovered blocks', ...two((s) => cnt(s, ['stl', 'recBlk']))],
    [sub('Share of the opponent\'s lost shot chances'), ...two((s) => { const lost = cnt(other(s), ['tovL', 'tovD']) + cnt(s, ['recBlk']); return lost ? pct(cnt(s, ['stl', 'recBlk']) / lost) : dash; })],
    ['Shot chance margin', ...two((s) => signed(shotNet(s) - shotNet(other(s)), 0))],
    // ['Calculated points from steals, rebounds, turnovers and blocks', ...two((s) => ({ v: f1(sum(s, 'epaAct')), strong: true }))],
    // [sub('Expected'), ...two((s) => f1(sum(s, 'epaExp')))],
    // [sub('Luck (actual − expected)'), ...two((s) => signed(sum(s, 'epaAct') - sum(s, 'epaExp'), 1))], NEEDS REFINING
  ];
  return (
    <Section title="Possession value">
      <BoxTable head={[{ label: '' }, { label: h.teams.byu }, { label: h.teams.opp }]} rows={rows} />
      {/* <details className="box-details">
        <summary>Calculated points explainer</summary>
        <div className="box-foot">
          <p>
            Calculated points are not points scored. Each event is valued against a baseline, in points. Expected uses the averages, calculated swaps in what actually followed, and Luck is calculated minus expected.
            "Own" is the team that gains or loses the chance, "opp" is the other team, and PPP is points per possession.
          </p>
          <ul>
            <li>
              <b>Steal, charge drawn</b> (a gain):
              <br />Calculated: <code>opp avg PPP + (own points on the next possession − own avg PPP)</code>
              <br />Expected: <code>opp avg PPP + (own avg PPP after a live-ball turnover − own avg PPP)</code>. A charge drawn uses just <code>opp avg PPP</code>.
            </li>
            <li>
              <b>Recovered block</b> (a gain):
              <br />Calculated: <code>opp avg PPP + (own points on the next possession − own avg PPP)</code>
              <br />Expected: <code>opp avg PPP</code>
            </li>
            <li>
              <b>Offensive rebound</b> (a gain):
              <br />Calculated: <code>points scored from the rebound to the end of the possession</code>
              <br />Expected: <code>own average points from an offensive rebound to the end of the possession</code>
            </li>
            <li>
              <b>Live-ball turnover</b> (a loss, so negative):
              <br />Calculated: <code>−(own avg PPP + (opp points on the next possession − opp avg PPP))</code>
              <br />Expected: <code>−(own avg PPP + (opp avg PPP after a live-ball turnover − opp avg PPP))</code>
            </li>
            <li>
              <b>Dead-ball turnover</b> (a loss): <code>−own avg PPP</code> for both, so it never adds luck.
            </li>
          </ul>
          <p>Averages come from this game only, so small samples can swing the numbers.</p>
        </div>
      </details> */}
    </Section>
  );
}
