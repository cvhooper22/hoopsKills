import { applyOverrideParam, parseOverrides, resolveFlag } from './featureFlags';

const ENV = 'REACT_APP_FF_COLLECTION';

describe('resolveFlag', () => {
  it('is off with no sources', () => {
    expect(resolveFlag('collection')).toBe(false);
  });

  it('is off for unknown flags', () => {
    expect(resolveFlag('nope', { overrides: { nope: true } })).toBe(false);
  });

  it('reads the build-time env var', () => {
    expect(resolveFlag('collection', { env: { [ENV]: 'true' } })).toBe(true);
    expect(resolveFlag('collection', { env: { [ENV]: '' } })).toBe(false);
  });

  it('runtime flags.json beats env', () => {
    expect(resolveFlag('collection', { remote: { collection: false }, env: { [ENV]: 'true' } })).toBe(false);
    expect(resolveFlag('collection', { remote: { collection: true } })).toBe(true);
  });

  it('personal override beats everything', () => {
    const sources = { overrides: { collection: true }, remote: { collection: false }, env: {} };
    expect(resolveFlag('collection', sources)).toBe(true);
    expect(resolveFlag('collection', { ...sources, overrides: { collection: false }, remote: { collection: true } })).toBe(false);
  });

  it('ignores non-boolean remote values and a failed fetch', () => {
    expect(resolveFlag('collection', { remote: { collection: 'yes' }, env: { [ENV]: 'true' } })).toBe(true);
    expect(resolveFlag('collection', { remote: null })).toBe(false);
  });
});

describe('applyOverrideParam', () => {
  it('turns flags on, off, and clears', () => {
    expect(applyOverrideParam({}, 'collection')).toEqual({ collection: true });
    expect(applyOverrideParam({ collection: true }, '-collection')).toEqual({ collection: false });
    expect(applyOverrideParam({ collection: true }, 'clear')).toEqual({});
  });

  it('ignores unknown names and a missing param', () => {
    const current = { collection: true };
    expect(applyOverrideParam(current, 'bogus')).toEqual({ collection: true });
    expect(applyOverrideParam(current, null)).toBe(current);
  });
});

describe('parseOverrides', () => {
  it('tolerates junk', () => {
    expect(parseOverrides(null)).toEqual({});
    expect(parseOverrides('not json')).toEqual({});
    expect(parseOverrides('[1]')).toEqual({});
    expect(parseOverrides('{"collection":true}')).toEqual({ collection: true });
  });
});
