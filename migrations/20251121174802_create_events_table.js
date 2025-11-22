/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('events', function (table) {
        table.increments('id');
        table.string('title').notNullable();
        table.datetime('start_date').notNullable();
        table.string('source_channel');
        table.string('status').defaultTo('pending');
        table.timestamps(true, true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('events');
};
