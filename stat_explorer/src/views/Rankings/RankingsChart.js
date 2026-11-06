import { useMemo } from 'react';
import urls from '../../constants/assetUrls';
import { Annotation, Area, Axis, Chart, HoverLayer, Line, Marker } from '../../components/charts';
import { PARTS, allDates, envelope, partRankKey, pointAt, rankDomain, toTime } from '../../utils/rankingsTimeline';
import { AVERAGE_COLOR, colorOf, formatDate, rank, rankAvg, signed } from './rankingsFormat';

// Opponent logos sit above each game's W/L dot, centred on it.
const LOGO_PX = 20;
const LOGO_GAP = 7;   // from the dot's centre to the logo's bottom edge
const logoUrl = (key) => `${urls.assetBase}/${urls.logosPath}/${key}.png`;

const CHART_MARGIN = { top: 16, right: 20, bottom: 30, left: 52 };
const timeOf = (d) => d.t;
const partLabel = (part) => (PARTS.find((p) => p.key === part) || { label: 'WAB' }).label;
const hasAvg = (d) => d.avg != null;
const toMillis = (iso) => toTime(iso);

// A sparse (hand-tracked) series is read within this many days of its points when hovering.
const HOVER_CARRY_DAYS = 10;

// One number per series and date for the part being drawn: a rank, or WAB.
const valueOf = (point, part) => (part === 'wab' ? point.wab : point[partRankKey(part)]);

// Where a change is measured from: the system's value as of the last game's date, or, with no earlier game, its previous data point.
function referenceValue(s, p, refDate, part) {
  const ref = refDate ? pointAt(s, refDate, s.daily ? 3 : HOVER_CARRY_DAYS) : [...s.points].reverse().find((q) => q.date < p.date);
  return ref ? valueOf(ref, part) : null;
}
// positive is good: a rank that fell, a WAB that rose
const improvement = (part, now, was) => (part === 'wab' ? now - was : was - now);

function tipRows({ date, series, part, env, games, change }) {
  const rows = series.map((s) => {
    const p = pointAt(s, date, s.daily ? 3 : HOVER_CARRY_DAYS);
    const v = p ? valueOf(p, part) : null;
    if (v == null) return null;
    const was = change ? referenceValue(s, p, change.refDate, part) : null;
    return { system: s.system, name: s.name, value: v, manual: s.source === 'manual', date: p.date, delta: was == null ? null : improvement(part, v, was) };
  }).filter(Boolean).sort((a, b) => (part === 'wab' ? b.value - a.value : a.value - b.value));
  return { rows, avg: env && env.avg != null ? env.avg : null, avgN: env ? env.n : 0, games: games.filter((g) => g.date === date) };
}

function Delta({ value, digits = 0 }) {
  if (value == null) return <span className="rk-tip__delta rk-tip__muted">{'–'}</span>;
  return <span className={`rk-tip__delta rk-change rk-change--${value > 0 ? 'up' : value < 0 ? 'down' : 'flat'}`}>{signed(value, digits)}</span>;
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
// The chart starts at the rankings that go into the first real game, the last pre-game snapshot (the day before it), so
// the preseason / exhibition-period snapshots before that are left off. A little room is left to the left of it that
// grows with the range drawn: a quarter day at first, a few days over a full season. The right edge gets the same.
const MIN_PAD_DAYS = 0.25;
const MAX_PAD_DAYS = 5;
const PAD_SHARE = 0.04;
const DAY_MS = 86400000;
const padDays = (spanDays) => Math.min(MAX_PAD_DAYS, Math.max(MIN_PAD_DAYS, spanDays * PAD_SHARE));

// One tick per whole day while the range is short (otherwise several ticks fall inside one day and read the same date).
function dayTicks([from, to]) {
  if ((to - from) / DAY_MS > 10) return undefined;
  const ticks = [];
  for (let t = Math.ceil(from / DAY_MS) * DAY_MS; t <= to; t += DAY_MS) ticks.push(t);
  return ticks;
}

export default function RankingsChart({ series: allSeries, part, games, showAverage, showChange = false }) {
  const rankPart = part !== 'wab';
  const firstReal = useMemo(() => games.filter((g) => !g.isExhibition).map((g) => g.date).sort()[0] || null, [games]);
  const { series, startMs, endMs } = useMemo(() => {
    const cutoff = firstReal ? toMillis(firstReal) - DAY_MS : null;
    const kept = cutoff == null ? [] : allSeries.map((s) => ({ ...s, points: s.points.filter((p) => toMillis(p.date) >= cutoff) })).filter((s) => s.points.length);
    if (!kept.length) return { series: allSeries, startMs: null, endMs: null };
    const times = kept.flatMap((s) => s.points.map((p) => toMillis(p.date)));
    const first = Math.min(...times), last = Math.max(...times);
    const pad = padDays((last - first) / DAY_MS) * DAY_MS;
    return { series: kept, startMs: first - pad, endMs: last + pad };
  }, [allSeries, firstReal]);
  const dates = useMemo(() => allDates(series), [series]);
  const hoverData = useMemo(() => dates.map((date) => ({ date, t: toMillis(date) })), [dates]);
  const env = useMemo(() => (rankPart && showAverage ? envelope(series, part, dates, { minSystems: 1 }) : null), [series, part, dates, rankPart, showAverage]);
  const envByDate = useMemo(() => (env ? new Map(env.map((e) => [e.date, e])) : null), [env]);

  const x = useMemo(() => ({ type: 'utc', domain: [startMs != null ? Math.min(startMs, toMillis(dates[0])) : toMillis(dates[0]), endMs != null ? Math.max(endMs, toMillis(dates[dates.length - 1])) : toMillis(dates[dates.length - 1])] }), [dates, startMs, endMs]);
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

  // The change a tooltip shows: since the last game before the hovered date (as of that game's date) or, when the filtered data
  // has no earlier game, since the previous data point.
  const changeAt = (date) => {
    if (!showChange) return null;
    const refDate = shownGames.map((g) => g.date).filter((d) => d < date).sort().pop() || null;
    const prevDate = refDate ? null : dates[dates.indexOf(date) - 1] || null;
    if (!refDate && !prevDate) return { refDate: null, prevDate: null, none: true };
    return { refDate, prevDate, label: refDate ? `since the ${formatDate(refDate)} game` : `since ${formatDate(prevDate)}` };
  };
  const avgDelta = (c, avg) => {
    if (!c || c.none || avg == null || !rankPart) return null;
    const ref = c.refDate ? envelope(series, part, [c.refDate], { minSystems: 1 })[0] : envByDate && envByDate.get(c.prevDate);
    return ref && ref.avg != null ? ref.avg - avg : null;
  };

  return (
    <Chart
      height={360} margin={CHART_MARGIN} x={x} y={y}
      label={rankPart ? `BYU's ${part === 'overall' ? 'overall' : part === 'off' ? 'offensive' : 'defensive'} rank by rating system over the season` : "BYU's wins above bubble over the season (Torvik)"}
    >
      <Axis orient="left" tickCount={6} grid hideDomain tickFormat={rankPart ? (v) => `#${v}` : undefined} />
      <Axis orient="bottom" tickCount={7} tickValues={dayTicks(x.domain)} tickFormat={(d) => formatDate(new Date(d).toISOString().slice(0, 10))} />

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
          {() => (
            <>
              {g.opponentLogo && (
                <image
                  href={logoUrl(g.opponentLogo)} x={-LOGO_PX / 2} y={-(LOGO_PX + LOGO_GAP)} width={LOGO_PX} height={LOGO_PX}
                  pointerEvents="none" onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <circle r={3.5} className={`rk-game rk-game--${(g.result || 'none').toLowerCase()}`} />
            </>
          )}
        </Marker>
      ))}

      <HoverLayer
        data={hoverData} x={timeOf} label="Rankings by date"
        describe={(d) => {
          const t = tipRows({ date: d.date, series, part, env: envByDate && envByDate.get(d.date), games: shownGames });
          return `${formatDate(d.date)}. ${t.rows.map((r) => `${r.name} ${rankPart ? rank(r.value) : r.value.toFixed(1)}`).join(', ')}`;
        }}
        tooltip={({ datum }) => {
          const c = changeAt(datum.date);
          const t = tipRows({ date: datum.date, series, part, env: envByDate && envByDate.get(datum.date), games: shownGames, change: c && !c.none ? c : null });
          const avgChange = avgDelta(c, t.avg);
          return (
            <div className={`rk-tip${c && !c.none ? ' rk-tip--change' : ''}${rankPart ? '' : ' rk-tip--wab'}`}>
              <div className="rk-tip__head"><b>{formatDate(datum.date, { month: 'short', day: 'numeric', year: 'numeric' })}</b> <span className="rk-tip__part">{partLabel(part)}</span></div>
              {t.rows.map((r) => (
                <div key={r.system} className="rk-tip__row">
                  <span className="rk-tip__swatch" style={{ background: colorOf(r.system) }} />
                  <span>{r.name}{r.manual ? ' *' : ''}</span>
                  <b className="rk-tip__val">{rankPart ? rank(r.value) : r.value.toFixed(2)}</b>
                  {c && !c.none && <Delta value={r.delta} digits={rankPart ? 0 : 2} />}
                </div>
              ))}
              {rankPart && t.avg != null && (
                <div className="rk-tip__row rk-tip__row--avg"><span className="rk-tip__swatch" style={{ background: AVERAGE_COLOR }} /><span>Average ({t.avgN})</span><b className="rk-tip__val">{t.avg.toFixed(1)}</b>{c && !c.none && <Delta value={avgChange} digits={1} />}</div>
              )}
              {c && !c.none && <div className="rk-tip__muted rk-tip__since">Change {c.label}</div>}
              {t.games.map((g) => <GameTip key={g.gameId} game={g} />)}
            </div>
          );
        }}
      />
    </Chart>
  );
}
