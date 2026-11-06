import { useMemo, useState } from 'react';
import { Section, BoxTable } from './BoxParts';
import { pct, dash, periodLabel } from './boxFormat';
import { clockSec, formatClock } from '../../utils/playGroups';
import { KINDS, emptySearch, searchEvents, eventText, shotTotals, logPlayers } from '../../utils/playSearch';
import useLineupModel from './useLineupModel';
import { Select } from '../../components/Field/Field';

const LIMIT = 300;
const ratio = (m, a) => (a ? `${m}-${a} (${pct(m / a)})` : dash);

const Chip = ({ on, onClick, children }) => (
  <button type="button" className={`plays-chip${on ? ' plays-chip--on' : ''}`} onClick={onClick}>{children}</button>
);

// "Find plays": search the whole game's play log by team, player and type (any mix of field goals, assists, rebounds, ...).
export function FindPlays({ events, teams, floorAt }) {
  const [f, setF] = useState(emptySearch);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const players = useMemo(() => logPlayers(events), [events]);
  const found = useMemo(() => searchEvents(events, f, null, floorAt), [events, f, floorAt]);
  const totals = useMemo(() => shotTotals(found), [found]);
  const has = (k) => f.kinds.includes(k);
  const toggleKind = (k) => set({ kinds: has(k) ? f.kinds.filter((x) => x !== k) : [...f.kinds, k] });

  const onPlayer = (name) => {
    const side = players.byu.includes(name) ? 'byu' : players.opp.includes(name) ? 'opp' : 'both';
    set({ player: name, side: name ? side : f.side });
  };

  // Floor filter: pick players; "On floor" requires them all together, "Off floor" excludes them.
  const floorPick = (key, label) => (
    <div className="plays-group__row">
      <span className="plays-group__label">{label}</span>
      <Select size="sm" aria-label={label} value="" onChange={(e) => e.target.value && set({ [key]: [...f[key], e.target.value] })}>
        <option value="">Add player…</option>
        {['byu', 'opp'].map((s) => (
          <optgroup key={s} label={teams[s]}>{players[s].filter((n) => !f.on.includes(n) && !f.off.includes(n)).map((n) => <option key={n} value={n}>{n}</option>)}</optgroup>
        ))}
      </Select>
      {f[key].map((n) => <Chip key={n} on onClick={() => set({ [key]: f[key].filter((x) => x !== n) })}>{n} ×</Chip>)}
    </div>
  );

  const rows = found.slice(0, LIMIT).map((e) => [
    `${periodLabel(e.per)} ${formatClock(clockSec({ per: e.per, startRem: e.rem }))}`,
    e.side ? teams[e.side] : dash, e.player || dash, eventText(e),
    e.made && e.sc && e.sc[0] !== null ? `${teams.byu} ${e.sc[0]}–${e.sc[1]} ${teams.opp}` : dash,
  ]);

  return (
    <Section>
      <div className="plays-group">
        <div className="plays-group__row">
          <span className="plays-group__label">Team</span>
          {[['both', 'Both'], ['byu', teams.byu], ['opp', teams.opp]].map(([k, label]) => <Chip key={k} on={f.side === k} onClick={() => set({ side: k, player: '' })}>{label}</Chip>)}
        </div>
        <div className="plays-group__row">
          <span className="plays-group__label">Player</span>
          <Select size="sm" aria-label="Player" value={f.player} onChange={(e) => onPlayer(e.target.value)}>
            <option value="">Anyone</option>
            {['byu', 'opp'].filter((s) => f.side === 'both' || f.side === s).map((s) => (
              <optgroup key={s} label={teams[s]}>{players[s].map((n) => <option key={n} value={n}>{n}</option>)}</optgroup>
            ))}
          </Select>
        </div>
        <div className="plays-group__row">
          <span className="plays-group__label">Type</span>
          <Chip on={!f.kinds.length} onClick={() => set({ kinds: [] })}>Any</Chip>
          {KINDS.map(([k, label]) => <Chip key={k} on={has(k)} onClick={() => toggleKind(k)}>{label}</Chip>)}
        </div>
        {floorAt ? floorPick('on', 'On floor') : null}
        {floorAt ? floorPick('off', 'Off floor') : null}
        {has('fg') || has('ft') ? (
          <div className="plays-group__row">
            <span className="plays-group__label">Shot result</span>
            {[['all', 'Makes and misses'], ['made', 'Makes'], ['missed', 'Misses']].map(([k, label]) => <Chip key={k} on={f.result === k} onClick={() => set({ result: k })}>{label}</Chip>)}
          </div>
        ) : null}
        {has('fg') ? (
          <div className="plays-group__row">
            <span className="plays-group__label">Field goal</span>
            {[['all', 'All'], [2, '2-pointers'], [3, '3-pointers']].map(([k, label]) => <Chip key={k} on={f.points === k} onClick={() => set({ points: k })}>{label}</Chip>)}
          </div>
        ) : null}
        {has('reb') ? (
          <div className="plays-group__row">
            <span className="plays-group__label">Rebound</span>
            {[['all', 'All'], ['offensive', 'Offensive'], ['defensive', 'Defensive']].map(([k, label]) => <Chip key={k} on={f.reb === k} onClick={() => set({ reb: k })}>{label}</Chip>)}
          </div>
        ) : null}
      </div>
      <p className="box-foot">
        {found.length} {found.length === 1 ? 'play' : 'plays'}
      </p>
      <BoxTable head={[{ label: 'When (clock left)' }, { label: 'Team' }, { label: 'Player' }, { label: 'Play' }, { label: 'Score after' }]} rows={rows} stickyFirst={false} />
      {found.length > LIMIT ? <p className="box-foot">Showing the first {LIMIT} of {found.length}. Narrow the search to see the rest.</p> : null}
    </Section>
  );
}

// The Find plays tab. Needs the event log, which older box files don't have.
export function FindPlaysPanel({ data }) {
  const { model } = useLineupModel(data);
  const floorAt = useMemo(() => (model ? (seq) => ({ byu: model.lineupAtSeq('byu', seq), opp: model.lineupAtSeq('opp', seq) }) : null), [model]);
  if (!data.events) return <Section title="Find plays"><p>This game's box file predates play search. Regenerate it with <code>node derivations/game-box-prototype.js {data.header.gameId}</code>.</p></Section>;
  return <div className="plays"><FindPlays events={data.events} teams={data.header.teams} floorAt={floorAt} /></div>;
}
