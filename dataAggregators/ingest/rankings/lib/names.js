// Team-name matching across rating systems. Each site spells teams its own way ("Kansas St.", "Kansas State",
// "Miami (FL)", "Miami FL"), so names are reduced to a comparable key (baseKey). Matching works against this app's own
// canonical team list (config/rating-teams.json: id -> name), not against any one site's spelling. Spellings the
// reduction can't unify go in config/rating-team-synonyms.json (name key -> canonical team id).
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', '..', '..', 'config');
const CANONICAL_FILE = path.join(CONFIG_DIR, 'rating-teams.json');
const SYNONYMS_FILE = path.join(CONFIG_DIR, 'rating-team-synonyms.json');
// Abbreviations the NCAA and other sites use for words that Torvik spells out, expanded one token at a time.
const TOKEN_MAP = {
  wash: 'washington', mich: 'michigan', univ: '', university: '', of: '', the: '', mt: 'mount', ft: 'fort',
  fla: 'florida', ky: 'kentucky', colo: 'colorado', ill: 'illinois', ind: 'indiana', ga: 'georgia', tenn: 'tennessee',
  ala: 'alabama', ark: 'arkansas', conn: 'connecticut', caro: 'carolina', mo: 'missouri', ariz: 'arizona', val: 'valley',
  mass: 'massachusetts', nc: 'north carolina', la: 'louisiana', cent: 'central', abil: 'abilene', ar: 'arkansas', so: 'southern',
};
// Direction abbreviations are ambiguous ("N. Arizona" is Northern, "N. Dakota St." is North), so a leading one yields several keys.
const DIRECTION = { n: ['northern', 'north'], s: ['southern', 'south'], e: ['eastern', 'east'], w: ['western', 'west'], se: ['southeastern', 'southeast'], sw: ['southwestern', 'southwest'], ne: ['northeastern', 'northeast'], nw: ['northwestern', 'northwest'] };
// "(NY)", "(CA)" ... only disambiguate a school on some sites; "(FL)" / "(OH)" are part of Miami's name everywhere.
const DROP_PAREN = /\((?:NY|CA|MN|NC)\)/gi;

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
const withoutComments = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

/** name key -> canonical team id */
function loadSynonyms(file = SYNONYMS_FILE) { return withoutComments(readJson(file)); }
/** team id -> { name } */
function loadCanonical(file = CANONICAL_FILE) { return withoutComments(readJson(file)); }

// Both config files keep their "_comment" entries when rewritten.
function saveJson(file, map) {
  const comments = Object.fromEntries(Object.entries(readJson(file)).filter(([k]) => k.startsWith('_')));
  fs.writeFileSync(file, JSON.stringify({ ...comments, ...map }, null, 2) + '\n');
}
const saveSynonyms = (map, file = SYNONYMS_FILE) => saveJson(file, map);
// one team per line, so the list reads (and diffs) like a table
function saveCanonical(map, file = CANONICAL_FILE) {
  const comments = Object.entries(readJson(file)).filter(([k]) => k.startsWith('_'));
  const lines = [...comments.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`),
    ...Object.entries(map).map(([id, t]) => `  ${JSON.stringify(id)}: ${JSON.stringify(t)}`)];
  fs.writeFileSync(file, `{\n${lines.join(',\n')}\n}\n`);
}

function baseKey(name) {
  const tokens = String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(DROP_PAREN, ' ')
    .replace(/&/g, ' and ')
    .replace(/[.']/g, '')            // N.C. State -> nc state, St. John's -> st johns
    .replace(/[^a-z0-9]+/g, ' ')
    .trim().split(/\s+/).filter(Boolean);
  const out = tokens.map((t, i) => {
    if (t === 'st') return i === 0 ? 'saint' : 'state';   // "St. John's" is Saint, "Kansas St." is State
    if (t === 'la' && i === 0) return 'la';                // a leading "La." is not "Louisiana" (La Salle)
    return t in TOKEN_MAP ? TOKEN_MAP[t] : t;
  }).filter(Boolean);
  return out.join(' ');
}

/** Every key a name could plausibly mean (see DIRECTION); the first is its plain key. */
function candidateKeys(name) {
  const base = baseKey(name);
  const first = base.split(' ')[0];
  const keys = new Set([base]);
  if (DIRECTION[first]) for (const d of DIRECTION[first]) keys.add([d, ...base.split(' ').slice(1)].join(' '));
  // a leading "Miss." is Mississippi (Miss. Valley St.), while "Southern Miss" keeps its Miss
  if (first === 'miss' && base.split(' ').length > 1) keys.add(['mississippi', ...base.split(' ').slice(1)].join(' '));
  return [...keys];
}

/** canonical ({id: {name}}) -> Map(key -> id). Two teams sharing a key would make matching ambiguous, so that throws. */
function keyIndex(canonical) {
  const byKey = new Map();
  for (const [id, t] of Object.entries(canonical)) {
    const k = baseKey(t.name);
    if (byKey.has(k) && byKey.get(k) !== id) throw new Error(`canonical teams ${byKey.get(k)} and ${id} both reduce to the name key "${k}"`);
    byKey.set(k, id);
  }
  return byKey;
}

/** The canonical team id a site's spelling means, or null. An explicit synonym wins over a name match. */
function matchTeam(name, { byKey, synonyms }) {
  for (const k of candidateKeys(name)) {
    if (synonyms[k]) return synonyms[k];
    if (byKey.has(k)) return byKey.get(k);
  }
  return null;
}

module.exports = { baseKey, candidateKeys, keyIndex, matchTeam, loadSynonyms, saveSynonyms, loadCanonical, saveCanonical, SYNONYMS_FILE, CANONICAL_FILE };
