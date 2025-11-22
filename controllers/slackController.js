const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const knex = require('knex')(require('../knexfile').development);
const slackParser = require('../services/slackParser');

/**
 * Slack Controller
 * Handles HTTP requests for Slack ZIP upload and message queries
 */

const slackController = {
    /**
     * POST /slack/upload
     * Upload and process Slack export ZIP file
     */
    uploadZip: async (req, res) => {
        let extractPath = null;

        try {
            // Validate file exists
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded. Please provide a ZIP file.'
                });
            }

            // Validate file is ZIP
            if (!req.file.originalname.endsWith('.zip')) {
                fs.unlinkSync(req.file.path); // Clean up
                return res.status(400).json({
                    success: false,
                    error: 'Invalid file type. Only ZIP files are accepted.'
                });
            }

            console.log(`[SlackController] Processing upload: ${req.file.originalname} (${req.file.size} bytes)`);

            // Generate unique batch ID
            const batchId = Date.now().toString();
            extractPath = path.join('C:\\tmp\\slack_data', batchId);

            // Create extraction directory
            if (!fs.existsSync('C:\\tmp\\slack_data')) {
                fs.mkdirSync('C:\\tmp\\slack_data', { recursive: true });
            }
            fs.mkdirSync(extractPath, { recursive: true });

            // Extract ZIP
            const zip = new AdmZip(req.file.path);
            zip.extractAllTo(extractPath, true);
            console.log(`[SlackController] Extracted to: ${extractPath}`);

            // Check extracted size (prevent zip bombs)
            const extractedSize = getDirectorySize(extractPath);
            const maxExtractedSize = 500 * 1024 * 1024; // 500MB

            if (extractedSize > maxExtractedSize) {
                throw new Error(`Extracted size (${Math.round(extractedSize / 1024 / 1024)}MB) exceeds maximum (500MB)`);
            }

            // Parse messages
            const allMessages = await slackParser.parseSlackExport(extractPath);

            // Filter to last 30 days
            const recentMessages = slackParser.filterLast30Days(allMessages);
            console.log(`[SlackController] Filtered to ${recentMessages.length} messages from last 30 days (out of ${allMessages.length} total)`);

            // Store in database
            if (recentMessages.length > 0) {
                const dbMessages = recentMessages.map(msg => ({
                    ...msg,
                    upload_batch: batchId
                }));

                await knex('slack_messages').insert(dbMessages);
                console.log(`[SlackController] Inserted ${dbMessages.length} messages into database`);
            }

            // Get unique channels
            const channels = [...new Set(recentMessages.map(m => m.channel))];

            // Clean up
            fs.unlinkSync(req.file.path);
            fs.rmSync(extractPath, { recursive: true, force: true });

            res.json({
                success: true,
                batch_id: batchId,
                message_count: recentMessages.length,
                total_parsed: allMessages.length,
                channels: channels
            });

        } catch (error) {
            console.error('[SlackController] Upload error:', error);

            // Clean up on error
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            if (extractPath && fs.existsSync(extractPath)) {
                fs.rmSync(extractPath, { recursive: true, force: true });
            }

            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * GET /slack/channels
     * Get list of unique channels from stored messages (last 30 days)
     */
    getChannels: async (req, res) => {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const channels = await knex('slack_messages')
                .distinct('channel')
                .where('msg_timestamp', '>=', thirtyDaysAgo.toISOString())
                .orderBy('channel')
                .pluck('channel');

            res.json(channels);

        } catch (error) {
            console.error('[SlackController] Get channels error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * GET /slack/messages/:channel
     * Get messages from specific channel (last 30 days only)
     * Query params: keyword (optional)
     */
    getMessages: async (req, res) => {
        try {
            const { channel } = req.params;
            const { keyword } = req.query;

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            let query = knex('slack_messages')
                .where('channel', channel)
                .where('msg_timestamp', '>=', thirtyDaysAgo.toISOString())
                .orderBy('msg_timestamp', 'desc');

            // Apply keyword filter if provided
            if (keyword) {
                query = query.where('text', 'ilike', `%${keyword}%`);
            }

            const messages = await query.select('channel', 'user', 'msg_timestamp', 'text');

            res.json(messages);

        } catch (error) {
            console.error('[SlackController] Get messages error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * GET /slack/search?keyword=...
     * Search messages across all channels (last 30 days only)
     */
    searchMessages: async (req, res) => {
        try {
            const { keyword } = req.query;

            if (!keyword) {
                return res.status(400).json({
                    success: false,
                    error: 'Keyword parameter is required'
                });
            }

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const messages = await knex('slack_messages')
                .where('text', 'ilike', `%${keyword}%`)
                .where('msg_timestamp', '>=', thirtyDaysAgo.toISOString())
                .orderBy('msg_timestamp', 'desc')
                .select('channel', 'user', 'msg_timestamp', 'text');

            res.json(messages);

        } catch (error) {
            console.error('[SlackController] Search error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
};

/**
 * Helper: Calculate total size of directory
 */
function getDirectorySize(dirPath) {
    let size = 0;

    const files = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const file of files) {
        const filePath = path.join(dirPath, file.name);

        if (file.isDirectory()) {
            size += getDirectorySize(filePath);
        } else {
            size += fs.statSync(filePath).size;
        }
    }

    return size;
}

module.exports = slackController;
