require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

async function inspect() {
    try {
        const usersInfo = await knex('users').columnInfo();
        console.log('Users table columns:', usersInfo);

        const eventsInfo = await knex('events').columnInfo();
        console.log('Events table columns:', eventsInfo);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
