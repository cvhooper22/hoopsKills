import { useMemo, useState } from 'react';
import useMediaQuery from '../../hooks/useMediaQuery';
import useElementWidth from '../../hooks/useElementWidth';
import { Section, BoxTable, NetChip } from './BoxParts';
import PlayerFilters from '../../components/PlayerFilters/PlayerFilters';
import BallToggle from '../../components/BallToggle/BallToggle';
import { periodLabel, f1, signed } from './boxFormat';
import { hasLineups, shortName, gameMinutes, axisLayout, fromMinute, formatClock } from '../../utils/playGroups';
import { playerFloorTime, netRating } from '../../utils/lineupTimeline';
import { toCheckname } from '../../utils/eventTimeline';
import useLineupModel from './useLineupModel';
import { FloorChart, NameColumn, COMPACT, STRIP_W, at } from './BoxFloorChart';

const COLORS = { byu: '#002e5d', opp: '#b4483a' };

// The Lineup timeline tab: each team's fives through the whole game, in order.
export function LineupTimelinePanel({ data }) {
  const plays = data.plays;
  const teams = data.header.teams;
  const [side, setSide] = useState('byu');
  const [marked, setMarked] = useState(null); // lineup key whose stints are highlighted in the table
  const [picked, setPicked] = useState([]); // players (LAST,FIRST) whose lineups are highlighted: every stint with all of them on the floor
  const [metric, setMetric] = useState('pm'); // number on each bar: plus/minus or net rating
  const narrow = useMediaQuery('(max-width: 640px)');
  const phone = useMediaQuery('(max-width: 700px)'); // stints become stacked cards instead of a table to scroll sideways
  const [boxRef, boxW] = useElementWidth(COMPACT.w);
  const [view, setView] = useState(1); // narrow screens: a period number, or 'scroll' for the whole game on a sideways-scrolling strip
  const total = useMemo(() => gameMinutes(plays), [plays]);
  const lineups = useLineupModel(data);
  const stints = useMemo(() => lineups.stintsFor(side), [lineups, side]);
  const floor = useMemo(() => playerFloorTime(stints), [stints]);
  const players = useMemo(() => floor.map((p) => toCheckname(p.name)), [floor]);
  const togglePlayer = (p) => { setMarked(null); setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p])); };
  const periods = useMemo(() => axisLayout(total).periods, [total]);

  if (!hasLineups(plays)) {
    return <Section title="Lineup timeline"><p>This game's box file predates lineups. Regenerate it with <code>node derivations/game-box-prototype.js {data.header.gameId}</code>.</p></Section>;
  }

  const chart = { floor, total, color: COLORS[side], metric, tip: { events: data.events, teams, side } };
  const half = periods.find((p) => p.per === view) || periods[0];
  // the selected lineup's stints added together
  const hit = (s) => (marked ? s.key === marked : picked.length > 0 && picked.every((p) => s.names.some((n) => toCheckname(n) === p)));
  const mine = stints.filter(hit);
  const mineTitle = marked ? mine[0].names.map(shortName).join(', ') : `${picked.map((p) => shortName(floor[players.indexOf(p)].name)).join(' + ')} together`;
  const sum = mine.reduce((t, s) => ({ mins: t.mins + s.mins, scored: t.scored + s.scored, allowed: t.allowed + s.allowed, offPoss: t.offPoss + s.offPoss, defPoss: t.defPoss + s.defPoss }), { mins: 0, scored: 0, allowed: 0, offPoss: 0, defPoss: 0 });
  // the "to" time drops the half when it is the same one the stint started in
  const until = (s) => { const { per, clockSec } = fromMinute(s.endMin, true); return per === fromMinute(s.startMin, false).per ? formatClock(clockSec) : at(s.endMin, true); };
  const markButton = (s, pinned) => (
    <button type="button" className={`timeline-mark${pinned ? ' timeline-mark--on' : ''}`} aria-pressed={pinned}
      title={pinned ? 'Stop highlighting this lineup' : 'Highlight every stint of this lineup'}
      aria-label={`${pinned ? 'Stop highlighting' : 'Highlight every stint of'} ${s.names.map(shortName).join(', ')}`}
      onClick={() => { setPicked([]); setMarked(marked === s.key ? null : s.key); }}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="8" cy="8" r="1.8" fill="currentColor" /><path d="M8 0.5v3M8 12.5v3M0.5 8h3M12.5 8h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    </button>
  );
  const names = (list) => list.map(shortName).join(', ') || 'none';
  const inOut = (i) => {
    const prev = stints[i - 1], s = stints[i];
    return prev
      ? <>In: <strong>{names(s.names.filter((n) => !prev.names.includes(n)))}</strong> · Out: <strong>{names(prev.names.filter((n) => !s.names.includes(n)))}</strong></>
      : 'Starters';
  };
  // the first stint of the 2nd half gets a solid bar above it (in the table and the phone cards)
  const halfStart = stints.findIndex((s, i) => i > 0 && fromMinute(s.startMin, false).per >= 2 && fromMinute(stints[i - 1].startMin, false).per < 2);
  const rows = stints.flatMap((s, i) => {
    const on = hit(s), pinned = marked === s.key;
    const cells = [
      i + 1,
      {
        v: (
          <span className="timeline-lineup">
            {s.names.map(shortName).join(', ')}
            {markButton(s, pinned)}
          </span>
        ),
      },
      at(s.startMin, false), until(s), f1(s.mins),
      { v: s.scored, className: 'box-table__center' }, { v: s.allowed, className: 'box-table__center' }, { v: <NetChip value={s.scored - s.allowed} />, strong: true, className: 'box-table__center' },
    ];
    const subs = inOut(i);
    const sub = [{ v: '', className: 'timeline-sub' }, { v: subs, className: 'timeline-sub' }, { v: '', colSpan: 6, className: 'timeline-sub' }];
    const mark = (c) => (c !== null && typeof c === 'object' && 'v' in c ? { ...c, className: [c.className, 'timeline-hit'].filter(Boolean).join(' ') } : { v: c, className: 'timeline-hit' });
    const out = on ? [cells.map(mark), sub.map(mark)] : [cells, sub];
    return i === halfStart ? [[{ v: 'Halftime', colSpan: 8, className: 'timeline-half' }], ...out] : out;
  });
  return (
    <div className="plays">
      <Section title="Lineup timeline">
        <div className="plays-group__row">
          <span className="plays-group__label">Team</span>
          {['byu', 'opp'].map((s) => (
            <button key={s} type="button" className={`plays-chip${side === s ? ' plays-chip--on' : ''}`} onClick={() => { setSide(s); setMarked(null); setPicked([]); }}>{teams[s]}</button>
          ))}
        </div>
        <div className="plays-group__row">
          <span className="plays-group__label">Show</span>
          <BallToggle size="small" checked={metric === 'net'} onChange={(net) => setMetric(net ? 'net' : 'pm')} leftLabel="+/-" rightLabel="Net rating" ariaLabel="Show net rating instead of plus/minus on the bars" />
        </div>
        <h3 className="plays-group__title">Who was on the floor</h3>
        {narrow ? (
          <div ref={boxRef}>
            <div className="plays-group__row">
              {periods.map((p) => <button key={p.per} type="button" className={`plays-chip${view === p.per ? ' plays-chip--on' : ''}`} onClick={() => setView(p.per)}>{periodLabel(p.per)}</button>)}
              <button type="button" className={`plays-chip${view === 'scroll' ? ' plays-chip--on' : ''}`} onClick={() => setView('scroll')}>Scroll</button>
            </div>
            {view === 'scroll' ? (
              <div className="timeline-strip">
                <NameColumn floor={floor} width={COMPACT.padL} />
                <div className="timeline-strip__scroll"><FloorChart {...chart} width={STRIP_W} padL={0} names={false} fixed /></div>
              </div>
            ) : (
              <FloorChart {...chart} lo={half.start} hi={half.start + half.len} width={boxW} padL={COMPACT.padL} fixed />
            )}
          </div>
        ) : <FloorChart {...chart} />}
      </Section>
      <Section title="Lineup Stints">
        <PlayerFilters title="Highlight by player/combination" players={players} filterPlayers={picked} onChange={togglePlayer} max={players.length} />
        {mine.length ? (
          <div className="timeline-totals mt-l">
            <p className="timeline-totals__title">{mineTitle} <span>(highlighted below)</span></p>
            <dl className="timeline-totals__stats">
              {[
                ['Stints', mine.length],
                ['Minutes', f1(sum.mins)],
                ['Pts', sum.scored],
                ['Opp. pts', sum.allowed],
                ['Net', <NetChip value={sum.scored - sum.allowed} />],
                ['Net rating', <>{signed(netRating(sum), 2)}<small> per poss.</small></>],
                ['Poss.', `${sum.offPoss} off. / ${sum.defPoss} def.`],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          </div>
        ) : null}
        {phone ? (
          <ol className="stint-cards">
            {stints.map((s, i) => {
              const net = s.scored - s.allowed;
              return (
                <li key={i} className={`stint-card${hit(s) ? ' stint-card--hit' : ''}${i === halfStart ? ' stint-card--half' : ''}`}>
                  <div className="stint-card__lineup"><span className="stint-card__num">{i + 1}</span><span className="stint-card__names">{s.names.map(shortName).join(', ')}</span>{markButton(s, marked === s.key)}</div>
                  <div className="stint-card__line">{inOut(i)}</div>
                  <div className="stint-card__line">{at(s.startMin, false)} to {until(s)} · {f1(s.mins)} min</div>
                  <div className="stint-card__stats"><span>Pts <strong>{s.scored}</strong></span><span>Opp <strong>{s.allowed}</strong></span><NetChip value={net} /></div>
                </li>
              );
            })}
          </ol>
        ) : (
        <BoxTable
          head={[{ label: '#' }, { label: 'Lineup' }, { label: 'From' }, { label: 'To' }, { label: 'Min', title: 'Minutes of game time' }, { label: 'Pts', className: 'box-table__center' }, { label: 'Opp. pts', className: 'box-table__center' }, { label: 'Net', className: 'box-table__center' }]}
          rows={rows} stickyFirst={false} />
        )}
      </Section>
    </div>
  );
}
