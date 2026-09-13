const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH Connection to VPS Successful!');
  
  const command = `
    echo "=== Cleaning local changes and syncing git on VPS ==="
    cd "/root/bk 2/shh 2/bk_operations"
    git remote set-url origin https://github.com/maharsh089-cmd/bk_operation.git
    git fetch origin main
    git reset --hard origin/main
    
    echo "=== Current Commit on VPS ==="
    git log -n 1 --oneline
    
    echo "=== Building Production Bundle ==="
    npm run build || true
    
    echo "=== Restarting PM2 Processes ==="
    pm2 restart all
    sleep 2
    
    echo "=== PM2 Status ==="
    pm2 status
  `;

  conn.exec(command, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log('Stream closed with code:', code);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection Error:', err);
}).connect({
  host: '200.97.172.171',
  port: 22,
  username: 'root',
  password: 'Nitip@tel2007',
  readyTimeout: 30000
});
