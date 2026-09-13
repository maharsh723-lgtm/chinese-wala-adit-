const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH Connection to VPS Successful!');
  
  const command = `
    echo "=== Locating bk_operations directory ==="
    TARGET_DIR=""
    for d in /root/bk_operations /root/2/bk_operations /var/www/bk_operations /root/bk; do
      if [ -d "$d/.git" ]; then
        TARGET_DIR="$d"
        break
      fi
    done
    if [ -z "$TARGET_DIR" ]; then
      TARGET_DIR=$(find /root /var/www /home -name ".git" 2>/dev/null | head -n 1 | xargs dirname)
    fi
    echo "Target repo directory: $TARGET_DIR"
    cd "$TARGET_DIR"
    
    echo "=== Running git pull ==="
    git fetch origin main
    git reset --hard origin/main
    
    echo "=== Checking PM2 Logs (Last 20 lines) ==="
    pm2 logs --lines 20 --nostream
    
    echo "=== Restarting PM2 Processes ==="
    pm2 restart all
    
    echo "=== Testing Local HTTP Ports ==="
    curl -I http://localhost:3000 || echo "Port 3000 failed"
    curl -I http://localhost:5000 || echo "Port 5000 failed"
    curl -I http://localhost:8080 || echo "Port 8080 failed"
    
    echo "=== Checking Nginx status ==="
    systemctl status nginx --no-pager | head -n 15
    nginx -t
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
