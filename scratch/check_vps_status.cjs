const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connection Successful! Checking PM2 status & logs...');
  const command = `
    pm2 status
    echo "=== PM2 BADI-KATORI LOGS ==="
    pm2 logs badi-katori --lines 40 --nostream
    echo "=== PM2 BK-OPS LOGS ==="
    pm2 logs bk-ops --lines 40 --nostream
  `;
  conn.exec(command, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '200.97.172.171',
  port: 22,
  username: 'root',
  password: 'Nitip@tel2007',
  readyTimeout: 30000
});
