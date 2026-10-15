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
  { label: 'Rebounds', get: (t) => t.reb, fmt: count, better: 'high' },
  { label: 'Offensive rebounds', get: (t) => t.oreb, fmt: count, better: 'high' },
  { label: 'Assists', get: (t) => t.ast, fmt: count, better: 'high' },
  { label: 'Turnovers', get: (t) => t.tov, fmt: count, better: 'low' },
  { label: 'Steals + blocks', get: (t) => t.stl + t.blk, fmt: count, better: 'high' },
  { label: 'Fouls', get: (t) => t.pf, fmt: count, better: 'low', title: 'Personal fouls committed' },
];

const SHOOTING = [
  { label: 'FG%', get: (t, r) => r.fgPct, fmt: pct, better: 'high' },
  { label: '2PA', get: (t) => t.fga - t.tpa, fmt: count, better: 'high', title: 'Two-point attempts' },
  { label: '2P%', get: (t, r) => r.twoPct, fmt: pct, better: 'high' },
  { label: '3PA', get: (t) => t.tpa, fmt: count, better: 'high', title: 'Three-point attempts' },
  { label: '3P%', get: (t, r) => r.tpPct, fmt: pct, better: 'high' },
  { label: 'FTA', get: (t) => t.fta, fmt: count, better: 'high', title: 'Free throw attempts' },
  { label: 'FT%', get: (t, r) => r.ftPct, fmt: pct, better: 'high' },
  { label: 'eFG%', get: (t, r) => r.efg, fmt: pct, better: 'high', title: 'Effective field goal %: counts a three as 1.5 makes' },
  { label: 'TS%', get: (t, r) => r.tsPct, fmt: pct, better: 'high', title: 'True shooting %: points per shooting attempt, free throws included' },
];

function winner(row, a, b) {
  if (!row.better || a === null || b === null || a === b) return null;
  return (a > b) === (row.better === 'high') ? 'us' : 'them';
}

// Width of BYU's half of the bar. Lower-is-better stats flip so a longer bar always means "better";
// stats with no better side (attempts, possessions) are just BYU's share of the two.
function share(row, a, b) {
  const x = row.better === 'low' ? b : a;
  const y = row.better === 'low' ? a : b;
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
              {r.fmt(r.a)}
            </span>
            <span className="outplayed__mid">
              <span className="outplayed__label">{r.label}</span>
              <span className="outplayed__bar" aria-hidden="true">
                <span className={`outplayed__fill${r.win === 'them' ? ' outplayed__fill--behind' : ''}`} style={{ width: `${share(r, r.a, r.b)}%` }} />
              </span>
            </span>
            <span className={`outplayed__val outplayed__val--them${r.win === 'them' ? ' outplayed__val--win' : ''}`}>
              {r.fmt(r.b)}
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
    title: 'By time left',
    note: 'Points each side scored in clutch time, by how much time was left on the clock',
    // a season with no overtime clutch shows the all-clutch total in its place, so the card keeps three rows
    rows: (d) => [
      ['Last 5:00', d.periods['2']],
      ['Last 2:00', d.last2],
      d.periods.OT.games > 0 ? ['Overtime', d.periods.OT] : ['Total', d.all],
    ],
    gamesTitle: 'Games with clutch time in this window',
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
      <h2 className="clutch-section__title">Team Comparison</h2>
      <div className="outplayed">
        <Matchups title="Overall Totals" defs={TOTALS} totals={totals} derived={derived} />
        <Matchups title="Shooting" defs={SHOOTING} totals={totals} derived={derived} />
        {SPLITS.map((s) => <SplitTable key={s.title} split={s} derived={derived} />)}
      </div>
    </section>
  );
}
