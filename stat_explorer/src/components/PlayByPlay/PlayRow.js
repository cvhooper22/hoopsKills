import "./PlayByPlay.css";

// One play as a table row: clock, team badge, what happened, and (on scoring plays) the running
// score and net. Data only, so it does not care where the plays come from; build rows with
// toPlayRows() in utils/playFormat.js. It renders a <tr>, so put it inside a <tbody>.
//
//   <PlayRow clock="4:36" teamLabel="UD" teamTone="secondary" text="Bryce Heard 2pt layup made"
//            score="67-64" net={3} netText="+3" />
//
//   teamTone: 'primary' (filled badge, the team being followed) or 'secondary' (outlined)
//   muted:    greys the row (a missed shot)
//   showScore=false drops the score and net cells (match it on <PlayByPlayTable>)
export default function PlayRow({ clock, teamLabel, teamTone = "secondary", text, muted = false, score, net, netText, showScore = true }) {
  return (
    <tr className={`pbp-row${muted ? " pbp-row--muted" : ""}`}>
      <td className="pbp-row__clock">{clock}</td>
      <td className="pbp-row__team">
        <span className={`pbp-badge pbp-badge--${teamTone}`}>{teamLabel}</span>
      </td>
      <td className="pbp-row__text">{text}</td>
      {showScore && (
        <>
          <td className="pbp-row__score">{score}</td>
          <td className={`pbp-row__net${net > 0 ? " pbp-row__net--pos" : net < 0 ? " pbp-row__net--neg" : ""}`}>{netText}</td>
        </>
      )}
    </tr>
  );
}
