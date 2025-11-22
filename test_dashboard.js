const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/dashboard',
    method: 'GET',
    headers: {
        'Cookie': 'connect.sid=test'
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    let body = '';
    res.on('data', (chunk) => {
        body += chunk;
    });
    res.on('end', () => {
        // Check if channels are in the response
        const channelMatches = body.match(/option value="C[A-Z0-9]+"/g);
        if (channelMatches) {
            console.log(`Found ${channelMatches.length} channels in dropdown`);
            channelMatches.slice(0, 5).forEach(m => console.log(`  ${m}`));
        } else {
            console.log('No channels found in dropdown');
        }
    });
});

req.on('error', (e) => {
    console.error(`Error: ${e.message}`);
});

req.end();
