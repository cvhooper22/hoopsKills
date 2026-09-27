// Run the kill detector on the exported games and compare it with the hand-marked
// stops saved from /admin/stops.
const fs = require('fs');
const path = require('path');
const { detectKills } = require('./kills');

const dataDir = path.join(__dirname, '../../stat_explorer/public/data');
// Games in public/data, with the side BYU is on (BYU's stops are the ones tracked).
const GAMES = [
  ['2025-11-03-villanova-at-byu', 'home'],
  ['2025-11-28-byu-at-dayton', 'away'],
  ['2026-01-03-byu-at-kansas-st', 'away'],
];

function check(gameId, side, playsPath, marksPath) {
  console.log(`\n== ${gameId} (BYU ${side})`);
  const plays = JSON.parse(fs.readFileSync(playsPath, 'utf8'));
  const result = detectKills(plays, side);
  const pct = result.completion === null ? 'n/a' : `${(result.completion * 100).toFixed(0)}%`;
  console.log(`${result.stops.length} stops, ${result.kills.length} kills (${result.kills.filter((k) => k.dirty).length} dirty), ${result.potentialKills.length} potential kills, completion ${pct}`);
  result.kills.forEach((k) => {
    console.log(`  kill ${k.stops.join(',')} ${k.dirty ? 'dirty' : 'pure'} start ${k.start.period}H ${k.start.clock} ${k.start.margin >= 0 ? '+' : ''}${k.start.margin}${k.critical ? ' critical' : ''}${k.clutch !== 'none' ? ` ${k.clutch}` : ''}${k.garbage ? ' garbage' : ''}`);
  });

  if (!fs.existsSync(marksPath)) { console.log('no hand marks saved for this game'); return; }
  const marked = new Set(JSON.parse(fs.readFileSync(marksPath, 'utf8')).plays.filter((p) => p.stop).map((p) => p.sequence_number));
  // A turnover + steal pair is one stop, marked on either play.
  const found = new Set();
  const extra = [];
  result.stops.forEach((s) => {
    const hit = s.seqs.filter((q) => marked.has(q));
    if (hit.length) hit.forEach((q) => found.add(q)); else extra.push(s.seq);
  });
  const missing = [...marked].filter((q) => !found.has(q));
  console.log(`vs hand marks: ${found.size}/${marked.size} matched, ${missing.length} missing [${missing}], ${extra.length} extra [${extra}]`);
}

// With no arguments, checks every game. Otherwise:
//   node derivations/check-kills.js <plays.json> <marked_stops.json> <home|away>
const [playsArg, marksArg, sideArg] = process.argv.slice(2);
if (playsArg) {
  check(path.basename(playsArg), sideArg || 'home', playsArg, marksArg || '');
} else {
  GAMES.forEach(([id, side]) => check(id, side, path.join(dataDir, `${id}.json`), path.join(dataDir, 'stops', `${id}.json`)));
}
