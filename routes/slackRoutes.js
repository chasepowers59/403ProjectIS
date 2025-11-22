const express = require('express');
const router = express.Router();
const multer = require('multer');
const slackController = require('../controllers/slackController');

/**
 * Slack Routes
 * All routes require authentication (enforced by server.js middleware)
 */

// Configure multer for file uploads
const upload = multer({
    dest: 'C:\\tmp\\slack_uploads',
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// POST /slack/upload - Upload and process Slack export ZIP
router.post('/upload', upload.single('zipfile'), slackController.uploadZip);

// GET /slack/channels - List all channels (last 30 days)
router.get('/channels', slackController.getChannels);

// GET /slack/messages/:channel - Get messages from specific channel (last 30 days)
router.get('/messages/:channel', slackController.getMessages);

// GET /slack/search - Search messages across all channels (last 30 days)
router.get('/search', slackController.searchMessages);

module.exports = router;
