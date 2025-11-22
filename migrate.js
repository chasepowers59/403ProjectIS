require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

async function runMigrations() {
    try {
        await knex.migrate.latest();
        console.log('Migrations finished successfully');
        process.exit(0);
    } catch (err) {
        console.error('Migrations failed');
        console.error(err);
        process.exit(1);
    }
}

runMigrations();
