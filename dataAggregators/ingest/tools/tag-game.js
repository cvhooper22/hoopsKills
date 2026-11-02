// Hand-entered game tags (game_tags). The one the pipeline reads today is `exhibition`: those games stay in the database
// and the games index (flagged isExhibition) but are left out of season aggregations and of the ratings record check.
//   node ingest/tools/tag-game.js <gameId> <tag> [value]        add (or update) a tag
//   node ingest/tools/tag-game.js <gameId> <tag> --remove       remove it
//   node ingest/tools/tag-game.js <gameId>                      list the game's tags
const { connect } = require('../../db/client');

async function main() {
  const [gameId, tag, ...rest] = process.argv.slice(2);
  if (!gameId) { console.error('usage: tag-game.js <gameId> [<tag> [value] | <tag> --remove]'); process.exit(1); }
  const client = await connect();
  try {
    const { rows: [g] } = await client.query('SELECT game_id FROM games WHERE game_id = $1', [gameId]);
    if (!g) throw new Error(`no game ${gameId}`);
    if (tag && rest.includes('--remove')) {
      const r = await client.query('DELETE FROM game_tags WHERE game_id = $1 AND tag = $2', [gameId, tag]);
      console.log(r.rowCount ? `removed ${tag} from ${gameId}` : `${gameId} had no ${tag} tag`);
    } else if (tag) {
      await client.query(
        `INSERT INTO game_tags (game_id, tag, value) VALUES ($1, $2, $3) ON CONFLICT (game_id, tag) DO UPDATE SET value = EXCLUDED.value`,
        [gameId, tag, rest[0] || '']);
      console.log(`${gameId}: ${tag}${rest[0] ? ` = ${rest[0]}` : ''}`);
    }
    const { rows } = await client.query('SELECT tag, value FROM game_tags WHERE game_id = $1 ORDER BY tag', [gameId]);
    console.log('tags:', rows.length ? rows.map((r) => (r.value ? `${r.tag}=${r.value}` : r.tag)).join(', ') : '(none)');
  } finally {
    await client.end();
  }
}
main().catch((err) => { console.error(err.message); process.exit(1); });
