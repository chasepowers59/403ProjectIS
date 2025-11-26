/**
 * Migration: Create slack_messages table
 * Stores parsed messages from Slack export ZIP files
 */

exports.up = function (knex) {
    return knex.schema.createTable('slack_messages', function (table) {
        table.increments('id').primary();
        table.string('channel').notNullable().index();
        table.string('user').notNullable();
        table.string('msg_timestamp').notNullable().index();
        table.text('text').notNullable();
        table.string('upload_batch').notNullable().index();
        table.timestamps(true, true);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('slack_messages');
};
