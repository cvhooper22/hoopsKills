// Live NCAA capture, dry run: polls one game's play-by-play and prints the parsed plays as they arrive. Database wiring
// (players, game row, live_game_state) isn't hooked up yet; see ingest/espn/live.js for the shape that will take.
//
//   node ingest/ncaa/live.js --id <contestId> [--every 15] [--save-fixture <dir>] [--once] [--verbose]
const fs = require('fs');
const path = require('path');
const { fetchPbp } = require('./fetch');
const { extractHeader } = require('./normalize');
const { toCanonical } = require('./canonical');

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const id = opt('--id');
const everyMs = (Number(opt('--every')) || 15) * 1000;
const saveDir = opt('--save-fixture');
if (!id) { console.error('Give --id <contestId>'); process.exit(1); }
const stamp = () => new Date().toISOString().slice(11, 19);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  let seen = 0, failures = 0;
  for (;;) {
    try {
      const pbp = await fetchPbp(id);
      failures = 0;
      const h = extractHeader(pbp);
      const { plays, unmapped, warnings } = toCanonical(pbp, { isFinal: pbp.status === 'final' });
      if (saveDir) { fs.mkdirSync(saveDir, { recursive: true }); fs.writeFileSync(path.join(saveDir, `${id}.pbp.json`), JSON.stringify(pbp)); }
      if (plays.length !== seen) {
        const fresh = plays.slice(seen);
        console.log(`${stamp()} ${h.away.nameShort} ${h.awayScore} @ ${h.home.nameShort} ${h.homeScore}  P${h.period} ${h.clock}  ${plays.length} plays (+${fresh.length})`);
        if (args.includes('--verbose')) for (const p of fresh) console.log(`   ${p.clock_display} ${p.team_side || '-'} ${p.play_category}${p.is_made != null ? p.is_made ? ' made' : ' miss' : ''} ${p.player ? p.player.name : ''} ${p.away_score_after}-${p.home_score_after}`);
        warnings.forEach(w => console.log('   warning: ' + w));
        if (Object.keys(unmapped).length) console.log('   UNMAPPED:', unmapped);
        seen = plays.length;
      }
      if (h.status === 'final' || args.includes('--once')) break;
    } catch (err) {
      failures++;
      console.error(`${stamp()} cycle failed (${failures}): ${err.message}`);
      if (failures >= 20) { process.exitCode = 1; break; }
    }
    await sleep(everyMs);
  }
}
main();
