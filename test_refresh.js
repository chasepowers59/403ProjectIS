const http = require('http');

const postData = JSON.stringify({
    channelId: ''
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/refresh-data',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': 'connect.sid=test' // Dummy session
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    let body = '';
    res.on('data', (chunk) => {
        body += chunk;
    });
    res.on('end', () => {
        console.log(`BODY: ${body}`);
    });
});

req.on('error', (e) => {
    console.error(`Error: ${e.message}`);
});

req.write(postData);
req.end();
