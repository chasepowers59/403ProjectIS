require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

knex.schema.createTable('test_table', table => {
    table.increments('id');
    table.string('name');
})
    .then(() => {
        console.log('Table created successfully');
        return knex.schema.dropTable('test_table');
    })
    .then(() => {
        console.log('Table dropped successfully');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Table creation failed', err);
        process.exit(1);
    });
