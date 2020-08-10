
exports.up = function(knex) {
  return knex.schema.createTable('users', (table) => {
    table.string('guid').unique().notNull();
    table.string('student_id').primary().unique().notNull();
    table.string('barcode').unique().notNull();
    table.integer('times_visited');
    table.timestamp('last_visited');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};
