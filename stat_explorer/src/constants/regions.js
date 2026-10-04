// Region meta for the alumni Geo filter, keyed by the lowercase ISO `countryCode` on each
// alum. Not exhaustive: add a country here when an alum plays somewhere new. A country with
// no entry just doesn't match any Geo option (the alum still shows when Geo isn't filtered).
//
// Calls worth knowing about: Israel is grouped with Asia by geography even though its clubs
// play in European competitions, and Australia gets its own Oceania region.
const REGIONS = [
  { key: 'us', label: 'US' },
  { key: 'europe', label: 'Europe' },
  { key: 'asia', label: 'Asia' },
  { key: 'oceania', label: 'Oceania' },
];

const COUNTRY_REGION = {
  us: 'us',
  // Europe
  de: 'europe',
  es: 'europe',
  gb: 'europe',
  gr: 'europe',
  is: 'europe',
  it: 'europe',
  ro: 'europe',
  // Asia
  il: 'asia',
  jp: 'asia',
  // Oceania
  au: 'oceania',
};

function regionOf(countryCode) {
  return COUNTRY_REGION[String(countryCode ?? '').toLowerCase()] ?? null;
}

export { REGIONS, regionOf };
