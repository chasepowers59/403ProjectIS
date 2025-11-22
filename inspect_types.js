require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

async function inspectTypes() {
    try {
        const eventsInfo = await knex('events').columnInfo();
        console.log(JSON.stringify(eventsInfo, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspectTypes();
