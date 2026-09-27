import { useEffect, useRef, useState } from "react";
import FlipPad from "../../../components/FlipPad/FlipPad";
import { formatClutchTime } from "../../../utils/clutchUtils";
import ClutchControls from "./ClutchControls";
import { teamName } from "./teamNames";

const formatDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const signed = (n) => (n > 0 ? `+${n}` : String(n));

function summarySentence({ clutch, focusId, opponentId }) {
  if (!clutch.stretches.length) return "This game never reached a clutch situation under this definition.";
  const mine = clutch.teams[focusId]?.pts ?? 0;
  const theirs = clutch.teams[opponentId]?.pts ?? 0;
  const count = clutch.stretches.length;
  const time = `${formatClutchTime(clutch.seconds)} of clutch time across ${count} ${count === 1 ? "stretch" : "stretches"}.`;
  const [us, them] = [teamName(focusId), teamName(opponentId)];
  if (mine === theirs) return `${time} ${us} and ${them} scored ${mine} apiece when it was close.`;
  return mine > theirs
    ? `${time} ${us} outscored ${them} ${mine}-${theirs} when it was close.`
    : `${time} ${them} outscored ${us} ${theirs}-${mine} when it was close.`;
}

export default function ClutchHeader({ clutch, meta, focusId, opponentId, definition, onDefinitionChange }) {
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!popRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const minutes = definition.seconds / 60;
  const scoreOf = (id) => (id === clutch.homeId ? clutch.final.home : clutch.final.away);
  const mine = clutch.teams[focusId]?.pts ?? 0;
  const theirs = clutch.teams[opponentId]?.pts ?? 0;
  const net = mine - theirs;
  const eyebrow = [meta?.date && formatDate(meta.date), meta?.venue, meta?.status === "final" && "Final"].filter(Boolean);

  return (
    <header className="clutch-header">
      {eyebrow.length > 0 && <div className="clutch-header__eyebrow">{eyebrow.join(" · ")}</div>}
      <h1 className="clutch-header__score">
        <span className="clutch-header__team clutch-header__team--focus">{teamName(focusId)} {scoreOf(focusId)}</span>
        <span className="clutch-header__dash">–</span>
        <span className="clutch-header__team">{scoreOf(opponentId)} {teamName(opponentId)}</span>
      </h1>
      <p className="clutch-header__summary">{summarySentence({ clutch, focusId, opponentId })}</p>

      <div className="clutch-popover" ref={popRef}>
        <button
          type="button" className="clutch-pill" aria-expanded={open} aria-haspopup="dialog"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="material-symbols-sharp clutch-pill__icon" aria-hidden="true">tune</span>
          <span>Clutch: last <b>{minutes} min</b>, within <b>{definition.margin} pts</b></span>
          <span className={`clutch-pill__chevron${open ? " clutch-pill__chevron--open" : ""}`} aria-hidden="true" />
        </button>
        {open && <ClutchControls minutes={minutes} margin={definition.margin} onChange={onDefinitionChange} />}
      </div>

      <div className="clutch-kpis">
        <FlipPad condensed label="Clutch time" value={formatClutchTime(clutch.seconds)} />
        <FlipPad condensed label="Stretches" value={String(clutch.stretches.length)} />
        <FlipPad condensed label={`${teamName(focusId)} clutch pts`} value={String(mine)} />
        <FlipPad condensed label={`${teamName(opponentId)} clutch pts`} value={String(theirs)} />
        <FlipPad condensed label={`${teamName(focusId)} clutch net`} value={net === 0 ? "0" : signed(net)} tone="auto" />
      </div>
    </header>
  );
}
