const http = require('http');

const start = Date.now();
http.get('http://localhost:3000/api/state', { headers: { 'Authorization': 'Bearer ' } }, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log(`Time taken: ${Date.now() - start} ms, Response length: ${data.length}`);
    });
});
