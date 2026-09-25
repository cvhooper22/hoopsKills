const { Client } = require('pg');

const DEFAULT_URL = 'postgres://postgres:postgres@localhost:5544/pbp';

async function connect() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || DEFAULT_URL });
  await client.connect();
  return client;
}

module.exports = { connect };
