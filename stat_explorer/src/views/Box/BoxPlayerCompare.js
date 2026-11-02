import { useState } from 'react';
import { Section, BoxTable } from './BoxParts';
import { shortName } from '../../utils/playGroups';
import { dash, mmss } from './boxFormat';
import { emptyLine, finishLine } from '../../utils/boxStats';

// Each player's box-score line while a lineup or stint was on the floor. Slices are the ones BoxStatsCompare takes, with
// `players: { team: Map, opp: Map }` from utils/boxStats. Side by side, every stat gets one column per slice (the second dimmed).

// each reads a player's line plus { min, poss } (minutes on the floor, possessions played)
// the third entry marks a column that starts a new block, drawn with a hard line on its left
const COLS = [
  ['Min', (l, x) => mmss(x.min)], ['Poss', (l, x) => x.poss],
  ['Pts', (l) => l.pts, true], ['Fg', (l) => `${l.fgm}-${l.fga}`], ['3pt', (l) => `${l.tpm}-${l.tpa}`], ['Ft', (l) => `${l.ftm}-${l.fta}`],
  ['Reb', (l) => l.reb, true], ['Oreb', (l) => l.oreb], ['Ast', (l) => l.ast], ['To', (l) => l.tov],
  ['Stl', (l) => l.stl, true], ['Blk', (l) => l.blk], ['Pf', (l) => l.pf],
];
const SEP = 'player-sep';
const withSep = (cell, c, on = true) => (COLS[c][2] && on ? { ...cell, className: [cell.className, SEP].filter(Boolean).join(' ') } : cell);

function Toggle({ label, options, value, onChange }) {
  return (
    <div className="plays-group__row">
      <span className="plays-group__label">{label}</span>
      {options.map(([k, text]) => <button key={k} type="button" className={`plays-chip${value === k ? ' plays-chip--on' : ''}`} onClick={() => onChange(k)}>{text}</button>)}
    </div>
  );
}

// players who played or recorded a stat in any slice, most points (then rebounds, then minutes) first
function playerNames(slices, who) {
  const names = new Set();
  slices.forEach((s) => { s.players[who].forEach((_, n) => names.add(n)); s.playerMins[who].forEach((m, n) => m > 0 && names.add(n)); });
  const score = (n) => slices.reduce((t, s) => { const l = s.players[who].get(n); return t + (l ? l.pts * 1000 + l.reb * 10 : 0) + (s.playerMins[who].get(n) || 0) / 100; }, 0);
  return [...names].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
}

const ZERO = finishLine(emptyLine());

export default function BoxPlayerCompare({ slices, teams, side }) {
  const [view, setView] = useState('side');
  const [flip, setFlip] = useState(false);
  const [who, setWho] = useState('team');
  const other = side === 'byu' ? 'opp' : 'byu';
  const both = slices.filter(Boolean);
  const ordered = flip && both.length > 1 ? [both[1], both[0]] : both;
  const names = playerNames(both, who);
  // a player has a cell in a slice when they played in it or recorded something; the Total row sums the floor time of all five
  const cell = (s, n) => {
    if (n === null) return { l: s[who], x: { min: [...s.playerMins[who].values()].reduce((t, m) => t + m, 0) / 5, poss: s.poss.team + s.poss.opp } };
    const min = s.playerMins[who].get(n) || 0, l = s.players[who].get(n);
    return l || min > 0 ? { l: l || ZERO, x: { min, poss: s.playerPoss[who].get(n) || 0 } } : null;
  };
  const cols = (s, i) => (n) => COLS.map(([, fn]) => {
    const c = cell(s, n);
    return { v: c ? fn(c.l, c.x) : dash, className: i ? 'stat-pair__dim' : undefined };
  });
  const rowsFor = (list, mk) => [...names.map((n) => [shortName(n), ...list.flatMap(mk(n))]), [{ v: 'Total', strong: true }, ...list.flatMap(mk(null)).map((c) => ({ ...c, strong: true }))]];

  const sideBySide = (
    <BoxTable
      groups={[{ label: '', span: 1 }, ...COLS.map(([label, , sep]) => ({ label, span: ordered.length, className: sep ? SEP : undefined }))]}
      head={[{ label: 'Player' }, ...COLS.flatMap(([, , sep]) => ordered.map((s, i) => ({ label: s === both[0] ? 'A' : 'B', className: sep && !i ? SEP : undefined })))]}
      rows={[...names.map((n) => [shortName(n), ...COLS.flatMap((_, c) => ordered.map((s, i) => withSep(cols(s, i)(n)[c], c, !i)))]), [{ v: 'Total', strong: true }, ...COLS.flatMap((_, c) => ordered.map((s, i) => withSep({ ...cols(s, i)(null)[c], strong: true }, c, !i)))]]}
    />
  );
  const tables = ordered.map((s) => (
    <div key={s.name}>
      <h3 className="plays-group__title">{both.length > 1 ? `${s === both[0] ? 'A' : 'B'}: ` : ''}{s.name}</h3>
      <BoxTable head={[{ label: 'Player' }, ...COLS.map(([label, , sep]) => ({ label, className: sep ? SEP : undefined }))]} rows={rowsFor([s], (n) => (x) => cols(x, 0)(n).map((cell, c) => withSep(cell, c)))} />
    </div>
  ));

  return (
    <Section title="Player box score" sub={`Each ${who === 'team' ? teams[side] : teams[other]} player's line while it was on the floor`}>
      <div className="plays-groups">
        <Toggle label="Team" options={[['team', teams[side]], ['opp', teams[other]]]} value={who} onChange={setWho} />
        {both.length > 1 ? <Toggle label="Layout" options={[['side', 'Side by side'], ['two', 'Two tables']]} value={view} onChange={setView} /> : null}
      </div>
      {both.length > 1 ? (
        <div className="plays-group__row">
          <span className="plays-group__label">Order</span>
          <button type="button" className={`plays-chip${flip ? ' plays-chip--on' : ''}`} aria-pressed={flip} onClick={() => setFlip((v) => !v)}>Flip order</button>
        </div>
      ) : null}
      {both.length > 1 ? (
        <div className="stat-key" aria-label="Key">
          <span className="stat-key__title">Key</span>
          {ordered.map((s, i) => <span key={s.name} className={i ? 'stat-pair__dim' : undefined}><strong>{s === both[0] ? 'A' : 'B'}</strong> = {s.name}</span>)}
        </div>
      ) : null}
      {names.length ? (both.length > 1 && view === 'two' ? tables : sideBySide) : <p className="box-foot">No one on this side recorded a stat.</p>}
    </Section>
  );
}
