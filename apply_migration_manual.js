require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

async function apply() {
    try {
        const hasSource = await knex.schema.hasColumn('events', 'source_channel');
        if (!hasSource) {
            await knex.schema.table('events', table => {
                table.string('source_channel');
            });
            console.log('Added source_channel');
        } else {
            console.log('source_channel already exists');
        }

        const hasStatus = await knex.schema.hasColumn('events', 'status');
        if (!hasStatus) {
            await knex.schema.table('events', table => {
                table.string('status').defaultTo('pending');
            });
            console.log('Added status');
        } else {
            console.log('status already exists');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

apply();
