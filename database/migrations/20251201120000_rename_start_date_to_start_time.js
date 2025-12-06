/**
 * Migration: Rename start_date to start_time in events table
 * This migration aligns the database schema with the codebase which uses start_time
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // Check if column exists before renaming
    const hasStartDate = await knex.schema.hasColumn('events', 'start_date');
    const hasStartTime = await knex.schema.hasColumn('events', 'start_time');
    
    if (hasStartDate && !hasStartTime) {
        // Rename column from start_date to start_time using raw SQL for PostgreSQL
        await knex.raw('ALTER TABLE events RENAME COLUMN start_date TO start_time');
    } else if (!hasStartDate && !hasStartTime) {
        // If neither exists, create start_time (shouldn't happen, but safe fallback)
        await knex.schema.table('events', function (table) {
            table.datetime('start_time').notNullable();
        });
    }
    // If start_time already exists, do nothing (idempotent)
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    // Check if column exists before renaming back
    const hasStartTime = await knex.schema.hasColumn('events', 'start_time');
    const hasStartDate = await knex.schema.hasColumn('events', 'start_date');
    
    if (hasStartTime && !hasStartDate) {
        // Rename column back from start_time to start_date using raw SQL for PostgreSQL
        await knex.raw('ALTER TABLE events RENAME COLUMN start_time TO start_date');
    }
    // If start_date already exists, do nothing (idempotent)
};

