// Polls the local StatBroadcast simulator and keeps its plays current in Postgres. Long-running; Ctrl-C to stop.
// Test harness only: live games come in through the Chrome extension and receiver.js.
//
//   node ingest/statbroadcast/sim-server.js
//   node ingest/statbroadcast/poll.js --event 610232 --date 2025-02-14 --home byu --away villanova --sim http://localhost:4577
//
// Options: --interval 5 (seconds between polls while plays are arriving), --max-interval 30, --once.
// Point DATABASE_URL at a scratch database when testing so replays don't land in the real dataset.
const { connect } = require('../../db/client');
const { syncSnapshot, titleCaseSlug } = require('./live-store');
const { simFetcher } = require('./fetchers');

const args = process.argv.slice(2);
const opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes(k);
const need = k => opt(k) || (console.error(`missing ${k}`), process.exit(1));

const ctx = {
  eventId: need('--event'), date: need('--date'), homeTeamId: need('--home'), awayTeamId: need('--away'),
  homeName: opt('--home-name', titleCaseSlug(opt('--home') || '')), awayName: opt('--away-name', titleCaseSlug(opt('--away') || '')),
  state: { playerCache: new Map(), gameId: null },
};
const base = Number(opt('--interval', 5)) * 1000;
const maxInterval = Number(opt('--max-interval', 30)) * 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);

async function main() {
  const fetcher = simFetcher(need('--sim'));
  const client = await connect();
  let stopping = false;
  process.on('SIGINT', () => { stopping = true; });

  let wait = base, idle = 0, failures = 0;
  while (!stopping) {
    try {
      const pages = await fetcher.getPeriodPages();
      const r = await syncSnapshot(client, ctx, pages, { boxHtml: await fetcher.getBox() });
      failures = 0;
      if (r.changed) {
        idle = 0; wait = base;
        console.log(`${stamp()} ${r.gameId}: ${r.playCount} plays (+${r.inserted} new, ${r.updated} changed, ${r.deleted} removed)  ` +
          `${r.header.awayName} ${r.header.awayScore ?? '-'} @ ${r.header.homeName} ${r.header.homeScore ?? '-'}  [${r.header.statusText}]`);
        r.warnings.forEach(w => console.log('  warning:', w));
        r.checks.forEach(c => console.log('  CHECK:', c));
        r.unmapped.forEach(u => console.log('  unmapped play:', u));
      } else if (++idle % 6 === 0) {
        wait = Math.min(wait * 2, maxInterval); // quiet (timeout, halftime): back off, reset on the next change
      }
      if (r.header.isFinal) { console.log(`${stamp()} game is final; stopping`); break; }
    } catch (err) {
      failures++;
      console.error(`${stamp()} poll failed (${failures}): ${err.message}`);
      if (ctx.state.gameId) {
        await client.query('UPDATE live_game_state SET consecutive_failures = $2, last_error = $3, last_polled_at = now() WHERE game_id = $1',
          [ctx.state.gameId, failures, err.message]).catch(() => {});
      }
      wait = Math.min(base * 2 ** failures, maxInterval);
    }
    if (flag('--once')) break;
    await sleep(wait);
  }
  await fetcher.close();
  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
