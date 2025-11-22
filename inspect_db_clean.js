require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

async function inspect() {
    try {
        const usersColumns = await knex('users').columnInfo();
        console.log('Users Columns:', Object.keys(usersColumns));

        const eventsColumns = await knex('events').columnInfo();
        console.log('Events Columns:', Object.keys(eventsColumns));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
