import React, { useEffect, useMemo, useRef, useState } from 'react';
import AlumniCard from '../Alumni/components/AlumniCard';
import FitToWidth from '../../components/ExportCard/FitToWidth';
import { downloadBlob, frameToBlob } from '../../utils/exportImage';
import '../Alumni/styles/index.css';
import './TopGamesPost.css';

// Static 1600x900 "Top alumni games" graphic for /admin/recent-games: the best game as a
// lead panel (tilted alumni card + big game score) and the next four as a ranked board.
// Handwritten type (Permanent Marker) is only used on four things: the lead game score,
// the lead stat values, the board title and the board game scores. The font is loaded
// here, not in index.html, because nothing else uses it.

const MARKER_FONT_URL = 'https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap';
const TOP = 5;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STAT_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk'];
// Every box-score stat the graphic can show, in display order. `field` is the key on a game row.
export const STAT_OPTIONS = [
  { key: 'pts', label: 'PTS', field: 'pts' },
  { key: 'reb', label: 'REB', field: 'reb' },
  { key: 'ast', label: 'AST', field: 'ast' },
  { key: 'stl', label: 'STL', field: 'stl' },
  { key: 'blk', label: 'BLK', field: 'blk' },
  { key: 'tov', label: 'TOV', field: 'tov' },
  { key: 'fg', label: 'FG', field: 'fg' },
  { key: 'threes', label: '3P', field: 'threes' },
  { key: 'ft', label: 'FT', field: 'ft' },
  { key: 'min', label: 'MIN', field: 'min' },
];
export const DEFAULT_LEAD_STATS = ['pts', 'reb', 'ast', 'fg', 'threes', 'ft'];
const statByKey = Object.fromEntries(STAT_OPTIONS.map((o) => [o.key, o]));
const HANDLE = 'byuhoopstats.com / @yze_guy';

const isoParts = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? { y: m[1], mo: Number(m[2]) - 1, d: Number(m[3]) } : null;
};
export const shortDate = (iso) => { const p = isoParts(iso); return p ? `${MONTHS[p.mo]} ${p.d}` : iso || ''; };
const longDate = (iso) => { const p = isoParts(iso); return p ? `${MONTHS[p.mo]} ${p.d}, ${p.y}` : iso || ''; };

// "Sep 26–29, 2026", "Sep 29–Oct 2, 2026", or a single day.
export function dateRange(games) {
  const parts = games.map((g) => isoParts(g.date)).filter(Boolean);
  if (!parts.length) return '';
  const keyOf = (p) => `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  const sorted = [...parts].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (keyOf(first) === keyOf(last)) return `${MONTHS[first.mo]} ${first.d}, ${first.y}`;
  if (first.mo === last.mo && first.y === last.y) return `${MONTHS[first.mo]} ${first.d}–${last.d}, ${last.y}`;
  return `${MONTHS[first.mo]} ${first.d}–${MONTHS[last.mo]} ${last.d}, ${last.y}`;
}

// Scrapers give "W 18-21" (3x3) or a bare "102-98" with the alum's side first.
export function parseResult(result) {
  const m = /^(?:([WL])\s*)?(\d+)\s*[-–:]\s*(\d+)$/.exec((result || '').trim());
  if (!m) return { wl: '', score: result || '' };
  const wl = m[1] || (Number(m[2]) > Number(m[3]) ? 'W' : Number(m[2]) < Number(m[3]) ? 'L' : '');
  return { wl, score: `${m[2]}-${m[3]}` };
}

const isCount = (v) => typeof v === 'number' && Number.isFinite(v);

// PTS/REB/AST always (when known), then STL/BLK only at 3 or more.
export function topLine(g) {
  const present = STAT_KEYS.filter((k) => isCount(g[k]));
  const keep = present.filter((k, i) => i < 3 || g[k] >= 3);
  return keep.map((k) => `${g[k]} ${k.toUpperCase()}`);
}

// Board line for a chosen set of stats; null selection = the automatic line above.
function boardLine(g, keys) {
  if (!keys) return topLine(g);
  return keys.map((k) => statByKey[k]).filter((o) => o && g[o.field] != null && g[o.field] !== '').map((o) => `${g[o.field]} ${o.label}`);
}

// The game's own competition ("Japan-B.Premier League" -> "B.Premier League (Japan)", "Euroleague" as is),
// falling back to the alum's league and country when the source doesn't record one (RealGM, 3x3).
export function leagueLabel(game, alum) {
  const raw = (game.competition || '').trim().replace(/^.*?\((.+)\)$/, '$1');
  const m = /^([A-Za-z.]+)-(.+)$/.exec(raw);
  if (m) return `${m[2]} (${m[1]})`;
  if (raw) return raw;
  if (!alum?.league) return '';
  return alum.country ? `${alum.league} (${alum.country})` : alum.league;
}

const dash = (v) => (v === null || v === undefined || v === '' ? '–' : v);
const minutes = (v) => (/^\d+(\.\d+)?$/.test(String(v ?? '')) ? `${v} min` : '');
const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('');

function Score({ g }) {
  return <>{g.gameScore.toFixed(1)}{g.gameScoreRaw != null && <sup>*</sup>}</>;
}

function WordmarkStackBg() {
  return (
    <div className="top-post__wordmarkBg" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <div className="top-post__wrow" key={i}>
          {Array.from({ length: 4 }, (_, j) => <img key={j} src="/byu-hoops-wordmark-white.png" alt="" />)}
        </div>
      ))}
      <div className="top-post__fade" />
    </div>
  );
}

function LeadCard({ alum, name }) {
  return (
    <div className="top-post__leadCard">
      <div className="top-post__leadCardInner">
        {alum ? <AlumniCard alum={alum} /> : <div className="top-post__cardFallback">{initials(name)}</div>}
      </div>
    </div>
  );
}

function LeadPanel({ game, alum, leadStats }) {
  const { wl, score } = parseResult(game.result);
  const min = minutes(game.min);
  return (
    <div className="top-post__lead">
      <WordmarkStackBg />
      <LeadCard alum={alum} name={game.player} />
      <div className="top-post__leadInfo">
        <div>
          <div className="top-post__leadName">{game.player}</div>
          <div className="top-post__leadTeam">{game.team}</div>
          {leagueLabel(game, alum) && <div className="top-post__leadLeague">{leagueLabel(game, alum)}</div>}
        </div>
        <div>
          <div className="top-post__gameScore"><Score g={game} /></div>
          <div className="top-post__micro">Game score</div>
        </div>
        <div className="top-post__matchup">
          <div>vs <b>{game.opp}</b>{score && ` · ${wl ? `${wl} ` : ''}${score}`}</div>
          <div>{longDate(game.date)}{min && ` · ${min}`}</div>
        </div>
        <div className="top-post__leadStats">
          {leadStats.map((k) => statByKey[k]).filter(Boolean).map((o) => (
            <div key={o.key}><div className="v">{dash(game[o.field])}</div><div className="k">{o.label}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Headshot({ alum, name }) {
  const photo = alum?.coverPhoto;
  return (
    <div className="top-post__head">
      {photo?.url
        ? <img src={photo.url} alt="" referrerPolicy="no-referrer" style={{ objectPosition: photo.style?.objectPosition || 'center 0' }} />
        : initials(name)}
    </div>
  );
}

function BoardRow({ rank, game, alum, boardStats }) {
  const { wl, score } = parseResult(game.result);
  return (
    <div className="top-post__row">
      <div className="top-post__rank">{rank}</div>
      <Headshot alum={alum} name={game.player} />
      <div className="top-post__rowMain">
        <div className="top-post__rName">{game.player}<span>{game.team}</span></div>
        <div className="top-post__rLine">{boardLine(game, boardStats).join(' · ')}</div>
        <div className="top-post__rMeta">
          vs {game.opp}
          {score && <> <span className={wl === 'W' ? 'top-post__resW' : wl === 'L' ? 'top-post__resL' : ''}>{wl}</span> {score}</>}
          <span className="top-post__sep">·</span>{shortDate(game.date)}
        </div>
      </div>
      <div className="top-post__rGm">
        <div className="v"><Score g={game} /></div>
        <div className="k">GmSc</div>
      </div>
    </div>
  );
}

export function TopGamesPost({ games, alumByName, footnote, leadStats = DEFAULT_LEAD_STATS, boardStats = null }) {
  const [lead, ...rest] = games;
  return (
    <div className="top-post">
      <LeadPanel game={lead} alum={alumByName[lead.player]} leadStats={leadStats} />
      <div className="top-post__board">
        <div className="top-post__boardHead">
          <div>
            <div className="top-post__boardTitle">Top alumni games</div>
            <div className="top-post__boardSub">{dateRange(games)} · Ranked by game score</div>
          </div>
        </div>
        <div className="top-post__rows">
          {rest.map((g, i) => <BoardRow key={`${g.player}-${g.date}-${g.opp}`} rank={i + 2} game={g} alum={alumByName[g.player]} boardStats={boardStats} />)}
        </div>
        <div className="top-post__boardFoot"><span>{footnote}</span><b>{HANDLE}</b></div>
      </div>
    </div>
  );
}

const PREFS_KEY = 'topGamesPost.stats';
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY));
    const valid = (a) => Array.isArray(a) && a.every((k) => statByKey[k]);
    return { lead: valid(p?.lead) ? p.lead : DEFAULT_LEAD_STATS, board: valid(p?.board) ? p.board : null };
  } catch (e) {
    return { lead: DEFAULT_LEAD_STATS, board: null };
  }
}

// Picker for a stat list. Selected stats sit in display order (drag a chip, or use the arrows,
// to reorder); the rest are below to add. Each chip shows the top game's value as a preview.
function StatPicker({ title, hint, selected, onChange, disabled, sample }) {
  const [dragKey, setDragKey] = useState(null);
  const remaining = STAT_OPTIONS.filter((o) => !selected.includes(o.key));
  const move = (from, to) => {
    if (to < 0 || to >= selected.length || from === to) return;
    const next = [...selected];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };
  const value = (o) => dash(sample?.[o.field]);
  return (
    <fieldset className="top-post-editor__group" disabled={disabled}>
      <legend>{title}</legend>
      <div className="top-post-editor__chips">
        {selected.map((key, i) => {
          const o = statByKey[key];
          return (
            <div
              key={key}
              className={`top-post-editor__chip top-post-editor__chip--on${dragKey === key ? ' top-post-editor__chip--drag' : ''}`}
              draggable
              onDragStart={() => setDragKey(key)}
              onDragEnd={() => setDragKey(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { move(selected.indexOf(dragKey), i); setDragKey(null); }}
            >
              <span className="top-post-editor__label">{o.label}</span>
              <span className="top-post-editor__value">{value(o)}</span>
              <span className="top-post-editor__ctl">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${o.label} earlier`}>‹</button>
                <button type="button" onClick={() => onChange(selected.filter((k) => k !== key))} aria-label={`Remove ${o.label}`}>×</button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === selected.length - 1} aria-label={`Move ${o.label} later`}>›</button>
              </span>
            </div>
          );
        })}
        {selected.length === 0 && <span className="recent-games__note">None selected</span>}
      </div>
      {remaining.length > 0 && (
        <div className="top-post-editor__chips top-post-editor__chips--pool">
          {remaining.map((o) => (
            <button key={o.key} type="button" className="top-post-editor__chip" onClick={() => onChange([...selected, o.key])} aria-label={`Add ${o.label}`}>
              <span className="top-post-editor__label">+ {o.label}</span>
              <span className="top-post-editor__value">{value(o)}</span>
            </button>
          ))}
        </div>
      )}
      {hint && <div className="recent-games__note">{hint}</div>}
    </fieldset>
  );
}

// Section under the combined table: loads the marker font once, picks the top games
// (same ranking as the table) and offers a PNG download of the graphic.
export default function TopGamesPostSection({ rows, alumni }) {
  const frameRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [prefs, setPrefs] = useState(loadPrefs);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MARKER_FONT_URL;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* storage unavailable: prefs just won't persist */ }
  }, [prefs]);

  const games = useMemo(
    () => rows.filter((r) => r.gameScore != null).sort((a, b) => b.gameScore - a.gameScore).slice(0, TOP),
    [rows]
  );
  const alumByName = useMemo(() => Object.fromEntries(alumni.map((a) => [a.name, a])), [alumni]);

  if (games.length < 2) return null;
  const footnote = games.some((g) => g.gameScoreRaw != null) ? '* FIBA 3x3 game score, scaled' : '';

  async function download() {
    setBusy(true);
    setError('');
    try {
      downloadBlob(await frameToBlob(frameRef.current), 'byu-hoops-top-alumni-games.png');
    } catch (e) {
      setError(`Could not render image: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="recent-games__combined">
      <div className="recent-games__combined-head">
        <h3>Top games graphic</h3>
        <button type="button" onClick={download} disabled={busy}>{busy ? 'Rendering…' : 'Download PNG'}</button>
        {error && <span className="recent-games__note--error">{error}</span>}
      </div>
      <FitToWidth width={1600}>
        <div ref={frameRef}><TopGamesPost games={games} alumByName={alumByName} footnote={footnote} leadStats={prefs.lead} boardStats={prefs.board} /></div>
      </FitToWidth>
      <div className="top-post-editor">
        <StatPicker
          title="Lead game stats"
          hint="Shown under the big score, three per row. Drag to reorder; up to 9."
          sample={games[0]}
          selected={prefs.lead}
          onChange={(lead) => setPrefs((p) => ({ ...p, lead: lead.slice(0, 9) }))}
        />
        <label className="top-post-editor__auto">
          <input
            type="checkbox"
            checked={prefs.board === null}
            onChange={(e) => setPrefs((p) => ({ ...p, board: e.target.checked ? null : ['pts', 'reb', 'ast'] }))}
          />
          Automatic board line (PTS/REB/AST, plus STL/BLK at 3 or more)
        </label>
        <StatPicker
          title="Board row stats"
          sample={games[0]}
          hint="Values shown are from the top game."
          selected={prefs.board || []}
          disabled={prefs.board === null}
          onChange={(board) => setPrefs((p) => ({ ...p, board }))}
        />
        <button type="button" onClick={() => setPrefs({ lead: DEFAULT_LEAD_STATS, board: null })}>Reset stats</button>
      </div>
    </section>
  );
}
