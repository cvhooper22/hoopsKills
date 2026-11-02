import { useMemo, useState } from 'react';
import {
  SECTIONS, DEFAULT_INCLUDE, QUESTION_IDEAS, fillIdea, buildParts, assemblePrompt, sectionTokens, estimateTokens,
} from '../../utils/askAiPrompt';
import './AskAi.css';

// "Ask AI about this game": a tab fixed to the right edge that slides out a panel. The person picks what to include and types
// a question; the panel builds one prompt to copy into their own AI chat. Behind the `askAi` feature flag. `data` is a box payload.
const BIG_PROMPT_TOKENS = 30000; // past this, free-tier chats and small models start to struggle

const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

// navigator.clipboard needs a secure context and a click; fall back to a hidden textarea for anything else.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* fall through */ }
    document.body.removeChild(area);
    return ok;
  }
}

export default function AskAi({ data, inProgress = false }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [include, setInclude] = useState(DEFAULT_INCLUDE);
  const [copied, setCopied] = useState(null); // null | 'yes' | 'no'

  const parts = useMemo(() => buildParts(data, { inProgress }), [data, inProgress]);
  const costs = useMemo(() => sectionTokens(parts), [parts]);
  const prompt = useMemo(() => assemblePrompt(parts, include, question), [parts, include, question]);
  const tokens = estimateTokens(prompt);
  const team = data.header.teams[data.header.focus];

  const toggle = (key) => { setInclude((cur) => ({ ...cur, [key]: !cur[key] })); setCopied(null); };
  const onCopy = async () => {
    const ok = await copyText(prompt);
    setCopied(ok ? 'yes' : 'no');
  };

  return (
    <div className={`ask-ai${open ? ' ask-ai--open' : ''}`}>
      {!open && (
        <button type="button" className="ask-ai__tab" onClick={() => setOpen(true)} aria-label="Ask AI about this game">
          <span className="material-symbols-sharp ask-ai__glyph" aria-hidden="true">auto_awesome</span>
        </button>
      )}
      <section className="ask-ai__panel" aria-label="Ask AI about this game" aria-hidden={!open}>
        <header className="ask-ai__header">
          <button type="button" className="ask-ai__close" onClick={() => setOpen(false)} aria-label="Close">
            <span className="material-symbols-sharp ask-ai__glyph" aria-hidden="true">close</span>
          </button>
          <h2>Ask AI about this game</h2>
        </header>
        <div className="ask-ai__body">
          <p className="ask-ai__lede">
            Build a prompt that includes context and play by play from this game. Copy it into ChatGPT, Claude, or any AI chat and ask away.
          </p>

          <label className="ask-ai__label" htmlFor="ask-ai-question">Your question</label>
          <textarea
            id="ask-ai-question"
            className="ask-ai__question"
            rows={3}
            value={question}
            onChange={(e) => { setQuestion(e.target.value); setCopied(null); }}
            placeholder="Leave blank to let the AI pick what's interesting"
          />
          <details className="ask-ai__suggest">
            <summary>Not sure what to ask?</summary>
            <p className="ask-ai__suggest-hint">Click a suggestion topic to prefill a question.</p>
            <div className="ask-ai__ideas" role="group" aria-label="Question ideas">
              {QUESTION_IDEAS.map((idea) => (
                <button key={idea.label} type="button" className="ask-ai__idea" onClick={() => { setQuestion(fillIdea(idea.text, team)); setCopied(null); }}>
                  {idea.label}
                </button>
              ))}
            </div>
          </details>

          <fieldset className="ask-ai__include">
            <legend className="ask-ai__label">Include</legend>
            <label className="ask-ai__check ask-ai__check--locked">
              <input type="checkbox" checked disabled />
              <span>Play-by-play <em>always</em></span>
            </label>
            {SECTIONS.map((s) => (
              <label key={s.key} className="ask-ai__check" title={s.hint}>
                <input type="checkbox" checked={include[s.key]} onChange={() => toggle(s.key)} />
                <span>{s.label} <em>~{fmt(costs[s.key])} tokens</em></span>
              </label>
            ))}
          </fieldset>

          <div className="ask-ai__size" data-big={tokens > BIG_PROMPT_TOKENS}>
            About {fmt(tokens)} tokens ({fmt(prompt.length)} characters).
            {tokens > BIG_PROMPT_TOKENS ? ' That is a lot for free chat plans; switch off a section above.' : ''}
          </div>

          <button type="button" className="ask-ai__copy" onClick={onCopy}>
            {copied === 'yes' ? 'Copied!' : 'Copy prompt'}
          </button>
          {copied === 'no' ? <p className="ask-ai__fail">Couldn't reach the clipboard. Open the preview below, select all, and copy.</p> : null}

          <details className="ask-ai__preview">
            <summary>Preview the prompt</summary>
            <textarea className="ask-ai__preview-text" readOnly value={prompt} onFocus={(e) => e.target.select()} />
          </details>
        </div>
      </section>
    </div>
  );
}
