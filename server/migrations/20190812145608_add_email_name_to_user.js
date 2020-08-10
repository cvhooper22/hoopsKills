
exports.up = function(knex) {
  return knex.schema.table('users', (table) => {
    table.string('email');
    table.string('name');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', (table) => {
    table.dropColumn('email');
    table.dropColumn('name');
  });
};
