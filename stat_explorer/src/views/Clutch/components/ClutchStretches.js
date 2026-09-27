import { Fragment, useMemo } from "react";
import { marginSeries } from "../../../utils/clutchSeries";
import { buildStretchStories } from "../../../utils/clutchStory";
import StretchDetail from "./StretchDetail";
import { teamName } from "./teamNames";

const WHOLE_HALF = 1200;

// Every stretch in one card, with a band between stretches that says how long the game was out of
// clutch and how big the lead got.
export default function ClutchStretches({ plays, clutch, definition, focusId }) {
  const { homeId, awayId, stretches } = clutch;
  const opponentId = homeId === focusId ? awayId : homeId;
  const stories = useMemo(() => {
    const { points, sign } = marginSeries(plays, { focusId, windowSeconds: WHOLE_HALF });
    return buildStretchStories(stretches, points, {
      sign, focusId, focusName: teamName(focusId), oppName: teamName(opponentId), margin: definition.margin,
    });
  }, [plays, stretches, focusId, opponentId, definition.margin]);

  return (
    <div className="stretches-card">
      {stretches.map((s, i) => (
        <Fragment key={s.id}>
          <StretchDetail stretch={s} story={stories[i]} focusId={focusId} opponentId={opponentId} homeId={homeId} />
          {stories[i].gapAfter && <div className="stretches-gap"><span aria-hidden="true">⋮</span>{stories[i].gapAfter}</div>}
        </Fragment>
      ))}
    </div>
  );
}
