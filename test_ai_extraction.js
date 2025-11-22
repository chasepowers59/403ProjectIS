/**
 * Test Script: AI Event Extraction
 * Verifies the /slack/ai-extract endpoint
 */

const http = require('http');

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

// Helper: Post JSON
function postJSON(path, data, cookie) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Cookie': cookie
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, body });
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function runTest() {
    console.log('🧪 Testing AI Event Extraction...\n');

    try {
        // 1. Login
        console.log('1. Logging in...');
        const cookie = await login();
        if (!cookie) {
            console.error('❌ Login failed');
            return;
        }
        console.log('✅ Logged in\n');

        // 2. Prepare test messages
        const now = new Date().toISOString();
        const testMessages = [
            {
                channel: 'general',
                user: 'U123',
                msg_timestamp: now,
                text: 'Hey everyone, just a reminder that the team meeting is tomorrow at 10 AM.'
            },
            {
                channel: 'random',
                user: 'U456',
                msg_timestamp: now,
                text: 'Anyone want to grab lunch?'
            },
            {
                channel: 'announcements',
                user: 'BOT',
                msg_timestamp: now,
                text: 'Project deadline is set for next Friday.'
            }
        ];

        console.log('2. Sending test messages to /slack/ai-extract...');
        console.log(`   Input: ${testMessages.length} messages`);

        const result = await postJSON('/slack/ai-extract', { messages: testMessages }, cookie);

        console.log(`\n📤 Response (Status ${result.status}):`);
        console.log(JSON.stringify(result.body, null, 2));

        if (result.status === 200 && result.body.success) {
            console.log('\n✅ Extraction successful!');
            console.log(`   Found ${result.body.count} events.`);

            // Basic validation
            const events = result.body.events;
            const hasMeeting = events.some(e => e.title.toLowerCase().includes('meeting'));
            const hasDeadline = events.some(e => e.title.toLowerCase().includes('deadline'));

            if (hasMeeting && hasDeadline) {
                console.log('   ✅ Identified both meeting and deadline.');
            } else {
                console.log('   ⚠️  Might have missed some events (check output).');
            }
        } else {
            console.log('\n❌ Extraction failed.');
        }

    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

runTest();
