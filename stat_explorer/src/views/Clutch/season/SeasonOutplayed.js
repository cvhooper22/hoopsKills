import { formatClutchTime } from '../../../utils/clutchUtils';

const pct = (n) => (n === null ? '–' : `${(n * 100).toFixed(1)}%`);
const signed = (n, digits = 0) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;
const count = (n) => String(n);
const ppp = (n) => (n === null ? '–' : n.toFixed(2));

// Each side's number for a matchup row. `better` says which direction wins; ties go to neither.
const TOTALS = [
  { label: 'Points', get: (t) => t.pts, fmt: count, better: 'high' },
  { label: 'Points / poss', get: (t, r) => r.ppp, fmt: ppp, better: 'high', title: 'Points per estimated possession' },
  { label: 'Possessions (est.)', get: (t, r) => r.poss, fmt: (n) => n.toFixed(1), better: null },
  { label: 'FT attempts', get: (t) => t.fta, fmt: count, better: 'high' },
  { label: 'Rebounds', get: (t) => t.reb, fmt: count, better: 'high' },
  { label: 'Assists', get: (t) => t.ast, fmt: count, better: 'high' },
  { label: 'Turnovers', get: (t) => t.tov, fmt: count, better: 'low' },
  { label: 'Steals + blocks', get: (t) => t.stl + t.blk, fmt: count, better: 'high' },
];

const SHOOTING = [
  { label: 'FG%', get: (t, r) => r.fgPct, fmt: pct, better: 'high', made: (t) => [t.fgm, t.fga] },
  { label: '2P%', get: (t, r) => r.twoPct, fmt: pct, better: 'high', made: (t) => [t.fgm - t.tpm, t.fga - t.tpa] },
  { label: '3P%', get: (t, r) => r.tpPct, fmt: pct, better: 'high', made: (t) => [t.tpm, t.tpa] },
  { label: 'FT%', get: (t, r) => r.ftPct, fmt: pct, better: 'high', made: (t) => [t.ftm, t.fta] },
  { label: 'eFG%', get: (t, r) => r.efg, fmt: pct, better: 'high', title: 'Effective field goal %: counts a three as 1.5 makes' },
  { label: 'TS%', get: (t, r) => r.tsPct, fmt: pct, better: 'high', title: 'True shooting %: points per shooting attempt, free throws included' },
];

function winner(row, a, b) {
  if (!row.better || a === null || b === null || a === b) return null;
  return (a > b) === (row.better === 'high') ? 'us' : 'them';
}

// Width of BYU's half of the bar. Lower-is-better stats flip so a longer bar always means "better".
function share(row, a, b) {
  const x = row.better === 'high' ? a : b;
  const y = row.better === 'high' ? b : a;
  if (a === null || b === null || x + y === 0) return 50;
  return (x / (x + y)) * 100;
}

// One side-by-side card. `verdict` adds the "ahead in X of N" line; categories with no better side
// (possessions) are shown but not counted.
function Matchups({ title, defs, totals, derived, verdict, note }) {
  const rows = defs.map((m) => {
    const a = m.get(totals.for, derived.forRates);
    const b = m.get(totals.against, derived.againstRates);
    return { ...m, a, b, win: winner(m, a, b) };
  });
  const counted = rows.filter((r) => r.better);
  const wins = counted.filter((r) => r.win === 'us').length;
  const losses = counted.filter((r) => r.win === 'them').length;
  return (
    <div className="outplayed__card">
      <h3 className="outplayed__title">{title}</h3>
      {verdict ? (
        <p className="outplayed__verdict">
          BYU is ahead in <b>{wins}</b> of {counted.length} categories{losses ? `, behind in ${losses}` : ''}.
        </p>
      ) : <p className="outplayed__note">{note}</p>}
      <ul className="outplayed__list">
        {rows.map((r) => (
          <li key={r.label} className="outplayed__row" title={r.title}>
            <span className={`outplayed__val${r.win === 'us' ? ' outplayed__val--win' : ''}`}>
              {r.fmt(r.a)}{r.made && <small className="outplayed__made">{r.made(totals.for).join('-')}</small>}
            </span>
            <span className="outplayed__mid">
              <span className="outplayed__label">{r.label}</span>
              <span className="outplayed__bar" aria-hidden="true">
                <span className={`outplayed__fill${r.win === 'them' ? ' outplayed__fill--behind' : ''}`} style={{ width: `${share(r, r.a, r.b)}%` }} />
              </span>
            </span>
            <span className={`outplayed__val outplayed__val--them${r.win === 'them' ? ' outplayed__val--win' : ''}`}>
              {r.fmt(r.b)}{r.made && <small className="outplayed__made">{r.made(totals.against).join('-')}</small>}
            </span>
          </li>
        ))}
      </ul>
      <p className="outplayed__legend"><span>BYU</span><span>Opponents</span></p>
    </div>
  );
}

const SPLITS = [
  {
    title: 'How the stretch started',
    note: 'Points each side scored in stretches that began with BYU leading, tied or trailing',
    rows: (d) => [['Leading', d.entries.leading], ['Tied', d.entries.tied], ['Trailing', d.entries.trailing]],
    gamesTitle: 'Games with a stretch that began this way',
  },
  {
    title: 'Regulation or overtime',
    note: 'Points each side scored in clutch time, split by where it fell on the clock',
    rows: (d) => [['2nd half', d.periods['2']], ['Overtime', d.periods.OT]],
    gamesTitle: 'Games with clutch time in this period',
    hideStretches: true,
  },
];

function SplitTable({ split, derived }) {
  const rows = split.rows(derived).filter(([, t]) => t.games > 0);
  return (
    <div className="outplayed__card">
      <h3 className="outplayed__title">{split.title}</h3>
      <p className="outplayed__note">{split.note}</p>
      <div className="outplayed__scroll">
        <table className="outplayed__table">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col" title={split.gamesTitle}>Games</th>
              {!split.hideStretches && <th scope="col" title="Clutch stretches">Str</th>}
              <th scope="col" title="Clutch time">Min</th>
              <th scope="col" title="Points BYU scored">BYU pts</th>
              <th scope="col" title="Points opponents scored">Opp pts</th>
              <th scope="col" title="BYU points minus opponent points">Net</th>
              <th scope="col" title="Net points per game that had this kind of clutch">Net / G</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, t]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{t.games}</td>
                {!split.hideStretches && <td>{t.stretches}</td>}
                <td>{formatClutchTime(t.seconds)}</td>
                <td>{t.ptsFor}</td>
                <td>{t.ptsAgainst}</td>
                <td className={`outplayed__net outplayed__net--${t.net > 0 ? 'pos' : t.net < 0 ? 'neg' : 'flat'}`}>{signed(t.net)}</td>
                <td>{t.perGame.net === null ? '–' : signed(t.perGame.net, 1)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="outplayed__empty">No clutch time</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// "Are we getting outplayed in the clutch?" BYU against its opponents, from team totals only
// (the season file keeps player lines for BYU alone), then the same question by how and when the
// clutch stretches happened.
export default function SeasonOutplayed({ folded }) {
  const { totals, derived } = folded;
  return (
    <section className="clutch-section">
      <h2 className="clutch-section__title">Outplaying them?</h2>
      <p className="clutch-section__sub">BYU against its opponents in clutch time</p>
      <div className="outplayed">
        <Matchups title="Team totals" defs={TOTALS} totals={totals} derived={derived} verdict />
        <Matchups title="Shooting" defs={SHOOTING} totals={totals} derived={derived} note="Percentages with makes-attempts underneath" />
        {SPLITS.map((s) => <SplitTable key={s.title} split={s} derived={derived} />)}
      </div>
    </section>
  );
}
