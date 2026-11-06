import { useMemo, useRef, useState } from 'react';
import { Section } from './BoxParts';
import GameFlow from './BoxFlow';
import { SpecEditor } from './BoxLineupCompare';
import { GroupEditor } from './BoxStintCompare';
import useLineupModel from './useLineupModel';
import { useLocatedShots, ftLine, ShotChartsSection, MADE, MISS } from './BoxShotCharts';
import { bucketOf, emptyGroup, mediaTimeouts, teamTimeouts, tagRebounds } from '../../utils/playGroups';
import { lineupMatches, playerFloorTime } from '../../utils/lineupTimeline';
import { inWindow } from '../../utils/boxStats';

const SLOT = ['#002e5d', '#d9730d', '#2e9e4f', '#7b3fb5', '#0f8aa8', '#8a6d1d']; // game-flow selection colors, by slice
const EMPTY_SPEC = () => ({ name: '', on: [], off: [], anyOf: [], atLeast: 1 });

// The Shot chart compare tab: any number of shot charts, each defined like a Lineup compare lineup or a Stint Compare stint, shown one
// after another or stacked on one court, each with make and miss colors of its own.
export function ShotComparePanel({ data, shotPlays }) {
  const teams = data.header.teams;
  const plays = useMemo(() => tagRebounds(data.plays), [data.plays]);
  const periods = useMemo(() => [...new Set(data.plays.map((p) => p.per))].sort((a, b) => a - b), [data.plays]);
  const lineupModel = useLineupModel(data);
  const { model, luOf } = lineupModel;
  const located = useLocatedShots(shotPlays, data);
  const timeouts = useMemo(() => mediaTimeouts(data.events), [data.events]);
  const teamTos = useMemo(() => teamTimeouts(data.events), [data.events]);

  const nextId = useRef(0);
  const make = (kind, n) => ({ id: nextId.current++, made: MADE, miss: MISS, slot: SLOT[n % SLOT.length], ...(kind === 'lineup' ? { spec: EMPTY_SPEC() } : { group: emptyGroup('byu') }) });
  const [by, setBy] = useState('lineup'); // lineup | stint
  const [side, setSide] = useState('byu'); // the team the lineups belong to
  const [lineupSlices, setLineupSlices] = useState(() => [make('lineup', 0), make('lineup', 1)]);
  const [stintSlices, setStintSlices] = useState(() => [make('stint', 0), make('stint', 1)]);
  const [slot, setSlot] = useState(0); // which stint the game-flow graph selects for
  const [snap, setSnap] = useState(true);

  const stints = useMemo(() => lineupModel.stintsFor(side), [lineupModel, side]);
  const roster = useMemo(() => playerFloorTime(stints).map((p) => p.name), [stints]);
  const lineups = useMemo(() => {
    const byKey = new Map();
    for (const p of plays) {
      if (!p.lu || !p.lu[side].length) continue;
      const names = luOf ? luOf(p, side) : p.lu[side];
      const k = names.join('|');
      if (!byKey.has(k)) byKey.set(k, { key: k, names, poss: new Set() });
      if (p.offense === side) byKey.get(k).poss.add(p.poss);
    }
    return [...byKey.values()].map((l) => ({ ...l, poss: l.poss.size })).sort((x, y) => y.poss - x.poss);
  }, [plays, side, luOf]);

  const isLineup = by === 'lineup';
  const slices = isLineup ? lineupSlices : stintSlices;
  const setSlices = isLineup ? setLineupSlices : setStintSlices;
  const nameOf = (s, i) => ((isLineup ? s.spec.name : s.group.name).trim() || `${isLineup ? 'Lineup' : 'Stint'} ${i + 1}`);
  const patch = (id, change) => setSlices((list) => list.map((s) => (s.id === id ? { ...s, ...change } : s)));
  const remove = (id) => setSlices((list) => list.filter((s) => s.id !== id));
  const add = () => setSlices((list) => [...list, make(by, list.length)]);
  const switchSide = (s) => { setSide(s); setLineupSlices((list) => list.map((x) => ({ ...x, spec: EMPTY_SPEC() }))); };

  const charts = useMemo(() => {
    if (!located) return null;
    return slices.map((s, i) => {
      const sideOf = isLineup ? side : s.group.side;
      const pick = isLineup ? (e, k) => lineupMatches(model.lineupAtSeq(side, k), s.spec)
        : (e, k, play) => inWindow(e, s.group) && (!s.group.buckets.length || (!!play && s.group.buckets.includes(bucketOf(play))));
      return { id: s.id, name: `${nameOf(s, i)} · ${teams[sideOf]}`, rawName: nameOf(s, i), made: s.made, miss: s.miss, side: sideOf, shots: located.shots.filter((x) => x.event.side === sideOf && pick(x.event, x.i, x.play)).map((x) => x.shot), ft: ftLine(located.fts.filter((x) => x.event.side === sideOf && pick(x.event, x.i, x.play))) };
    });
  }, [located, slices, isLineup, side, model]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLineup && !model) {
    return <Section title="Shot chart compare"><p>Lineups need this game's event log. Regenerate the box file with <code>node derivations/game-box-prototype.js {data.header.gameId}</code>, or compare by stint.</p></Section>;
  }
  const onFlowSelect = (i, r) => patch(stintSlices[i].id, { group: { ...stintSlices[i].group, fromMin: r ? r.from : null, toMin: r ? r.to : null } });
  const sub = ['Free throws have no location, so they are counted in each summary but not drawn on the charts.', located && located.unmatched ? `${located.unmatched} shot${located.unmatched === 1 ? '' : 's'} could not be matched to this box file and ${located.unmatched === 1 ? 'is' : 'are'} left out.` : null].filter(Boolean).join(' ');

  return (
    <div className="plays">
      <Section>
        <div className="plays-group__row">
          <span className="plays-group__label">Select by</span>
          {[['lineup', 'Lineup'], ['stint', 'Stint']].map(([k, label]) => <button key={k} type="button" className={`plays-chip${by === k ? ' plays-chip--on' : ''}`} onClick={() => setBy(k)}>{label}</button>)}
          {isLineup ? (
            <>
              <span className="plays-group__label">Team</span>
              {['byu', 'opp'].map((s) => <button key={s} type="button" className={`plays-chip${side === s ? ' plays-chip--on' : ''}`} onClick={() => switchSide(s)}>{teams[s]}</button>)}
            </>
          ) : null}
        </div>
      </Section>

      {!isLineup ? (
        <Section title="Game flow">
          <div className="plays-group__row">
            <span className="plays-group__label">Select</span>
            {stintSlices.map((s, i) => (
              <button key={s.id} type="button" className={`plays-chip${slot === i ? ' plays-chip--on' : ''}`} style={slot === i ? { background: s.slot, borderColor: s.slot } : { color: s.slot, borderColor: s.slot }} onClick={() => setSlot(i)}>{nameOf(s, i)}</button>
            ))}
            {timeouts.length || teamTos.length ? <button type="button" className={`plays-chip plays-chip--small${snap ? ' plays-chip--on' : ''}`} aria-pressed={snap} title="Selections land on the nearest timeout (media or team) when they end within 45 seconds of it" onClick={() => setSnap((v) => !v)}>Snap to timeouts</button> : null}
          </div>
          <GameFlow plays={data.plays} events={data.events} teams={teams} active={Math.min(slot, stintSlices.length - 1)} names={stintSlices.map(nameOf)} onSelect={onFlowSelect}
            timeouts={timeouts} teamTimeouts={teamTos} snap={snap} colors={stintSlices.map((s) => s.slot)}
            ranges={stintSlices.map((s) => (s.group.fromMin !== null || s.group.toMin !== null ? { from: s.group.fromMin ?? 0, to: s.group.toMin ?? 99 } : null))} />
        </Section>
      ) : null}

      <Section title={isLineup ? 'Lineups' : 'Stints'}>
        <div className="plays-groups">
          {slices.map((s, i) => (
            <div key={s.id} className="shotcmp-slice">
              {i > 0 ? (
                <button type="button" className="shotcmp-trash" title="Delete this chart" aria-label={`Delete ${nameOf(s, i)}`} onClick={() => remove(s.id)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" /></svg>
                </button>
              ) : null}
              {isLineup
                ? <SpecEditor title={`Lineup ${i + 1}`} spec={s.spec} onChange={(spec) => patch(s.id, { spec })} roster={roster} lineups={lineups} />
                : <GroupEditor title={`Stint ${i + 1}`} group={s.group} onChange={(group) => patch(s.id, { group })} teams={teams} periods={periods} />}
            </div>
          ))}
        </div>
        <div className="plays-group__row"><button type="button" className="plays-chip" onClick={add}>+ Add {isLineup ? 'a lineup' : 'a stint'}</button></div>
      </Section>

      <ShotChartsSection charts={charts || []} loading={!located} empty={!!located && !located.shots.length} sub={sub} teams={teams} onColor={patch} />
    </div>
  );
}
