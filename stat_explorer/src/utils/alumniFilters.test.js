import { EMPTY_FILTERS, divisionOptions, hasAnyFilter, matchesFilters, regionOptions, toggleValue } from './alumniFilters';
import { regionOf } from '../constants/regions';

const alum = [
  { name: 'A', countryCode: 'us', division: 'Highest', statuses: ['injured'] },
  { name: 'B', countryCode: 'JP', division: 'Middle' },
  { name: 'C', countryCode: 'es', division: 'Highest', statuses: ['updateSoon'] },
  { name: 'D', countryCode: 'au', division: 'Highest' },
  { name: 'E', countryCode: 'xx', division: 'Middle' },
];
const names = (filters) => alum.filter((a) => matchesFilters(a, filters)).map((a) => a.name);

describe('regionOf', () => {
  it('maps country codes case-insensitively and returns null for unknowns', () => {
    expect(regionOf('us')).toBe('us');
    expect(regionOf('JP')).toBe('asia');
    expect(regionOf('il')).toBe('asia');
    expect(regionOf('xx')).toBeNull();
    expect(regionOf(undefined)).toBeNull();
  });
});

describe('matchesFilters', () => {
  it('shows everyone with nothing selected', () => {
    expect(names(EMPTY_FILTERS)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('ORs within a group', () => {
    expect(names({ ...EMPTY_FILTERS, regions: ['us', 'asia'] })).toEqual(['A', 'B']);
    expect(names({ ...EMPTY_FILTERS, statuses: ['injured', 'updateSoon'] })).toEqual(['A', 'C']);
  });

  it('ANDs across groups', () => {
    expect(names({ statuses: [], divisions: ['Highest'], regions: ['europe', 'oceania'] })).toEqual(['C', 'D']);
    expect(names({ statuses: ['injured'], divisions: ['Highest'], regions: ['europe'] })).toEqual([]);
  });

  it('drops alumni in unmapped countries once Geo is filtered', () => {
    expect(names({ ...EMPTY_FILTERS, regions: ['us', 'europe', 'asia', 'oceania'] })).not.toContain('E');
  });
});

describe('options', () => {
  it('lists only divisions and regions that exist, in a sensible order', () => {
    expect(divisionOptions(alum).map((o) => o.key)).toEqual(['Highest', 'Middle']);
    expect(regionOptions(alum).map((o) => o.key)).toEqual(['us', 'europe', 'asia', 'oceania']);
    expect(regionOptions(alum.slice(0, 1)).map((o) => o.key)).toEqual(['us']);
  });

  it('sorts unknown divisions last', () => {
    const more = [{ division: 'Zed' }, { division: 'Lowest' }, { division: 'Highest' }];
    expect(divisionOptions(more).map((o) => o.key)).toEqual(['Highest', 'Lowest', 'Zed']);
  });
});

describe('helpers', () => {
  it('toggles values and detects active filters', () => {
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
    expect(hasAnyFilter(EMPTY_FILTERS)).toBe(false);
    expect(hasAnyFilter({ ...EMPTY_FILTERS, regions: ['us'] })).toBe(true);
  });
});
