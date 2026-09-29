import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import YBallLoader from "../../../components/Loaders/YBballLoader";
import { DEFAULT_CLUTCH, genClutchData } from "../../../utils/clutchUtils";
import urls from "../../../constants/assetUrls";
import ClutchHeader from "./ClutchHeader";
import ClutchBoxScore from "./ClutchBoxScore";
import ClutchStretches from "./ClutchStretches";
import MarginChart from "./MarginChart";
import TopPerformers from "./TopPerformers";
import "../Clutch.css";

const FOCUS_TEAM = "byu";
const VIEW_SUMMARY = "summary";
const VIEW_STRETCHES = "stretches";

// URL params (?min=4&margin=3&view=stretches) hold the page state so it is shareable and survives refresh
function readDefinition(params) {
  const min = parseFloat(params.get("min"));
  const margin = parseInt(params.get("margin"), 10);
  return {
    seconds: min > 0 ? min * 60 : DEFAULT_CLUTCH.seconds,
    margin: margin >= 0 ? margin : DEFAULT_CLUTCH.margin,
  };
}

export default function GameClutch() {
  const { name } = useParams();
  const gameId = name;
  const [params, setParams] = useSearchParams();
  const [plays, setPlays] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPlays(null);
    setMeta(null);
    setError(false);
    fetch(urls.pbpGame(gameId))
      .then((resp) => resp.json())
      .then(setPlays)
      .catch((err) => {
        console.error(err);
        setError(true);
      });
    // header facts and headshots are optional: the page still works from the plays alone
    fetch(urls.pbpGameMeta(gameId))
      .then((resp) => (resp.ok ? resp.json() : null))
      .then(setMeta)
      .catch(() => setMeta(null));
  }, [gameId]);

  const definition = readDefinition(params);
  const clutch = useMemo(
    () => (plays ? genClutchData(plays, definition) : null),
    [plays, definition.seconds, definition.margin]
  );
  const view = params.get("view") === VIEW_STRETCHES ? VIEW_STRETCHES : VIEW_SUMMARY;

  function updateParams(patch) {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => next.set(k, String(v)));
    setParams(next, { replace: true });
  }

  if (error) return <div className="mt-l">There was an error fetching the play by play data</div>;
  if (!clutch) return <YBallLoader />;

  const { homeId, awayId, stretches } = clutch;
  const opponentId = homeId === FOCUS_TEAM ? awayId : homeId;
  const tabs = [
    { id: VIEW_SUMMARY, label: "Summary" },
    { id: VIEW_STRETCHES, label: "Stretches", count: stretches.length },
  ];
  return (
    <div className="game-clutch">
      <ClutchHeader
        clutch={clutch} meta={meta} focusId={FOCUS_TEAM} opponentId={opponentId}
        definition={definition}
        onDefinitionChange={({ min, margin }) => updateParams({ min, margin })}
      />

      <div className="clutch-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id} type="button" role="tab" aria-selected={view === t.id}
            className={`clutch-tabs__tab${view === t.id ? " clutch-tabs__tab--on" : ""}`}
            onClick={() => updateParams({ view: t.id })}
          >
            {t.label}
            {t.count !== undefined && <span className="clutch-tabs__count">{t.count}</span>}
          </button>
        ))}
      </div>

      {!stretches.length && <div className="mt-l">Try a wider definition to see clutch stats for this game.</div>}
      {stretches.length > 0 && view === VIEW_SUMMARY && (
        <>
          <TopPerformers
            players={clutch.players.filter((p) => p.teamId === FOCUS_TEAM)}
            headshots={meta?.headshots}
          />
          <ClutchBoxScore clutch={clutch} focusId={FOCUS_TEAM} opponentId={opponentId} />
        </>
      )}
      {stretches.length > 0 && view === VIEW_STRETCHES && (
        <section className="clutch-section">
          <MarginChart plays={plays} clutch={clutch} definition={definition} focusId={FOCUS_TEAM} />
          <h2 className="clutch-section__title">Clutch stretches</h2>
          <p className="clutch-section__sub">Every stretch where the game was in range, and what pushed it out</p>
          <ClutchStretches plays={plays} clutch={clutch} definition={definition} focusId={FOCUS_TEAM} />
        </section>
      )}
    </div>
  );
}
