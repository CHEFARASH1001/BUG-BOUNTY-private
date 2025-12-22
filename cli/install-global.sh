#!/bin/bash

# Install bb CLI globally
# This creates a symlink in /usr/local/bin

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="$SCRIPT_DIR/bb"

echo "🐛 Installing Bug Bounty CLI globally..."

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "Creating symlink with sudo..."
    sudo ln -sf "$CLI_PATH" /usr/local/bin/bb
else
    ln -sf "$CLI_PATH" /usr/local/bin/bb
fi

if [ $? -eq 0 ]; then
    echo "✅ CLI installed successfully!"
    echo ""
    echo "Usage:"
    echo "  bb subfinder example.com"
    echo "  bb recon example.com"
    echo "  bb enum-all"
    echo ""
    echo "Set your auth token:"
    echo "  export BB_TOKEN='your-jwt-token'"
else
    echo "❌ Installation failed"
    exit 1
fi
