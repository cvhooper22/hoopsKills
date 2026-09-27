import { useId, useMemo, useState } from "react";
import { PlayByPlayTable } from "../../../components/PlayByPlay";
import { formatClutchTime } from "../../../utils/clutchUtils";
import { formatClock, periodLabel, toPlayRows } from "../../../utils/playFormat";
import StretchCallout from "./StretchCallout";
import { teamAbbrev } from "./teamNames";

const signed = (n) => (n > 0 ? `+${n}` : String(n));

// One stretch: a rail of its numbers, the moment it started, a collapsible play-by-play, and the
// moment it ended. `story` is one entry from buildStretchStories.
export default function StretchDetail({ stretch, story, focusId, opponentId, homeId }) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const { start, end, pts, events } = stretch;
  const usThem = (s) => (focusId === homeId ? [s.home, s.away] : [s.away, s.home]).join("-");
  const net = (pts[focusId] ?? 0) - (pts[opponentId] ?? 0);
  const span = start.period === end.period
    ? `${periodLabel(start.period)} ${formatClock(start.clockSeconds)} to ${end.clock}`
    : `${periodLabel(start.period)} ${formatClock(start.clockSeconds)} to ${periodLabel(end.period)} ${end.clock}`;

  // rows are only built once the play-by-play is opened
  const rows = useMemo(
    () => (open ? toPlayRows(events.map((e) => e.play), { focusId, homeId, labelOf: teamAbbrev }) : []),
    [open, events, focusId, homeId]
  );

  return (
    <section className="stretch" aria-label={`Stretch ${stretch.id}`}>
      <div className="stretch__rail">
        <span className="stretch__eyebrow">Stretch</span>
        <span className="stretch__number">{stretch.id}</span>
        <span className="stretch__meta">{span}</span>
        <span className="stretch__meta"><b>{formatClutchTime(stretch.seconds)}</b> clutch</span>
        <span className="stretch__meta">In <b>{usThem(start)}</b></span>
        <span className="stretch__meta">Out <b>{usThem(end)}</b></span>
        <span className="stretch__meta">
          Net <span className={`stretch__net${net > 0 ? " stretch__net--pos" : net < 0 ? " stretch__net--neg" : ""}`}>{signed(net)}</span>
        </span>
      </div>

      <div className="stretch__body">
        <StretchCallout {...story.start} />

        <button
          type="button" className="stretch__toggle" aria-expanded={open} aria-controls={regionId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`clutch-pill__chevron stretch__chevron${open ? " clutch-pill__chevron--open" : ""}`} aria-hidden="true" />
          {open ? "Hide" : "Show"} play by play <span className="stretch__toggle-count">· {events.length} plays</span>
        </button>
        <div id={regionId} hidden={!open}>
          {open && (
            <PlayByPlayTable
              rows={rows}
              scoreLabel={`${teamAbbrev(focusId)}-${teamAbbrev(opponentId)}`}
            />
          )}
        </div>

        <StretchCallout {...story.end} />
      </div>
    </section>
  );
}
