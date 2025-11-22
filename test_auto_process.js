require('dotenv').config();
const fs = require('fs');
const path = require('path');
const knex = require('knex')(require('./knexfile').development);
const slackController = require('./controllers/slackController');

async function runTest() {
    console.log('🧪 Testing Auto-Process Root ZIP...');

    // 1. Setup: Ensure a ZIP exists in root
    const rootDir = process.cwd();
    const testZipName = 'auto_process_test.zip';
    const testZipPath = path.join(rootDir, testZipName);

    // We'll assume the user has a ZIP or we can copy one from previous tests if available.
    // For now, let's check if ANY zip exists, if not, warn.
    const files = fs.readdirSync(rootDir);
    const zipFiles = files.filter(file => file.endsWith('.zip'));

    if (zipFiles.length === 0) {
        console.warn('⚠️ No ZIP files found in root. Please place a ZIP file in root to test.');
        // Create a dummy empty zip just to test the detection logic (it will fail extraction but pass detection)
        // Actually, let's try to use the one from previous test if it exists in a known location, 
        // or just create a dummy file to see if controller picks it up.
        // But the controller tries to extract it, so a dummy file will cause AdmZip error.
        // Let's skip creation and rely on user having one or the previous test having left one.
        // If no zip, we can't fully test.
        console.log('❌ Test aborted: No ZIP file found.');
        process.exit(1);
    } else {
        console.log(`✅ Found ${zipFiles.length} ZIP files. Newest will be used.`);
    }

    // 2. Insert a "stale" event to verify clearing
    await knex('events').insert({
        title: 'Stale Event',
        date: '2020-01-01',
        source_channel: 'general',
        raw_message_id: 'stale_1'
    }).onConflict(['raw_message_id', 'title']).ignore();
    console.log('✅ Inserted stale event for verification.');

    // 3. Trigger Scan
    console.log('🔄 Triggering /slack/scan...');
    // We can't easily use supertest with the real server running, so we'll mock the request object
    // or just call the controller method directly if we can mock req/res.

    const req = {};
    const res = {
        json: (data) => {
            console.log('✅ Response:', data);
            verifyResults(data);
        },
        status: (code) => {
            console.log(`❌ Status: ${code}`);
            return {
                json: (data) => {
                    console.log('❌ Error Response:', data);
                    process.exit(1);
                }
            };
        }
    };

    try {
        await slackController.scanAndProcessLatest(req, res);
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

async function verifyResults(data) {
    // 4. Verify Stale Event Removed
    const staleEvent = await knex('events').where({ title: 'Stale Event' }).first();
    if (!staleEvent) {
        console.log('✅ Stale event correctly removed.');
    } else {
        console.error('❌ Stale event still exists! Table was not cleared.');
    }

    // 5. Verify New Events
    const count = await knex('events').count('id as count').first();
    console.log(`✅ Total events in DB: ${count.count}`);

    if (data.success && !staleEvent && count.count > 0) {
        console.log('🎉 Auto-Process Test PASSED!');
    } else {
        console.log('❌ Auto-Process Test FAILED.');
    }
    process.exit(0);
}

runTest();
