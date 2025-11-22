require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);
const bcrypt = require('bcrypt');

async function debugLogin() {
    console.log('1. Starting debug login...');
    const email = 'admin@byu.edu';
    const password = 'password123';

    try {
        console.log('2. Attempting to query user...');
        const user = await knex('users').where({ email }).first();
        console.log('3. Query result:', user ? 'User found' : 'User NOT found');

        if (user) {
            console.log('4. Comparing password...');
            const match = await bcrypt.compare(password, user.password);
            console.log('5. Password match:', match);
        }

        console.log('6. Done.');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

debugLogin();
