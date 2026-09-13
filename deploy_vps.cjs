const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH Connection to VPS Successful!');
  
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP Error:', err);
      conn.end();
      return;
    }
    
    const vpsPath = '/root/bk 2/shh 2/bk_operations';
    console.log('Uploading db.cjs to VPS...');
    
    sftp.fastPut(
      path.join(__dirname, 'db.cjs'),
      `${vpsPath}/db.cjs`,
      (err) => {
        if (err) {
          console.error('Failed to upload db.cjs:', err);
          conn.end();
          return;
        }
        console.log('Successfully uploaded db.cjs!');
        
        console.log('Uploading style.css to VPS...');
        sftp.fastPut(
          path.join(__dirname, 'style.css'),
          `${vpsPath}/style.css`,
          (err) => {
            if (err) console.error('Failed to upload style.css:', err);
            else console.log('Successfully uploaded style.css!');
            
            const command = `
              cd "/root/bk 2/shh 2/bk_operations"
              echo "=== Building Vite Bundle on VPS ==="
              npm run build || true
              
              echo "=== Restarting PM2 process bk-ops ==="
              pm2 restart bk-ops || pm2 restart all
              sleep 2
              
              echo "=== Testing local port 3000 ==="
              curl -I http://localhost:3000
              
              echo "=== PM2 Status ==="
              pm2 status
              
              echo "=== PM2 Error Log (Last 10 lines) ==="
              pm2 logs bk-ops --lines 10 --nostream
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
          }
        );
      }
    );
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
