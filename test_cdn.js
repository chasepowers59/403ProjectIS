const https = require('https');

const options = {
    hostname: 'cdn.jsdelivr.net',
    path: '/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    method: 'HEAD'
};

const req = https.request(options, (res) => {
    console.log(`CDN STATUS: ${res.statusCode}`);
});

req.on('error', (e) => {
    console.error(`CDN Error: ${e.message}`);
});

req.end();
