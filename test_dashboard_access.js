const http = require('http');
const querystring = require('querystring');

function loginAndGetDashboard() {
    const postData = querystring.stringify({
        'email': 'admin@byu.edu',
        'password': 'password123'
    });

    const loginOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(loginOptions, (res) => {
        console.log(`Login Status: ${res.statusCode}`);

        if (res.statusCode === 302) {
            const cookies = res.headers['set-cookie'];
            console.log('Cookies:', cookies);

            if (cookies) {
                // Access Dashboard
                const dashboardOptions = {
                    hostname: 'localhost',
                    port: 3000,
                    path: '/dashboard',
                    method: 'GET',
                    headers: {
                        'Cookie': cookies
                    }
                };

                const dashReq = http.request(dashboardOptions, (dashRes) => {
                    console.log(`Dashboard Status: ${dashRes.statusCode}`);
                    dashRes.setEncoding('utf8');
                    let data = '';
                    dashRes.on('data', (chunk) => { data += chunk; });
                    dashRes.on('end', () => {
                        console.log('Dashboard accessed successfully.');
                        // console.log(data); // Uncomment to see HTML
                    });
                });

                dashReq.on('error', (e) => console.error(e));
                dashReq.end();
            }
        }
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

loginAndGetDashboard();
