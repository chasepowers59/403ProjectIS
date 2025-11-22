require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);
const fs = require('fs');

async function inspect() {
    try {
        const usersColumns = Object.keys(await knex('users').columnInfo());
        const eventsColumns = Object.keys(await knex('events').columnInfo());

        fs.writeFileSync('db_info.txt', JSON.stringify({ users: usersColumns, events: eventsColumns }, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
