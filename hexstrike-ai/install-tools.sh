#!/bin/bash
# Quick tool installer for hexstrike-ai container

echo "🔧 Installing missing security tools..."

# Install Go
apt-get update && apt-get install -y golang-go

# Set Go environment
export GOPATH=/root/go
export PATH=$PATH:/root/go/bin:/opt/go-tools

# Install nuclei (most important)
echo "📦 Installing nuclei..."
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
cp /root/go/bin/nuclei /opt/go-tools/ 2>/dev/null || true

# Install ffuf
echo "📦 Installing ffuf..."
go install -v github.com/ffuf/ffuf/v2@latest
cp /root/go/bin/ffuf /opt/go-tools/ 2>/dev/null || true

# Install dalfox
echo "📦 Installing dalfox..."
go install -v github.com/hahwul/dalfox/v2@latest
cp /root/go/bin/dalfox /opt/go-tools/ 2>/dev/null || true

# Install Python tools
echo "📦 Installing Python tools..."
pip install arjun paramspider

# Update nuclei templates
echo "📦 Updating nuclei templates..."
/opt/go-tools/nuclei -update-templates 2>/dev/null || nuclei -update-templates 2>/dev/null || true

echo "✅ Installation complete!"
echo "Installed tools:"
ls -la /opt/go-tools/
which arjun paramspider 2>/dev/null || echo "Python tools in PATH"
