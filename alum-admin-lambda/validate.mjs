// Validation for the alumni array written by the admin editor. The public
// Alumni page renders these values (including as href/src), so this is the
// last line of defence against a bad or malicious write: whitelisted keys
// only, length caps, and safe URL schemes.

export const MAX_BODY_BYTES = 300 * 1024;
export const MAX_ALUMNI = 500;

const STATUSES = ['updateSoon', 'injured', 'retired', 'unsigned'];
const SOCIAL_KEYS = ['twitter', 'instagram', 'youtube', 'facebook'];
const TOP_LEVEL_KEYS = new Set([
  'name', 'nameAccent', 'years', 'inactive', 'statuses', 'country', 'countryCode', 'team',
  'position', 'teamLogo', 'league', 'division', 'teamSocial', 'recentTweetsUrl', 'playerUrl',
  'recentGamesUrl', 'teamWebsite', 'coverPhoto', 'notes',
]);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function checkString(errors, where, value, max, { required = false } = {}) {
  if (typeof value !== 'string') {
    errors.push(`${where} must be a string`);
    return;
  }
  if (required && !value.trim()) errors.push(`${where} is required`);
  if (value.length > max) errors.push(`${where} is too long (max ${max})`);
}

// Empty is allowed (unset optional links). Links may be http or https (some team
// sites are still http-only); images must be https. Every other scheme, notably
// javascript: and data:, is rejected since the public page renders these as href/src.
function checkUrl(errors, where, value, { httpsOnly = false } = {}) {
  if (typeof value !== 'string') {
    errors.push(`${where} must be a string`);
    return;
  }
  if (value === '') return;
  if (value.length > 2000) {
    errors.push(`${where} is too long`);
    return;
  }
  try {
    const { protocol } = new URL(value);
    const ok = httpsOnly ? protocol === 'https:' : protocol === 'https:' || protocol === 'http:';
    if (!ok) errors.push(`${where} must be an ${httpsOnly ? 'https' : 'http or https'} URL`);
  } catch {
    errors.push(`${where} is not a valid URL`);
  }
}

function checkImage(errors, where, value) {
  if (!isPlainObject(value)) {
    errors.push(`${where} must be an object`);
    return;
  }
  Object.keys(value).forEach((k) => {
    if (k !== 'url' && k !== 'style') errors.push(`${where}.${k} is not allowed`);
  });
  checkUrl(errors, `${where}.url`, value.url ?? '', { httpsOnly: true });
  if (value.style !== undefined) {
    if (!isPlainObject(value.style)) {
      errors.push(`${where}.style must be an object`);
    } else {
      Object.entries(value.style).forEach(([k, v]) => {
        if (k.length > 40 || !/^[a-zA-Z]+$/.test(k)) errors.push(`${where}.style key "${k}" is invalid`);
        if (typeof v === 'string' ? v.length > 200 : typeof v !== 'number') {
          errors.push(`${where}.style.${k} must be a short string or number`);
        }
      });
    }
  }
}

export function validateAlumni(data) {
  const errors = [];
  if (!Array.isArray(data)) return ['Expected an array of alumni'];
  if (data.length > MAX_ALUMNI) return [`Too many alumni (max ${MAX_ALUMNI})`];

  const names = new Set();
  data.forEach((a, i) => {
    const label = isPlainObject(a) && typeof a.name === 'string' && a.name ? a.name : `#${i + 1}`;
    const at = (field) => `${label}: ${field}`;
    if (!isPlainObject(a)) {
      errors.push(`${label}: must be an object`);
      return;
    }

    Object.keys(a).forEach((k) => {
      if (!TOP_LEVEL_KEYS.has(k)) errors.push(at(`unknown field "${k}"`));
    });

    checkString(errors, at('name'), a.name, 100, { required: true });
    if (typeof a.name === 'string') {
      if (names.has(a.name)) errors.push(at('duplicate name'));
      names.add(a.name);
    }

    ['nameAccent', 'inactive'].forEach((k) => {
      if (a[k] !== undefined && typeof a[k] !== 'boolean') errors.push(at(`${k} must be true/false`));
    });
    if (a.years !== undefined) checkString(errors, at('years'), a.years, 40);
    ['country', 'team', 'position', 'league', 'division'].forEach((k) => {
      if (a[k] !== undefined) checkString(errors, at(k), a[k], 100);
    });
    if (a.countryCode !== undefined && !(typeof a.countryCode === 'string' && (a.countryCode === '' || /^[a-z]{2}$/.test(a.countryCode)))) {
      errors.push(at('countryCode must be a 2-letter lowercase code'));
    }

    if (a.statuses !== undefined) {
      if (!Array.isArray(a.statuses) || a.statuses.some((s) => !STATUSES.includes(s))) {
        errors.push(at(`statuses must be a list of: ${STATUSES.join(', ')}`));
      }
    }

    if (a.teamLogo !== undefined) checkImage(errors, at('teamLogo'), a.teamLogo);
    if (a.coverPhoto !== undefined) checkImage(errors, at('coverPhoto'), a.coverPhoto);

    if (a.teamSocial !== undefined) {
      if (!isPlainObject(a.teamSocial)) {
        errors.push(at('teamSocial must be an object'));
      } else {
        Object.entries(a.teamSocial).forEach(([k, v]) => {
          if (!SOCIAL_KEYS.includes(k)) errors.push(at(`teamSocial.${k} is not allowed`));
          else checkUrl(errors, at(`teamSocial.${k}`), v);
        });
      }
    }

    ['recentTweetsUrl', 'playerUrl', 'recentGamesUrl', 'teamWebsite'].forEach((k) => {
      if (a[k] !== undefined) checkUrl(errors, at(k), a[k]);
    });

    if (a.notes !== undefined) {
      if (!Array.isArray(a.notes) || a.notes.length > 20) {
        errors.push(at('notes must be a list of up to 20 strings'));
      } else {
        a.notes.forEach((n, j) => checkString(errors, at(`notes[${j}]`), n, 2000));
      }
    }
  });

  return errors.slice(0, 20);
}
