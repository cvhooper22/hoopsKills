// Loads the app's stat_explorer/.env.local into process.env for the ingest scripts (values already in the
// environment win). The file is written for the app's loader (dotenv + dotenv-expand), so values are read the
// same way here: surrounding quotes are dropped and `\$` is an escaped dollar sign, in any quote style
// (the admin password has one).
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '../../../stat_explorer/.env.local');

function parseValue(raw) {
  const value = /^(['"]).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
  return value.replace(/\\\$/g, '$');
}

function loadEnv(file = ENV_FILE) {
  fs.readFileSync(file, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = parseValue(m[2].trim());
  });
}

module.exports = { loadEnv, parseValue };
