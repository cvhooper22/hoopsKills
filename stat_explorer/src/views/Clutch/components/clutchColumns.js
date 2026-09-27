import Net from "../../../components/Net/Net";
import { SORT_KEYS } from "../../../constants/sorting";
import { formatClutchTime } from "../../../utils/clutchUtils";

const ratio = (made, att) => `${made}-${att}`;
// shooting sorts by makes, then by fewer attempts (the better percentage)
const shootingColumn = (key, label, made, att) => ({
  key, label,
  sortValue: (p) => [p[made], -p[att]],
  cell: (p) => ratio(p[made], p[att]),
});
const countColumn = (key, label) => ({ key, label, sortValue: (p) => p[key], cell: (p) => p[key] });

export const CLUTCH_COLUMNS = [
  { key: "name", label: "Player", align: "left", sortValue: (p) => p.name, cell: (p) => p.name },
  { key: "seconds", label: "MIN", sortValue: (p) => p.seconds, cell: (p) => formatClutchTime(p.seconds) },
  { key: "pts", label: "PTS", strong: true, sortValue: (p) => p.pts, cell: (p) => p.pts },
  shootingColumn("fg", "FG", "fgm", "fga"),
  shootingColumn("tp", "3P", "tpm", "tpa"),
  shootingColumn("ft", "FT", "ftm", "fta"),
  countColumn("reb", "REB"),
  countColumn("ast", "AST"),
  countColumn("stl", "STL"),
  countColumn("blk", "BLK"),
  countColumn("tov", "TO"),
  countColumn("pf", "PF"),
  { key: "plusMinus", label: "+/-", sortValue: (p) => p.plusMinus, cell: (p) => <Net netVal={p.plusMinus} /> },
];

const compareValues = (a, b) => {
  if (Array.isArray(a)) return a[0] - b[0] || a[1] - b[1];
  return typeof a === "string" ? a.localeCompare(b) : a - b;
};

// Default order is most clutch minutes, then points. Array.sort is stable, so ties keep that order.
export function sortClutchRows(rows, sort) {
  const byDefault = [...rows].sort((a, b) => b.seconds - a.seconds || b.pts - a.pts);
  const column = CLUTCH_COLUMNS.find((c) => c.key === sort.key);
  if (!column) return byDefault;
  const dir = sort.direction === SORT_KEYS.ASC ? 1 : -1;
  return byDefault.sort((a, b) => dir * compareValues(column.sortValue(a), column.sortValue(b)));
}
