/**
 * Test Script: Test all Slack query endpoints
 */

const http = require('http');

// Login first
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

// Test GET endpoint
function testGet(path, cookie, description) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET',
            headers: {
                'Cookie': cookie
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`\n${description}:`);
                console.log(`Status: ${res.statusCode}`);
                try {
                    const result = JSON.parse(data);
                    console.log(JSON.stringify(result, null, 2));
                } catch (e) {
                    console.log('Raw response:', data);
                }
                resolve();
            });
        });

        req.on('error', (e) => console.error('Request error:', e));
        req.end();
    });
}

// Run tests
async function runTests() {
    console.log('🧪 Testing Slack Query Endpoints...\n');
    console.log('1. Logging in...');

    login(async (cookie) => {
        if (!cookie) {
            console.error('❌ Login failed');
            return;
        }

        console.log('✅ Login successful\n');

        // Test channels endpoint
        await testGet('/slack/channels', cookie, '📋 GET /slack/channels');

        // Test messages endpoint
        await testGet('/slack/messages/general', cookie, '💬 GET /slack/messages/general');

        // Test messages with keyword
        await testGet('/slack/messages/general?keyword=assignment', cookie, '🔍 GET /slack/messages/general?keyword=assignment');

        // Test search endpoint
        await testGet('/slack/search?keyword=message', cookie, '🔎 GET /slack/search?keyword=message');

        console.log('\n✅ All tests complete!');
    });
}

runTests();
