// Parse saved StatBroadcast period pages and print the normalized game as JSON (no database).
//   node ingest/statbroadcast/parse-file.js byuvillanovah1.html byuvillanovah2.html [--out game.json] [--game-id ID]
const fs = require('fs');
const { normalizeGame } = require('./parse');

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i === -1 ? null : args.splice(i, 2)[1]; };
const out = opt('--out');
const gameId = opt('--game-id');
if (!args.length) { console.error('usage: parse-file.js <period.html>... [--out file] [--game-id id]'); process.exit(1); }

const game = normalizeGame(args.map(f => fs.readFileSync(f, 'utf8')), { gameId });
const { header, plays, participants, warnings, unmapped, checks } = game;
const count = (arr, f) => arr.reduce((m, x) => (m[f(x)] = (m[f(x)] || 0) + 1, m), {});

console.error(`${header.awayName} ${header.awayScore} @ ${header.homeName} ${header.homeScore} (${header.statusText}), periods ${header.periods.join(',')}`);
console.error(`${plays.length} plays, ${participants.length} participants`, count(plays, p => p.play_category));
for (const [label, list] of [['unmapped', unmapped], ['warnings', warnings], ['CHECK FAILURES', checks]])
  if (list.length) console.error(`${label}:\n  ${list.join('\n  ')}`);

const json = JSON.stringify(game, null, 2);
if (out) fs.writeFileSync(out, json); else console.log(json);
process.exit(checks.length ? 2 : 0);
