require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);
const bcrypt = require('bcrypt');

async function setup() {
    try {
        // Create Users Table
        const hasUsers = await knex.schema.hasTable('users');
        if (!hasUsers) {
            await knex.schema.createTable('users', function (table) {
                table.increments('id');
                table.string('email').notNullable().unique();
                table.string('password').notNullable();
                table.string('name').notNullable();
                table.timestamps(true, true);
            });
            console.log('Created users table');
        } else {
            console.log('Users table already exists');
        }

        // Create Events Table
        const hasEvents = await knex.schema.hasTable('events');
        if (!hasEvents) {
            await knex.schema.createTable('events', function (table) {
                table.increments('id');
                table.string('title').notNullable();
                table.datetime('start_date').notNullable();
                table.string('source_channel');
                table.string('status').defaultTo('pending');
                table.timestamps(true, true);
            });
            console.log('Created events table');
        } else {
            console.log('Events table already exists');
        }

        // Seed Admin User
        const adminEmail = 'admin@byu.edu';
        const existingAdmin = await knex('users').where({ email: adminEmail }).first();
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('password123', 10);
            await knex('users').insert({
                email: adminEmail,
                password: hashedPassword,
                name: 'Admin User'
            });
            console.log('Seeded admin user');
        } else {
            console.log('Admin user already exists');
        }

        process.exit(0);
    } catch (err) {
        console.error('Setup failed', err);
        process.exit(1);
    }
}

setup();
