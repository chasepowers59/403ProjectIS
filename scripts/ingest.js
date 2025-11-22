const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const knex = require('knex')(require('../knexfile').development);
const chrono = require('chrono-node');

const EXPORT_PATH = process.env.SLACK_EXPORT_PATH || './slack-export';

async function ingest() {
    console.log('Starting ingestion from:', EXPORT_PATH);

    // Recursive function to find JSON files
    function getFiles(dir) {
        const subdirs = fs.readdirSync(dir);
        const files = subdirs.map(subdir => {
            const res = path.resolve(dir, subdir);
            return (fs.statSync(res).isDirectory()) ? getFiles(res) : res;
        });
        return files.reduce((a, f) => a.concat(f), []);
    }

    if (!fs.existsSync(EXPORT_PATH)) {
        console.error('Export path does not exist');
        process.exit(1);
    }

    const allFiles = getFiles(EXPORT_PATH);
    const jsonFiles = allFiles.filter(f => f.endsWith('.json'));

    console.log(`Found ${jsonFiles.length} JSON files.`);

    for (const file of jsonFiles) {
        const content = fs.readFileSync(file, 'utf8');
        let messages = [];
        try {
            messages = JSON.parse(content);
        } catch (e) {
            console.error(`Failed to parse ${file}`, e);
            continue;
        }

        // Determine channel name from folder name
        const channelName = path.basename(path.dirname(file));

        for (const msg of messages) {
            if (!msg.text) continue;

            const results = chrono.parse(msg.text);
            if (results.length > 0) {
                // Found a date!
                const date = results[0].start.date();
                const title = msg.text.substring(0, 100); // Truncate for title

                // Check duplicate
                // Simple duplicate check: same title, same start_time, same channel
                const exists = await knex('events').where({
                    title: title,
                    start_time: date,
                    source_channel: channelName
                }).first();

                if (!exists) {
                    await knex('events').insert({
                        title: title,
                        start_time: date,
                        source_channel: channelName,
                        status: 'pending'
                    });
                    console.log(`Inserted event: ${title} on ${date}`);
                }
            }
        }
    }

    console.log('Ingestion complete.');
    process.exit(0);
}

ingest();
