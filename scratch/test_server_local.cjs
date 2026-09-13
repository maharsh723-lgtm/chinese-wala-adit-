const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/state',
  method: 'GET',
  headers: {
    'Accept-Encoding': 'gzip'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let chunks = [];
  res.on('data', (chunk) => {
    chunks.push(chunk);
  });
  
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    console.log(`Transferred size: ${buffer.length} bytes`);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
