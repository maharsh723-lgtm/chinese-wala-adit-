const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function uploadDir(sftp, localDir, remoteDir) {
  return new Promise(async (resolve, reject) => {
    try {
      sftp.mkdir(remoteDir, (err) => {
        // ignore dir exists error
      });
      const files = fs.readdirSync(localDir);
      for (const file of files) {
        const localPath = path.join(localDir, file);
        const remotePath = `${remoteDir}/${file}`;
        const stat = fs.statSync(localPath);
        if (stat.isDirectory()) {
          await uploadDir(sftp, localPath, remotePath);
        } else {
          console.log(`Uploading ${file}...`);
          await uploadFile(sftp, localPath, remotePath);
        }
      }
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

conn.on('ready', () => {
  console.log('SSH Connection to VPS Successful!');
  
  conn.sftp(async (err, sftp) => {
    if (err) {
      console.error('SFTP Error:', err);
      conn.end();
      return;
    }
    
    try {
      const vpsPath = '/root/bk 2/shh 2/bk_operations';
      console.log('=== Uploading core application files to VPS via SFTP ===');
      
      await uploadFile(sftp, path.join(__dirname, 'server.cjs'), `${vpsPath}/server.cjs`);
      await uploadFile(sftp, path.join(__dirname, 'db.cjs'), `${vpsPath}/db.cjs`);
      await uploadFile(sftp, path.join(__dirname, 'style.css'), `${vpsPath}/style.css`);
      await uploadFile(sftp, path.join(__dirname, 'package.json'), `${vpsPath}/package.json`);
      await uploadFile(sftp, path.join(__dirname, 'package-lock.json'), `${vpsPath}/package-lock.json`);
      
      console.log('=== Uploading built dist/ bundle to VPS ===');
      await uploadDir(sftp, path.join(__dirname, 'dist'), `${vpsPath}/dist`);

      console.log('=== Installing packages & Restarting PM2 on VPS ===');
      const command = `
        cd "/root/bk 2/shh 2/bk_operations"
        npm install --production || true
        pm2 restart all
        sleep 2
        pm2 status
      `;

      conn.exec(command, (execErr, stream) => {
        if (execErr) {
          console.error('Exec error:', execErr);
          conn.end();
          return;
        }
        stream.on('close', (code) => {
          console.log('Deployment completed with status code:', code);
          conn.end();
        }).on('data', (data) => {
          process.stdout.write(data);
        }).stderr.on('data', (data) => {
          process.stderr.write(data);
        });
      });

    } catch (uploadErr) {
      console.error('Upload Error:', uploadErr);
      conn.end();
    }
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
