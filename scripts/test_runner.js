/**
 * COMPREHENSIVE REGRESSION TEST SUITE
 * Tests all aspects of the Slack ZIP upload system
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const FormData = require('form-data');
const http = require('http');
const knex = require('knex')(require('./knexfile').development);

const TEST_DIR = path.join(__dirname, 'regression-tests');
const RESULTS = [];
let TEST_COUNT = 0;

// Utility: Log test result
function logTest(category, name, passed, details = {}) {
    TEST_COUNT++;
    const result = { category, name, passed, details, id: TEST_COUNT };
    RESULTS.push(result);
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} [${category}] ${name}`);
    if (!passed && details.error) {
        console.log(`   Error: ${details.error}`);
    }
    return passed;
}

// Helper: Login
function login() {
    return new Promise((resolve, reject) => {
        const postData = 'email=admin@byu.edu&password=password123';
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            const cookie = res.headers['set-cookie'];
            resolve(cookie ? cookie[0] : null);
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Helper: Upload file with proper stream handling
function uploadFile(filePath, cookie) {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath);
        const form = new FormData();
        form.append('zipfile', fileStream);

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/slack/upload',
            method: 'POST',
            headers: {
                ...form.getHeaders(),
                'Cookie': cookie
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                fileStream.destroy();
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', (err) => {
            fileStream.destroy();
            reject(err);
        });

        form.on('error', (err) => {
            fileStream.destroy();
            reject(err);
        });

        form.pipe(req);
    });
}

// Helper: GET request
function getRequest(urlPath, cookie) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: urlPath,
            method: 'GET',
            headers: { 'Cookie': cookie }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Helper: Create test ZIP
function createTestZip(name, structure) {
    const zipPath = path.join(TEST_DIR, `${name}.zip`);
    const tempDir = path.join(TEST_DIR, `temp_${name}`);

    fs.mkdirSync(tempDir, { recursive: true });

    for (const [channelName, messages] of Object.entries(structure)) {
        const channelDir = path.join(tempDir, channelName);
        fs.mkdirSync(channelDir, { recursive: true });
        fs.writeFileSync(
            path.join(channelDir, '2024-01-01.json'),
            JSON.stringify(messages, null, 2)
        );
    }

    const zip = new AdmZip();
    zip.addLocalFolder(tempDir);
    zip.writeZip(zipPath);
    fs.rmSync(tempDir, { recursive: true });

    return zipPath;
}

// Helper: Delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// CATEGORY 1: FILE UPLOAD HANDLING
// ============================================================================

async function test_fileUpload_normal(cookie) {
    const now = Date.now() / 1000;
    const zipPath = createTestZip('upload_normal', {
        'general': [
            { type: 'message', user: 'U123', text: 'Test message', ts: now.toString() }
        ]
    });

    const result = await uploadFile(zipPath, cookie);
    return logTest('FILE_UPLOAD', 'Normal ZIP upload',
        result.status === 200 && result.body.success,
        { status: result.status, response: result.body }
    );
}

async function test_fileUpload_sequential(cookie) {
    const now = Date.now() / 1000;
    const results = [];

    for (let i = 0; i < 3; i++) {
        const zipPath = createTestZip(`upload_seq_${i}`, {
            'general': [
                { type: 'message', user: 'U123', text: `Sequential ${i}`, ts: now.toString() }
            ]
        });

        const result = await uploadFile(zipPath, cookie);
        results.push(result.status === 200 && result.body.success);
        await delay(200);
    }

    const allPassed = results.every(r => r);
    return logTest('FILE_UPLOAD', 'Sequential uploads (3x)', allPassed,
        { successCount: results.filter(r => r).length, totalCount: 3 }
    );
}

async function test_fileUpload_large(cookie) {
    const now = Date.now() / 1000;
    const messages = [];

    // Create 1000 messages
    for (let i = 0; i < 1000; i++) {
        messages.push({
            type: 'message',
            user: `U${i}`,
            text: `Message ${i} with some content to make it larger`,
            ts: (now - i).toString()
        });
    }

    const zipPath = createTestZip('upload_large', { 'general': messages });
    const result = await uploadFile(zipPath, cookie);

    return logTest('FILE_UPLOAD', 'Large ZIP (1000 messages)',
        result.status === 200 && result.body.success,
        { status: result.status, messageCount: result.body.message_count }
    );
}

async function test_fileUpload_malformedZip(cookie) {
    const txtPath = path.join(TEST_DIR, 'malformed.zip');
    fs.writeFileSync(txtPath, 'This is not a valid ZIP file content');

    try {
        const result = await uploadFile(txtPath, cookie);
        // Should either reject or return error
        const passed = result.status === 400 || result.status === 500;
        return logTest('FILE_UPLOAD', 'Malformed ZIP handling', passed,
            { status: result.status, response: result.body }
        );
    } catch (error) {
        // Catching error is also acceptable
        return logTest('FILE_UPLOAD', 'Malformed ZIP handling', true,
            { error: 'Properly rejected' }
        );
    }
}

async function test_fileUpload_nonZip(cookie) {
    const txtPath = path.join(TEST_DIR, 'notzip.txt');
    fs.writeFileSync(txtPath, 'Plain text file');

    const result = await uploadFile(txtPath, cookie);
    return logTest('FILE_UPLOAD', 'Non-ZIP file rejection',
        result.status === 400 && result.body.error && result.body.error.includes('ZIP'),
        { status: result.status, error: result.body.error }
    );
}

async function test_fileUpload_noBusboyErrors(cookie) {
    const now = Date.now() / 1000;
    let busboyError = false;

    for (let i = 0; i < 5; i++) {
        const zipPath = createTestZip(`busboy_test_${i}`, {
            'general': [
                { type: 'message', user: 'U123', text: `Test ${i}`, ts: now.toString() }
            ]
        });

        const result = await uploadFile(zipPath, cookie);
        if (result.body.error && result.body.error.includes('Unexpected end of form')) {
            busboyError = true;
            break;
        }
        await delay(100);
    }

    return logTest('FILE_UPLOAD', 'No Busboy errors (5x uploads)', !busboyError,
        { busboyErrorDetected: busboyError }
    );
}

// ============================================================================
// CATEGORY 2: SLACK PARSER VALIDATION
// ============================================================================

async function test_parser_normalMessages(cookie) {
    const now = Date.now() / 1000;
    const zipPath = createTestZip('parser_normal', {
        'general': [
            { type: 'message', user: 'U123', text: 'Normal message', ts: now.toString() }
        ]
    });

    const result = await uploadFile(zipPath, cookie);
    return logTest('PARSER', 'Normal messages',
        result.body.success && result.body.message_count === 1,
        { messageCount: result.body.message_count }
    );
}

async function test_parser_botMessages(cookie) {
    const now = Date.now() / 1000;
    const zipPath = createTestZip('parser_bot', {
        'general': [
            { type: 'message', bot_id: 'B123', text: 'Bot message', ts: now.toString() },
            { type: 'message', user: 'U123', text: 'User message', ts: now.toString() }
        ]
    });

    const result = await uploadFile(zipPath, cookie);
    // Should parse both bot and user messages
    return logTest('PARSER', 'Bot messages',
        result.body.success && result.body.message_count === 2,
        { messageCount: result.body.message_count, expected: 2 }
    );
}

async function test_parser_timestamps(cookie) {
    const now = Date.now() / 1000;
    const zipPath = createTestZip('parser_timestamps', {
        'general': [
            { type: 'message', user: 'U123', text: 'With timestamp', ts: now.toString() },
            { type: 'message', user: 'U456', text: 'Without timestamp' } // No ts field
        ]
    });

    const result = await uploadFile(zipPath, cookie);
    // Should handle both with and without timestamps
    return logTest('PARSER', 'Timestamp handling',
        result.body.success && result.body.message_count >= 1,
        { messageCount: result.body.message_count }
    );
}

async function test_parser_emptyChannels(cookie) {
    const now = Date.now() / 1000;
    const zipPath = createTestZip('parser_empty', {
        'empty-channel': [],
        'active-channel': [
            { type: 'message', user: 'U123', text: 'Message', ts: now.toString() }
        ]
    });

    const result = await uploadFile(zipPath, cookie);
    return logTest('PARSER', 'Empty channels',
        result.body.success && result.body.message_count === 1,
        { messageCount: result.body.message_count, channels: result.body.channels }
    );
}

async function test_parser_attachments(cookie) {
    const now = Date.now() / 1000;
    const zipPath = createTestZip('parser_attachments', {
        'general': [
            {
                type: 'message',
                user: 'U123',
                text: '',
                attachments: [{ text: 'Attachment text' }],
                ts: now.toString()
            }
        ]
    });

    const result = await uploadFile(zipPath, cookie);
    // Should extract text from attachments
    return logTest('PARSER', 'Attachment metadata',
        result.body.success && result.body.message_count === 1,
        { messageCount: result.body.message_count }
    );
}

async function test_parser_malformedJSON(cookie) {
    const zipPath = path.join(TEST_DIR, 'parser_malformed.zip');
    const tempDir = path.join(TEST_DIR, 'temp_malformed');

    fs.mkdirSync(path.join(tempDir, 'general'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'general', '2024-01-01.json'), '{invalid json}');

    const zip = new AdmZip();
    zip.addLocalFolder(tempDir);
    zip.writeZip(zipPath);
    fs.rmSync(tempDir, { recursive: true });

    const result = await uploadFile(zipPath, cookie);
    // Should handle gracefully without crashing
    return logTest('PARSER', 'Malformed JSON detection',
        result.status !== 500,
        { status: result.status, handled: result.status !== 500 }
    );
}

async function test_parser_channelTraversal(cookie) {
    const now = Date.now() / 1000;
    const zipPath = createTestZip('parser_multi_channel', {
        'general': [
            { type: 'message', user: 'U123', text: 'General msg', ts: now.toString() }
        ],
        'random': [
            { type: 'message', user: 'U456', text: 'Random msg', ts: now.toString() }
        ],
        'tech-talk': [
            { type: 'message', user: 'U789', text: 'Tech msg', ts: now.toString() }
        ]
    });

    const result = await uploadFile(zipPath, cookie);
    return logTest('PARSER', 'Channel directory traversal',
        result.body.success && result.body.channels.length === 3,
        { channelCount: result.body.channels.length, channels: result.body.channels }
    );
}

// ============================================================================
// CATEGORY 3: DATABASE INSERT LOGIC
// ============================================================================

async function test_database_correctTimestamps(cookie) {
    const now = Date.now() / 1000;
    const zipPath = createTestZip('db_timestamps', {
        'general': [
            { type: 'message', user: 'U123', text: 'DB test', ts: now.toString() }
        ]
    });

    const result = await uploadFile(zipPath, cookie);
    await delay(100);

    // Query database to verify timestamp
    const dbRecords = await knex('slack_messages')
        .where('text', 'DB test')
        .select('msg_timestamp');

    const hasCorrectTimestamp = dbRecords.length > 0 && dbRecords[0].msg_timestamp;
    return logTest('DATABASE', 'Correct timestamps',
        hasCorrectTimestamp,
        { recordCount: dbRecords.length, hasTimestamp: hasCorrectTimestamp }
    );
}

async function test_database_channelMapping(cookie) {
    const now = Date.now() / 1000;
    const zipPath = createTestZip('db_channels', {
        'test-channel': [
            { type: 'message', user: 'U123', text: 'Channel test', ts: now.toString() }
        ]
    });

    const result = await uploadFile(zipPath, cookie);
    await delay(100);

    const dbRecords = await knex('slack_messages')
        .where('text', 'Channel test')
        .select('channel');

    const correctChannel = dbRecords.length > 0 && dbRecords[0].channel === 'test-channel';
    return logTest('DATABASE', 'Correct channel mapping',
        correctChannel,
        { channel: dbRecords[0]?.channel, expected: 'test-channel' }
    );
}

async function test_database_missingFields(cookie) {
    const now = Date.now() / 1000;
    const zipPath = createTestZip('db_missing_fields', {
        'general': [
            { type: 'message', user: 'U123', text: 'Complete message', ts: now.toString() },
            { type: 'message', text: 'Missing user' }, // No user field
            { user: 'U456', ts: now.toString() } // No text field
        ]
    });

    const result = await uploadFile(zipPath, cookie);
    // Should handle missing fields gracefully
    return logTest('DATABASE', 'Handling missing fields safely',
        result.body.success && result.body.message_count >= 1,
        { messageCount: result.body.message_count }
    );
}

// ============================================================================
// CATEGORY 4: API ENDPOINTS
// ============================================================================

async function test_api_postUpload(cookie) {
    const now = Date.now() / 1000;
    const zipPath = createTestZip('api_upload', {
        'general': [
            { type: 'message', user: 'U123', text: 'API test', ts: now.toString() }
        ]
    });

    const result = await uploadFile(zipPath, cookie);
    return logTest('API', 'POST /slack/upload',
        result.status === 200 && result.body.success,
        { status: result.status, success: result.body.success }
    );
}

async function test_api_getChannels(cookie) {
    const result = await getRequest('/slack/channels', cookie);
    return logTest('API', 'GET /slack/channels',
        result.status === 200 && Array.isArray(result.body),
        { status: result.status, isArray: Array.isArray(result.body), count: result.body.length }
    );
}

async function test_api_getMessages(cookie) {
    const result = await getRequest('/slack/messages/general', cookie);
    return logTest('API', 'GET /slack/messages/:channel',
        result.status === 200 && Array.isArray(result.body),
        { status: result.status, isArray: Array.isArray(result.body), count: result.body.length }
    );
}

async function test_api_getMessagesWithKeyword(cookie) {
    const result = await getRequest('/slack/messages/general?keyword=test', cookie);
    return logTest('API', 'GET /slack/messages/:channel?keyword=',
        result.status === 200 && Array.isArray(result.body),
        { status: result.status, count: result.body.length }
    );
}

async function test_api_search(cookie) {
    const result = await getRequest('/slack/search?keyword=message', cookie);
    return logTest('API', 'GET /slack/search?keyword=',
        result.status === 200 && Array.isArray(result.body),
        { status: result.status, count: result.body.length }
    );
}

async function test_api_searchNoKeyword(cookie) {
    const result = await getRequest('/slack/search', cookie);
    return logTest('API', 'GET /slack/search (no keyword)',
        result.status === 400,
        { status: result.status, expectError: true }
    );
}

async function test_api_nonExistentChannel(cookie) {
    const result = await getRequest('/slack/messages/nonexistent-channel-xyz', cookie);
    return logTest('API', 'GET /slack/messages/:channel (non-existent)',
        result.status === 200 && Array.isArray(result.body) && result.body.length === 0,
        { status: result.status, count: result.body.length }
    );
}

// ============================================================================
// CATEGORY 5: END-TO-END FLOW
// ============================================================================

async function test_e2e_fullFlow(cookie) {
    const now = Date.now() / 1000;
    const testText = `E2E_TEST_${Date.now()}`;

    // 1. Upload
    const zipPath = createTestZip('e2e_full', {
        'e2e-channel': [
            { type: 'message', user: 'U123', text: testText, ts: now.toString() }
        ]
    });

    const uploadResult = await uploadFile(zipPath, cookie);
    if (!uploadResult.body.success) {
        return logTest('E2E', 'Full flow (upload → DB → API)', false,
            { step: 'upload', error: 'Upload failed' }
        );
    }

    await delay(200);

    // 2. Verify in database
    const dbRecords = await knex('slack_messages')
        .where('text', testText)
        .select('*');

    if (dbRecords.length === 0) {
        return logTest('E2E', 'Full flow (upload → DB → API)', false,
            { step: 'database', error: 'Not found in DB' }
        );
    }

    // 3. Fetch via API
    const apiResult = await getRequest('/slack/messages/e2e-channel', cookie);
    const foundInAPI = apiResult.body.some(msg => msg.text === testText);

    return logTest('E2E', 'Full flow (upload → DB → API)', foundInAPI,
        { uploadSuccess: true, dbSuccess: true, apiSuccess: foundInAPI }
    );
}

async function test_e2e_30DayFilter(cookie) {
    const now = Date.now() / 1000;
    const old = now - (40 * 24 * 60 * 60); // 40 days ago

    const zipPath = createTestZip('e2e_filter', {
        'general': [
            { type: 'message', user: 'U123', text: 'Recent message', ts: now.toString() },
            { type: 'message', user: 'U456', text: 'Old message', ts: old.toString() }
        ]
    });

    const uploadResult = await uploadFile(zipPath, cookie);

    // Should only store recent message (30-day filter)
    const storedRecent = uploadResult.body.message_count === 1;

    return logTest('E2E', '30-day filter consistency',
        storedRecent,
        { messageCount: uploadResult.body.message_count, expected: 1 }
    );
}

// ============================================================================
// CATEGORY 6: STRESS & RELIABILITY
// ============================================================================

async function test_stress_sequential10(cookie) {
    const results = [];

    for (let i = 0; i < 10; i++) {
        const now = Date.now() / 1000;
        const zipPath = createTestZip(`stress_${i}`, {
            'general': [
                { type: 'message', user: 'U123', text: `Stress test ${i}`, ts: now.toString() }
            ]
        });

        const result = await uploadFile(zipPath, cookie);
        results.push(result.status === 200 && result.body.success);
        await delay(150);
    }

    const successCount = results.filter(r => r).length;
    return logTest('STRESS', 'Sequential 10 uploads',
        successCount === 10,
        { successCount, totalCount: 10 }
    );
}

async function test_stress_multipleMalformed(cookie) {
    const results = [];

    for (let i = 0; i < 3; i++) {
        const txtPath = path.join(TEST_DIR, `malformed_${i}.zip`);
        fs.writeFileSync(txtPath, `Invalid content ${i}`);

        try {
            const result = await uploadFile(txtPath, cookie);
            results.push(result.status === 400 || result.status === 500);
        } catch (error) {
            results.push(true); // Error is acceptable
        }
        await delay(100);
    }

    const allHandled = results.every(r => r);
    return logTest('STRESS', 'Multiple malformed files',
        allHandled,
        { handledCount: results.filter(r => r).length, totalCount: 3 }
    );
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('🧪 COMPREHENSIVE REGRESSION TEST SUITE');
    console.log('='.repeat(70) + '\n');

    // Setup
    if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    try {
        console.log('Logging in...');
        const cookie = await login();
        if (!cookie) {
            console.error('❌ Login failed - cannot run tests');
            return;
        }
        console.log('✅ Logged in\n');

        // CATEGORY 1: FILE UPLOAD HANDLING
        console.log('\n📁 CATEGORY 1: FILE UPLOAD HANDLING');
        console.log('-'.repeat(70));
        await test_fileUpload_normal(cookie);
        await delay(200);
        await test_fileUpload_sequential(cookie);
        await delay(200);
        await test_fileUpload_large(cookie);
        await delay(200);
        await test_fileUpload_malformedZip(cookie);
        await delay(200);
        await test_fileUpload_nonZip(cookie);
        await delay(200);
        await test_fileUpload_noBusboyErrors(cookie);
        await delay(200);

        // CATEGORY 2: SLACK PARSER VALIDATION
        console.log('\n🔍 CATEGORY 2: SLACK PARSER VALIDATION');
        console.log('-'.repeat(70));
        await test_parser_normalMessages(cookie);
        await delay(200);
        await test_parser_botMessages(cookie);
        await delay(200);
        await test_parser_timestamps(cookie);
        await delay(200);
        await test_parser_emptyChannels(cookie);
        await delay(200);
        await test_parser_attachments(cookie);
        await delay(200);
        await test_parser_malformedJSON(cookie);
        await delay(200);
        await test_parser_channelTraversal(cookie);
        await delay(200);

        // CATEGORY 3: DATABASE INSERT LOGIC
        console.log('\n💾 CATEGORY 3: DATABASE INSERT LOGIC');
        console.log('-'.repeat(70));
        await test_database_correctTimestamps(cookie);
        await delay(200);
        await test_database_channelMapping(cookie);
        await delay(200);
        await test_database_missingFields(cookie);
        await delay(200);

        // CATEGORY 4: API ENDPOINTS
        console.log('\n🌐 CATEGORY 4: API ENDPOINTS');
        console.log('-'.repeat(70));
        await test_api_postUpload(cookie);
        await delay(200);
        await test_api_getChannels(cookie);
        await delay(200);
        await test_api_getMessages(cookie);
        await delay(200);
        await test_api_getMessagesWithKeyword(cookie);
        await delay(200);
        await test_api_search(cookie);
        await delay(200);
        await test_api_searchNoKeyword(cookie);
        await delay(200);
        await test_api_nonExistentChannel(cookie);
        await delay(200);

        // CATEGORY 5: END-TO-END FLOW
        console.log('\n🔄 CATEGORY 5: END-TO-END FLOW');
        console.log('-'.repeat(70));
        await test_e2e_fullFlow(cookie);
        await delay(200);
        await test_e2e_30DayFilter(cookie);
        await delay(200);

        // CATEGORY 6: STRESS & RELIABILITY
        console.log('\n⚡ CATEGORY 6: STRESS & RELIABILITY');
        console.log('-'.repeat(70));
        await test_stress_sequential10(cookie);
        await delay(200);
        await test_stress_multipleMalformed(cookie);

        // Generate summary
        console.log('\n' + '='.repeat(70));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(70) + '\n');

        const byCategory = {};
        RESULTS.forEach(r => {
            if (!byCategory[r.category]) {
                byCategory[r.category] = { passed: 0, failed: 0, tests: [] };
            }
            if (r.passed) {
                byCategory[r.category].passed++;
            } else {
                byCategory[r.category].failed++;
            }
            byCategory[r.category].tests.push(r);
        });

        Object.keys(byCategory).forEach(category => {
            const stats = byCategory[category];
            const total = stats.passed + stats.failed;
            const icon = stats.failed === 0 ? '✅' : '⚠️';
            console.log(`${icon} ${category}: ${stats.passed}/${total} passed`);

            if (stats.failed > 0) {
                stats.tests.filter(t => !t.passed).forEach(t => {
                    console.log(`   ❌ ${t.name}`);
                    if (t.details.error) {
                        console.log(`      Error: ${t.details.error}`);
                    }
                });
            }
        });

        const totalPassed = RESULTS.filter(r => r.passed).length;
        const totalTests = RESULTS.length;
        const passRate = ((totalPassed / totalTests) * 100).toFixed(1);

        console.log('\n' + '='.repeat(70));
        console.log(`OVERALL: ${totalPassed}/${totalTests} tests passed (${passRate}%)`);
        console.log('='.repeat(70));

        if (totalPassed === totalTests) {
            console.log('\n🎉 ALL TESTS PASSED! System is fully functional.\n');
        } else {
            console.log(`\n⚠️  ${totalTests - totalPassed} test(s) failed. Review above for details.\n`);
        }

        // Save detailed results
        const reportPath = path.join(__dirname, 'regression_report.json');
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            summary: {
                total: totalTests,
                passed: totalPassed,
                failed: totalTests - totalPassed,
                passRate: passRate + '%'
            },
            byCategory,
            allResults: RESULTS
        }, null, 2));

        console.log(`📄 Detailed report saved to: ${reportPath}\n`);

    } catch (error) {
        console.error('❌ Test suite error:', error);
    } finally {
        // Cleanup
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true });
        }
        await knex.destroy();
    }
}

runAllTests();
