import { FLAGS } from '../constants/featureFlags';

const TRUTHY = ['true', '1', 'on'];

function parseEnv (raw) {
  if (raw === undefined || raw === '') return undefined;
  return TRUTHY.includes(String(raw).toLowerCase());
}

// Applies a `?ff=` query value to the stored overrides. Comma separated:
//   name -> on, -name -> off, clear -> drop every override. Unknown names are ignored.
export function applyOverrideParam (current, param) {
  if (!param) return current;
  let next = { ...current };
  param.split(',').map((s) => s.trim()).filter(Boolean).forEach((token) => {
    if (token === 'clear') {
      next = {};
      return;
    }
    const off = token.startsWith('-');
    const name = off ? token.slice(1) : token;
    if (FLAGS[name]) next[name] = !off;
  });
  return next;
}

export function parseOverrides (raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Pure resolution of one flag. `remote` is the parsed flags.json (or null while it
// loads / if it failed - failing closed just means falling through to env, then off).
export function resolveFlag (name, { overrides = {}, remote = null, env = {} } = {}) {
  const flag = FLAGS[name];
  if (!flag) return false;
  if (typeof overrides[name] === 'boolean') return overrides[name];
  if (remote && typeof remote[name] === 'boolean') return remote[name];
  const fromEnv = parseEnv(env[flag.envVar]);
  if (fromEnv !== undefined) return fromEnv;
  return false;
}

export function resolveAllFlags (sources) {
  return Object.keys(FLAGS).reduce((acc, name) => {
    acc[name] = resolveFlag(name, sources);
    return acc;
  }, {});
}
