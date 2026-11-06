// node --test ingest/rankings/rankings.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parseTimeMachine } = require('./torvik');
const { parseNet } = require('./net');
const { baseKey, keyIndex, matchTeam, loadCanonical, loadSynonyms } = require('./lib/names');
const { parseKenPom } = require('./kenpom');
const { parseEvanMiya } = require('./evanmiya');
const { parseHaslam } = require('./haslam');

const fx = (f) => path.join(__dirname, '../../fixtures/rankings', f);

test('torvik: columns, WAB, and through-date = the file date', () => {
  const raw = JSON.parse(fs.readFileSync(fx('torvik-20260115.json'), 'utf8'));
  const p = parseTimeMachine(raw, '2026-01-15');
  assert.strictEqual(p.throughDate, '2026-01-15');
  const byu = p.rows.find((r) => r.name === 'BYU');
  assert.strictEqual(byu.record, '16-1');
  assert.strictEqual(byu.overall.rank, 18);
  assert.ok(byu.off.rating > 120 && byu.def.rating < 100);
  assert.strictEqual(byu.metrics.wab, 4.489580560466305);
  assert.strictEqual(byu.metrics.wab_rank, 10);
  assert.ok(Math.abs(byu.metrics.adjem - (byu.off.rating - byu.def.rating)) < 0.01);
});

test('torvik: a changed layout fails loudly instead of misreading columns', () => {
  assert.throws(() => parseTimeMachine([[1, 'X', 'B12']], '2026-01-15'), /unexpected layout/);
});

test('net: rows, quads, and the "Through Games" stamp', () => {
  const p = parseNet(fs.readFileSync(fx('net-sample.html'), 'utf8'));
  assert.strictEqual(p.throughDate, '2026-04-06');
  const mich = p.rows.find((r) => r.name === 'Michigan');
  assert.deepStrictEqual([mich.overall.rank, mich.record, mich.metrics.quad1, mich.metrics.prev_rank], [1, '37-3', '21-3', 2]);
  assert.ok(p.rows.length >= 10);
});

// Matching runs against the real canonical list and synonyms, so a spelling a collector had to map stays mapped.
const canonical = loadCanonical();
const byKey = keyIndex(canonical);
const synonyms = loadSynonyms();
const match = (name) => matchTeam(name, { byKey, synonyms });

test('canonical list: every synonym points at a real team, no two teams share a name key', () => {
  for (const [alias, id] of Object.entries(synonyms)) assert.ok(canonical[id], `synonym "${alias}" -> unknown team ${id}`);
  assert.ok(Object.keys(canonical).length >= 360);
  assert.strictEqual(canonical.byu.name, 'BYU');
});

test('team names: spellings of one team match the same canonical team', () => {
  const same = [['Kansas St.', 'Kansas State', 'kansas-st'], ['Miami (FL)', 'Miami FL', 'miami-fl'], ['N.C. State', 'NC State', 'nc-state'],
    ['Fla. Atlantic', 'Florida Atlantic', 'florida-atlantic'], ['Ole Miss', 'Mississippi', 'mississippi'], ['App State', 'Appalachian St.', 'appalachian-st'],
    ['UConn', 'Connecticut', 'uconn'], ['FGCU', 'Florida Gulf Coast', 'florida-gulf-coast'], ['Coast. Carolina', 'Coastal Carolina', 'coastal-carolina'],
    ["St. John's (NY)", "St. John's", 'st-johns']];
  for (const [a, b, id] of same) { assert.strictEqual(match(a), id, a); assert.strictEqual(match(b), id, b); }
  assert.notStrictEqual(match('Miami (FL)'), match('Miami (OH)'));
  assert.strictEqual(match('Totally Made Up U'), null);
});

test('ids line up with the games teams: BYU, UConn, Eastern Wash.', () => {
  assert.strictEqual(match('BYU'), 'byu');
  assert.strictEqual(match('UConn'), 'uconn');
  assert.strictEqual(match('Eastern Wash.'), 'eastern-wash');
});

test('plain keys: abbreviation expansion does not rewrite a team that spells the word out', () => {
  assert.strictEqual(baseKey('Florida Gulf Coast'), 'florida gulf coast');
  assert.strictEqual(baseKey('Kansas St.'), baseKey('Kansas State'));
});

test('kenpom: columns and ranks', () => {
  const p = parseKenPom(JSON.parse(fs.readFileSync(fx('kenpom-rows.json'), 'utf8')), '2026-10-19');
  const byu = p.rows.find((r) => r.name === 'BYU');
  assert.deepStrictEqual([byu.overall.rank, byu.overall.rating, byu.off.rank, byu.off.rating, byu.def.rank, byu.def.rating], [33, 20.75, 11, 120.6, 70, 99.9]);
  assert.strictEqual(p.throughDate, '2026-10-18');   // pulled the 19th, games through the 18th
  assert.throws(() => parseKenPom([['1', 'x']], '2026-10-19'), /unexpected table layout/);
});

test('evanmiya: offense + defense = relative rating, direction is higher-is-better', () => {
  const p = parseEvanMiya(JSON.parse(fs.readFileSync(fx('evanmiya-rows.json'), 'utf8')), '2026-10-19');
  const byu = p.rows.find((r) => r.name === 'BYU');
  assert.ok(Math.abs(byu.off.rating + byu.def.rating - byu.overall.rating) < 0.11);
  assert.strictEqual(byu.overall.rank, 25);
});

test('haslam: preseason stamp, computed off/def ranks', () => {
  const mk = (id, name, oe, de, rk) => `<mr rk="${rk}" t="${name}" c="X" id="${id}" oe="${oe}" de="${de}" ou="70" du="70" sos="-999" w="0" l="0" />`;
  const teams = Array.from({ length: 300 }, (_, i) => mk(i, `T${i}`, 100 + i, 100 - i / 10, i + 1)).join('\n');
  const xml = `<mydata>${teams}<dt md="10/31/1974" /></mydata>`;
  const p = parseHaslam(xml, '2026-10-19');
  assert.strictEqual(p.throughDate, '2026-10-19');
  const t299 = p.rows.find((r) => r.name === 'T299');
  assert.deepStrictEqual([t299.off.rank, t299.def.rank], [1, 1]);   // highest oe, lowest de
  assert.strictEqual(parseHaslam(xml.replace('10/31/1974', '3/16/2026'), '2026-10-19').throughDate, '2026-03-16');
});

test('haslam: written-out date in <dt>', () => {
  const teams = Array.from({ length: 300 }, (_, i) => `<mr t="T${i}" c="X" w="0" l="0" rk="${i + 1}" oe="100" de="100" />`).join('');
  const r = parseHaslam(`<mydata>${teams}<dt md="November 1, 2026" /></mydata>`, '2026-11-02');
  assert.equal(r.throughDate, '2026-11-01');
});

test('haslam: off/def come from the component fields the site uses, not the xml oe / de', () => {
  // site OE = ftpct*oftar/100 + 2*(ofgmr - otpmr) + 3*otpmr; DE the same on the d* fields
  const mk = (i, ftpct, oftar, ofgmr, otpmr, oe) => `<mr t="T${i}" c="X" id="${i}" w="0" l="0" rk="${i}" oe="${oe}" de="100" ftpct="${ftpct}" oftar="${oftar}" ofgmr="${ofgmr}" otpmr="${otpmr}" dftpct="70" dftar="20" dfgmr="40" dtpmr="10" />`;
  const teams = Array.from({ length: 299 }, (_, i) => mk(i + 1, 70, 20, 40, 10, 120)).join('') + mk(300, 76, 30, 44, 13, 100);
  const p = parseHaslam(`<mydata>${teams}<dt md="3/16/2026" /></mydata>`, '2026-03-17');
  const t = p.rows.find((r) => r.name === 'T300');
  assert.ok(Math.abs(t.off.rating - (76 * 30 / 100 + 2 * (44 - 13) + 3 * 13)) < 1e-9);   // 123.8, though the xml oe says 100
  assert.strictEqual(t.off.rank, 1);   // 123.8 vs 14 + 60 + 30 = 104 for the rest, so first on the recomputed number only
  assert.strictEqual(t.metrics.xml_oe, 100);
});
