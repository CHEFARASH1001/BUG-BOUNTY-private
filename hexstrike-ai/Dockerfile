# HexStrike AI v6.0 - Docker Container
# Advanced Penetration Testing Framework with 150+ Security Tools

# Stage 1: Build Go tools
FROM golang:1.22 AS go-builder

ENV CGO_ENABLED=0
ENV GOPATH=/go
# Use direct mode first to bypass proxy issues, then fallback to proxy
ENV GOPROXY=direct,https://proxy.golang.org
ENV GOSUMDB=off

# Install git and build dependencies for go install
# Using Debian package manager (more reliable than Alpine for network issues)
RUN apt-get update && \
    apt-get install -y --no-install-recommends git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install Go-based security tools (continue on failure for network resilience)
# ProjectDiscovery tools
RUN (go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && echo "✅ nuclei installed") || echo "❌ nuclei failed" || true
RUN (go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest && echo "✅ httpx installed") || echo "❌ httpx failed" || true
RUN (go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && echo "✅ subfinder installed") || echo "❌ subfinder failed" || true
RUN (go install -v github.com/projectdiscovery/katana/cmd/katana@latest && echo "✅ katana installed") || echo "❌ katana failed" || true

# Fuzzing tools
RUN (go install -v github.com/ffuf/ffuf/v2@latest && echo "✅ ffuf installed") || echo "❌ ffuf failed" || true

# Recon tools
RUN (go install -v github.com/tomnomnom/assetfinder@latest && echo "✅ assetfinder installed") || echo "❌ assetfinder failed" || true
RUN (go install -v github.com/lc/gau/v2/cmd/gau@latest && echo "✅ gau installed") || echo "❌ gau failed" || true
RUN (go install -v github.com/tomnomnom/waybackurls@latest && echo "✅ waybackurls installed") || echo "❌ waybackurls failed" || true

# XSS tools
RUN (go install -v github.com/hahwul/dalfox/v2@latest && echo "✅ dalfox installed") || echo "❌ dalfox failed" || true

# List what was installed
RUN echo "=== Installed Go tools ===" && ls -la /go/bin/

# Stage 2: Final image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV HEXSTRIKE_PORT=8888
ENV HEXSTRIKE_HOST=0.0.0.0
ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/opt/go-tools:${PATH}"

# Install system dependencies and security tools with retry logic
RUN for i in 1 2 3; do \
    apt-get update && break || sleep 5; \
    done && \
    apt-get install -y --no-install-recommends \
    # Core system tools
    curl wget git unzip zip \
    build-essential gcc g++ make \
    pkg-config libssl-dev libffi-dev \
    # Network tools
    nmap masscan netcat-openbsd dnsutils whois \
    # Web application security tools
    gobuster dirb sqlmap \
    # Binary analysis tools
    binutils gdb binwalk \
    # Additional utilities (use perl-base instead of perl)
    jq xmlstarlet perl-base libnet-ssleay-perl \
    # Clean up
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean || \
    (echo "⚠️  Some packages may have failed to install due to network issues" && \
     apt-get install -y --no-install-recommends curl wget git ca-certificates || true)

# Install nikto from source (continue on failure)
RUN (git clone https://github.com/sullo/nikto.git /opt/nikto \
    && chmod +x /opt/nikto/program/nikto.pl \
    && ln -s /opt/nikto/program/nikto.pl /usr/local/bin/nikto) || \
    echo "⚠️  nikto installation failed (network issue)" || true

# Create go-tools directory and copy Go tools from builder stage
RUN mkdir -p /opt/go-tools
COPY --from=go-builder /go/bin/ /opt/go-tools/

# Verify Go tools were copied
RUN ls -la /opt/go-tools/ && chmod +x /opt/go-tools/* || echo "No Go tools found"

# Update nuclei templates
RUN /opt/go-tools/nuclei -update-templates || true

# Create application directory
WORKDIR /app

# Copy requirements first for better Docker layer caching
COPY requirements-minimal.txt requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-minimal.txt

# Install Python-based security tools (continue if some tools are unavailable)
RUN (pip install --no-cache-dir arjun paramspider && \
    echo "✅ Python security tools installed") || \
    (echo "⚠️  Some Python security tools could not be installed (e.g., paramspider not found)" && true)

# Copy HexStrike AI source code
COPY hexstrike_server.py hexstrike_mcp.py ./
COPY *.py ./

# Create necessary directories
RUN mkdir -p /app/results /app/logs /app/config

# Create health check script
RUN echo '#!/bin/bash\ncurl -f http://localhost:8888/health || exit 1' > /app/healthcheck.sh \
    && chmod +x /app/healthcheck.sh

# Expose the MCP server port
EXPOSE 8888

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /app/healthcheck.sh

# Start the HexStrike AI server
CMD ["python3", "hexstrike_server.py", "--port", "8888"]
