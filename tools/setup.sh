#!/bin/bash

# Badi Katori VPS Auto-Deployment Script
# For Ubuntu 20.04/22.04 LTS

set -e

# Configuration variables (Adjust these)
SUBDOMAIN="ops.badikatori.com"
REPO_URL="https://github.com/maharsh089-cmd/bk_operation.git" # Replace with your actual repository URL
APP_PORT=3000

echo "=================================================="
echo " Starting Automated Badi Katori VPS Setup..."
echo "=================================================="

# 1. Update system packages
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (v20 LTS)
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install Git, Nginx, PM2
echo "Installing Git, Nginx, and PM2..."
sudo apt install -y git nginx build-essential
sudo npm install -g pm2

# 4. Clone and prepare app
echo "Cloning repository..."
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www

if [ -d "bk-app" ]; then
    echo "App directory already exists. Pulling latest updates..."
    cd bk-app
    git pull
else
    git clone "$REPO_URL" bk-app
    cd bk-app
fi

# Install dependencies
echo "Installing application dependencies..."
npm install

# Build static assets
echo "Building production frontend assets..."
npm run build

# 5. Start app under PM2
echo "Starting application process with PM2..."
pm2 stop bk-ops || true
pm2 start server.cjs --name "bk-ops"
pm2 save
pm2 startup systemd || true

# 6. Configure Nginx Reverse Proxy
echo "Configuring Nginx reverse proxy..."
NGINX_CONF="/etc/nginx/sites-available/$SUBDOMAIN"

sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name $SUBDOMAIN;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable configuration if not already enabled
if [ ! -f "/etc/nginx/sites-enabled/$SUBDOMAIN" ]; then
    sudo ln -s "$NGINX_CONF" "/etc/nginx/sites-enabled/"
fi

# Reload Nginx
sudo nginx -t
sudo systemctl restart nginx

# 7. Configure SSL (Let's Encrypt)
echo "Configuring SSL Certificate..."
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d "$SUBDOMAIN" --non-interactive --agree-tos -m admin@badikatori.com

echo "=================================================="
echo " Auto-Deployment Finished Successfully!"
echo " Your application is live at: https://$SUBDOMAIN"
echo "=================================================="
