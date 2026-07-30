#!/bin/bash

# ==============================================================================
# Update Script for SkillSwap (Backend PM2 + Frontend Static Web)
# ==============================================================================
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ==============================================================================

# Exit immediately on error
set -e

# --- CONFIGURATION (Adjust paths as needed on your Ubuntu server) ---
BACKEND_DIR="/var/www/skillswap-backend"            # Path to backend repository
FRONTEND_REPO_DIR="/var/www/skillswap-frontend-repo" # Path to frontend repository (source)
FRONTEND_WEB_DIR="/var/www/skillswap-frontend"      # Nginx / Apache web root for frontend
PM2_APP_NAME="all"                                   # PM2 app name or ID (or "all")

echo "--------------------------------------------------"
echo "🚀 1. Updating Backend..."
echo "--------------------------------------------------"
if [ -d "$BACKEND_DIR" ]; then
    cd "$BACKEND_DIR"
    echo "📥 Pulling latest code from GitHub..."
    git pull origin main

    echo "📦 Installing backend dependencies..."
    npm install --production

    echo "🔄 Restarting PM2 process..."
    pm2 restart "$PM2_APP_NAME"
    echo "✅ Backend updated successfully!"
else
    echo "⚠️ Backend directory $BACKEND_DIR not found. Skipping backend update."
fi

echo ""
echo "--------------------------------------------------"
echo "🚀 2. Updating Frontend..."
echo "--------------------------------------------------"

# OPTION A: If building frontend from source repository (e.g. React / Expo Web / Vite)
if [ -d "$FRONTEND_REPO_DIR" ]; then
    cd "$FRONTEND_REPO_DIR"
    echo "📥 Pulling latest frontend code..."
    git pull origin main

    echo "📦 Installing frontend dependencies..."
    npm install

    echo "🏗️ Building frontend static assets..."
    # Expo web export command (or 'npm run build' / 'npx expo export --platform web')
    npx expo export --platform web

    echo "🧹 Clearing old web assets from $FRONTEND_WEB_DIR..."
    sudo rm -rf "$FRONTEND_WEB_DIR"/*

    echo "📋 Copying new build output to web directory..."
    # Adjust 'dist' if output folder is 'out' or 'build'
    sudo cp -r dist/* "$FRONTEND_WEB_DIR"/

    echo "🔒 Fixing permissions for web server..."
    sudo chown -R www-data:www-data "$FRONTEND_WEB_DIR"
    sudo chmod -R 755 "$FRONTEND_WEB_DIR"

    echo "✅ Frontend updated successfully!"

# OPTION B: If frontend repo is pulled directly inside /var/www/skillswap-frontend
elif [ -d "$FRONTEND_WEB_DIR" ]; then
    cd "$FRONTEND_WEB_DIR"
    echo "📥 Pulling latest code directly in web directory..."
    git pull origin main
    
    echo "🔒 Fixing permissions for web server..."
    sudo chown -R www-data:www-data "$FRONTEND_WEB_DIR"
    sudo chmod -R 755 "$FRONTEND_WEB_DIR"

    echo "✅ Frontend updated successfully!"
else
    echo "⚠️ Frontend directory not found. Please check paths."
fi

echo ""
echo "--------------------------------------------------"
echo "🔄 3. Reloading Nginx Web Server..."
echo "--------------------------------------------------"
if command -v nginx > /dev/null; then
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded!"
fi

echo ""
echo "🎉 Deployment complete!"
