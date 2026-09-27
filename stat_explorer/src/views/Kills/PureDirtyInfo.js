import './PureDirtyInfo.css';

// Hover/focus tooltip triggered by an info icon, explaining what makes a kill
// pure vs. dirty. Shared by KillsHeader (next to "Pure / dirty") and the Kills
// table's legend, so the definition lives in one place. Material Symbols
// Sharp's `info` glyph (see public/index.html's icon_names subset).
export default function PureDirtyInfo() {
  return (
    <span className="pure-dirty-info" tabIndex={0}>
      <span className="material-symbols-sharp pure-dirty-info__icon" role="img" aria-label="What makes a kill pure or dirty">info</span>
      <span className="pure-dirty-info__panel" role="tooltip">
        <p><strong>Pure kill</strong> — all 3 stops were clean.</p>
        <p><strong>Dirty kill</strong> — at least one of its 3 stops was dirty.</p>
        <p>A stop is dirty when:</p>
        <ul>
          <li>The offense grabs an offensive rebound during the possession. This signifies that you didn't get the job done the first time.</li>
          <li>The stop only came because the opponent missed their free throws. You got lucky.</li>
        </ul>
        <p>Example: a stop that's a clean defensive rebound off a straight miss is pure. The same rebound after the shooter got two cracks at it — miss, offensive board, miss again — is dirty.</p>
      </span>
    </span>
  );
}
