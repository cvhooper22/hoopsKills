import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import urls from '../constants/assetUrls';
import {
  FLAGS,
  FLAGS_FETCH_TIMEOUT_MS,
  OVERRIDES_QUERY_PARAM,
  OVERRIDES_STORAGE_KEY,
} from '../constants/featureFlags';
import { applyOverrideParam, parseOverrides, resolveAllFlags } from '../utils/featureFlags';
import { getStorageItem, setStorageItem, removeStorageItem } from '../utils/localStorage';

const OFF = Object.keys(FLAGS).reduce((acc, name) => ({ ...acc, [name]: false }), {});
export const FeatureFlagsContext = createContext(OFF);

// Reads ?ff= once, folds it into the stored overrides and persists the result.
function loadOverrides () {
  const stored = parseOverrides(getStorageItem(OVERRIDES_STORAGE_KEY));
  const param = new URLSearchParams(window.location.search).get(OVERRIDES_QUERY_PARAM);
  const next = applyOverrideParam(stored, param);
  if (next !== stored) {
    if (Object.keys(next).length) setStorageItem(OVERRIDES_STORAGE_KEY, JSON.stringify(next));
    else removeStorageItem(OVERRIDES_STORAGE_KEY);
  }
  return next;
}

export function FeatureFlagsProvider ({ children }) {
  const [overrides] = useState(loadOverrides);
  const [remote, setRemote] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FLAGS_FETCH_TIMEOUT_MS);
    fetch(urls.flags(), { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setRemote(json && typeof json === 'object' ? json : null))
      .catch(() => {}) // fail closed: fall through to env, then off
      .finally(() => clearTimeout(timer));
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const flags = useMemo(
    () => resolveAllFlags({ overrides, remote, env: process.env }),
    [overrides, remote]
  );

  return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>;
}

export function useFlag (name) {
  return Boolean(useContext(FeatureFlagsContext)[name]);
}
