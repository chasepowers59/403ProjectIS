const bcrypt = require('bcrypt');
const environment = process.env.NODE_ENV || 'development';
const config = require('./database/knexfile')[environment];
const knex = require('knex')(config);

async function createAdmin() {
    try {
        console.log('Hashing password...');
        const hashedPassword = await bcrypt.hash('password', 10);

        console.log('Checking for existing user...');
        const existing = await knex('users').where({ email: 'admin@example.com' }).first();

        if (existing) {
            console.log('User already exists. Updating password...');
            await knex('users').where({ email: 'admin@example.com' }).update({ password: hashedPassword });
        } else {
            console.log('Creating new user...');
            await knex('users').insert({
                name: 'Admin User',
                email: 'admin@example.com',
                password: hashedPassword
            });
        }

        console.log('Success! User created/updated.');
        console.log('Email: admin@example.com');
        console.log('Password: password');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await knex.destroy();
    }
}

createAdmin();
