import SortableHeader from "../../../components/SortableHeader/SortableHeader";
import { SORT_KEYS } from "../../../constants/sorting";
import { CLUTCH_COLUMNS } from "./clutchColumns";

const ARIA_SORT = { [SORT_KEYS.ASC]: "ascending", [SORT_KEYS.DESC]: "descending" };

// Sortable header row shared by every clutch box score table (either team).
// `sort` is { key, direction }; onSort(key, direction) follows SortableHeader's contract.
export default function ClutchTableHead({ sort, onSort }) {
  return (
    <thead>
      <tr>
        {CLUTCH_COLUMNS.map((col) => {
          const direction = sort.key === col.key ? sort.direction : "";
          return (
            <th
              key={col.key}
              className={`clutch-table__th${col.align === "left" ? " clutch-table__name" : ""}`}
              aria-sort={ARIA_SORT[direction] ?? "none"}
            >
              <SortableHeader
                classes={`clutch-sort${col.align === "left" ? " clutch-sort--left" : ""}`}
                sortKey={col.key}
                sortDirection={direction}
                onHeaderClick={onSort}
              >
                {col.label}
              </SortableHeader>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
