#!/bin/bash

set -euo pipefail

# Telegram Bot Starter Script
# Usage: ./start-telegram-bot.sh

echo "🤖 Starting Telegram Bot..."
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

# Check if proxy is running
if ! ss -tlnp | grep -q 10808; then
    echo "⚠️  Warning: Proxy on port 10808 is not running!"
    echo "Make sure Xray or your proxy is running on port 10808"
    echo ""
fi

# Check if backend is running
BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
if ! curl -fsS "${BACKEND_URL}/api/docs" > /dev/null 2>&1; then
    echo "⚠️  Warning: Backend API is not responding!"
    echo "Make sure Docker containers are running:"
    echo "  docker compose -f docker-compose.dev.yml up -d"
    echo ""
fi

# Start the bot. Keep credentials outside the repository.
: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN before starting the bot}"
: "${TELEGRAM_CHAT_ID:?Set TELEGRAM_CHAT_ID before starting the bot}"
export PROXY_PORT="${PROXY_PORT:-10808}"

echo "📡 Configuration:"
echo "  Bot Token: ${TELEGRAM_BOT_TOKEN:0:8}..."
echo "  Chat ID: $TELEGRAM_CHAT_ID"
echo "  Proxy Port: $PROXY_PORT"
echo ""
echo "✅ Starting bot... (Press Ctrl+C to stop)"
echo ""

node scripts/telegram-bot.js
