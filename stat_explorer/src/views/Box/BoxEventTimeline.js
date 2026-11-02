import { useMemo, useState } from 'react';
import { curveMonotoneX } from 'd3';
import { Chart, Axis, Line, ReferenceLine, PointPicker, useChart } from '../../components/charts';
import { ShapeIcon, ShapeMark } from '../../components/ShapeIcons/ShapeIcons';
import PlayerFilters from '../../components/PlayerFilters/PlayerFilters';
import { Section, BoxTable } from './BoxParts';
import { periodLabel } from './boxFormat';
import { gameMinutes, axisLayout, pointAt, formatClock, shortName } from '../../utils/playGroups';
import useLineupModel from './useLineupModel';
import {
  KINDS, KIND_BY_KEY, timelineEvents, lineSideOf, assignLanes, gapStats, formatGap, toCheckname, playerPhotoUrl, initialsOf,
} from '../../utils/eventTimeline';

// The Event timeline tab: every counting stat for one team placed on the game clock, either on top of the score lines (game flow)
// or one row per stat (stacked), with how long the gaps between each stat run underneath. All of it comes from data.events.
const BYU_COLOR = 'var(--royal-blue)';
const OPP_COLOR = '#b4483a';
const LINE_OPACITY = 0.4; // the score lines sit back so the markers read over them
const LANE_STEP = 9; // px between lanes of markers that would otherwise overlap
const ROW_H = 28;
const FLOW_MARGIN = { top: 12, right: 14, bottom: 46, left: 40 };
const STACK_MARGIN = { top: 8, right: 14, bottom: 46, left: 118 };

// Groups of stats that switch on and off together. A group reads as on when every stat in it is plotted.
const META = [
  { key: 'offense', label: 'Offense', kinds: ['fg2m', 'fg2x', 'fg3m', 'fg3x', 'ftm', 'ftx', 'oreb'] },
  { key: 'defense', label: 'Defense', kinds: ['dreb', 'stl', 'blk', 'foul'] },
  { key: 'shooting', label: 'Shooting', kinds: ['fg2m', 'fg2x', 'fg3m', 'fg3x', 'ftm', 'ftx'] },
  { key: 'rebounds', label: 'Rebounds', kinds: ['oreb', 'dreb'] },
  { key: 'possession', label: 'Possession', kinds: ['tov', 'stl'] },
];
const DEFAULT_KINDS = META.find((m) => m.key === 'shooting').kinds;

// Rows of the time-between table that combine several stats, drawn above the first one they cover.
const AGGREGATES = [
  { label: 'FG attempts', kinds: ['fg2m', 'fg2x', 'fg3m', 'fg3x'], before: 'fg2m' },
  { label: '2PT attempts', kinds: ['fg2m', 'fg2x'], before: 'fg2m' },
  { label: '3PT attempts', kinds: ['fg3m', 'fg3x'], before: 'fg3m' },
  { label: 'FT attempts', kinds: ['ftm', 'ftx'], before: 'ftm' },
];

const teamName = (n) => (n.length <= 4 ? n.toUpperCase() : n);
const xOf = (d) => d.t;
const byuOf = (d) => d.byu;
const oppOf = (d) => d.opp;

function Avatar({ name }) {
  const [failed, setFailed] = useState(false);
  const src = playerPhotoUrl(name);
  if (!src || failed) return <span className="etl-avatar etl-avatar--initials" aria-hidden="true">{initialsOf(name)}</span>;
  return <img className="etl-avatar" src={src} alt="" onError={() => setFailed(true)} />;
}

function EventTip({ e, teams, lineup }) {
  const kind = KIND_BY_KEY[e.kind];
  const margin = e.byu - e.opp;
  const lead = margin === 0 ? 'Tied' : `${margin > 0 ? teams.byu : teams.opp} +${Math.abs(margin)}`;
  return (
    <div className="etl-tip">
      {e.player ? <Avatar name={e.player} /> : null}
      <div>
        <div className="etl-tip__what">
          <ShapeIcon name={kind.shape} filled={kind.filled} color={kind.color} size={13} />
          <strong>{kind.label}</strong>{e.detail ? <span> · {e.detail}</span> : null}
        </div>
        <div>{e.player ?? `${teams[e.side]} (team)`}{e.player ? <span className="etl-tip__muted"> · {teams[e.side]}</span> : null}</div>
        <div className="etl-tip__muted">{periodLabel(e.per)} · {formatClock(e.clock)} left</div>
        <div>{teams.byu} {e.byu} – {e.opp} {teams.opp} <span className="etl-tip__muted">· {lead}</span></div>
        {lineup ? <div className="etl-tip__muted">On floor: {lineup.map(shortName).join(', ')}</div> : null}
      </div>
    </div>
  );
}

// Markers, positioned with the chart's scales. Game flow: on the score line the event belongs to (the opponent's for defensive
// stats), fanned into lanes where they crowd. Stacked: on the stat's own row.
function EventLayer({ items, line, mode, rowIndex, teams, model }) {
  const chart = useChart();
  const points = useMemo(() => {
    if (mode === 'stack') return items.map((e) => ({ key: e.id, e, x: chart.x(e.t), y: chart.y(rowIndex[e.kind] + 0.5) }));
    const base = items.map((e) => {
      const side = lineSideOf(e);
      return { key: e.id, e, side, x: chart.x(e.t), y: chart.y(pointAt(line, e.t)[side]) };
    });
    const lanes = assignLanes(base.map((b) => ({ x: b.x, group: b.side })), LANE_STEP);
    return base.map((b, i) => ({ ...b, y: Math.min(chart.innerHeight - 4, Math.max(4, b.y + lanes[i] * LANE_STEP)) }));
  }, [items, line, mode, rowIndex, chart.x, chart.y, chart.innerHeight]);

  const render = ({ e }, { active }) => {
    const k = KIND_BY_KEY[e.kind];
    return (
      <>
        {active ? <circle r={11} fill={k.color} opacity="0.18" /> : null}
        <ShapeMark name={k.shape} size={active ? 14 : 10} filled={k.filled} color={k.color} />
      </>
    );
  };
  return <PointPicker points={points} render={render} tooltip={({ e }) => <EventTip e={e} teams={teams} lineup={model ? model.lineupAtSeq(e.side, e.seq) : null} />} label="Game events" />;
}

// "1st half" / "2nd half" / "OT1" under the time-left ticks, and a divider where each period after the first begins.
function PeriodMarks({ periods }) {
  const chart = useChart();
  return (
    <>
      {periods.filter((p) => p.start > 0).map((p) => <ReferenceLine key={p.per} x={p.start} className="etl-divider" />)}
      {periods.map((p) => (
        <text key={p.per} className="etl-period" x={chart.x(p.start + p.len / 2)} y={chart.innerHeight + 38} textAnchor="middle">{periodLabel(p.per)}</text>
      ))}
    </>
  );
}

function RowLabels({ rows }) {
  const chart = useChart();
  return (
    <g>
      {rows.map((k, i) => {
        const y = chart.y(i + 0.5);
        return (
          <g key={k.key}>
            <line className="etl-rowline" x1={0} x2={chart.innerWidth} y1={y} y2={y} />
            <g transform={`translate(${-chart.margin.left + 12},${y})`}><ShapeMark name={k.shape} size={10} filled={k.filled} color={k.color} /></g>
            <text className="etl-rowlabel" x={-chart.margin.left + 24} y={y} dy="0.32em">{k.label}</text>
          </g>
        );
      })}
    </g>
  );
}

export function EventChart({ events, total, mode, side, teams, rows, model }) {
  const items = useMemo(() => events, [events]);
  // The score at every logged event (both teams, so markers sit exactly on the line), one point per instant, joined smoothly.
  const line = useMemo(() => {
    const l = [{ t: 0, byu: 0, opp: 0 }];
    for (const e of events.raw) {
      const p = { t: e.t, byu: e.byu, opp: e.opp };
      if (l[l.length - 1].t === p.t) l[l.length - 1] = p; else l.push(p);
    }
    return [...l, { ...l[l.length - 1], t: total }];
  }, [events.raw, total]);
  const { ticks, periods } = useMemo(() => axisLayout(total), [total]);
  const labelAt = useMemo(() => Object.fromEntries(ticks.map((k) => [k.t, k.label])), [ticks]);
  const rowIndex = useMemo(() => Object.fromEntries(rows.map((k, i) => [k.key, i])), [rows]);

  const top = Math.max(...line.map((p) => Math.max(p.byu, p.opp)));
  const yMax = Math.max(20, Math.ceil(top / 10) * 10);
  const flow = mode === 'flow';
  const margin = flow ? FLOW_MARGIN : STACK_MARGIN;
  return (
    <Chart
      height={flow ? 340 : rows.length * ROW_H + margin.top + margin.bottom}
      margin={margin}
      x={{ domain: [0, total] }}
      y={flow ? { domain: [0, yMax] } : { domain: [rows.length, 0] }}
      label={flow ? 'Scores over the game with each stat marked where it happened' : 'Each stat on its own row across the game'}
    >
      {flow ? <Axis orient="left" tickCount={5} grid /> : <RowLabels rows={rows} />}
      <Axis orient="bottom" tickValues={ticks.map((k) => k.t)} tickFormat={(t) => labelAt[t]} />
      <PeriodMarks periods={periods} />
      {flow ? (
        <>
          <Line data={line} x={xOf} y={byuOf} curve={curveMonotoneX} style={{ fill: 'none', stroke: BYU_COLOR, strokeWidth: 2, opacity: LINE_OPACITY }} />
          <Line data={line} x={xOf} y={oppOf} curve={curveMonotoneX} style={{ fill: 'none', stroke: OPP_COLOR, strokeWidth: 2, strokeDasharray: '5 4', opacity: LINE_OPACITY }} />
        </>
      ) : null}
      <EventLayer items={items} line={line} mode={mode} rowIndex={rowIndex} teams={teams} model={model} />
    </Chart>
  );
}

export function EventTimelinePanel({ data }) {
  const teams = useMemo(() => ({ byu: teamName(data.header.teams.byu), opp: teamName(data.header.teams.opp) }), [data.header.teams]);
  const [side, setSide] = useState('byu');
  const [mode, setMode] = useState('flow'); // flow | stack
  const [selected, setSelected] = useState(DEFAULT_KINDS); // stat keys plotted: none until picked, shooting to start
  const [picked, setPicked] = useState([]); // player filter, as "LAST,FIRST"
  const { model } = useLineupModel(data);

  const all = useMemo(() => timelineEvents(data.events), [data.events]);
  const total = useMemo(() => gameMinutes(data.plays), [data.plays]);
  const now = useMemo(() => all.reduce((m, e) => Math.max(m, e.t), 0), [all]); // the latest the log reaches: the end of the game, or where a live game stands
  const mine = useMemo(() => all.filter((e) => e.side === side), [all, side]);

  const players = useMemo(() => {
    const counts = new Map();
    mine.forEach((e) => e.player && counts.set(e.player, (counts.get(e.player) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => toCheckname(name));
  }, [mine]);
  const shown = useMemo(() => mine.filter((e) => selected.includes(e.kind) && (!picked.length || (e.player && picked.includes(toCheckname(e.player))))), [mine, selected, picked]);
  const rows = useMemo(() => KINDS.filter((k) => selected.includes(k.key)), [selected]);
  const chartEvents = useMemo(() => Object.assign([...shown], { raw: all }), [shown, all]);

  if (!data.events?.length) {
    return <Section title="Event timeline"><p>This game's box file has no event log. Regenerate it with <code>node derivations/game-box-prototype.js {data.header.gameId}</code>.</p></Section>;
  }

  const toggleKind = (k) => setSelected((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const metaOn = (m) => m.kinds.every((k) => selected.includes(k));
  const toggleMeta = (m) => setSelected((cur) => (metaOn(m) ? cur.filter((k) => !m.kinds.includes(k)) : [...new Set([...cur, ...m.kinds])]));
  const togglePlayer = (p) => setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const pickSide = (s) => { setSide(s); setPicked([]); };

  const gapRow = (label, icon, kinds) => {
    const g = gapStats(shown.filter((e) => kinds.includes(e.kind)).map((e) => e.t), now);
    return [{ v: <span className="etl-stat">{icon ?? <span className="etl-stat__gap" />}{label}</span> }, g.n, formatGap(g.since), formatGap(g.avg), formatGap(g.longest), formatGap(g.shortest)];
  };
  // an aggregate row sits above the first stat it covers, and only when every stat it covers is plotted, so its label is true
  const gapRows = rows.flatMap((k) => [
    ...AGGREGATES.filter((a) => a.before === k.key && a.kinds.every((x) => selected.includes(x))).map((a) => gapRow(a.label, null, a.kinds)),
    gapRow(k.label, <ShapeIcon name={k.shape} filled={k.filled} color={k.color} size={13} />, [k.key]),
  ]);

  return (
    <div className="plays">
      <Section title="Event timeline">
        <div className="plays-group__row">
          <span className="plays-group__label">Team</span>
          {['byu', 'opp'].map((s) => <button key={s} type="button" className={`plays-chip${side === s ? ' plays-chip--on' : ''}`} onClick={() => pickSide(s)}>{teams[s]}</button>)}
          <span className="plays-group__label etl-gap">View</span>
          {[['flow', 'Game flow'], ['stack', 'Stacked']].map(([k, label]) => <button key={k} type="button" className={`plays-chip${mode === k ? ' plays-chip--on' : ''}`} onClick={() => setMode(k)}>{label}</button>)}
        </div>

        <div className="mt-l">
          <PlayerFilters players={players} filterPlayers={picked} onChange={togglePlayer} max={players.length} />
        </div>

        <div className="mt-l">
          <div className="plays-group__row etl-meta">
            <span className="plays-group__label">Group</span>
            {META.map((m) => <button key={m.key} type="button" className={`plays-chip${metaOn(m) ? ' plays-chip--on' : ''}`} aria-pressed={metaOn(m)} onClick={() => toggleMeta(m)}>{m.label}</button>)}
          </div>
          <div className="etl-legend" role="group" aria-label="Stats shown">
            {KINDS.map((k) => (
              <button key={k.key} type="button" className={`plays-chip plays-chip--small etl-chip${selected.includes(k.key) ? '' : ' etl-chip--off'}`} aria-pressed={selected.includes(k.key)} onClick={() => toggleKind(k.key)}>
                <ShapeIcon name={k.shape} filled={k.filled} color={k.color} size={12} className="etl-chipicon" />{k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-l">
          {mode === 'flow' ? (
            <div className="etl-keys">
              <span><i className="etl-key etl-key--solid" />{teams.byu} score</span>
              <span><i className="etl-key etl-key--dash" />{teams.opp} score</span>
              <span className="etl-keys__note">{teams[side]}'s steals, blocks and defensive rebounds sit on the {teams[side === 'byu' ? 'opp' : 'byu']} line.</span>
            </div>
          ) : null}

          {rows.length ? <EventChart events={chartEvents} total={total} mode={mode} side={side} teams={teams} rows={rows} model={model} /> : <p className="box-foot">Pick a group or a stat to plot.</p>}
        </div>
      </Section>

      <Section title="Time between events">
        <BoxTable
          head={[{ label: 'Stat', className: 'box-table__label' }, { label: 'Count' }, { label: 'Since last', title: 'Time from the latest one to the latest play in the log' }, { label: 'Average gap' }, { label: 'Longest gap' }, { label: 'Shortest gap' }]}
          rows={gapRows}
        />
      </Section>
    </div>
  );
}
