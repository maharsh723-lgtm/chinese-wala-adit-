process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const localtunnel = require('localtunnel');
const fs = require('fs');

async function getPublicIP() {
  try {
    const res = await fetch('https://api.ipify.org');
    return (await res.text()).trim();
  } catch(e) {
    return '1.38.158.138';
  }
}

async function startTunnel() {
  const ip = await getPublicIP();
  while (true) {
    try {
      console.log("Starting localtunnel on port 3000...");
      const tunnel = await localtunnel({
        port: 3000,
        subdomain: 'chinesewala-adit'
      });

      console.log("==========================================");
      console.log(`Localtunnel is active!`);
      console.log(`Public URL: ${tunnel.url}`);
      console.log(`Tunnel Password (IP): ${ip}`);
      console.log("==========================================");

      fs.writeFileSync('tunnel_url.txt', `${tunnel.url}\nPassword: ${ip}\n`, 'utf8');

      await new Promise((resolve) => {
        tunnel.on('close', () => {
          console.log("Tunnel closed, reconnecting in 3s...");
          resolve();
        });
        tunnel.on('error', (err) => {
          console.error("Tunnel error:", err.message);
          try { tunnel.close(); } catch(e) {}
          resolve();
        });
      });
    } catch (err) {
      console.error("Localtunnel failed to start, retrying in 5s:", err.message);
    }
    await new Promise(r => setTimeout(r, 4000));
  }
}

startTunnel();
