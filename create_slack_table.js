/**
 * Manually create slack_messages table
 */

const knex = require('knex')(require('./knexfile').development);

async function createTable() {
    try {
        const exists = await knex.schema.hasTable('slack_messages');

        if (exists) {
            console.log('✅ slack_messages table already exists');
            process.exit(0);
        }

        await knex.schema.createTable('slack_messages', function (table) {
            table.increments('id').primary();
            table.string('channel').notNullable().index();
            table.string('user').notNullable();
            table.string('msg_timestamp').notNullable().index();
            table.text('text').notNullable();
            table.string('upload_batch').notNullable().index();
            table.timestamps(true, true);
        });

        console.log('✅ Created slack_messages table successfully');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error creating table:', error);
        process.exit(1);
    }
}

createTable();
