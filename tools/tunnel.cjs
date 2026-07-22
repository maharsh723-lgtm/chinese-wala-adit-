const localtunnel = require('localtunnel');

(async () => {
  try {
    console.log("Starting localtunnel on port 3000...");
    const tunnel = await localtunnel({ port: 3000 });

    console.log("==========================================");
    console.log(`Localtunnel is active!`);
    console.log(`Public URL: ${tunnel.url}`);
    console.log("==========================================");

    tunnel.on('close', () => {
      console.log("Tunnel closed");
    });
  } catch (err) {
    console.error("Localtunnel failed to start:", err);
  }
})();
