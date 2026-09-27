import PlayRow from "./PlayRow";
import "./PlayByPlay.css";

// A play-by-play list: header plus a PlayRow per row object (see toPlayRows in utils/playFormat.js).
//   <PlayByPlayTable rows={rows} scoreLabel="BYU-UD" />
export default function PlayByPlayTable({ rows, scoreLabel = "Score", netLabel = "Net", showScore = true, id }) {
  return (
    <div className="pbp-scroll">
      <table className="pbp-table" id={id}>
        <thead>
          <tr>
            <th className="pbp-row__clock">Clock</th>
            <th className="pbp-row__team">Team</th>
            <th className="pbp-row__text">Play</th>
            {showScore && (
              <>
                <th className="pbp-row__score">{scoreLabel}</th>
                <th className="pbp-row__net">{netLabel}</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, ...row }) => <PlayRow key={key} showScore={showScore} {...row} />)}
        </tbody>
      </table>
    </div>
  );
}
