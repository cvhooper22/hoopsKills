import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { KILL_GAMES, killGameById } from '../../constants/killGames';
import './StopsEditor.css';

// Hidden page for marking which plays count as a "stop" in a normalized game.
// Clicking a row only sets the "left off" bookmark; the checkbox marks a stop.
// Any play can carry a note. Saved shape: { leftOff, plays: [{ sequence_number, stop, note }] }.
// Reachable only by navigating to /admin/stops[/<gameId>]. Marks are the defending
// team's (BYU's) stops in that game. Saving only works under
// `npm start`: it POSTs to a dev-server endpoint (see src/setupProxy.js) that
// writes public/data/stops/<gameId>.json.

const NOISE = new Set(['substitution', 'period_admin']);

function playLabel(p) {
  return [p.play_category, p.play_type, p.play_subtype].filter(Boolean).join(' · ');
}

export default function StopsEditor() {
  const { gameId } = useParams();
  const game = killGameById(gameId);
  return <StopsGame key={game.id} game={game} />;
}

function StopsGame({ game }) {
  const GAME_ID = game.id;
  const navigate = useNavigate();
  const teamLabel = { home: game.home, away: game.away };
  const [plays, setPlays] = useState(null);
  const [stops, setStops] = useState({}); // sequence_number -> true
  const [notes, setNotes] = useState({}); // sequence_number -> text
  const [leftOff, setLeftOff] = useState(null);
  const [savedJson, setSavedJson] = useState(null);
  const [hideNoise, setHideNoise] = useState(true);
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [status, setStatus] = useState(null);
  const leftOffRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/data/${GAME_ID}.json`);
        if (!res.ok) throw new Error(`game data: ${res.status}`);
        setPlays(await res.json());
        const stopsRes = await fetch(`/data/stops/${GAME_ID}.json`);
        // CRA's dev server answers unknown paths with index.html, so check the type.
        if (stopsRes.ok && (stopsRes.headers.get('content-type') || '').includes('json')) {
          const saved = await stopsRes.json();
          const list = Array.isArray(saved) ? saved.map((s) => ({ ...s, stop: true })) : saved.plays;
          setStops(Object.fromEntries(list.filter((s) => s.stop).map((s) => [s.sequence_number, true])));
          setNotes(Object.fromEntries(list.filter((s) => s.note).map((s) => [s.sequence_number, s.note])));
          setLeftOff(Array.isArray(saved) ? null : saved.leftOff ?? null);
        }
      } catch (err) {
        setStatus({ ok: false, msg: err.message });
      }
    }
    load();
  }, [GAME_ID]);

  const payload = useMemo(() => {
    const seqs = new Set([...Object.keys(stops), ...Object.keys(notes)].map(Number));
    return {
      leftOff,
      plays: [...seqs]
        .sort((a, b) => a - b)
        .map((seq) => ({ sequence_number: seq, stop: !!stops[seq], ...(notes[seq] ? { note: notes[seq] } : {}) })),
    };
  }, [stops, notes, leftOff]);
  const payloadJson = JSON.stringify(payload);

  // The first load establishes the baseline for the dirty check.
  useEffect(() => {
    if (plays && savedJson === null) setSavedJson(payloadJson);
  }, [plays, savedJson, payloadJson]);

  useEffect(() => {
    if (plays && leftOffRef.current) leftOffRef.current.scrollIntoView({ block: 'center' });
    // Only on first render of the rows, not on every bookmark change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plays]);

  const stopCount = Object.keys(stops).length;
  const dirty = savedJson !== null && payloadJson !== savedJson;

  function toggleStop(seq) {
    setStops((prev) => {
      const next = { ...prev };
      if (next[seq]) delete next[seq];
      else next[seq] = true;
      return next;
    });
  }

  function setNote(seq, text) {
    setNotes((prev) => {
      const next = { ...prev };
      if (text) next[seq] = text;
      else delete next[seq];
      return next;
    });
  }

  async function save() {
    setStatus({ ok: true, msg: 'Saving…' });
    try {
      const res = await fetch(`/api/stops/${GAME_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadJson,
      });
      if (!(res.headers.get('content-type') || '').includes('json')) {
        throw new Error(`Save endpoint not found (${res.status}). Restart \`npm start\` so src/setupProxy.js reloads.`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSavedJson(payloadJson);
      setStatus({ ok: true, msg: `Saved ${stopCount} stops` });
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    }
  }

  if (!plays) return <div className="stops-editor">{status ? status.msg : 'Loading…'}</div>;

  const rows = plays.filter((p) => {
    const seq = p.sequence_number;
    if (onlyMarked) return stops[seq] || notes[seq] || seq === leftOff;
    return !(hideNoise && NOISE.has(p.play_category)) || seq === leftOff || notes[seq];
  });

  return (
    <div className="stops-editor">
      <div className="stops-editor__bar">
        <h2>Stops</h2>
        <select value={game.id} onChange={(e) => navigate(`/admin/stops/${e.target.value}`)}>
          {KILL_GAMES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
        <label><input type="checkbox" checked={hideNoise} onChange={(e) => setHideNoise(e.target.checked)} /> Hide subs / period admin</label>
        <label><input type="checkbox" checked={onlyMarked} onChange={(e) => setOnlyMarked(e.target.checked)} /> Only stops / notes / bookmark</label>
        <span className="stops-editor__count">{stopCount} stops</span>
        <button type="button" onClick={save} disabled={!dirty}>{dirty ? 'Save' : 'Saved'}</button>
        {status && <span className={`stops-editor__status stops-editor__status--${status.ok ? 'ok' : 'error'}`}>{status.msg}</span>}
      </div>
      <table className="stops-editor__table">
        <thead>
          <tr><th>#</th><th>Stop</th><th>Half</th><th>Clock</th><th>Team</th><th>Player</th><th>Play</th><th>Score ({game.home}–{game.away})</th><th>Note</th></tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const seq = p.sequence_number;
            const newPeriod = i === 0 || rows[i - 1].period_number !== p.period_number;
            const classes = [stops[seq] ? 'is-stop' : '', seq === leftOff ? 'is-left-off' : '', p.team_side === game.defense ? 'is-defense' : ''].join(' ');
            return (
              <React.Fragment key={seq}>
                {newPeriod && <tr className="stops-editor__period"><td colSpan={9}>Period {p.period_number}</td></tr>}
                <tr className={classes} ref={seq === leftOff ? leftOffRef : null} onClick={() => setLeftOff(seq)}>
                  <td className="stops-editor__seq">{seq}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={!!stops[seq]} onChange={() => toggleStop(seq)} />
                  </td>
                  <td>{p.period_number}</td>
                  <td>{p.clock_display}</td>
                  <td>{teamLabel[p.team_side] || ''}</td>
                  <td>{p.player_name || ''}</td>
                  <td title={p.play_description}>{playLabel(p)}{p.is_made === true ? ' ✓' : ''}</td>
                  <td>{p.home_score_after}–{p.away_score_after}</td>
                  <td>
                    <input type="text" value={notes[seq] || ''} placeholder="note" onChange={(e) => setNote(seq, e.target.value)} />
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
