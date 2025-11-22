/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const hasSource = await knex.schema.hasColumn('events', 'source_channel');
    const hasStatus = await knex.schema.hasColumn('events', 'status');

    if (!hasSource || !hasStatus) {
        return knex.schema.table('events', function (table) {
            if (!hasSource) table.string('source_channel');
            if (!hasStatus) table.string('status').defaultTo('pending');
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('events', function (table) {
        table.dropColumn('source_channel');
        table.dropColumn('status');
    });
};
