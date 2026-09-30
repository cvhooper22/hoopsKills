// Client for the production admin API (see ../../../alum-admin-lambda). The
// password is typed into the login gate and only ever held in this tab's
// sessionStorage; it is sent as the Authorization header and checked
// server-side, so nothing here is a secret.
// Under `npm start` the browser talks to the dev server's own /api/admin proxy
// (src/setupProxy.js), which adds the password from .env.local server-side, so no
// login is needed locally. NODE_ENV is a compile-time constant: this branch and the
// gate skip in AdminGate are stripped from production builds, and the proxy doesn't
// exist there, so production always requires the typed password.
export const DEV_PROXY = process.env.NODE_ENV === 'development';
const API_BASE = DEV_PROXY ? '/api/admin' : (process.env.REACT_APP_ADMIN_API_URL || '').replace(/\/+$/, '');
const STORAGE_KEY = 'adminPassword';
const AUTH_LOST_EVENT = 'admin-auth-lost';

export const adminApiConfigured = () => !!API_BASE;

export function getPassword() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setPassword(value) {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, value);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // sessionStorage unavailable (private mode etc.): the gate just asks again on reload.
  }
}

export function onAuthLost(handler) {
  window.addEventListener(AUTH_LOST_EVENT, handler);
  return () => window.removeEventListener(AUTH_LOST_EVENT, handler);
}

// fetch() against the admin API with the password attached. A 401/403 means the
// password is wrong (or was rotated), so it is dropped and the gate re-locks.
// `password` overrides the stored one; the gate uses it to test a new entry.
export async function adminFetch(path, { password, headers, ...options } = {}) {
  if (!API_BASE) throw new Error('REACT_APP_ADMIN_API_URL is not set');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: DEV_PROXY ? headers : { ...headers, Authorization: password ?? getPassword() },
  });
  if (!DEV_PROXY && password === undefined && (res.status === 401 || res.status === 403)) {
    setPassword('');
    window.dispatchEvent(new Event(AUTH_LOST_EVENT));
  }
  return res;
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Unexpected response (${res.status})`);
  }
}

// The editor's source of truth: always fresh from S3 (the public copy can lag by a
// cache TTL). Anything other than a non-empty array is an error, never an empty list,
// so a failed load can't be saved back over the real data.
export async function fetchAlum() {
  const res = await adminFetch('/alum');
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || `Could not load alumni (${res.status})`);
  if (!Array.isArray(data) || !data.length) throw new Error('alum.json in S3 is empty or not a list');
  return data;
}

export async function saveAlum(alumni) {
  const res = await adminFetch('/alum', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alumni),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
  return data;
}

export async function uploadImage({ imageUrl, category, fileName }) {
  const res = await adminFetch('/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, category, fileName }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return data;
}
