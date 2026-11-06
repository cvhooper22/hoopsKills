import { useEffect, useRef, useState } from 'react';
import { GlossaryEntry, GlossaryTerm, GlossaryDefinition } from '../../components/Glossary/Glossary';
import { GLOSSARY_GROUPS } from '../../constants/glossaryEntries';
import './GlossaryPage.css';

// Hidden page (/glossary, not in the nav): every glossary term on the site, with a
// share tray. "Add" collects a term into the tray, rendered like the site's glossary, so
// several can be screenshotted together.
const allEntries = GLOSSARY_GROUPS.flatMap((g) => g.entries);

export default function GlossaryPage() {
  const [trayIds, setTrayIds] = useState([]); // entry ids, in the order added
  const [query, setQuery] = useState('');
  const [texts, setTexts] = useState({}); // id -> lowercase definition text, for search
  const refs = useRef({});

  useEffect(() => {
    const next = {};
    GLOSSARY_GROUPS.forEach((g) => g.entries.forEach((e) => {
      const el = refs.current[e.id];
      next[e.id] = el ? el.textContent.toLowerCase() : '';
    }));
    setTexts(next);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = (e) => !q || e.term.toLowerCase().includes(q) || (texts[e.id] || '').includes(q);

  const inTray = (id) => trayIds.includes(id);
  const add = (id) => setTrayIds((t) => (t.includes(id) ? t : [...t, id]));
  const remove = (id) => setTrayIds((t) => t.filter((x) => x !== id));
  const trayEntries = trayIds.map((id) => allEntries.find((e) => e.id === id)).filter(Boolean);

  return (
    <div className="glossary-page">
      <h1>Glossary</h1>

      <section className="glossary-page__tray" aria-label="Share tray">
        <header className="glossary-page__tray-head">
          <h2>Share tray <span className="glossary-page__count">{trayEntries.length} term{trayEntries.length === 1 ? '' : 's'}</span></h2>
          <button type="button" onClick={() => setTrayIds([])} disabled={!trayEntries.length}>Clear</button>
        </header>
        {trayEntries.length === 0 && <p className="glossary-page__empty">Add terms below to collect them here for a screenshot.</p>}
        {trayEntries.map((entry) => (
          <div className="glossary-page__tray-item" key={entry.id}>
            <GlossaryEntry>
              <GlossaryTerm>{entry.term}</GlossaryTerm>
              <GlossaryDefinition>{entry.definition}</GlossaryDefinition>
            </GlossaryEntry>
            <button type="button" className="glossary-page__remove" onClick={() => remove(entry.id)}>Remove</button>
          </div>
        ))}
      </section>

      <input
        type="search"
        className="glossary-page__search"
        placeholder="Search terms and definitions"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search glossary"
      />
      {q && !GLOSSARY_GROUPS.some((g) => g.entries.some(matches)) && <p className="glossary-page__empty">No terms match "{query}".</p>}

      {GLOSSARY_GROUPS.map((group) => (
        <section key={group.id} className="glossary-page__group" hidden={!group.entries.some(matches)}>
          <h2>{group.label}</h2>
          {group.entries.map((entry) => (
            <div className="glossary-page__entry" key={entry.id} hidden={!matches(entry)}>
              <GlossaryEntry>
                <GlossaryTerm>{entry.term}</GlossaryTerm>
                <div ref={(el) => { refs.current[entry.id] = el; }}>
                  <GlossaryDefinition>{entry.definition}</GlossaryDefinition>
                </div>
              </GlossaryEntry>
              <button type="button" className="glossary-page__add" onClick={() => add(entry.id)} disabled={inTray(entry.id)}>
                {inTray(entry.id) ? 'Added' : 'Add to tray'}
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
