// Applies db/migrations/*.sql in filename order, once each.
const fs = require('fs');
const path = require('path');
const { connect } = require('./client');

async function main() {
  const client = await connect();
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = new Set((await client.query('SELECT filename FROM schema_migrations')).rows.map(r => r.filename));
  const dir = path.join(__dirname, 'migrations');
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    console.log(`applying ${file}`);
    await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  }
  await client.end();
  console.log('migrations up to date');
}

main().catch(err => { console.error(err); process.exit(1); });
