import { useEffect, useMemo, useState } from 'react';
import YBallLoader from '../../components/Loaders/YBballLoader';
import urls from '../../constants/assetUrls';
import { MANUAL_SEASON, MANUAL_SYSTEMS, MANUAL_THROUGH } from '../../constants/rankingsManual';
import { PARTS, buildSeries, gameImpact } from '../../utils/rankingsTimeline';
import RankingsChart from './RankingsChart';
import { colorOf, formatDate, rank, signed } from './rankingsFormat';
import './RankingsTimeline.css';

const SEASONS = [2026, 2025]; // newest first; each needs public/data/rankings/timeline-<season>.json
const seasonLabel = (y) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
const TABS = [...PARTS.map((p) => ({ key: p.key, label: p.label })), { key: 'wab', label: 'WAB' }];

// Torvik's overall rank at the start, its best, its worst and where it ended: the shape of the season in four numbers.
function SeasonStrip({ series }) {
  const t = series && series.points.filter((p) => p.overallRank != null);
  if (!t || !t.length) return null;
  const best = t.reduce((a, p) => (p.overallRank < a.overallRank ? p : a));
  const worst = t.reduce((a, p) => (p.overallRank > a.overallRank ? p : a));
  const items = [
    ['Start', rank(t[0].overallRank), formatDate(t[0].date)],
    ['Best', rank(best.overallRank), formatDate(best.date)],
    ['Worst', rank(worst.overallRank), formatDate(worst.date)],
    ['Latest', rank(t[t.length - 1].overallRank), formatDate(t[t.length - 1].date)],
  ];
  return (
    <dl className="rk-strip" aria-label="Torvik overall rank over the season">
      {items.map(([label, value, when]) => (
        <div key={label} className="rk-strip__item"><dt>{label}</dt><dd>{value}</dd><span>{when}</span></div>
      ))}
    </dl>
  );
}

function Change({ value, digits = 0 }) {
  if (value == null) return <span className="rk-muted">{'–'}</span>;
  const tone = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return <span className={`rk-change rk-change--${tone}`}>{signed(value, digits)}</span>;
}

// Each game with what it did to BYU's Torvik rank (the day before against the game day) and WAB, and how the opponent was
// ranked at tip-off against the end of the season.
function GamesTable({ games, torvik }) {
  const [sort, setSort] = useState('date');
  const rows = useMemo(() => games.filter((g) => !g.isExhibition).map((g) => ({ g, impact: torvik ? gameImpact(torvik, g) : null })), [games, torvik]);
  const sorted = useMemo(() => {
    if (sort === 'date') return rows;
    const move = (r) => (r.impact && r.impact.overall ? Math.abs(r.impact.overall.change) : -1);
    return [...rows].sort((a, b) => move(b) - move(a));
  }, [rows, sort]);

  return (
    <section className="rk-games">
      <div className="rk-games__head">
        <h3>Games and what they did to the rankings</h3>
        <label className="rk-sort">Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="date">Date</option>
            <option value="move">Biggest Torvik move</option>
          </select>
        </label>
      </div>
      <div className="rk-games__scroll">
        <table className="rk-table">
          <thead>
            <tr><th>Date</th><th>Opponent</th><th>Opp. rank (tip-off → final)</th><th>Result</th><th>BYU Torvik rank</th><th>Move</th><th>WAB</th></tr>
          </thead>
          <tbody>
            {sorted.map(({ g, impact }) => {
              const o = g.opponentRatings && g.opponentRatings.torvik;
              return (
                <tr key={g.gameId}>
                  <td>{formatDate(g.date)}</td>
                  <td>{g.location === 'away' ? 'at ' : g.location === 'neutral' ? '' : 'vs '}{g.opponentName}{g.location === 'neutral' ? ' (N)' : ''}</td>
                  <td className="rk-num">{o && o.atGame ? rank(o.atGame.overallRank) : '–'} {'→'} {o && o.latest ? rank(o.latest.overallRank) : '–'}</td>
                  <td><span className={`rk-result rk-result--${(g.result || '').toLowerCase()}`}>{g.result}</span> {g.scoreFor != null ? `${g.scoreFor}–${g.scoreAgainst}` : ''}</td>
                  <td className="rk-num">{impact && impact.overall ? `${rank(impact.overall.before)} → ${rank(impact.overall.after)}` : '–'}</td>
                  <td className="rk-num"><Change value={impact && impact.overall ? impact.overall.change : null} /></td>
                  <td className="rk-num"><Change value={impact && impact.wab ? impact.wab.change : null} digits={2} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="rk-note">Move is the change in BYU's Torvik rank from the day before the game to the game day, which already includes the game; + means BYU moved up. Other teams' results move it too, so it is context, not a verdict on the game.</p>
    </section>
  );
}

export default function RankingsTimeline() {
  const [timeline, setTimeline] = useState(null);
  const [error, setError] = useState(false);
  const [season, setSeason] = useState(SEASONS[0]);
  const [part, setPart] = useState('overall');
  const [hidden, setHidden] = useState(() => new Set());
  const [showAverage, setShowAverage] = useState(true);

  useEffect(() => {
    setTimeline(null);
    setError(false);
    fetch(urls.rankingsTimeline(season))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setTimeline)
      .catch(() => setError(true));
  }, [season]);

  const series = useMemo(
    () => (timeline ? buildSeries({ timeline, manual: { season: MANUAL_SEASON, systems: MANUAL_SYSTEMS } }) : []),
    [timeline]
  );
  const torvik = series.find((s) => s.system === 'torvik') || null;
  const drawn = useMemo(() => series.filter((s) => !hidden.has(s.system)).filter((s) => part !== 'wab' || s.points.some((p) => p.wab != null)), [series, hidden, part]);

  if (error) return <div className="mt-l">No rankings data found. Run <code>node ingest/tools/export-rankings-timeline.js</code> in dataAggregators.</div>;
  if (!timeline) return <YBallLoader />;

  const toggle = (system) => setHidden((h) => { const n = new Set(h); if (n.has(system)) n.delete(system); else n.add(system); return n; });
  const hasManual = series.some((s) => s.source === 'manual');

  return (
    <div className="rankings">
      <header className="rankings__head">
        <h2>Rankings timeline</h2>
        <select className="rankings__season" aria-label="Season" value={season} onChange={(e) => setSeason(Number(e.target.value))}>
          {SEASONS.map((y) => <option key={y} value={y}>{seasonLabel(y)}</option>)}
        </select>
      </header>
      <SeasonStrip series={torvik} />

      <div className="rankings__controls">
        <div className="rk-tabs" role="tablist" aria-label="What to chart">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={part === t.key} className={`rk-tab${part === t.key ? ' rk-tab--on' : ''}`} onClick={() => setPart(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="rk-chips">
          {series.filter((s) => part !== 'wab' || s.points.some((p) => p.wab != null)).map((s) => {
            const off = hidden.has(s.system);
            return (
              <button key={s.system} type="button" className={`rk-chip${off ? ' rk-chip--off' : ''}`} aria-pressed={!off} onClick={() => toggle(s.system)}>
                <span className="rk-chip__swatch" style={{ background: colorOf(s.system) }} />
                {s.name}{s.source === 'manual' ? ' *' : ''}
              </button>
            );
          })}
          {part !== 'wab' && (
            <button type="button" className={`rk-chip${showAverage ? '' : ' rk-chip--off'}`} aria-pressed={showAverage} onClick={() => setShowAverage((v) => !v)}>
              <span className="rk-chip__swatch rk-chip__swatch--avg" />Average and spread
            </button>
          )}
        </div>
      </div>

      {drawn.length ? <RankingsChart series={drawn} part={part} games={timeline.games} showAverage={showAverage} /> : <p className="rk-note">Turn a system on to draw it.</p>}

      <ul className="rk-legend">
        <li><span className="rk-game rk-game--w rk-legend__dot" />Win</li>
        <li><span className="rk-game rk-game--l rk-legend__dot" />Loss</li>
        {part !== 'wab' && <li>Rank 1 is at the top. The solid line is the average of the systems with data on that date (Torvik alone once the hand-tracked ones end); the shaded band spans them.</li>}
      </ul>
      {hasManual && <p className="rk-note">* Hand-tracked from a spreadsheet through {formatDate(MANUAL_THROUGH, { month: 'short', day: 'numeric', year: 'numeric' })}: a point every few days, not daily, and no history after that. Torvik is collected daily; NET is its final ranking only.</p>}

      <GamesTable games={timeline.games} torvik={torvik} />
    </div>
  );
}
