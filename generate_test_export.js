/**
 * Test Script: Generate Sample Slack Export ZIP
 * Creates a minimal Slack export structure for testing
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const exportDir = path.join(__dirname, 'test-slack-export');
const zipPath = path.join(__dirname, 'test-slack-export.zip');

// Create sample messages (mix of recent and old)
const now = new Date();
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
const fortyDaysAgo = new Date();
fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

const sampleMessages = {
    general: [
        {
            type: 'message',
            user: 'U123ABC',
            text: 'Hello everyone! This is a recent message.',
            ts: (now.getTime() / 1000).toString()
        },
        {
            type: 'message',
            user: 'U456DEF',
            text: 'Assignment due next week - please submit on Canvas',
            ts: (new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).getTime() / 1000).toString()
        },
        {
            type: 'message',
            user: 'U789GHI',
            text: 'This message is 40 days old and should be filtered out',
            ts: (fortyDaysAgo.getTime() / 1000).toString()
        }
    ],
    random: [
        {
            type: 'message',
            user: 'U123ABC',
            text: 'Random chat message from last week',
            ts: (new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime() / 1000).toString()
        },
        {
            type: 'message',
            user: 'U456DEF',
            text: 'Meeting notes: discussed project timeline',
            ts: (new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).getTime() / 1000).toString()
        }
    ],
    'tech-talk': [
        {
            type: 'message',
            user: 'U789GHI',
            text: 'Check out this new JavaScript framework!',
            ts: (new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).getTime() / 1000).toString()
        }
    ]
};

try {
    // Clean up old test files
    if (fs.existsSync(exportDir)) {
        fs.rmSync(exportDir, { recursive: true });
    }
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }

    // Create export directory structure
    fs.mkdirSync(exportDir);

    // Create channel directories and message files
    for (const [channelName, messages] of Object.entries(sampleMessages)) {
        const channelDir = path.join(exportDir, channelName);
        fs.mkdirSync(channelDir);

        // Write messages to a daily file
        const messageFile = path.join(channelDir, '2024-01-01.json');
        fs.writeFileSync(messageFile, JSON.stringify(messages, null, 2));
    }

    // Create ZIP file
    const zip = new AdmZip();
    zip.addLocalFolder(exportDir);
    zip.writeZip(zipPath);

    console.log(`✅ Created test Slack export ZIP: ${zipPath}`);
    console.log(`   - 3 channels: general, random, tech-talk`);
    console.log(`   - 6 total messages (5 recent, 1 old)`);
    console.log(`   - Expected filtered count: 5 messages`);

    // Clean up temp directory
    fs.rmSync(exportDir, { recursive: true });

} catch (error) {
    console.error('❌ Error creating test export:', error);
    process.exit(1);
}
