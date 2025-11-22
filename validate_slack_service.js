/**
 * Comprehensive End-to-End Validation Tests for Slack Upload Service
 * FIXED: Proper stream handling to prevent "Unexpected end of form" errors
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const FormData = require('form-data');
const http = require('http');

const TEST_DIR = path.join(__dirname, 'test-validation');
const RESULTS = [];

// Helper: Login and get cookie
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
                // Ensure file stream is fully closed before resolving
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

        // Handle form errors
        form.on('error', (err) => {
            fileStream.destroy();
            reject(err);
        });

        // Pipe form to request
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

    // Create temp directory structure
    fs.mkdirSync(tempDir, { recursive: true });

    for (const [channelName, messages] of Object.entries(structure)) {
        const channelDir = path.join(tempDir, channelName);
        fs.mkdirSync(channelDir, { recursive: true });
        fs.writeFileSync(
            path.join(channelDir, '2024-01-01.json'),
            JSON.stringify(messages, null, 2)
        );
    }

    // Create ZIP
    const zip = new AdmZip();
    zip.addLocalFolder(tempDir);
    zip.writeZip(zipPath);

    // Clean up temp
    fs.rmSync(tempDir, { recursive: true });

    return zipPath;
}

// Test 1: Normal messages
async function test1_normalMessages(cookie) {
    console.log('\n🧪 TEST 1: Normal Messages');

    const now = Date.now() / 1000;
    const zipPath = createTestZip('test1_normal', {
        'general': [
            { type: 'message', user: 'U123', text: 'Hello world', ts: now.toString() },
            { type: 'message', user: 'U456', text: 'Test message', ts: (now - 100).toString() }
        ]
    });

    const result = await uploadFile(zipPath, cookie);

    const testPass = result.status === 200 && result.body.success && result.body.message_count === 2;
    RESULTS.push({ test: 'Normal Messages', pass: testPass, details: result.body });
    console.log(testPass ? '✅ PASS' : '❌ FAIL', JSON.stringify(result.body, null, 2));
}

// Test 2: Bot messages
async function test2_botMessages(cookie) {
    console.log('\n🧪 TEST 2: Bot Messages');

    const now = Date.now() / 1000;
    const zipPath = createTestZip('test2_bot', {
        'general': [
            { type: 'message', bot_id: 'B123', text: 'Bot message', ts: now.toString() },
            { type: 'message', user: 'U123', text: 'User message', ts: now.toString() }
        ]
    });

    const result = await uploadFile(zipPath, cookie);

    const testPass = result.status === 200 && result.body.message_count >= 1;
    RESULTS.push({ test: 'Bot Messages', pass: testPass, details: result.body });
    console.log(testPass ? '✅ PASS' : '❌ FAIL', JSON.stringify(result.body, null, 2));
}

// Test 3: Messages with attachments
async function test3_attachments(cookie) {
    console.log('\n🧪 TEST 3: Messages with Attachments');

    const now = Date.now() / 1000;
    const zipPath = createTestZip('test3_attachments', {
        'general': [
            {
                type: 'message',
                user: 'U123',
                text: '',
                attachments: [{ text: 'Attachment text' }],
                ts: now.toString()
            },
            { type: 'message', user: 'U456', text: 'Normal text', ts: now.toString() }
        ]
    });

    const result = await uploadFile(zipPath, cookie);

    const testPass = result.status === 200;
    RESULTS.push({ test: 'Attachments', pass: testPass, details: result.body });
    console.log(testPass ? '✅ PASS' : '❌ FAIL', JSON.stringify(result.body, null, 2));
}

// Test 4: Empty channel
async function test4_emptyChannel(cookie) {
    console.log('\n🧪 TEST 4: Empty Channel');

    const zipPath = createTestZip('test4_empty', {
        'general': [],
        'random': [{ type: 'message', user: 'U123', text: 'Test', ts: (Date.now() / 1000).toString() }]
    });

    const result = await uploadFile(zipPath, cookie);

    const testPass = result.status === 200 && result.body.success;
    RESULTS.push({ test: 'Empty Channel', pass: testPass, details: result.body });
    console.log(testPass ? '✅ PASS' : '❌ FAIL', JSON.stringify(result.body, null, 2));
}

// Test 5: Malformed JSON
async function test5_malformedJSON(cookie) {
    console.log('\n🧪 TEST 5: Malformed JSON');

    const zipPath = path.join(TEST_DIR, 'test5_malformed.zip');
    const tempDir = path.join(TEST_DIR, 'temp_test5');

    fs.mkdirSync(path.join(tempDir, 'general'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'general', '2024-01-01.json'), '{invalid json}');

    const zip = new AdmZip();
    zip.addLocalFolder(tempDir);
    zip.writeZip(zipPath);
    fs.rmSync(tempDir, { recursive: true });

    const result = await uploadFile(zipPath, cookie);

    const testPass = result.status !== 500 || (result.body.error && !result.body.error.includes('Unexpected'));
    RESULTS.push({ test: 'Malformed JSON', pass: testPass, details: result.body });
    console.log(testPass ? '✅ PASS (handled gracefully)' : '❌ FAIL (crashed)', JSON.stringify(result.body, null, 2));
}

// Test 6: Non-ZIP file
async function test6_nonZipFile(cookie) {
    console.log('\n🧪 TEST 6: Non-ZIP File');

    const txtPath = path.join(TEST_DIR, 'test6.txt');
    fs.writeFileSync(txtPath, 'Not a ZIP file');

    const result = await uploadFile(txtPath, cookie);

    const testPass = result.status === 400 && result.body.error.includes('ZIP');
    RESULTS.push({ test: 'Non-ZIP File', pass: testPass, details: result.body });
    console.log(testPass ? '✅ PASS' : '❌ FAIL', JSON.stringify(result.body, null, 2));
}

// Test 7: Query endpoints
async function test7_queryEndpoints(cookie) {
    console.log('\n🧪 TEST 7: Query Endpoints');

    // Test channels
    const channels = await getRequest('/slack/channels', cookie);
    const channelsPass = channels.status === 200 && Array.isArray(channels.body);
    console.log('  Channels:', channelsPass ? '✅' : '❌', channels.body);

    // Test messages (non-existent channel)
    const noChannel = await getRequest('/slack/messages/nonexistent', cookie);
    const noChannelPass = noChannel.status === 200 && Array.isArray(noChannel.body) && noChannel.body.length === 0;
    console.log('  Non-existent channel:', noChannelPass ? '✅' : '❌');

    // Test search without keyword
    const noKeyword = await getRequest('/slack/search', cookie);
    const noKeywordPass = noKeyword.status === 400;
    console.log('  Search without keyword:', noKeywordPass ? '✅' : '❌', noKeyword.body);

    const testPass = channelsPass && noChannelPass && noKeywordPass;
    RESULTS.push({ test: 'Query Endpoints', pass: testPass, details: { channels, noChannel, noKeyword } });
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting Comprehensive Validation Tests\n');
    console.log('='.repeat(60));

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

        // Run tests SEQUENTIALLY with delays to prevent stream overlap
        await test1_normalMessages(cookie);
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay

        await test2_botMessages(cookie);
        await new Promise(resolve => setTimeout(resolve, 200));

        await test3_attachments(cookie);
        await new Promise(resolve => setTimeout(resolve, 200));

        await test4_emptyChannel(cookie);
        await new Promise(resolve => setTimeout(resolve, 200));

        await test5_malformedJSON(cookie);
        await new Promise(resolve => setTimeout(resolve, 200));

        await test6_nonZipFile(cookie);
        await new Promise(resolve => setTimeout(resolve, 200));

        await test7_queryEndpoints(cookie);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY\n');

        const passed = RESULTS.filter(r => r.pass).length;
        const total = RESULTS.length;

        RESULTS.forEach(r => {
            console.log(`${r.pass ? '✅' : '❌'} ${r.test}`);
        });

        console.log(`\n${passed}/${total} tests passed`);

        if (passed === total) {
            console.log('\n🎉 All tests passed!');
        } else {
            console.log('\n⚠️  Some tests failed - review issues above');
        }

    } catch (error) {
        console.error('❌ Test suite error:', error);
    } finally {
        // Cleanup
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true });
        }
    }
}

runAllTests();
