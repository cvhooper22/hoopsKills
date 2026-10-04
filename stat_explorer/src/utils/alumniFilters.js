import { REGIONS, regionOf } from '../constants/regions';

// Division values as they appear in alum.json, best to worst. Anything not listed sorts last.
const DIVISION_ORDER = ['Highest', 'High', 'Middle', 'Mid', 'Lowest', 'Low'];

export const EMPTY_FILTERS = { statuses: [], divisions: [], regions: [] };

export function hasAnyFilter(filters) {
  return Object.values(filters).some((list) => list.length > 0);
}

export function toggleValue(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const passes = (selected, value) => selected.length === 0 || selected.includes(value);

// OR within a filter group, AND across groups. Nothing selected shows everyone.
export function matchesFilters(alum, filters) {
  const statusOk = filters.statuses.length === 0 || filters.statuses.some((key) => alum.statuses?.includes(key));
  return statusOk && passes(filters.divisions, alum.division) && passes(filters.regions, regionOf(alum.countryCode));
}

// Options come from the data so a value nobody has never shows up as an empty filter.
export function divisionOptions(alum) {
  const present = [...new Set(alum.map((a) => a.division).filter(Boolean))];
  const rank = (d) => { const i = DIVISION_ORDER.indexOf(d); return i === -1 ? DIVISION_ORDER.length : i; };
  return present.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((d) => ({ key: d, label: d }));
}

export function regionOptions(alum) {
  const present = new Set(alum.map((a) => regionOf(a.countryCode)));
  return REGIONS.filter((r) => present.has(r.key));
}
