/**
 * Test Script: System Extension Verification
 * Verifies auto-extraction, event storage, and new endpoints
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const FormData = require('form-data');
const http = require('http');

const TEST_DIR = path.join(__dirname, 'extension_test');

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

// Helper: Upload file
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
                    // Try parsing JSON, otherwise return text (for ICS)
                    const contentType = res.headers['content-type'];
                    if (contentType && contentType.includes('application/json')) {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    } else {
                        resolve({ status: res.statusCode, body: data, isText: true });
                    }
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
function createTestZip() {
    const zipPath = path.join(TEST_DIR, 'extension_test.zip');
    const tempDir = path.join(TEST_DIR, 'temp');

    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });

    const channelDir = path.join(tempDir, 'extension-test');
    fs.mkdirSync(channelDir);

    // Create messages with events
    const now = Date.now() / 1000;
    const messages = [
        {
            type: 'message',
            user: 'U123',
            text: 'Important meeting tomorrow at 2pm',
            ts: now.toString()
        },
        {
            type: 'message',
            user: 'U456',
            text: 'Project deadline is next Friday',
            ts: now.toString()
        }
    ];

    fs.writeFileSync(
        path.join(channelDir, '2024-01-01.json'),
        JSON.stringify(messages)
    );

    const zip = new AdmZip();
    zip.addLocalFolder(tempDir);
    zip.writeZip(zipPath);
    fs.rmSync(tempDir, { recursive: true });

    return zipPath;
}

async function runTest() {
    console.log('🧪 Testing System Extension...\n');

    try {
        // 1. Login
        console.log('1. Logging in...');
        const cookie = await login();
        if (!cookie) {
            console.error('❌ Login failed');
            return;
        }
        console.log('✅ Logged in\n');

        // 2. Create and Upload ZIP
        console.log('2. Uploading ZIP with event messages...');
        const zipPath = createTestZip();
        const uploadResult = await uploadFile(zipPath, cookie);

        if (uploadResult.status === 200 && uploadResult.body.success) {
            console.log('✅ Upload successful');
            console.log(`   Extracted events count: ${uploadResult.body.extracted_events}`);
        } else {
            console.error('❌ Upload failed:', uploadResult.body);
            return;
        }

        // Wait for DB insertion (though it should be awaited in controller)
        await new Promise(r => setTimeout(r, 1000));

        // 3. Verify Events Retrieval
        console.log('\n3. Fetching upcoming events...');
        const eventsResult = await getRequest('/events/upcoming', cookie);

        if (eventsResult.status === 200 && Array.isArray(eventsResult.body)) {
            console.log(`✅ Retrieved ${eventsResult.body.length} events`);
            if (eventsResult.body.length > 0) {
                console.log('   Sample event:', eventsResult.body[0].title);
            }
        } else {
            console.error('❌ Failed to fetch events:', eventsResult.body);
        }

        // 4. Verify Calendar Export
        console.log('\n4. Exporting calendar (ICS)...');
        const icsResult = await getRequest('/calendar/export', cookie);

        if (icsResult.status === 200 && icsResult.body.includes('BEGIN:VCALENDAR')) {
            console.log('✅ ICS export successful');
            console.log('   Content preview:');
            console.log(icsResult.body.split('\n').slice(0, 5).join('\n'));
        } else {
            console.error('❌ ICS export failed');
        }

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true });
        }
    }
}

runTest();
