import React, { useEffect, useId, useMemo, useState } from 'react';
import alumSeed from '../../assets/alum';
import AlumniCard from '../Alumni/components/AlumniCard';
import { STATUSES } from '../../components/StatusBadge/StatusBadge';
import '../Alumni/Alumni.css';
import './AlumniEditor.css';

// Hidden editor for src/assets/alum.js. Not linked from anywhere in the
// app nav — reachable only by navigating directly to /admin/alumni.
// Saving only works while running `npm start` locally: it POSTs to a
// dev-server-only endpoint (see src/setupProxy.js) that rewrites
// src/assets/alum.js on disk. It does nothing in a production build.

// Stable identity for an alum in the editor. Names are editable and list
// positions change on reorder, so neither can be used to track an alum.
const newId = () => Math.random().toString(36).slice(2, 10);

function emptyAlum() {
  return {
    _id: newId(),
    name: '',
    nameAccent: false,
    years: '',
    inactive: false,
    statuses: [],
    country: '',
    countryCode: '',
    team: '',
    position: '',
    teamLogo: { url: '', styleText: '' },
    league: '',
    division: '',
    teamSocial: { twitter: '', instagram: '', youtube: '', facebook: '' },
    recentTweetsUrl: '',
    playerUrl: '',
    teamWebsite: '',
    coverPhoto: { url: '', styleText: '' },
    notesText: '',
  };
}

function toEditable(a) {
  return {
    _id: newId(),
    name: a.name || '',
    nameAccent: !!a.nameAccent,
    years: a.years || '',
    inactive: !!a.inactive,
    statuses: a.statuses || [],
    country: a.country || '',
    countryCode: a.countryCode || '',
    team: a.team || '',
    position: a.position || '',
    teamLogo: {
      url: a.teamLogo?.url || '',
      styleText: a.teamLogo?.style ? JSON.stringify(a.teamLogo.style, null, 2) : '',
    },
    league: a.league || '',
    division: a.division || '',
    teamSocial: {
      twitter: a.teamSocial?.twitter || '',
      instagram: a.teamSocial?.instagram || '',
      youtube: a.teamSocial?.youtube || '',
      facebook: a.teamSocial?.facebook || '',
    },
    recentTweetsUrl: a.recentTweetsUrl || '',
    playerUrl: a.playerUrl || '',
    teamWebsite: a.teamWebsite || '',
    coverPhoto: {
      url: a.coverPhoto?.url || '',
      styleText: a.coverPhoto?.style ? JSON.stringify(a.coverPhoto.style, null, 2) : '',
    },
    notesText: (a.notes || []).join('\n'),
  };
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Downloads an external image server-side and re-hosts it in S3, via the
// dev-only proxy in setupProxy.js -> the image-uploader Lambda. Only works
// under `npm start` with IMAGE_UPLOAD_API_URL/KEY set in .env.local.
function ImageImporter({ category, defaultFileName, onImported }) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [fileName, setFileName] = useState(defaultFileName);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    if (!sourceUrl.trim() || !fileName.trim()) {
      setStatus({ ok: false, message: 'Enter both a source URL and a filename' });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: sourceUrl.trim(), category, fileName: fileName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onImported(data.url);
      setSourceUrl('');
      setStatus({ ok: true, message: `Hosted at ${data.url}` });
    } catch (e) {
      setStatus({ ok: false, message: `${e.message} (this only works when running "npm start" locally with the uploader Lambda configured)` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="alumni-editor__importer">
      <input
        type="url"
        placeholder="Paste a source image URL to download & host in S3"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
      />
      <input
        type="text"
        className="alumni-editor__importer-filename"
        placeholder="filename"
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
      />
      <button type="button" onClick={handleImport} disabled={loading}>
        {loading ? 'Fetching…' : 'Fetch & Host'}
      </button>
      {status && (
        <span className={`alumni-editor__status alumni-editor__status--${status.ok ? 'ok' : 'error'}`}>
          {status.message}
        </span>
      )}
    </div>
  );
}

function parseStyleText(styleText, errors, fieldName) {
  const trimmed = (styleText || '').trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    errors.push(`${fieldName}: style must be a JSON object`);
    return undefined;
  } catch (e) {
    errors.push(`${fieldName}: invalid JSON style (${e.message})`);
    return undefined;
  }
}

function toStored(editable, errors) {
  const out = { name: editable.name.trim() };
  if (editable.nameAccent) out.nameAccent = true;
  if (editable.years.trim()) out.years = editable.years.trim();
  if (editable.inactive) out.inactive = true;
  const statuses = Object.keys(STATUSES).filter((key) => editable.statuses.includes(key));
  if (statuses.length) out.statuses = statuses;
  out.country = editable.country.trim();
  out.countryCode = editable.countryCode.trim();
  out.team = editable.team.trim();
  out.position = editable.position.trim();

  const teamLogo = { url: editable.teamLogo.url.trim() };
  const teamLogoStyle = parseStyleText(editable.teamLogo.styleText, errors, `${editable.name || '(unnamed)'} team logo`);
  if (teamLogoStyle) teamLogo.style = teamLogoStyle;
  out.teamLogo = teamLogo;

  out.league = editable.league.trim();
  out.division = editable.division.trim();

  const teamSocial = {};
  Object.entries(editable.teamSocial).forEach(([k, v]) => {
    if (v.trim()) teamSocial[k] = v.trim();
  });
  if (Object.keys(teamSocial).length) out.teamSocial = teamSocial;

  if (editable.recentTweetsUrl.trim()) out.recentTweetsUrl = editable.recentTweetsUrl.trim();
  out.playerUrl = editable.playerUrl.trim();
  out.teamWebsite = editable.teamWebsite.trim();

  const coverPhoto = { url: editable.coverPhoto.url.trim() };
  const coverPhotoStyle = parseStyleText(editable.coverPhoto.styleText, errors, `${editable.name || '(unnamed)'} cover photo`);
  if (coverPhotoStyle) coverPhoto.style = coverPhotoStyle;
  out.coverPhoto = coverPhoto;

  const notes = editable.notesText.split('\n').map((n) => n.trim()).filter(Boolean);
  if (notes.length) out.notes = notes;

  return out;
}

function Field({ label, hint, children }) {
  return (
    <label className="alumni-editor__field">
      <span className="alumni-editor__label">{label}</span>
      {children}
      {hint && <span className="alumni-editor__hint">{hint}</span>}
    </label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="alumni-editor__checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// Style JSON textarea with an explicit "Apply to preview" button. Typing updates
// the form (and dirty tracking) immediately; the card preview only picks the
// style up when applied.
function StyleField({ label, hint, value, appliedValue, onChange, onApply }) {
  const id = useId();
  const error = parseError(value);
  const pending = value.trim() !== appliedValue.trim();
  return (
    <div className="alumni-editor__field">
      <label className="alumni-editor__label" htmlFor={id}>{label}</label>
      <textarea id={id} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="alumni-editor__hint">{hint}</span>}
      <div className="alumni-editor__apply">
        <button type="button" className="alumni-editor__apply-btn" onClick={onApply} disabled={!!error || !pending}>
          Apply to preview
        </button>
        {error ? (
          <span className="alumni-editor__apply-msg alumni-editor__apply-msg--error">{error}</span>
        ) : pending ? (
          <span className="alumni-editor__apply-msg alumni-editor__apply-msg--pending">Not applied to preview yet</span>
        ) : null}
      </div>
    </div>
  );
}

function parseError(styleText) {
  const trimmed = (styleText || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? null : 'Must be a JSON object';
  } catch (e) {
    return `Invalid JSON: ${e.message}`;
  }
}

export default function AlumniEditor() {
  const [initial] = useState(() => alumSeed.map(toEditable));
  // Working copy: what's on screen, including unsaved edits, order and removals.
  const [list, setList] = useState(initial);
  // What was last written to alum.js, in file order: [{ id, data }].
  const [savedList, setSavedList] = useState(() =>
    initial.map((e) => ({ id: e._id, data: toStored(e, []) }))
  );
  // Style JSON text the card preview is currently showing, per alum. Separate from
  // the form value so the preview only changes when "Apply to preview" is pressed.
  const [appliedStyles, setAppliedStyles] = useState(() =>
    Object.fromEntries(
      initial.map((e) => [e._id, { teamLogo: e.teamLogo.styleText, coverPhoto: e.coverPhoto.styleText }])
    )
  );
  const [selected, setSelected] = useState(0);
  const [playerStatus, setPlayerStatus] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [saving, setSaving] = useState(null); // 'order' | 'player' | null

  const current = list[selected];

  const savedById = useMemo(() => new Map(savedList.map((s) => [s.id, s.data])), [savedList]);

  // Order/removals: working order of the alumni already in the file vs. file order.
  // (Brand-new, never-saved alumni don't count — they belong to the player save.)
  const orderDirty = useMemo(
    () =>
      list.filter((i) => savedById.has(i._id)).map((i) => i._id).join('|') !==
      savedList.map((s) => s.id).join('|'),
    [list, savedList, savedById]
  );

  // Players whose field values differ from the file, or that aren't in it yet.
  const dirtyPlayerIds = useMemo(() => {
    const ids = new Set();
    list.forEach((item) => {
      const saved = savedById.get(item._id);
      if (!saved || JSON.stringify(toStored(item, [])) !== JSON.stringify(saved)) ids.add(item._id);
    });
    return ids;
  }, [list, savedById]);

  const playerDirty = !!current && dirtyPlayerIds.has(current._id);
  const anyDirty = orderDirty || dirtyPlayerIds.size > 0;

  useEffect(() => {
    if (!anyDirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  function updateCurrent(patch) {
    setList((prev) => prev.map((item, i) => (i === selected ? { ...item, ...patch } : item)));
  }

  function updateCurrentNested(key, patch) {
    setList((prev) =>
      prev.map((item, i) => (i === selected ? { ...item, [key]: { ...item[key], ...patch } } : item))
    );
  }

  function selectAlum(idx) {
    setSelected(idx);
    setPlayerStatus(null);
  }

  function addAlum() {
    setList((prev) => [...prev, emptyAlum()]);
    setSelected(list.length);
    setPlayerStatus(null);
  }

  function deleteAlum(idx) {
    if (!window.confirm(`Delete ${list[idx].name || '(unnamed)'}?`)) return;
    setList((prev) => prev.filter((_, i) => i !== idx));
    setSelected((prevSel) => Math.max(0, prevSel >= idx ? prevSel - 1 : prevSel));
    setPlayerStatus(null);
    setOrderStatus(null);
  }

  function move(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    setList((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setSelected((prevSel) => {
      if (prevSel === idx) return target;
      if (prevSel === target) return idx;
      return prevSel;
    });
    setOrderStatus(null);
  }

  async function persist(nextSaved, kind) {
    const setStatus = kind === 'order' ? setOrderStatus : setPlayerStatus;
    setSaving(kind);
    setStatus(null);
    try {
      const res = await fetch('/api/alum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSaved.map((s) => s.data)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSavedList(nextSaved);
      setStatus({ ok: true, message: kind === 'order' ? 'Order saved' : 'Player saved' });
    } catch (e) {
      setStatus({ ok: false, message: `${e.message} (this only works when running "npm start" locally)` });
    } finally {
      setSaving(null);
    }
  }

  // Writes the working order/removals, keeping every player's last-saved values.
  function saveOrder() {
    persist(
      list.filter((i) => savedById.has(i._id)).map((i) => ({ id: i._id, data: savedById.get(i._id) })),
      'order'
    );
  }

  // Writes only the selected player's values, keeping the file's last-saved order.
  function savePlayer() {
    const errors = [];
    const data = toStored(current, errors);
    if (!data.name) errors.push('Name is required');
    else if (savedList.some((s) => s.id !== current._id && s.data.name === data.name)) {
      errors.push(`Duplicate name: ${data.name}`);
    }
    if (errors.length) {
      setPlayerStatus({ ok: false, message: errors.join('; ') });
      return;
    }

    let nextSaved;
    if (savedById.has(current._id)) {
      nextSaved = savedList.map((s) => (s.id === current._id ? { id: s.id, data } : s));
    } else {
      // New alum: slot it in after the closest preceding alum that's already in the file.
      let insertAt = 0;
      for (let i = selected - 1; i >= 0; i--) {
        const at = savedList.findIndex((s) => s.id === list[i]._id);
        if (at !== -1) { insertAt = at + 1; break; }
      }
      nextSaved = [...savedList.slice(0, insertAt), { id: current._id, data }, ...savedList.slice(insertAt)];
    }
    persist(nextSaved, 'player');
  }

  const applied = (current && appliedStyles[current._id]) || { teamLogo: '', coverPhoto: '' };

  function applyStyle(key) {
    setAppliedStyles((prev) => ({
      ...prev,
      [current._id]: { ...(prev[current._id] || { teamLogo: '', coverPhoto: '' }), [key]: current[key].styleText },
    }));
  }

  // Everything but the two style objects tracks the form live; those use the applied text.
  const previewAlum = useMemo(() => {
    if (!current) return null;
    const preview = toStored(current, []);
    const withStyle = ({ url }, styleText) => {
      const style = parseStyleText(styleText, [], '');
      return style ? { url, style } : { url };
    };
    return {
      ...preview,
      teamLogo: withStyle(preview.teamLogo, applied.teamLogo),
      coverPhoto: withStyle(preview.coverPhoto, applied.coverPhoto),
    };
  }, [current, applied.teamLogo, applied.coverPhoto]);

  if (!current) {
    return (
      <div className="alumni-editor">
        <div className="alumni-editor__empty">
          No alumni. <button onClick={addAlum}>Add one</button>
        </div>
      </div>
    );
  }

  const styleHint = (example) => `Optional JSON, e.g. ${example}`;
  const headerStatus =
    playerStatus && !playerStatus.ok ? playerStatus : playerDirty ? { ok: null, message: 'Unsaved changes' } : playerStatus;

  return (
    <div className="alumni-editor">
      <aside className="alumni-editor__list">
        <div className="alumni-editor__list-top">
          <button className="alumni-editor__add-btn" onClick={addAlum}>+ Add New Alum</button>
          <button className="alumni-editor__list-save-btn" onClick={saveOrder} disabled={saving !== null || !orderDirty}>
            {saving === 'order' ? 'Saving…' : 'Save changes'}
          </button>
          {orderStatus && !orderStatus.ok ? (
            <p className="alumni-editor__list-note alumni-editor__list-note--error">{orderStatus.message}</p>
          ) : orderDirty ? (
            <p className="alumni-editor__list-note">Reordering or removing alumni isn't written to alum.js until you save.</p>
          ) : (
            orderStatus && <p className="alumni-editor__list-note alumni-editor__list-note--ok">{orderStatus.message}</p>
          )}
        </div>
        <div className="alumni-editor__list-items">
          {list.map((item, idx) => (
            <div
              key={item._id}
              className={`alumni-editor__list-item${idx === selected ? ' alumni-editor__list-item--selected' : ''}${item.inactive ? ' alumni-editor__list-item--inactive' : ''}`}
              onClick={() => selectAlum(idx)}
            >
              <button disabled={idx === 0} onClick={(e) => { e.stopPropagation(); move(idx, -1); }} title="Move up">↑</button>
              <button disabled={idx === list.length - 1} onClick={(e) => { e.stopPropagation(); move(idx, 1); }} title="Move down">↓</button>
              <span className="alumni-editor__list-item-name">{item.name || '(unnamed)'}</span>
              {dirtyPlayerIds.has(item._id) && <span className="alumni-editor__dot" title="Unsaved player changes" />}
              <button onClick={(e) => { e.stopPropagation(); deleteAlum(idx); }} title="Delete">✕</button>
            </div>
          ))}
        </div>
      </aside>

      <main className="alumni-editor__main">
        <header className="alumni-editor__save-bar">
          <h2 className="alumni-editor__title">{current.name || 'New alum'}</h2>
          <div className="alumni-editor__save-actions">
            {headerStatus && (
              <span className={`alumni-editor__status alumni-editor__status--${headerStatus.ok === null ? 'dirty' : headerStatus.ok ? 'ok' : 'error'}`}>
                {headerStatus.message}
              </span>
            )}
            <button className="alumni-editor__save-btn" onClick={savePlayer} disabled={saving !== null || !playerDirty}>
              {saving === 'player' ? 'Saving…' : 'Save player'}
            </button>
          </div>
        </header>

        <div className="alumni-editor__scroll">
          <div className="alumni-editor__form">
            <section className="alumni-editor__section">
              <h3>Player</h3>
              <div className="alumni-editor__row alumni-editor__row--player">
                <Field label="Name">
                  <input type="text" value={current.name} onChange={(e) => updateCurrent({ name: e.target.value })} />
                </Field>
                <Field label="Position">
                  <input type="text" value={current.position} onChange={(e) => updateCurrent({ position: e.target.value })} placeholder="Guard" />
                </Field>
                <Field label="Years">
                  <input type="text" value={current.years} onChange={(e) => updateCurrent({ years: e.target.value })} placeholder="2022-24" />
                </Field>
              </div>
              <div className="alumni-editor__checks">
                <Checkbox label="Accent last name" checked={current.nameAccent} onChange={(nameAccent) => updateCurrent({ nameAccent })} />
                <Checkbox label="Inactive" checked={current.inactive} onChange={(inactive) => updateCurrent({ inactive })} />
              </div>
              <div className="alumni-editor__checks">
                {Object.entries(STATUSES).map(([key, { label }]) => (
                  <Checkbox
                    key={key}
                    label={label}
                    checked={current.statuses.includes(key)}
                    onChange={(on) => updateCurrent({ statuses: on ? [...current.statuses, key] : current.statuses.filter((st) => st !== key) })}
                  />
                ))}
              </div>
            </section>

            <section className="alumni-editor__section">
              <h3>Team</h3>
              <div className="alumni-editor__row alumni-editor__row--2">
                <Field label="Team name">
                  <input type="text" value={current.team} onChange={(e) => updateCurrent({ team: e.target.value })} />
                </Field>
                <Field label="Team website">
                  <input type="url" value={current.teamWebsite} onChange={(e) => updateCurrent({ teamWebsite: e.target.value })} />
                </Field>
                <Field label="League">
                  <input type="text" value={current.league} onChange={(e) => updateCurrent({ league: e.target.value })} />
                </Field>
                <Field label="Division">
                  <input type="text" value={current.division} onChange={(e) => updateCurrent({ division: e.target.value })} placeholder="Highest / Middle" />
                </Field>
                <Field label="Country">
                  <input type="text" value={current.country} onChange={(e) => updateCurrent({ country: e.target.value })} />
                </Field>
                <Field label="Country code" hint="Lowercase ISO code: us, fr, jp…">
                  <input type="text" value={current.countryCode} onChange={(e) => updateCurrent({ countryCode: e.target.value.toLowerCase() })} />
                </Field>
              </div>
            </section>

            <section className="alumni-editor__section">
              <h3>Team Logo</h3>
              <div className="alumni-editor__row">
                <Field label="Logo URL">
                  <input type="url" value={current.teamLogo.url} onChange={(e) => updateCurrentNested('teamLogo', { url: e.target.value })} />
                </Field>
                <StyleField
                  label="Logo style"
                  hint={styleHint('{"filter": "none"}')}
                  value={current.teamLogo.styleText}
                  appliedValue={applied.teamLogo}
                  onChange={(styleText) => updateCurrentNested('teamLogo', { styleText })}
                  onApply={() => applyStyle('teamLogo')}
                />
              </div>
              <ImageImporter
                key={`teamLogo-${current._id}`}
                category="teamLogo"
                defaultFileName={slugify(current.team)}
                onImported={(url) => updateCurrentNested('teamLogo', { url })}
              />
            </section>

            <section className="alumni-editor__section">
              <h3>Cover Photo</h3>
              <div className="alumni-editor__row">
                <Field label="Photo URL">
                  <input type="url" value={current.coverPhoto.url} onChange={(e) => updateCurrentNested('coverPhoto', { url: e.target.value })} />
                </Field>
                <StyleField
                  label="Photo style"
                  hint={styleHint('{"objectPosition": "54% 0"}')}
                  value={current.coverPhoto.styleText}
                  appliedValue={applied.coverPhoto}
                  onChange={(styleText) => updateCurrentNested('coverPhoto', { styleText })}
                  onApply={() => applyStyle('coverPhoto')}
                />
              </div>
              <ImageImporter
                key={`coverPhoto-${current._id}`}
                category="player"
                defaultFileName={slugify(current.name)}
                onImported={(url) => updateCurrentNested('coverPhoto', { url })}
              />
            </section>

            <section className="alumni-editor__section">
              <h3>Links</h3>
              <div className="alumni-editor__row">
                <Field label="Player stats URL">
                  <input type="url" value={current.playerUrl} onChange={(e) => updateCurrent({ playerUrl: e.target.value })} />
                </Field>
                <Field label="Recent tweets search URL" hint="Optional. Replaces the player link in the card footer.">
                  <input type="url" value={current.recentTweetsUrl} onChange={(e) => updateCurrent({ recentTweetsUrl: e.target.value })} />
                </Field>
              </div>
            </section>

            <section className="alumni-editor__section">
              <h3>Team Social</h3>
              <div className="alumni-editor__row alumni-editor__row--2">
                {['twitter', 'instagram', 'youtube', 'facebook'].map((k) => (
                  <Field label={k} key={k}>
                    <input type="url" value={current.teamSocial[k]} onChange={(e) => updateCurrentNested('teamSocial', { [k]: e.target.value })} />
                  </Field>
                ))}
              </div>
            </section>

            <section className="alumni-editor__section">
              <h3>Notes</h3>
              <div className="alumni-editor__row">
                <Field label="Notes" hint="Optional. One note per line.">
                  <textarea rows={4} value={current.notesText} onChange={(e) => updateCurrent({ notesText: e.target.value })} />
                </Field>
              </div>
            </section>
          </div>
        </div>
      </main>

      <aside className="alumni-editor__preview">
        <div className="alumni-editor__preview-heading">Card preview</div>
        <AlumniCard key={current._id} alum={previewAlum} />
        <p className="alumni-editor__preview-hint">Hover the card and use the flip button to see the back.</p>
        {current.inactive && (
          <p className="alumni-editor__preview-hint">Inactive — hidden from the Active tab on the Alumni page.</p>
        )}
      </aside>
    </div>
  );
}
