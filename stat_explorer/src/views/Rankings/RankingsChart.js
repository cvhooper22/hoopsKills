import { useMemo } from 'react';
import { Annotation, Area, Axis, Chart, HoverLayer, Line, Marker } from '../../components/charts';
import { PARTS, allDates, envelope, partRankKey, pointAt, rankDomain, toTime } from '../../utils/rankingsTimeline';
import { AVERAGE_COLOR, colorOf, formatDate, rank } from './rankingsFormat';

const CHART_MARGIN = { top: 16, right: 20, bottom: 30, left: 52 };
const timeOf = (d) => d.t;
const partLabel = (part) => (PARTS.find((p) => p.key === part) || { label: 'WAB' }).label;
const hasAvg = (d) => d.avg != null;
const toMillis = (iso) => toTime(iso);

// A sparse (hand-tracked) series is read within this many days of its points when hovering.
const HOVER_CARRY_DAYS = 10;

// One number per series and date for the part being drawn: a rank, or WAB.
const valueOf = (point, part) => (part === 'wab' ? point.wab : point[partRankKey(part)]);

function tipRows({ date, series, part, env, games }) {
  const rows = series.map((s) => {
    const p = pointAt(s, date, s.daily ? 3 : HOVER_CARRY_DAYS);
    const v = p ? valueOf(p, part) : null;
    return v == null ? null : { system: s.system, name: s.name, value: v, manual: s.source === 'manual', date: p.date };
  }).filter(Boolean).sort((a, b) => (part === 'wab' ? b.value - a.value : a.value - b.value));
  return { rows, avg: env && env.avg != null ? env.avg : null, avgN: env ? env.n : 0, games: games.filter((g) => g.date === date) };
}

function GameTip({ game }) {
  const then = game.opponentRatings && game.opponentRatings.torvik && game.opponentRatings.torvik.atGame;
  return (
    <div className="rk-tip__game">
      <b>{game.result || '–'}</b> {game.location === 'away' ? 'at' : 'vs'} {game.opponentName}
      {game.scoreFor != null ? ` ${game.scoreFor}–${game.scoreAgainst}` : ''}
      {then && then.overallRank != null ? <span className="rk-tip__muted"> (Torvik {rank(then.overallRank)} at tip-off)</span> : null}
    </div>
  );
}

// BYU's rank (or Torvik's WAB) by system over the season. Collected systems are lines; the hand-tracked ones are dots joined by
// a line, because they only have a point every few days; a one-snapshot system (NET) is a single labelled dot. Rank 1 is at the
// top. A band shows the spread between the systems and a dashed line their average. Games sit along the bottom edge as W/L
// dots. Hovering snaps to every date any system has a point on.
export default function RankingsChart({ series, part, games, showAverage }) {
  const rankPart = part !== 'wab';
  const dates = useMemo(() => allDates(series), [series]);
  const hoverData = useMemo(() => dates.map((date) => ({ date, t: toMillis(date) })), [dates]);
  const env = useMemo(() => (rankPart && showAverage ? envelope(series, part, dates, { minSystems: 1 }) : null), [series, part, dates, rankPart, showAverage]);
  const envByDate = useMemo(() => (env ? new Map(env.map((e) => [e.date, e])) : null), [env]);

  const x = useMemo(() => ({ type: 'utc', domain: [toMillis(dates[0]), toMillis(dates[dates.length - 1])] }), [dates]);
  const y = useMemo(() => {
    if (rankPart) return { domain: rankDomain(series, part) };
    const vals = series.flatMap((s) => s.points.map((p) => p.wab).filter((v) => v != null));
    return { domain: [Math.floor(Math.min(0, ...vals)), Math.ceil(Math.max(1, ...vals)) + 1] };
  }, [series, part, rankPart]);

  const lines = series.map((s) => ({ s, pts: s.points.filter((p) => valueOf(p, part) != null) })).filter((l) => l.pts.length);
  const lineY = (d) => valueOf(d, part);
  // With an average drawn the systems step back (dashed, translucent); without one they are the chart and draw solid.
  const soft = env != null;
  // a dot for the average wherever a collected-at-intervals system has a point, and at the latest date (the daily Torvik
  // file would otherwise put one on every day)
  const avgDots = useMemo(() => {
    if (!env) return [];
    const marked = new Set(series.filter((s) => !s.daily).flatMap((s) => s.points.map((p) => p.date)));
    marked.add(dates[dates.length - 1]);
    return env.filter((e) => hasAvg(e) && marked.has(e.date));
  }, [env, series, dates]);
  const shownGames = games.filter((g) => !g.isExhibition);

  return (
    <Chart
      height={360} margin={CHART_MARGIN} x={x} y={y}
      label={rankPart ? `BYU's ${part === 'overall' ? 'overall' : part === 'off' ? 'offensive' : 'defensive'} rank by rating system over the season` : "BYU's wins above bubble over the season (Torvik)"}
    >
      <Axis orient="left" tickCount={6} grid hideDomain tickFormat={rankPart ? (v) => `#${v}` : undefined} />
      <Axis orient="bottom" tickCount={7} tickFormat={(d) => formatDate(new Date(d).toISOString().slice(0, 10))} />

      {env && <Area className="rk-band" data={env} x={timeOf} y0={(d) => d.min} y1={(d) => d.max} defined={hasAvg} />}

      {lines.map(({ s, pts }) => (pts.length > 1 ? (
        <Line key={s.system} className={`rk-line${soft ? ' rk-line--soft' : ''}`} data={pts} x={timeOf} y={lineY} style={{ stroke: colorOf(s.system) }} />
      ) : null))}
      {lines.filter(({ s }) => !s.daily).map(({ s, pts }) => pts.map((p) => (
        <Marker key={`${s.system}-${p.date}`} x={p.t} y={lineY(p)} r={pts.length > 1 ? 3 : 4.5}>
          {() => <circle r={pts.length > 1 ? 3 : 4.5} fill={colorOf(s.system)} fillOpacity={soft ? 0.6 : 1} stroke="white" strokeWidth={1} />}
        </Marker>
      )))}
      {/* last, so the average sits on top of everything else */}
      {env && <Line className="rk-avg" data={env} x={timeOf} y={(d) => d.avg} defined={hasAvg} style={{ stroke: AVERAGE_COLOR }} />}
      {avgDots.map((e) => (
        <Marker key={`avg-${e.date}`} x={toMillis(e.date)} y={e.avg} r={5}>
          {() => <circle r={5} fill={AVERAGE_COLOR} stroke="white" strokeWidth={1.5} />}
        </Marker>
      ))}
      {lines.filter(({ s, pts }) => !s.daily && pts.length === 1).map(({ s, pts }) => (
        <Annotation key={`l-${s.system}`} x={pts[0].t} y={lineY(pts[0])} dx={-8} dy={-12} textAnchor="end" label={`${s.name.replace('NCAA ', '')} ${rank(lineY(pts[0]))}`} />
      ))}

      {shownGames.map((g) => (
        <Marker key={g.gameId} x={toMillis(g.date)} yPx={(c) => c.innerHeight - 7} r={3.5}>
          {() => <circle r={3.5} className={`rk-game rk-game--${(g.result || 'none').toLowerCase()}`} />}
        </Marker>
      ))}

      <HoverLayer
        data={hoverData} x={timeOf} label="Rankings by date"
        describe={(d) => {
          const t = tipRows({ date: d.date, series, part, env: envByDate && envByDate.get(d.date), games: shownGames });
          return `${formatDate(d.date)}. ${t.rows.map((r) => `${r.name} ${rankPart ? rank(r.value) : r.value.toFixed(1)}`).join(', ')}`;
        }}
        tooltip={({ datum }) => {
          const t = tipRows({ date: datum.date, series, part, env: envByDate && envByDate.get(datum.date), games: shownGames });
          return (
            <div className="rk-tip">
              <div className="rk-tip__head"><b>{formatDate(datum.date, { month: 'short', day: 'numeric', year: 'numeric' })}</b> <span className="rk-tip__part">{partLabel(part)}</span></div>
              {t.rows.map((r) => (
                <div key={r.system} className="rk-tip__row">
                  <span className="rk-tip__swatch" style={{ background: colorOf(r.system) }} />
                  <span>{r.name}{r.manual ? ' *' : ''}</span>
                  <b>{rankPart ? rank(r.value) : r.value.toFixed(2)}</b>
                </div>
              ))}
              {rankPart && t.avg != null && (
                <div className="rk-tip__row rk-tip__row--avg"><span className="rk-tip__swatch" style={{ background: AVERAGE_COLOR }} /><span>Average ({t.avgN})</span><b>{t.avg.toFixed(1)}</b></div>
              )}
              {t.games.map((g) => <GameTip key={g.gameId} game={g} />)}
            </div>
          );
        }}
      />
    </Chart>
  );
}
