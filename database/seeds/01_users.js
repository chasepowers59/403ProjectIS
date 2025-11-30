const bcrypt = require('bcrypt');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
    // Deletes ALL existing entries
    await knex('users').del();

    const hashedPassword = await bcrypt.hash('password', 10);

    await knex('users').insert([
        {
            name: 'Admin User',
            email: 'admin@example.com',
            password: hashedPassword
        }
    ]);
};
