// Status, ingest, build and deploy for per-game S3 files (see ../lib/game-pipeline.js). This is what the
// admin page /admin/games runs; it works from a terminal too.
//   node ingest/tools/game-pipeline.js status                         one JSON line: every game and what is deployed
//   node ingest/tools/game-pipeline.js ingest --wmt <id> | --url <athletics box score url> | --espn <id>
//   node ingest/tools/game-pipeline.js build <gameId> [--steps plays,meta,kills,clutch,lineups,box]
//   node ingest/tools/game-pipeline.js deploy <gameId> [<gameId> ...]  upload staged files, indexes, then season rollups
//   node ingest/tools/game-pipeline.js rollups <season> [...]          rebuild + upload only the season rollups
// Built files go to a stage directory laid out like the S3 keys (HOOPS_STAGE_DIR, default <tmp>/hoops-stage).
const { connect } = require('../../db/client');
const P = require('../lib/game-pipeline');

const log = (line) => console.log(line);
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(name); return i === -1 ? null : rest[i + 1]; };
const positional = () => rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));

async function main() {
  if (cmd === 'ingest') {
    if (flag('--url') || flag('--wmt')) {
      await P.run(['ingest/wmt/ingest.js', ...(flag('--url') ? ['--url', flag('--url')] : ['--id', flag('--wmt')])], { log });
    } else if (flag('--espn')) {
      await P.run(['ingest/espn/ingest.js', '--id', flag('--espn')], { log });
    } else throw new Error('ingest needs --wmt <id>, --url <box score url> or --espn <id>');
    return;
  }
  if (cmd === 'build') {
    const [gameId] = positional();
    if (!gameId) throw new Error('build needs a game id');
    await P.buildGame(gameId, flag('--steps') ? flag('--steps').split(',') : P.STEPS, log);
    return;
  }
  if (cmd === 'rollups') {
    const seasons = positional();
    if (!seasons.length) throw new Error('rollups needs at least one season year');
    await P.buildShared(log);
    await P.rollups(seasons, log);
    return;
  }
  const client = await connect();
  try {
    if (cmd === 'status') console.log(JSON.stringify(await P.status(client)));
    else if (cmd === 'deploy') {
      const ids = positional();
      if (!ids.length) throw new Error('deploy needs at least one game id');
      await P.deploy(client, ids, log);
    } else throw new Error('usage: game-pipeline.js status | ingest | build <gameId> | deploy <gameId...> | rollups <season...>');
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
