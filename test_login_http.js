const http = require('http');
const querystring = require('querystring');

const postData = querystring.stringify({
    'email': 'admin@byu.edu',
    'password': 'password123'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        req.write(postData);
        req.end();
