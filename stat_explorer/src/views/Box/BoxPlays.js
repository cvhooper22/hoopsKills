import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Section, BoxTable } from './BoxParts';
import GameFlow, { SLOT_COLORS } from './BoxFlow';
import { pct, f2, signed, dash, isNum, periodLabel } from './boxFormat';
import {
  BUCKETS, BREAKDOWNS, START_LABELS, END_LABELS, bucketOf, clockSec, emptyGroup, hasShotLines, select, selectRest, selectOpposing, selectOpposingRest, summarize, breakdown,
  hasLineups, lineupRows, shortName, periodLenMin, toMinute, fromMinute, formatClock, parseClock,
} from '../../utils/playGroups';

// Tab links shared by the finished-game page (/box/:name) and the live page (/live/:name).
export function BoxTabs({ tabs }) {
  return (
    <nav className="live-tabs" aria-label="Game views">
      {tabs.map((t) => <NavLink key={t.to} end={t.end} to={t.to}>{t.label}</NavLink>)}
    </nav>
  );
}

const madeAtt = (m, a, p) => (a ? `${m}-${a} (${pct(p)})` : dash);
const clock = (p) => { const s = clockSec(p); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const pp = (a, b) => (isNum(a) && isNum(b) ? signed((a - b) * 100, 1) + ' pts' : dash);
const d2 = (a, b) => (isNum(a) && isNum(b) ? signed(a - b, 2) : dash);

// label, how a group's totals read, and how the gap between the two groups reads
const METRICS = [
  ['Chances', (s) => s.chances, (a, b) => signed(a.chances - b.chances)],
  ['Possessions', (s) => s.poss, (a, b) => signed(a.poss - b.poss)],
  ['Points', (s) => s.pts, (a, b) => signed(a.pts - b.pts)],
  ['Points per possession', (s) => f2(s.ppp), (a, b) => d2(a.ppp, b.ppp), true],
  ['Points per chance', (s) => f2(s.ppc), (a, b) => d2(a.ppc, b.ppc)],
  ['FG', (s) => madeAtt(s.fgm, s.fga, s.fgPct), (a, b) => pp(a.fgPct, b.fgPct)],
  ['2PT', (s) => madeAtt(s.twoM, s.twoA, s.twoPct), (a, b) => pp(a.twoPct, b.twoPct)],
  ['3PT', (s) => madeAtt(s.tpm, s.tpa, s.tpPct), (a, b) => pp(a.tpPct, b.tpPct)],
  ['FT', (s) => madeAtt(s.ftm, s.fta, s.ftPct), (a, b) => pp(a.ftPct, b.ftPct)],
  ['Effective FG%', (s) => pct(s.efg), (a, b) => pp(a.efg, b.efg)],
  ['True shooting %', (s) => pct(s.ts), (a, b) => pp(a.ts, b.ts)],
];

// Clock-left box: takes "m:ss" (or minutes) and commits on blur / Enter, so typing isn't fought by reformatting.
function ClockInput({ seconds, max, onCommit, label }) {
  const [text, setText] = useState(formatClock(seconds));
  useEffect(() => setText(formatClock(seconds)), [seconds]);
  const commit = () => {
    const v = parseClock(text);
    if (v === null) setText(formatClock(seconds));
    else onCommit(Math.min(v, max));
  };
  return <input type="text" inputMode="numeric" className="plays-clock" aria-label={label} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />;
}

// One end of a window: a period and the time left in it. `value` is a game minute, or null for the open end of the game.
function TimeBound({ isEnd, value, onChange, periods }) {
  const at = value === null ? null : fromMinute(value, isEnd);
  const len = at ? periodLenMin(at.per) * 60 : 0;
  return (
    <>
      <select aria-label={isEnd ? 'Window ends in' : 'Window starts in'} value={at ? at.per : ''} onChange={(e) => onChange(e.target.value === '' ? null : toMinute(Number(e.target.value), isEnd ? 0 : periodLenMin(Number(e.target.value)) * 60))}>
        <option value="">{isEnd ? 'End of game' : 'Start of game'}</option>
        {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
      </select>
      {at ? <><ClockInput seconds={at.clockSec} max={len} label={isEnd ? 'Time left at the end' : 'Time left at the start'} onCommit={(sec) => onChange(toMinute(at.per, sec))} /><span className="plays-group__hint">left</span></> : null}
    </>
  );
}

function GroupEditor({ title, group, onChange, teams, periods }) {
  const set = (patch) => onChange({ ...group, ...patch });
  const toggle = (key, v) => set({ [key]: group[key].includes(v) ? group[key].filter((x) => x !== v) : [...group[key], v] });
  return (
    <div className="plays-group">
      <h3 className="plays-group__title">{group.name.trim() || title}</h3>
      <div className="plays-group__row">
        <span className="plays-group__label">Name</span>
        <input type="text" className="plays-name" maxLength={40} placeholder={title} aria-label={`${title} name`} value={group.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="plays-group__row">
        <span className="plays-group__label">Offense</span>
        {['byu', 'opp'].map((s) => (
          <button key={s} type="button" className={`plays-chip${group.side === s ? ' plays-chip--on' : ''}`} onClick={() => set({ side: s })}>{teams[s]}</button>
        ))}
      </div>
      <div className="plays-group__row">
        <span className="plays-group__label">Period</span>
        <button type="button" className={`plays-chip${group.periods.length ? '' : ' plays-chip--on'}`} onClick={() => set({ periods: [] })}>All</button>
        {periods.map((p) => (
          <button key={p} type="button" className={`plays-chip${group.periods.includes(p) ? ' plays-chip--on' : ''}`} onClick={() => toggle('periods', p)}>{periodLabel(p)}</button>
        ))}
      </div>
      <div className="plays-group__row">
        <span className="plays-group__label">From</span>
        <TimeBound value={group.fromMin} onChange={(v) => set({ fromMin: v })} periods={periods} />
      </div>
      <div className="plays-group__row">
        <span className="plays-group__label">To</span>
        <TimeBound isEnd value={group.toMin} onChange={(v) => set({ toMin: v })} periods={periods} />
      </div>
      <div className="plays-group__row">
        <span className="plays-group__label">Play type</span>
        <button type="button" className={`plays-chip${group.buckets.length ? '' : ' plays-chip--on'}`} onClick={() => set({ buckets: [] })}>All</button>
        {BUCKETS.map(([k, label]) => (
          <button key={k} type="button" className={`plays-chip${group.buckets.includes(k) ? ' plays-chip--on' : ''}`} onClick={() => toggle('buckets', k)}>{label}</button>
        ))}
      </div>
    </div>
  );
}

// Every five that was on the floor for the group's plays, with what the team scored on offense and gave up on defense with
// that five out there over the same stretch.
function LineupTable({ title, offPlays, defPlays, side }) {
  const [all, setAll] = useState(false);
  const LIMIT = 10;
  const rows = useMemo(() => lineupRows(offPlays, defPlays, side), [offPlays, defPlays, side]);
  const shown = (all ? rows : rows.slice(0, LIMIT)).map((r) => [
    r.names.map(shortName).join(', '), r.off.poss, r.off.pts, f2(r.off.ppp), r.def.poss, r.def.pts, f2(r.def.ppp),
    isNum(r.off.ppp) && isNum(r.def.ppp) ? { v: signed(r.off.ppp - r.def.ppp, 2), strong: true } : dash,
  ]);
  return (
    <>
      <h3 className="plays-group__title">{title}</h3>
      {rows.length ? (
        <>
          <BoxTable className="lineup-table" head={[{ label: 'Lineup' }, { label: 'Off. poss.' }, { label: 'Pts' }, { label: 'Pts / poss.' }, { label: 'Def. poss.' }, { label: 'Opp. pts' }, { label: 'Opp. pts / poss.' }, { label: 'Net / poss.', title: 'Points per possession scored minus points per possession allowed' }]} rows={shown} />
          {rows.length > LIMIT ? <button type="button" className="plays-chip" onClick={() => setAll((v) => !v)}>{all ? `Show the top ${LIMIT}` : `Show all ${rows.length} lineups`}</button> : null}
        </>
      ) : <p className="box-foot">No plays in this group.</p>}
    </>
  );
}

function PlayList({ plays, teams }) {
  const LIMIT = 250;
  const rows = plays.slice(0, LIMIT).map((p) => {
    const bits = [];
    if (p.fga) bits.push(`FG ${p.fgm}-${p.fga}`);
    if (p.tpa) bits.push(`3PT ${p.tpm}-${p.tpa}`);
    if (p.fta) bits.push(`FT ${p.ftm}-${p.fta}`);
    return [
      `${periodLabel(p.per)} ${clock(p)}`, teams[p.offense], BUCKETS.find((b) => b[0] === bucketOf(p))?.[1] ?? bucketOf(p),
      START_LABELS[p.start] ?? p.start, END_LABELS[p.end] ?? p.end, bits.join(' · ') || dash, { v: p.pts, strong: p.pts > 0 },
    ];
  });
  return (
    <>
      <BoxTable head={[{ label: 'When (clock left)' }, { label: 'Offense' }, { label: 'Type' }, { label: 'Started' }, { label: 'Ended' }, { label: 'Shots' }, { label: 'Pts' }]} rows={rows} />
      {plays.length > LIMIT ? <p className="box-foot">Showing the first {LIMIT} of {plays.length} plays.</p> : null}
    </>
  );
}

// The Plays tab: pick a group of plays (offense, period, stretch of the game, play type), see points per possession and the
// FG / 2PT / 3PT / FT lines, break it down, and set it against the rest of the game or a second group.
export function PlaysPanel({ data }) {
  const plays = data.plays;
  const teams = data.header.teams;
  const periods = useMemo(() => [...new Set(plays.map((p) => p.per))].sort((a, b) => a - b), [plays]);
  const [a, setA] = useState(() => emptyGroup('byu'));
  const [b, setB] = useState(() => emptyGroup('byu'));
  const [mode, setMode] = useState('off'); // off | rest | custom
  const [by, setBy] = useState('type');
  const [showList, setShowList] = useState(false);
  const [slot, setSlot] = useState(0); // which group the game-flow graph selects for: 0 = A, 1 = B

  // A stretch picked on the graph becomes that group's game-minute window; picking for B opens the second group.
  const onFlowSelect = (i, r) => {
    const patch = { fromMin: r ? r.from : null, toMin: r ? r.to : null };
    if (i === 0) setA((g) => ({ ...g, ...patch }));
    else { setB((g) => ({ ...g, ...patch })); setMode('custom'); }
  };

  const inA = useMemo(() => select(plays, a), [plays, a]);
  const inB = useMemo(() => (mode === 'rest' ? selectRest(plays, a) : mode === 'custom' ? select(plays, b) : null), [plays, a, b, mode]);
  const sa = useMemo(() => summarize(inA), [inA]);
  const sb = useMemo(() => (inB ? summarize(inB) : null), [inB]);
  // what the other team did over the same stretch
  const oa = useMemo(() => summarize(selectOpposing(plays, a)), [plays, a]);
  const ob = useMemo(() => (mode === 'rest' ? summarize(selectOpposingRest(plays, a)) : mode === 'custom' ? summarize(selectOpposing(plays, b)) : null), [plays, a, b, mode]);

  if (!hasShotLines(plays)) {
    return <Section title="Plays"><p>This game's box file predates the Plays tab. Regenerate it with <code>node derivations/game-box-prototype.js {data.header.gameId}</code>.</p></Section>;
  }

  const nameA = a.name.trim() || 'Group A';
  const nameB = b.name.trim() || (mode === 'rest' ? `Rest of ${teams[a.side]}'s plays` : 'Group B');
  const head = [{ label: '' }, { label: nameA }, ...(sb ? [{ label: nameB }, { label: `${nameA} − ${nameB}` }] : [])];
  const rows = METRICS.map(([label, show, diff, strong]) => [
    { v: label, strong }, { v: show(sa), strong }, ...(sb ? [{ v: show(sb), strong }, diff(sa, sb)] : []),
  ]);
  const oppRow = ['Opponent points per possession', f2(oa.ppp), ...(ob ? [f2(ob.ppp), d2(oa.ppp, ob.ppp)] : [])];
  rows.splice(rows.findIndex((r) => r[0].v === 'Points per possession') + 1, 0, oppRow.map((v) => ({ v, strong: true })));

  const breakdownRows = (list) => breakdown(list, by).map((r) => [
    r.label, r.chances, r.poss, r.pts, f2(r.ppp), madeAtt(r.fgm, r.fga, r.fgPct), madeAtt(r.twoM, r.twoA, r.twoPct), madeAtt(r.tpm, r.tpa, r.tpPct), madeAtt(r.ftm, r.fta, r.ftPct),
  ]);
  const bhead = (first) => [{ label: first }, { label: 'Chances' }, { label: 'Poss.' }, { label: 'Pts' }, { label: 'Pts / poss.' }, { label: 'FG' }, { label: '2PT' }, { label: '3PT' }, { label: 'FT' }];

  return (
    <div className="plays">
      <Section title="Game flow">
        <div className="plays-group__row">
          <span className="plays-group__label">Select for</span>
          {[nameA, nameB].map((label, i) => (
            <button key={label} type="button" className={`plays-chip${slot === i ? ' plays-chip--on' : ''}`} style={slot === i ? { background: SLOT_COLORS[i], borderColor: SLOT_COLORS[i] } : { color: SLOT_COLORS[i], borderColor: SLOT_COLORS[i] }} onClick={() => setSlot(i)}>{label}</button>
          ))}
        </div>
        <GameFlow plays={plays} events={data.events} teams={teams} active={slot} names={[nameA, nameB]} onSelect={onFlowSelect}
          ranges={[a.fromMin !== null || a.toMin !== null ? { from: a.fromMin ?? 0, to: a.toMin ?? 99 } : null, mode === 'custom' && (b.fromMin !== null || b.toMin !== null) ? { from: b.fromMin ?? 0, to: b.toMin ?? 99 } : null]} />
      </Section>

      <Section title="Pick the plays">
        <div className="plays-groups">
          <GroupEditor title="Group A" group={a} onChange={setA} teams={teams} periods={periods} />
          {mode === 'custom' ? <GroupEditor title="Group B" group={b} onChange={setB} teams={teams} periods={periods} /> : null}
        </div>
        <div className="plays-group__row plays-compare">
          <span className="plays-group__label">Compare to</span>
          {[['off', 'Nothing'], ['rest', 'Rest of the game'], ['custom', 'Another group']].map(([k, label]) => (
            <button key={k} type="button" className={`plays-chip${mode === k ? ' plays-chip--on' : ''}`} onClick={() => setMode(k)}>{label}</button>
          ))}
        </div>
        {mode === 'rest' ? (
          <div className="plays-group__row">
            <span className="plays-group__label">Name</span>
            <input type="text" className="plays-name" maxLength={40} placeholder={`Rest of ${teams[a.side]}'s plays`} aria-label="Comparison name" value={b.name} onChange={(e) => setB((g) => ({ ...g, name: e.target.value }))} />
          </div>
        ) : null}
      </Section>

      <Section title="Totals">
        <BoxTable head={head} rows={rows} />
      </Section>

      <Section title="Break it down">
        <div className="plays-group__row">
          <span className="plays-group__label">By</span>
          {Object.entries(BREAKDOWNS).map(([k, spec]) => (
            <button key={k} type="button" className={`plays-chip${by === k ? ' plays-chip--on' : ''}`} onClick={() => setBy(k)}>{spec.label}</button>
          ))}
        </div>
        <h3 className="plays-group__title">{nameA}</h3>
        <BoxTable head={bhead(BREAKDOWNS[by].label)} rows={breakdownRows(inA)} />
        {inB ? (<><h3 className="plays-group__title">{nameB}</h3><BoxTable head={bhead(BREAKDOWNS[by].label)} rows={breakdownRows(inB)} /></>) : null}
      </Section>

      <Section title="Lineups">
        {hasLineups(plays) ? (
          <>
            <LineupTable title={nameA} side={a.side} offPlays={inA} defPlays={selectOpposing(plays, a)} />
            {inB ? <LineupTable title={nameB} side={mode === 'rest' ? a.side : b.side} offPlays={inB} defPlays={mode === 'rest' ? selectOpposingRest(plays, a) : selectOpposing(plays, b)} /> : null}
          </>
        ) : <p>This game's box file predates lineups. Regenerate it with <code>node derivations/game-box-prototype.js {data.header.gameId}</code>.</p>}
      </Section>

      <Section title="The plays">
        <button type="button" className="plays-chip" onClick={() => setShowList((v) => !v)}>{showList ? 'Hide' : 'Show'} {nameA}'s {inA.length} plays</button>
        {showList ? <PlayList plays={inA} teams={teams} /> : null}
      </Section>
    </div>
  );
}
