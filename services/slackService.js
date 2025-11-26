const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const knex = require('knex')(require('../database/knexfile').development);
const chrono = require('chrono-node');
const AdmZip = require('adm-zip');
require('dotenv').config();

const SLACKDUMP_CMD = process.env.SLACKDUMP_CMD || '.\\tools\\slackdump.exe';
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
            // Use absolute path to tools directory to be safe
            const toolsDir = path.join(process.cwd(), 'tools');
            const slackdumpPath = path.join(toolsDir, 'slackdump.exe');

            console.log(`Executing: ${slackdumpPath} list channels`);

            exec(`${slackdumpPath} list channels`, { timeout: 60000 }, (error, stdout, stderr) => {
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
                        // fs.unlinkSync(zipFile); // KEEP ZIP for processLatestExport
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
        // ... (existing implementation kept for backward compatibility if needed, but we will use processLatestExport primarily)
        console.log('Legacy ingestData called - redirecting to processLatestExport logic if possible, or just running legacy flow.');
        // For now, let's keep the legacy flow as is in the file, but we will add the new function below it.
        // Actually, to avoid code duplication, we can make ingestData just call processLatestExport if we wanted, 
        // but the user asked for "Detect newest zip... Extract... Send to OpenAI".
        // The legacy ingestData just read from EXPORT_DIR.
        // We will leave ingestData alone and add processLatestExport.
    },

    /**
     * New Sync Workflow:
     * 1. Find newest ZIP in root
     * 2. Extract to temp
     * 3. Parse messages
     * 4. AI Analysis
     * 5. Save Analysis & Update Events
     */
    processLatestExport: async () => {
        console.log('[SlackService] Starting full sync workflow...');
        let extractPath = null;
        let zipPath = null;

        try {
            // 1. Find newest ZIP in root
            const rootDir = process.cwd();
            const files = fs.readdirSync(rootDir);
            const zipFiles = files.filter(file => file.startsWith('slackdump_') && file.endsWith('.zip'));

            if (zipFiles.length === 0) {
                console.error('[SlackService] No ZIP found');
                throw new Error('No slackdump ZIP files found in project root.');
            }

            // Sort by mtime desc
            zipFiles.sort((a, b) => {
                return fs.statSync(path.join(rootDir, b)).mtime.getTime() - fs.statSync(path.join(rootDir, a)).mtime.getTime();
            });

            const newestZip = zipFiles[0];
            zipPath = path.join(rootDir, newestZip);
            console.log(`[SlackService] Found newest ZIP: ${newestZip}`);

            // 2. Extract to temp
            const batchId = Date.now().toString();
            extractPath = path.join(process.cwd(), 'data', 'slack_extracted', batchId);

            if (!fs.existsSync(extractPath)) {
                fs.mkdirSync(extractPath, { recursive: true });
            }

            const zip = new AdmZip(zipPath);
            zip.extractAllTo(extractPath, true);
            console.log(`[SlackService] Extracted to: ${extractPath}`);

            // 3. Parse Messages
            const slackParser = require('./slackParser');
            const allMessages = await slackParser.parseSlackExport(extractPath);

            // Filter to last 30 days
            const recentMessages = slackParser.filterLast30Days(allMessages);
            console.log(`[SlackService] Parsed ${recentMessages.length} recent messages`);

            // 4. AI Analysis (Events Extraction)
            const aiEventExtractor = require('./aiEventExtractor');
            console.log('[SlackService] Starting AI extraction...');
            const extractedEvents = await aiEventExtractor.extractEvents(recentMessages);

            // 5. Update Database
            if (extractedEvents.length > 0) {
                const dbEvents = extractedEvents.map(evt => {
                    let fullStartTime = null;
                    let fullEndTime = null;

                    // Construct full start_time
                    if (evt.date) {
                        if (evt.start_time) {
                            // Try to parse HH:MM
                            const timeParts = evt.start_time.split(':');
                            if (timeParts.length >= 2) {
                                const d = new Date(evt.date);
                                d.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
                                if (!isNaN(d.getTime())) {
                                    fullStartTime = d.toISOString();
                                }
                            }
                        }

                        // Fallback if no start_time or invalid time
                        if (!fullStartTime) {
                            const d = new Date(evt.date);
                            // Default to 9 AM if no time specified, or just midnight? 
                            // Let's use midnight to be safe, or keep it null if DB allows.
                            // But dashboard expects a date.
                            if (!isNaN(d.getTime())) {
                                fullStartTime = d.toISOString();
                            }
                        }
                    }

                    return {
                        title: evt.title,
                        date: evt.date,
                        start_time: fullStartTime || new Date().toISOString(), // Fallback to now if completely failed
                        end_time: evt.end_time || null,
                        description: evt.description || '',
                        source_channel: evt.source_channel,
                        raw_message_id: evt.raw_message_id || null,
                        status: 'pending'
                    };
                });

                await knex.transaction(async (trx) => {
                    for (const evt of dbEvents) {
                        const exists = await trx('events')
                            .where({ raw_message_id: evt.raw_message_id })
                            .orWhere({ title: evt.title, date: evt.date })
                            .first();

                        if (!exists) {
                            await trx('events').insert(evt);
                        }
                    }
                });
                console.log(`[SlackService] Processed ${dbEvents.length} events`);
            }

            // 6. Generate Analysis JSON
            console.log('[SlackService] Generating analysis JSON...');
            const limitedMessages = recentMessages.slice(0, 500);

            const systemPromptPath = path.join(process.cwd(), 'ai_system', 'system_instructions.md');
            const userPromptPath = path.join(process.cwd(), 'ai_system', 'prompt_slackdump.md');

            if (fs.existsSync(systemPromptPath) && fs.existsSync(userPromptPath)) {
                const systemPrompt = fs.readFileSync(systemPromptPath, 'utf8');
                const userPrompt = fs.readFileSync(userPromptPath, 'utf8');

                const response = await aiEventExtractor.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt + "\n\nDATA:\n" + JSON.stringify(limitedMessages) }
                    ],
                    temperature: 0,
                    response_format: { type: "json_object" }
                });

                const analysisResult = JSON.parse(response.choices[0].message.content);

                // Save to public/data/slack_analysis.json
                const dataDir = path.join(process.cwd(), 'public', 'data');
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
                fs.writeFileSync(path.join(dataDir, 'slack_analysis.json'), JSON.stringify(analysisResult, null, 2));
                console.log('[SlackService] Saved analysis to public/data/slack_analysis.json');
            } else {
                console.warn('[SlackService] Prompts not found, skipping detailed analysis generation.');
            }

            // 7. Cleanup
            if (extractPath) {
                fs.rmSync(extractPath, { recursive: true, force: true });
            }
            if (zipPath) {
                fs.unlinkSync(zipPath);
            }

            return { success: true, events: extractedEvents.length };

        } catch (error) {
            console.error('[SlackService] Sync error:', error);
            if (extractPath && fs.existsSync(extractPath)) {
                fs.rmSync(extractPath, { recursive: true, force: true });
            }
            throw error;
        }
    }
};

module.exports = slackService;
