/**
 * Test Script: Upload Slack Export ZIP
 * Tests the /slack/upload endpoint
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const zipPath = path.join(__dirname, 'test-slack-export.zip');

// First, login to get session cookie
function login(callback) {
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
        callback(cookie ? cookie[0] : null);
    });

    req.on('error', (e) => console.error('Login error:', e));
    req.write(postData);
    req.end();
}

// Upload ZIP file
function uploadZip(cookie) {
    const form = new FormData();
    form.append('zipfile', fs.createReadStream(zipPath));

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

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log(`\n📤 Upload Response (Status ${res.statusCode}):`);
            try {
                const result = JSON.parse(data);
                console.log(JSON.stringify(result, null, 2));

                if (result.success) {
                    console.log('\n✅ Upload successful!');
                    console.log(`   - Batch ID: ${result.batch_id}`);
                    console.log(`   - Messages stored: ${result.message_count}`);
                    console.log(`   - Total parsed: ${result.total_parsed}`);
                    console.log(`   - Channels: ${result.channels.join(', ')}`);
                }
            } catch (e) {
                console.log('Raw response:', data);
            }
        });
    });

    req.on('error', (e) => console.error('Upload error:', e));
    form.pipe(req);
}

// Run test
console.log('🧪 Testing Slack ZIP Upload...\n');
console.log('1. Logging in...');

login((cookie) => {
    if (!cookie) {
        console.error('❌ Login failed - no session cookie');
        return;
    }

    console.log('✅ Login successful\n');
    console.log('2. Uploading test-slack-export.zip...');

    uploadZip(cookie);
});
