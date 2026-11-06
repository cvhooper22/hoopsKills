import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { signed } from './boxFormat';

// Shared building blocks for the Box view, styled to match the Clutch and Kills pages.

// Tab links shared by the finished-game page (/games/:name) and the live page (/live/:name). Labels stay on one line and the row scrolls
// sideways when it is wider than the screen, with the same edge fades and chevrons as the main nav; the current tab is kept in view.
export function BoxTabs({ tabs }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  const [edges, setEdges] = useState({ start: false, end: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft > 1, end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [update, tabs.length]);
  useEffect(() => {
    const el = ref.current, active = el?.querySelector('a.active');
    if (!el || !active) return;
    const pad = 40; // clear of the edge fades
    const box = el.getBoundingClientRect(), item = active.getBoundingClientRect();
    if (item.left < box.left + pad) el.scrollBy({ left: item.left - box.left - pad, behavior: 'smooth' });
    else if (item.right > box.right - pad) el.scrollBy({ left: item.right - box.right + pad, behavior: 'smooth' });
  }, [pathname]);
  return (
    <div className="live-tabs-wrap">
      <nav className="live-tabs" aria-label="Game views" ref={ref} onScroll={update}>
        {tabs.map((t) => <NavLink key={t.to} end={t.end} to={t.to}>{t.label}</NavLink>)}
      </nav>
      {edges.start ? <span className="nav-wrap__edge nav-wrap__edge--start" aria-hidden="true" /> : null}
      {edges.end ? <span className="nav-wrap__edge nav-wrap__edge--end" aria-hidden="true" /> : null}
    </div>
  );
}

export function Section({ title, sub, children }) {
  return (
    <section className="box-section">
      <h2 className={`box-section__title${sub ? '' : ' box-section__title--no-sub'}`}>{title}</h2>
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
// groups: optional [{ label, span, title? }] drawn as a header row above head; spans should add up to head.length.
export function BoxTable({ head, rows, totals, stickyFirst = true, className = '', oppCols = [], groups }) {
  const oppStart = oppCols.length ? Math.min(...oppCols) : -1; // divider between the two teams' columns
  const oppEnd = oppCols.length ? Math.max(...oppCols) : -1; // and a closing one after the opponent's last column
  const cell = (c, i, tag = 'td') => {
    const spec = c !== null && typeof c === 'object' && !Array.isArray(c) && 'v' in c ? c : { v: c };
    const Tag = tag;
    const cls = [i === 0 && stickyFirst ? 'box-table__name' : '', spec.strong ? 'box-table__strong' : '', oppCols.includes(i) ? `box-table__opp${i === oppStart ? ' box-table__opp--start' : ''}${i === oppEnd ? ' box-table__opp--end' : ''}` : '', spec.className || ''].filter(Boolean).join(' ');
    return <Tag key={i} className={cls || undefined} colSpan={spec.colSpan}>{spec.v}</Tag>;
  };
  return (
    <div className={`box-table-scroll mt-l ${className}`}>
      <table className="box-table">
        <thead>
          {groups && (
            <tr className="box-table__groups">
              {groups.map((g, i) => (
                <th key={i} colSpan={g.span} title={g.title} className={[i === 0 && stickyFirst ? 'box-table__name' : '', g.label ? 'box-table__group' : '', g.className || ''].filter(Boolean).join(' ') || undefined}>{g.label}</th>
              ))}
            </tr>
          )}
          <tr>
            {head.map((h, i) => (
              <th key={i} className={[i === 0 && stickyFirst ? 'box-table__name' : '', oppCols.includes(i) ? `box-table__opp${i === oppStart ? ' box-table__opp--start' : ''}${i === oppEnd ? ' box-table__opp--end' : ''}` : '', h.className || ''].filter(Boolean).join(' ') || undefined} title={h.title}>{h.label}</th>
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
