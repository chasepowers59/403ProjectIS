const bcrypt = require('bcrypt');
const environment = process.env.NODE_ENV || 'development';
const config = require('./database/knexfile')[environment];
const knex = require('knex')(config);

async function createAdmin() {
    try {
        const email = 'testuser@byu.edu';
        const password = 'Test123!';
        const name = 'Test User';
        
        console.log('Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log('Checking for existing user...');
        const existing = await knex('users').where({ email }).first();

        if (existing) {
            console.log('User already exists. Updating password...');
            await knex('users').where({ email }).update({ password: hashedPassword });
        } else {
            console.log('Creating new user...');
            await knex('users').insert({
                name,
                email,
                password: hashedPassword
            });
        }

        console.log('\n✅ Success! User created/updated.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📧 Email: ' + email);
        console.log('🔑 Password: ' + password);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await knex.destroy();
    }
}

createAdmin();
