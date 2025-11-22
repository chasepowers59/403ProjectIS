require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

async function checkEvents() {
    try {
        const event = await knex('events').first();
        console.log('Sample Event:', event);
        console.log('Type of event_id:', typeof event.event_id);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkEvents();
