// Definitions of the kills terminology, shared by the info tooltips and the
// page's Glossary so each explanation lives in one place.

export const PURE_DIRTY_DEFINITION = (
  <>
    <p><strong>Pure kill</strong> — all 3 stops were clean.</p>
    <p><strong>Dirty kill</strong> — at least one of its 3 stops was dirty.</p>
    <p>A stop is dirty when:</p>
    <ul>
      <li>The offense grabs an offensive rebound during the possession. This signifies that you didn't get the job done the first time.</li>
      <li>The stop only came because the opponent missed their free throws. You got lucky.</li>
    </ul>
    <p>Example: a stop that's a clean defensive rebound off a straight miss is pure. The same rebound after the shooter got two cracks at it — miss, offensive board, miss again — is dirty.</p>
  </>
);

// Opening sentence of a definition. With `showLabel` it leads with the bolded term
// (what a tooltip needs, since nothing else names the term); without, it drops the
// label and capitalizes the sentence (the Glossary already shows the term as a heading).
function Lead({ label, showLabel, children }) {
  if (showLabel) return <><strong>{label}</strong> — {children}</>;
  return <>{children.charAt(0).toUpperCase() + children.slice(1)}</>;
}

export function PotentialKillDefinition({ showLabel = true }) {
  return (
    <p>
      <Lead label="Potential Kills" showLabel={showLabel}>this is a 2 stop streak that never converted to a full kill (3 stops).</Lead>
    </p>
  );
}

export function EfficiencyDefinition({ showLabel = true }) {
  return (
    <>
      <p>
        <Lead label="Efficiency" showLabel={showLabel}>the average net points BYU gained per kill. For each kill it's the change in scoring margin from its first stop to the opponent basket that ends the streak. Gives an idea on how well BYU capitalized on each kill.</Lead>
      </p>
      <p>Single Kill Example: BYU scores 6 points while the kill builds, then the opponent's basket that ends it takes 2 back. That's +4 net.</p>
    </>
  );
}
