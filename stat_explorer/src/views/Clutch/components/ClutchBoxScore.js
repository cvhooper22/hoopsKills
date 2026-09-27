import { useState } from "react";
import ClutchTable from "./ClutchTable";
import { teamName } from "./teamNames";

export default function ClutchBoxScore({ clutch, focusId, opponentId }) {
  const [showOpponent, setShowOpponent] = useState(false);
  const pts = (id) => clutch.teams[id]?.pts ?? 0;
  return (
    <section className="clutch-section">
      <h2 className="clutch-section__title">Clutch box score</h2>
      <p className="clutch-section__sub">All clutch stretches combined</p>
      <ClutchTable
        teamId={focusId} players={clutch.players}
        netPts={pts(focusId) - pts(opponentId)} seconds={clutch.seconds}
      />
      <button
        type="button" className="clutch-toggle" aria-expanded={showOpponent}
        onClick={() => setShowOpponent((s) => !s)}
      >
        {showOpponent ? "Hide" : "View"} {teamName(opponentId)} box score
        <span className={`clutch-pill__chevron${showOpponent ? " clutch-pill__chevron--open" : ""}`} aria-hidden="true" />
      </button>
      {showOpponent && (
        <ClutchTable
          teamId={opponentId} players={clutch.players}
          netPts={pts(opponentId) - pts(focusId)} seconds={clutch.seconds}
        />
      )}
    </section>
  );
}
