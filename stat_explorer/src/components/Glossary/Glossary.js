import { useState } from 'react';
import './Glossary.css';

// Reusable floating glossary: a pill fixed to the bottom-right of the screen
// that opens a panel rendering its `children`. Compose the body from
// <GlossaryEntry>, <GlossaryTerm> and <GlossaryDefinition> so every glossary
// is styled the same:
//   <Glossary storageKey="x">
//     <GlossaryEntry>
//       <GlossaryTerm>Kill</GlossaryTerm>
//       <GlossaryDefinition><p>Three stops in a row.</p></GlossaryDefinition>
//     </GlossaryEntry>
//   </Glossary>
// The pill can be dismissed with its ×; that's
// remembered in sessionStorage under `storageKey`, so it stays gone for the
// tab's session and returns next visit. Give each page its own storageKey.
function readDismissed(storageKey) {
  try {
    return window.sessionStorage.getItem(storageKey) === '1';
  } catch {
    return false; // sessionStorage unavailable: just show it
  }
}

function writeDismissed(storageKey) {
  try {
    window.sessionStorage.setItem(storageKey, '1');
  } catch {
    // unavailable (private mode etc.): dismissal lasts until reload
  }
}

export function GlossaryEntry({ children }) {
  return <div className="glossary__entry">{children}</div>;
}

export function GlossaryTerm({ children }) {
  return <h3 className="glossary__term">{children}</h3>;
}

// Holds the definition's markup (<p>, <ul>, ...), which gets the shared spacing.
export function GlossaryDefinition({ children }) {
  return <div className="glossary__definition">{children}</div>;
}

export default function Glossary({ children, storageKey = 'glossary-dismissed', title = 'Glossary' }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey));
  const [open, setOpen] = useState(false);

  if (dismissed) return null;

  const dismiss = () => {
    writeDismissed(storageKey);
    setDismissed(true);
  };

  return (
    <div className="glossary">
      {open && (
        <section className="glossary__panel" aria-label={title}>
          <header className="glossary__panel-header">
            <h2>{title}</h2>
            <button type="button" className="glossary__icon-btn" onClick={() => setOpen(false)} aria-label="Close glossary">×</button>
          </header>
          <div className="glossary__body">{children}</div>
        </section>
      )}
      <div className="glossary__pill">
        <button
          type="button"
          className="glossary__trigger"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="material-symbols-sharp glossary__glyph" aria-hidden="true">info</span>
          {title}
        </button>
        <button type="button" className="glossary__icon-btn glossary__dismiss" onClick={dismiss} aria-label={`Dismiss ${title.toLowerCase()}`}>×</button>
      </div>
    </div>
  );
}
