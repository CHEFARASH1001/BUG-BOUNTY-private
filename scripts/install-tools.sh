#!/bin/bash
# Install security tools script
# Run with: sudo bash scripts/install-tools.sh

set -e

echo "=== Installing Security Tools ==="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Install pip if not available
if ! command -v pip3 &> /dev/null; then
    echo -e "${GREEN}Installing pip3...${NC}"
    apt install -y python3-pip
fi

# Install apt packages
echo -e "${GREEN}Installing apt packages...${NC}"
apt install -y sqlmap dirsearch wafw00f git curl

# Install Python tools
echo -e "${GREEN}Installing Python tools...${NC}"
pip3 install --break-system-packages --ignore-installed arjun xnLinkFinder waymore

# Install paramspider from git (not on PyPI)
echo -e "${GREEN}Installing ParamSpider from git...${NC}"
pip3 install --break-system-packages --ignore-installed git+https://github.com/devanshbatham/ParamSpider.git

# Create tools directory
TOOLS_DIR="$HOME/tools"
mkdir -p "$TOOLS_DIR"

# Install LinkFinder
if [ ! -d "$TOOLS_DIR/linkfinder" ]; then
    echo -e "${GREEN}Installing LinkFinder...${NC}"
    git clone https://github.com/GerbenJavado/LinkFinder.git "$TOOLS_DIR/linkfinder"
    cd "$TOOLS_DIR/linkfinder"
    pip3 install --break-system-packages -r requirements.txt
    ln -sf "$TOOLS_DIR/linkfinder/linkfinder.py" /usr/local/bin/linkfinder
fi

# Install SecretFinder
if [ ! -d "$TOOLS_DIR/secretfinder" ]; then
    echo -e "${GREEN}Installing SecretFinder...${NC}"
    git clone https://github.com/m4ll0k/SecretFinder.git "$TOOLS_DIR/secretfinder"
    cd "$TOOLS_DIR/secretfinder"
    pip3 install --break-system-packages -r requirements.txt
    ln -sf "$TOOLS_DIR/secretfinder/SecretFinder.py" /usr/local/bin/secretfinder
fi

# Install JSParser
if [ ! -d "$TOOLS_DIR/jsparser" ]; then
    echo -e "${GREEN}Installing JSParser...${NC}"
    git clone https://github.com/nahamsec/JSParser.git "$TOOLS_DIR/jsparser"
    cd "$TOOLS_DIR/jsparser"
    pip3 install --break-system-packages -r requirements.txt
fi

# Install Rust and x8 (optional - requires user interaction)
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}Rust/Cargo not installed. To install x8, run:${NC}"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "  source ~/.cargo/env"
    echo "  cargo install x8"
else
    echo -e "${GREEN}Installing x8...${NC}"
    cargo install x8
fi

# Add Go bin to PATH if not already
if ! grep -q 'go/bin' ~/.bashrc; then
    echo 'export PATH=$PATH:$HOME/go/bin' >> ~/.bashrc
fi

echo ""
echo -e "${GREEN}=== Installation Complete ===${NC}"
echo "Run 'source ~/.bashrc' to update PATH"
echo ""
echo "Installed tools:"
for tool in sqlmap dirsearch wafw00f arjun paramspider linkfinder secretfinder; do
    if command -v $tool &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} $tool"
    else
        echo -e "  ${RED}✗${NC} $tool (may need PATH update)"
    fi
done
