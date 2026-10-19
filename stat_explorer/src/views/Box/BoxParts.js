import { signed } from './boxFormat';

// Shared building blocks for the Box view, styled to match the Clutch and Kills pages.

export function Section({ title, sub, children }) {
  return (
    <section className="box-section">
      <h2 className="box-section__title">{title}</h2>
      {sub && <p className="box-section__sub">{sub}</p>}
      {children}
    </section>
  );
}

// +N / −N chip, green for positive and red for negative like the Net chip in the other tables.
export function NetChip({ value, digits = 0 }) {
  const cls = value > 0 ? ' net--pos' : value < 0 ? ' net--neg' : '';
  return <span className={`net${cls}`}>{signed(value, digits)}</span>;
}

// head: [{ label, align?, title? }]; rows: arrays of cells; cell may be { v, strong, className }.
// oppCols: indices of the opponent's columns, shaded so they read apart from the focus team's at a glance.
export function BoxTable({ head, rows, totals, stickyFirst = true, className = '', oppCols = [] }) {
  const cell = (c, i, tag = 'td') => {
    const spec = c !== null && typeof c === 'object' && !Array.isArray(c) && 'v' in c ? c : { v: c };
    const Tag = tag;
    const cls = [i === 0 && stickyFirst ? 'box-table__name' : '', spec.strong ? 'box-table__strong' : '', oppCols.includes(i) ? 'box-table__opp' : '', spec.className || ''].filter(Boolean).join(' ');
    return <Tag key={i} className={cls || undefined}>{spec.v}</Tag>;
  };
  return (
    <div className={`box-table-scroll ${className}`}>
      <table className="box-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className={[i === 0 && stickyFirst ? 'box-table__name' : '', oppCols.includes(i) ? 'box-table__opp' : '', h.className || ''].filter(Boolean).join(' ') || undefined} title={h.title}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => <tr key={ri}>{r.map((c, i) => cell(c, i))}</tr>)}
          {totals && <tr className="box-table__totals">{totals.map((c, i) => cell(c, i))}</tr>}
        </tbody>
      </table>
    </div>
  );
}

// Diverging bars: where each point of the margin came from. Right of center favors the focus team.
export function NetBars({ rows, focusName, oppName }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  return (
    <div className="box-netbars" role="list" aria-label="Net points by source">
      <div className="box-netbars__axis" aria-hidden="true">
        <span>{oppName} +</span>
        <span>{focusName} +</span>
      </div>
      {rows.map((r) => (
        <div className="box-netbar" role="listitem" key={r.k}>
          <span className="box-netbar__label">{r.label}</span>
          <span className="box-netbar__track">
            <span
              className={`box-netbar__fill box-netbar__fill--${r.net >= 0 ? 'pos' : 'neg'}`}
              style={{ width: `${(Math.abs(r.net) / max) * 50}%` }}
            />
          </span>
          <NetChip value={r.net} />
        </div>
      ))}
    </div>
  );
}
