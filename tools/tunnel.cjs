process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.on('uncaughtException', (err) => console.error('Tunnel supervisor caught error:', err.message));
process.on('unhandledRejection', (reason) => console.error('Tunnel supervisor caught rejection:', reason));

const localtunnel = require('localtunnel');
const fs = require('fs');

// Perpetual heartbeat keeps Node event loop alive indefinitely
setInterval(() => {}, 60000);

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
  let useSubdomain = true;

  while (true) {
    let currentTunnel = null;
    try {
      console.log(`Starting localtunnel on port 3000 (subdomain: ${useSubdomain ? 'chinesewala-adit' : 'auto'})...`);
      
      const opts = { port: 3000 };
      if (useSubdomain) {
        opts.subdomain = 'chinesewala-adit';
      }

      currentTunnel = await localtunnel(opts);

      console.log("==========================================");
      console.log(`Localtunnel is active!`);
      console.log(`Public URL: ${currentTunnel.url}`);
      console.log(`Tunnel Password (IP): ${ip}`);
      console.log("==========================================");

      fs.writeFileSync('tunnel_url.txt', `${currentTunnel.url}\nPassword: ${ip}\n`, 'utf8');

      await new Promise((resolve) => {
        let done = false;
        const cleanup = () => {
          if (!done) {
            done = true;
            try { currentTunnel.close(); } catch(e) {}
            resolve();
          }
        };

        currentTunnel.on('close', () => {
          console.log("Tunnel closed event received.");
          cleanup();
        });

        currentTunnel.on('error', (err) => {
          console.error("Tunnel error:", err.message);
          if (err.message && err.message.includes('connection refused')) {
            useSubdomain = !useSubdomain;
          }
          cleanup();
        });
      });
    } catch (err) {
      console.error("Localtunnel failed to start:", err.message);
      useSubdomain = !useSubdomain;
    }

    console.log("Re-establishing tunnel in 3 seconds...");
    await new Promise(r => setTimeout(r, 3000));
  }
}

startTunnel();
