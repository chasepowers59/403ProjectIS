const fs = require('fs');
const path = require('path');

/**
 * Slack Export Parser Service
 * Parses Slack export ZIP contents into normalized message objects
 */

const slackParser = {
    /**
     * Parse extracted Slack export directory
     * @param {string} extractedPath - Path to extracted ZIP contents
     * @returns {Promise<Array>} Array of normalized message objects
     */
    parseSlackExport: async (extractedPath) => {
        const messages = [];

        try {
            // Read all directories in extracted path (each is a channel)
            const entries = fs.readdirSync(extractedPath, { withFileTypes: true });
            const channelDirs = entries.filter(entry => entry.isDirectory());

            for (const channelDir of channelDirs) {
                const channelName = channelDir.name;
                const channelPath = path.join(extractedPath, channelName);

                // Read all JSON files in channel directory
                const channelMessages = await slackParser.readChannelMessages(channelPath, channelName);
                messages.push(...channelMessages);
            }

            console.log(`[SlackParser] Parsed ${messages.length} total messages from ${channelDirs.length} channels`);
            return messages;

        } catch (error) {
            console.error('[SlackParser] Error parsing Slack export:', error);
            throw new Error(`Failed to parse Slack export: ${error.message}`);
        }
    },

    /**
     * Read and parse all message files from a channel directory
     * @param {string} channelPath - Path to channel directory
     * @param {string} channelName - Name of the channel
     * @returns {Promise<Array>} Array of normalized messages
     */
    readChannelMessages: async (channelPath, channelName) => {
        const messages = [];

        try {
            const files = fs.readdirSync(channelPath);
            const jsonFiles = files.filter(f => f.endsWith('.json'));

            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(channelPath, file);
                    const fileContent = fs.readFileSync(filePath, 'utf8');

                    // Try to parse JSON
                    let rawMessages;
                    try {
                        rawMessages = JSON.parse(fileContent);
                    } catch (parseError) {
                        console.warn(`[SlackParser] Skipping malformed JSON file: ${file} in ${channelName}`);
                        continue; // Skip this file, continue with others
                    }

                    // Ensure it's an array
                    if (!Array.isArray(rawMessages)) {
                        console.warn(`[SlackParser] Skipping non-array JSON in ${file}`);
                        continue;
                    }

                    // Normalize each message
                    for (const rawMsg of rawMessages) {
                        const normalized = slackParser.normalizeMessage(rawMsg, channelName);
                        if (normalized) {
                            messages.push(normalized);
                        }
                    }
                } catch (fileError) {
                    console.error(`[SlackParser] Error processing file ${file}:`, fileError.message);
                    // Continue with next file
                }
            }

            return messages;

        } catch (error) {
            console.error(`[SlackParser] Error reading channel ${channelName}:`, error);
            return messages; // Return what we have so far
        }
    },

    /**
     * Normalize a raw Slack message to standard format
     * @param {Object} rawMsg - Raw message from Slack export JSON
     * @param {string} channelName - Channel name
     * @returns {Object|null} Normalized message or null if invalid
     */
    normalizeMessage: (rawMsg, channelName) => {
        try {
            // Skip non-message types (join/leave events, etc.)
            if (rawMsg.type && rawMsg.type !== 'message') {
                return null;
            }

            // Get user ID - handle both regular users and bots
            const userId = rawMsg.user || rawMsg.bot_id || rawMsg.username || 'unknown';

            // Get message text - check multiple sources
            let messageText = rawMsg.text || '';

            // If no text, check attachments
            if (!messageText && rawMsg.attachments && rawMsg.attachments.length > 0) {
                // Try to get text from first attachment
                const attachment = rawMsg.attachments[0];
                messageText = attachment.text || attachment.fallback || attachment.pretext || '';
            }

            // If still no text, check files
            if (!messageText && rawMsg.files && rawMsg.files.length > 0) {
                const file = rawMsg.files[0];
                messageText = `[File: ${file.name || 'attachment'}]`;
            }

            // Skip if we still have no content
            if (!messageText || messageText.trim() === '') {
                return null;
            }

            // Convert Slack timestamp (Unix timestamp with microseconds) to ISO string
            const timestamp = rawMsg.ts ?
                new Date(parseFloat(rawMsg.ts) * 1000).toISOString() :
                new Date().toISOString();

            return {
                channel: channelName,
                user: userId,
                msg_timestamp: timestamp,
                text: messageText.trim()
            };

        } catch (error) {
            console.error('[SlackParser] Error normalizing message:', error);
            return null;
        }
    },

    /**
     * Filter messages to only include those from last 30 days
     * @param {Array} messages - Array of normalized messages
     * @returns {Array} Filtered messages
     */
    filterLast30Days: (messages) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return messages.filter(msg => {
            const msgDate = new Date(msg.msg_timestamp);
            return msgDate >= thirtyDaysAgo;
        });
    }
};

module.exports = slackParser;
