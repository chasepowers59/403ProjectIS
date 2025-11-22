require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

async function inspect() {
    try {
        const eventsColumns = await knex('events').columnInfo();
        console.log('--- EVENTS TABLE COLUMNS ---');
        Object.keys(eventsColumns).forEach(col => console.log(col));
        console.log('----------------------------');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
