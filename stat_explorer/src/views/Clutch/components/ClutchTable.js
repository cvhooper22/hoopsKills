import { useState } from "react";
import { CLUTCH_COLUMNS, sortClutchRows } from "./clutchColumns";
import ClutchTableHead from "./ClutchTableHead";
import { teamName } from "./teamNames";

const SUM_KEYS = ["pts", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "reb", "ast", "stl", "blk", "tov", "pf"];

const hasClutchActivity = (p) => p.seconds > 0 || SUM_KEYS.some((k) => p[k]);

function Cells({ row }) {
  return CLUTCH_COLUMNS.map((col) => (
    <td
      key={col.key}
      className={[col.align === "left" && "clutch-table__name", col.strong && "clutch-table__pts"].filter(Boolean).join(" ") || undefined}
    >
      {col.cell(row)}
    </td>
  ));
}

// `netPts` is the team's clutch points minus its opponent's; `seconds` is total clutch time.
// Each table keeps its own sort, so the two teams sort independently.
export default function ClutchTable({ teamId, players, netPts, seconds }) {
  const [sort, setSort] = useState({ key: "", direction: "" });
  const [scrolled, setScrolled] = useState(false); // shows an edge shadow under the pinned Player column
  const rows = sortClutchRows(players.filter((p) => p.teamId === teamId && hasClutchActivity(p)), sort);
  const totals = {
    name: "Team",
    seconds,
    plusMinus: netPts,
    ...Object.fromEntries(SUM_KEYS.map((k) => [k, rows.reduce((sum, p) => sum + p[k], 0)])),
  };
  return (
    <div className="clutch-team">
      <h3 className="clutch-team__title">{teamName(teamId)}</h3>
      <div
        className={`clutch-table-scroll${scrolled ? " clutch-table-scroll--scrolled" : ""}`}
        onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
      >
        <table className="clutch-table">
          <ClutchTableHead
            sort={sort}
            onSort={(key, direction) => setSort({ key: direction ? key : "", direction })}
          />
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}><Cells row={p} /></tr>
            ))}
            <tr className="clutch-table__totals"><Cells row={totals} /></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
