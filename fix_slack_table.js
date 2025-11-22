/**
 * Drop and recreate slack_messages table with correct schema
 */

const knex = require('knex')(require('./knexfile').development);

async function recreateTable() {
    try {
        // Drop table if exists
        await knex.schema.dropTableIfExists('slack_messages');
        console.log('✅ Dropped slack_messages table');

        // Create with correct schema
        await knex.schema.createTable('slack_messages', function (table) {
            table.increments('id').primary();
            table.string('channel').notNullable().index();
            table.string('user').notNullable();
            table.string('msg_timestamp').notNullable().index();
            table.text('text').notNullable();
            table.string('upload_batch').notNullable().index();
            table.timestamps(true, true);
        });

        console.log('✅ Created slack_messages table with msg_timestamp column');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

recreateTable();
