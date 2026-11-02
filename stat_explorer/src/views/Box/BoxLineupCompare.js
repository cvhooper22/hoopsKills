import { useMemo, useState } from 'react';
import { Section, BoxTable } from './BoxParts';
import { pct, f1, f2, signed, dash, isNum } from './boxFormat';
import { hasLineups, shortName, summarize, tagRebounds, reboundLines } from '../../utils/playGroups';
import { playerFloorTime, lineupSplit, lineupMatches, minutesOn, specIsEmpty } from '../../utils/lineupTimeline';
import useLineupModel from './useLineupModel';
import BoxStatsCompare from './BoxStatsCompare';
import BoxPlayerCompare from './BoxPlayerCompare';
import CompareShotCharts, { useLocatedShots } from './BoxShotCharts';
import { eventLines, playerContext } from '../../utils/boxStats';
import { TextInput, Select } from '../../components/Field/Field';

const madeAtt = (m, a, p) => (a ? `${m}-${a} (${pct(p)})` : dash);
const dpp = (a, b) => (isNum(a) && isNum(b) ? signed((a - b) * 100, 1) + ' pts' : dash);
const d2 = (a, b) => (isNum(a) && isNum(b) ? signed(a - b, 2) : dash);
const d1 = (a, b) => (isNum(a) && isNum(b) ? signed(a - b, 1) : dash);
const d0 = (a, b) => signed(a - b);

const EMPTY = () => ({ name: '', on: [], off: [] });

// Everything the table shows for one spec: the team's offense, its defense (what the other team did against it) and minutes.
function lineSummary(plays, stints, side, spec, invert, total, luOf) {
  const { off, def } = lineupSplit(plays, side, spec, invert, luOf);
  const o = summarize(off), d = summarize(def);
  const net = isNum(o.ppp) && isNum(d.ppp) ? (o.ppp - d.ppp) * 100 : null;
  return { o, d, net, r: reboundLines(off, def), total, share: total ? o.poss / total : null, mins: minutesOn(stints, spec, invert) };
}

// label, value for a summary, gap between two summaries (null = none), bold row
const TOTAL_ROWS = [
  ['Possessions (share of the team\'s game)', (x) => (x.total ? `${x.o.poss} of ${x.total} (${pct(x.share)})` : dash), (a, b) => dpp(a.share, b.share), true],
  ['Minutes on the floor', (x) => f1(x.mins), (a, b) => d1(a.mins, b.mins)],
  ['Net rating (per 100 poss.)', (x) => (isNum(x.net) ? signed(x.net, 1) : dash), (a, b) => d1(a.net, b.net), true],
  ['Points scored', (x) => x.o.pts, (a, b) => d0(a.o.pts, b.o.pts)],
  ['Points per possession', (x) => f2(x.o.ppp), (a, b) => d2(a.o.ppp, b.o.ppp), true],
  ['Turnovers per possession', (x) => f2(x.o.tovRate), (a, b) => d2(a.o.tovRate, b.o.tovRate)],
  ['Possessions on defense', (x) => x.d.poss, (a, b) => d0(a.d.poss, b.d.poss)],
  ['Opponent points per possession', (x) => f2(x.d.ppp), (a, b) => d2(a.d.ppp, b.d.ppp), true],
  ['Opponent turnovers per possession', (x) => f2(x.d.tovRate), (a, b) => d2(a.d.tovRate, b.d.tovRate)],
];

const SHOOTING_ROWS = [
  ['FG', (x) => madeAtt(x.o.fgm, x.o.fga, x.o.fgPct), (a, b) => dpp(a.o.fgPct, b.o.fgPct)],
  ['2PT', (x) => madeAtt(x.o.twoM, x.o.twoA, x.o.twoPct), (a, b) => dpp(a.o.twoPct, b.o.twoPct)],
  ['3PT', (x) => madeAtt(x.o.tpm, x.o.tpa, x.o.tpPct), (a, b) => dpp(a.o.tpPct, b.o.tpPct)],
  ['FT', (x) => madeAtt(x.o.ftm, x.o.fta, x.o.ftPct), (a, b) => dpp(a.o.ftPct, b.o.ftPct)],
  ['Effective FG%', (x) => pct(x.o.efg), (a, b) => dpp(a.o.efg, b.o.efg)],
  ['Opponent FG', (x) => madeAtt(x.d.fgm, x.d.fga, x.d.fgPct), (a, b) => dpp(a.d.fgPct, b.d.fgPct)],
  ['Opponent 2PT', (x) => madeAtt(x.d.twoM, x.d.twoA, x.d.twoPct), (a, b) => dpp(a.d.twoPct, b.d.twoPct)],
  ['Opponent 3PT', (x) => madeAtt(x.d.tpm, x.d.tpa, x.d.tpPct), (a, b) => dpp(a.d.tpPct, b.d.tpPct)],
  ['Opponent effective FG%', (x) => pct(x.d.efg), (a, b) => dpp(a.d.efg, b.d.efg)],
];

const REBOUND_ROWS = [
  ['Rebounds', (x) => x.r.reb, (a, b) => d0(a.r.reb, b.r.reb), true],
  ['Offensive rebounds', (x) => x.r.oreb, (a, b) => d0(a.r.oreb, b.r.oreb)],
  ['Offensive rebounds per possession', (x) => f2(x.o.poss ? x.r.oreb / x.o.poss : null), (a, b) => d2(a.o.poss ? a.r.oreb / a.o.poss : null, b.o.poss ? b.r.oreb / b.o.poss : null)],
  ['Defensive rebounds', (x) => x.r.dreb, (a, b) => d0(a.r.dreb, b.r.dreb)],
  ['Offensive rebound %', (x) => pct(x.r.orebPct), (a, b) => dpp(a.r.orebPct, b.r.orebPct), true],
  ['Defensive rebound %', (x) => pct(x.r.drebPct), (a, b) => dpp(a.r.drebPct, b.r.drebPct), true],
  ['Total rebound %', (x) => pct(x.r.rebPct), (a, b) => dpp(a.r.rebPct, b.r.rebPct), true],
  ['Opponent offensive rebounds', (x) => x.r.oppOreb, (a, b) => d0(a.r.oppOreb, b.r.oppOreb)],
  ['Opponent offensive rebounds per possession', (x) => f2(x.d.poss ? x.r.oppOreb / x.d.poss : null), (a, b) => d2(a.d.poss ? a.r.oppOreb / a.d.poss : null, b.d.poss ? b.r.oppOreb / b.d.poss : null)],
];

// One lineup definition: a name, a "pick a five" shortcut, and a chip per player (click: on the floor, again: off, again: neither).
function SpecEditor({ title, spec, onChange, roster, lineups }) {
  const set = (patch) => onChange({ ...spec, ...patch });
  const state = (n) => (spec.on.includes(n) ? 'on' : spec.off.includes(n) ? 'off' : 'none');
  const cycle = (n) => {
    const s = state(n);
    set({ on: s === 'none' ? [...spec.on, n] : spec.on.filter((x) => x !== n), off: s === 'on' ? [...spec.off, n] : spec.off.filter((x) => x !== n) });
  };
  const key = spec.on.length === 5 && !spec.off.length ? [...spec.on].sort().join('|') : '';
  return (
    <div className="plays-group">
      <h3 className="plays-group__title">{spec.name.trim() || title}</h3>
      <div className="plays-group__row">
        <span className="plays-group__label">Name</span>
        <TextInput size="sm" className="plays-name" maxLength={40} placeholder={title} aria-label={`${title} name`} value={spec.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="plays-group__row">
        <span className="plays-group__label">Lineup</span>
        <Select size="sm" aria-label={`${title} lineup`} value={key} onChange={(e) => set(e.target.value ? { on: e.target.value.split('|'), off: [] } : { on: [], off: [] })}>
          <option value="">{key || spec.on.length || spec.off.length ? 'Pick a five…' : 'Everyone (whole game)'}</option>
          {lineups.map((l) => <option key={l.key} value={l.key}>{l.names.map(shortName).join(', ')} ({l.poss} poss.)</option>)}
        </Select>
        <button type="button" className="plays-chip" onClick={() => set({ on: [], off: [] })}>Clear</button>
      </div>
      <div className="plays-group__row">
        <span className="plays-group__label" title="Click a player once to require them on the floor, twice to require them off it">Players</span>
        {roster.map((n) => {
          const s = state(n);
          return (
            <button key={n} type="button" className={`plays-chip${s === 'on' ? ' plays-chip--on' : ''}${s === 'off' ? ' plays-chip--off' : ''}`}
              title={s === 'on' ? 'On the floor (click: off the floor)' : s === 'off' ? 'Off the floor (click: clear)' : 'Click: on the floor'} onClick={() => cycle(n)}>
              {s === 'off' ? 'Off: ' : ''}{shortName(n)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const describe = (spec) => {
  const bits = [];
  if (spec.on.length) bits.push(`${spec.on.map(shortName).join(', ')} on`);
  if (spec.off.length) bits.push(`${spec.off.map(shortName).join(', ')} off`);
  return bits.join('; ') || 'everyone';
};

// The Lineup compare tab: one lineup (or a set of players on / off the floor) against the rest of the time, or against another.
export function LineupComparePanel({ data, shotPlays }) {
  const plays = useMemo(() => tagRebounds(data.plays), [data.plays]);
  const teams = data.header.teams;
  const [side, setSide] = useState('byu');
  const [a, setA] = useState(EMPTY);
  const [b, setB] = useState(EMPTY);
  const [mode, setMode] = useState('rest'); // rest | custom | off

  const lineupModel = useLineupModel(data);
  const { luOf, model } = lineupModel;
  const located = useLocatedShots(shotPlays, data);
  const stints = useMemo(() => lineupModel.stintsFor(side), [lineupModel, side]);
  const roster = useMemo(() => playerFloorTime(stints).map((p) => p.name), [stints]);
  const lineups = useMemo(() => {
    const by = new Map();
    for (const p of plays) {
      if (!p.lu || !p.lu[side].length) continue;
      const names = luOf ? luOf(p, side) : p.lu[side];
      const k = names.join('|');
      if (!by.has(k)) by.set(k, { key: k, names, poss: new Set() });
      if (p.offense === side) by.get(k).poss.add(p.poss);
    }
    return [...by.values()].map((l) => ({ ...l, poss: l.poss.size })).sort((x, y) => y.poss - x.poss);
  }, [plays, side, luOf]);

  // the team's possessions on offense in the whole game: the denominator for each lineup's share
  const total = useMemo(() => new Set(plays.filter((p) => p.offense === side).map((p) => p.poss)).size, [plays, side]);
  const sa = useMemo(() => lineSummary(plays, stints, side, a, false, total, luOf), [plays, stints, side, a, total, luOf]);
  const sb = useMemo(() => (mode === 'rest' ? lineSummary(plays, stints, side, a, true, total, luOf) : mode === 'custom' ? lineSummary(plays, stints, side, b, false, total, luOf) : null), [plays, stints, side, a, b, mode, total, luOf]);

  // box-score lines from the event log: each event goes to the five the replayed substitutions had on the floor at that point
  const boxFor = (spec, invert) => (model ? eventLines(data.events, side, (e, i) => lineupMatches(model.lineupAtSeq(side, i), spec) !== invert) : null);
  const boxA = useMemo(() => boxFor(a, false), [model, data.events, side, a]); // eslint-disable-line react-hooks/exhaustive-deps
  const boxB = useMemo(() => (mode === 'rest' ? boxFor(a, true) : mode === 'custom' ? boxFor(b, false) : null), [model, data.events, side, a, b, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasLineups(plays)) {
    return <Section title="Lineup compare"><p>This game's box file predates lineups. Regenerate it with <code>node derivations/game-box-prototype.js {data.header.gameId}</code>.</p></Section>;
  }

  const nameA = a.name.trim() || 'Lineup A';
  const nameB = b.name.trim() || (mode === 'rest' ? 'Other combos' : 'Lineup B');
  const stintsBoth = { byu: lineupModel.stintsFor('byu'), opp: lineupModel.stintsFor('opp') };
  const withContext = (box, spec, invert) => {
    const { off, def } = lineupSplit(plays, side, spec, invert, luOf);
    const spans = stints.filter((s) => lineupMatches(s.names, spec) !== invert).map((s) => [s.startMin, s.endMin]);
    const c = playerContext({ plays: [...off, ...def], luOf, side, stints: stintsBoth, spans });
    return { ...box, playerMins: c.mins, playerPoss: c.poss };
  };
  const boxSlices = boxA ? [{ name: nameA, ...withContext(boxA, a, false), poss: { team: sa.o.poss, opp: sa.d.poss } }, sb && boxB ? { name: nameB, ...withContext(boxB, mode === 'rest' ? a : b, mode === 'rest'), poss: { team: sb.o.poss, opp: sb.d.poss } } : null] : [];
  const toRows = (defs) => defs.map(([label, show, diff, strong]) => [{ v: label, strong }, { v: show(sa), strong }, ...(sb ? [{ v: show(sb), strong }, diff(sa, sb)] : [])]);
  const head = [{ label: '' }, { label: nameA }, ...(sb ? [{ label: nameB }, { label: `${nameA} − ${nameB}` }] : [])];
  const switchSide = (s) => { setSide(s); setA(EMPTY()); setB(EMPTY()); };

  return (
    <div className="plays">
      <Section>
        <div className="plays-group__row">
          <span className="plays-group__label">Team</span>
          {['byu', 'opp'].map((s) => <button key={s} type="button" className={`plays-chip${side === s ? ' plays-chip--on' : ''}`} onClick={() => switchSide(s)}>{teams[s]}</button>)}
        </div>
        <div className="plays-groups">
          <SpecEditor title="Lineup A" spec={a} onChange={setA} roster={roster} lineups={lineups} />
          {mode === 'custom' ? <SpecEditor title="Lineup B" spec={b} onChange={setB} roster={roster} lineups={lineups} /> : null}
        </div>
        <div className="plays-group__row plays-compare">
          <span className="plays-group__label">Compare to</span>
          {[['rest', 'All other lineup combos'], ['custom', 'Another lineup'], ['off', 'Nothing']].map(([k, label]) => (
            <button key={k} type="button" className={`plays-chip${mode === k ? ' plays-chip--on' : ''}`} onClick={() => setMode(k)}>{label}</button>
          ))}
        </div>
        {mode === 'rest' ? (
          <div className="plays-group__row">
            <span className="plays-group__label">Name</span>
            <TextInput size="sm" className="plays-name" maxLength={40} placeholder="Other combos" aria-label="Comparison name" value={b.name} onChange={(e) => setB((g) => ({ ...g, name: e.target.value }))} />
          </div>
        ) : null}
      </Section>

      <Section title="Totals">
        <BoxTable head={head} rows={toRows(TOTAL_ROWS)} />
      </Section>

      <Section title="Rebounding">
        <BoxTable head={head} rows={toRows(REBOUND_ROWS)} />
      </Section>

      {boxA ? <BoxStatsCompare side={side} teams={teams} slices={boxSlices} /> : null}
      {boxA ? <BoxPlayerCompare side={side} teams={teams} slices={boxSlices} /> : null}

      <Section title="Shooting">
        <BoxTable head={head} rows={toRows(SHOOTING_ROWS)} />
      </Section>

      {model ? (
        <CompareShotCharts located={located} teams={teams} slices={[
          { name: nameA, side, pick: (e, i) => lineupMatches(model.lineupAtSeq(side, i), a) },
          ...(mode === 'rest' ? [{ name: nameB, side, pick: (e, i) => !lineupMatches(model.lineupAtSeq(side, i), a) }] : mode === 'custom' ? [{ name: nameB, side, pick: (e, i) => lineupMatches(model.lineupAtSeq(side, i), b) }] : []),
        ]} />
      ) : null}
    </div>
  );
}
