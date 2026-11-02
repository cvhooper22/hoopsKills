import { useState } from 'react';
import { Section, BoxTable } from './BoxParts';
import { pct, f1, dash } from './boxFormat';

// Box-score lines for one or two slices of a game (lineups or stints), as two tables or one side-by-side table.
// A slice: { name, team, opp (finished lines from utils/boxStats), poss: { team, opp } }.

const madeAtt = (m, a, p, per, poss) => (a ? (per ? `${f1(poss ? (m / poss) * 100 : null)}-${f1(poss ? (a / poss) * 100 : null)} (${pct(p)})` : `${m}-${a} (${pct(p)})`) : dash);

const ROWS = [
  ['Points', 'pts'],
  ['FG', 'fg', 'fgm', 'fga', 'fgPct'],
  ['2PT', 'two', 'twoM', 'twoA', 'twoPct'],
  ['3PT', 'tp', 'tpm', 'tpa', 'tpPct'],
  ['FT', 'ft', 'ftm', 'fta', 'ftPct'],
  ['Rebounds', 'reb'],
  ['Offensive rebounds', 'oreb'],
  ['Defensive rebounds', 'dreb'],
  ['Assists', 'ast'],
  ['Steals', 'stl'],
  ['Blocks', 'blk'],
  ['Turnovers', 'tov'],
  ['Fouls', 'pf'],
];

// how one row reads for one team in one slice
function cell([, key, m, a, p], line, poss, per) {
  if (m) return madeAtt(line[m], line[a], line[p], per, poss);
  if (!per) return line[key];
  return poss ? f1((line[key] / poss) * 100) : dash;
}

function slot(slice, who, row, per) {
  return slice ? cell(row, slice[who], slice.poss[who], per) : null;
}

function Toggle({ label, options, value, onChange }) {
  return (
    <div className="plays-group__row">
      <span className="plays-group__label">{label}</span>
      {options.map(([k, text]) => <button key={k} type="button" className={`plays-chip${value === k ? ' plays-chip--on' : ''}`} onClick={() => onChange(k)}>{text}</button>)}
    </div>
  );
}

export default function BoxStatsCompare({ slices, teams, side, note }) {
  const [view, setView] = useState('side');
  const [per, setPer] = useState(false);
  const [flip, setFlip] = useState(false);
  const other = side === 'byu' ? 'opp' : 'byu';
  const both = slices.filter(Boolean);
  const [first, second] = flip && both.length > 1 ? [both[1], both[0]] : both;
  const whos = [['team', teams[side]], ['opp', teams[other]]];

  const pair = (row, who, fn) => (
    <>
      {fn(first, who, row)}
      {second ? <><span className="stat-pair__sep"> | </span><span className="stat-pair__dim">{fn(second, who, row)}</span></> : null}
    </>
  );
  const value = (s, who, row) => (row === 'poss' ? s.poss[who] : slot(s, who, row, per));

  const sideBySide = (
    <BoxTable
      head={[{ label: '' }, ...whos.map(([who, name]) => ({
        label: <>{name}{second ? <small className="stat-pair__head"><br />{first.name} | <span className="stat-pair__dim">{second.name}</span></small> : null}</>,
      }))]}
      rows={[
        [{ v: 'Possessions', strong: true }, ...whos.map(([who]) => ({ v: pair('poss', who, value), strong: true }))],
        ...ROWS.map((r) => [r[0], ...whos.map(([who]) => pair(r, who, value))]),
      ]}
    />
  );
  const tables = both.map((s) => (
    <div key={s.name}>
      <h3 className="plays-group__title">{s.name}</h3>
      <BoxTable
        head={[{ label: '' }, ...whos.map(([, name]) => ({ label: name }))]}
        rows={[[{ v: 'Possessions', strong: true }, ...whos.map(([who]) => ({ v: s.poss[who], strong: true }))], ...ROWS.map((r) => [r[0], ...whos.map(([who]) => slot(s, who, r, per))])]}
      />
    </div>
  ));
  const ordered = flip && both.length > 1 ? [...tables].reverse() : tables;

  return (
    <Section title="Box score" sub={`What happened while it was on the floor: ${teams[side]}'s line, then ${teams[other]}'s`}>
      <div className="plays-groups">
        {both.length > 1 ? <Toggle label="Layout" options={[['side', 'Side by side'], ['two', 'Two tables']]} value={view} onChange={setView} /> : null}
        <Toggle label="Show" options={[['totals', 'Totals'], ['per', 'Per 100 poss.']]} value={per ? 'per' : 'totals'} onChange={(k) => setPer(k === 'per')} />
      </div>
      {both.length > 1 ? (
        <div className="plays-group__row">
          <span className="plays-group__label">Order</span>
          <button type="button" className={`plays-chip${flip ? ' plays-chip--on' : ''}`} aria-pressed={flip} onClick={() => setFlip((v) => !v)}>Flip order</button>
        </div>
      ) : null}
      {both.length > 1 && view === 'two' ? ordered : sideBySide}
      {note ? <p className="box-foot">{note}</p> : null}
    </Section>
  );
}
