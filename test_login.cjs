const https = require('https');

const data = JSON.stringify({ username: "bk2022", password: "wrongpassword" });
const options = {
  hostname: 'ops.badikatori.in',
  port: 443,
  path: '/api/auth/login',
  method: 'POST',
  rejectUnauthorized: false,
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  let body = '';
  res.on('data', d => {
    body += d;
  });
  res.on('end', () => {
    console.log('Body start:', body.slice(0, 100));
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
