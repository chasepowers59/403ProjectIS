require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

async function createEventsTable() {
    try {
        const exists = await knex.schema.hasTable('events');
        if (!exists) {
            await knex.schema.createTable('events', (table) => {
                table.increments('id').primary();
                table.string('title').notNullable();
                table.date('date').notNullable();
                table.string('start_time').nullable(); // HH:MM
                table.string('end_time').nullable();   // HH:MM
                table.text('description').nullable();
                table.string('source_channel').notNullable();
                table.string('raw_message_id').nullable(); // For deduplication
                table.timestamp('created_at').defaultTo(knex.fn.now());

                // Unique constraint to prevent duplicate events from same message
                table.unique(['raw_message_id', 'title']);
            });
            console.log('✅ Created "events" table');
        } else {
            console.log('ℹ️ "events" table already exists');
        }
    } catch (error) {
        console.error('❌ Error creating table:', error);
    } finally {
        await knex.destroy();
    }
}

createEventsTable();
