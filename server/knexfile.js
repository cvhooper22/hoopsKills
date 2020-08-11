module.exports = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL || { user: 'byuticketing', database: 'byu_roc_pass' }
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL
  }
};
