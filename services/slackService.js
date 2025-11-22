const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const knex = require('knex')(require('../knexfile').development);
const chrono = require('chrono-node');
const AdmZip = require('adm-zip');
require('dotenv').config();

const SLACKDUMP_CMD = process.env.SLACKDUMP_CMD || '.\\slackdump.exe';
const EXPORT_DIR = process.env.EXPORT_DIR || './slack-data';

const slackService = {
    getChannels: () => {
        return new Promise((resolve, reject) => {
            // First, try to read from cached file if it exists
            const channelFiles = fs.readdirSync('.').filter(f => f.startsWith('channels-') && f.endsWith('.txt'));

            if (channelFiles.length > 0) {
                console.log(`Reading channels from ${channelFiles[0]}`);
                try {
                    const content = fs.readFileSync(channelFiles[0], 'utf8');
                    const channels = [];
                    const lines = content.split('\n');
                    const regex = /^(C[A-Z0-9]+)\s+(?:arch|-)\s+(#[a-z0-9_-]+)/i;

                    lines.forEach(line => {
                        const match = line.match(regex);
                        if (match) {
                            // Only include non-archived channels
                            if (!line.includes('arch')) {
                                channels.push({
                                    id: match[1],
                                    name: match[2]
                                });
                            }
                        }
                    });
                    console.log(`Found ${channels.length} active channels from file`);
                    return resolve(channels);
                } catch (err) {
                    console.error('Error reading channel file:', err);
                }
            }

            // Fallback: try to execute slackdump
            exec(`${SLACKDUMP_CMD} list channels`, { timeout: 10000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    // Return empty array if both methods fail
                    return resolve([]);
                }

                const channels = [];
                const lines = stdout.split('\n');
                const regex = /^(C[A-Z0-9]+)\s+(?:arch|-)\s+(#[a-z0-9_-]+)/i;

                lines.forEach(line => {
                    const match = line.match(regex);
                    if (match) {
                        // Only include non-archived channels
                        if (!line.includes('arch')) {
                            channels.push({
                                id: match[1],
                                name: match[2]
                            });
                        }
                    }
                });
                console.log(`Found ${channels.length} active channels from slackdump`);
                resolve(channels);
            });
        });
    },

    runExport: (channelId = null) => {
        return new Promise((resolve, reject) => {
            // Slackdump V3 exports to a zip file by default
            let cmd = `${SLACKDUMP_CMD} export`;
            if (channelId) {
                cmd = `${SLACKDUMP_CMD} export ${channelId}`;
            }

            console.log(`Running export command: ${cmd}`);
            exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Export error: ${error}`);
                    console.error(`stderr: ${stderr}`);
                    return reject(error);
                }
                console.log(`Export completed successfully`);
                console.log(`stdout: ${stdout}`);
                if (stderr) console.log(`stderr: ${stderr}`);

                // Extract the zip file name from output
                const zipMatch = stdout.match(/([^\s]+\.zip)/);
                if (zipMatch) {
                    const zipFile = zipMatch[1];
                    console.log(`Exported to: ${zipFile}`);

                    try {
                        // Extract zip to EXPORT_DIR
                        if (!fs.existsSync(EXPORT_DIR)) {
                            fs.mkdirSync(EXPORT_DIR, { recursive: true });
                        }

                        const zip = new AdmZip(zipFile);
                        console.log(`Extracting ${zipFile} to ${EXPORT_DIR}...`);
                        zip.extractAllTo(EXPORT_DIR, true);
                        console.log(`Extraction complete`);

                        // Optionally delete the zip file after extraction
                        fs.unlinkSync(zipFile);
                    } catch (extractError) {
                        console.error(`Error extracting zip: ${extractError}`);
                        return reject(extractError);
                    }
                }

                resolve(stdout);
            });
        });
    },

    ingestData: async () => {
        console.log('Starting ingestion from:', EXPORT_DIR);

        if (!fs.existsSync(EXPORT_DIR)) {
            console.log('Export directory does not exist, creating it.');
            fs.mkdirSync(EXPORT_DIR, { recursive: true });
            return; // Nothing to ingest
        }

        // Recursive function to find JSON files
        function getFiles(dir) {
            const subdirs = fs.readdirSync(dir);
            const files = subdirs.map(subdir => {
                const res = path.resolve(dir, subdir);
                return (fs.statSync(res).isDirectory()) ? getFiles(res) : res;
            });
            return files.reduce((a, f) => a.concat(f), []);
        }

        const allFiles = getFiles(EXPORT_DIR);
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

            // Handle array of messages (both formats)
            if (!Array.isArray(messages)) {
                console.log(`Skipping ${file} - not an array`);
                continue;
            }

            for (const msg of messages) {
                if (!msg.text) continue;

                // Determine channel name - check if msg has channel field, otherwise use folder name
                const channelName = msg.channel || path.basename(path.dirname(file));

                const results = chrono.parse(msg.text);
                if (results.length > 0) {
                    const date = results[0].start.date();
                    const title = msg.text.substring(0, 100);

                    // Check duplicate (Upsert logic)
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
                        console.log(`Inserted event: ${title} from ${channelName}`);
                    } else {
                        // Optional: Update existing event if needed
                        // console.log(`Event already exists: ${title}`);
                    }
                }
            }
        }
        console.log('Ingestion complete.');
    }
};

module.exports = slackService;
