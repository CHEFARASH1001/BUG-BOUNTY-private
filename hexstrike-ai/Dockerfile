# HexStrike AI v6.0 - Docker Container
# Advanced Penetration Testing Framework with 150+ Security Tools

# Stage 1: Build Go tools
FROM golang:1.22-alpine AS go-builder

ENV CGO_ENABLED=0
ENV GOPATH=/go
# Use default proxy for better reliability
ENV GOPROXY=https://proxy.golang.org,direct

# Install git and build dependencies for go install
RUN apk add --no-cache git ca-certificates

# Install Go-based security tools
# ProjectDiscovery tools
RUN go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && \
    echo "✅ nuclei installed" || echo "❌ nuclei failed"
RUN go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest && \
    echo "✅ httpx installed" || echo "❌ httpx failed"
RUN go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
    echo "✅ subfinder installed" || echo "❌ subfinder failed"
RUN go install -v github.com/projectdiscovery/katana/cmd/katana@latest && \
    echo "✅ katana installed" || echo "❌ katana failed"

# Fuzzing tools
RUN go install -v github.com/ffuf/ffuf/v2@latest && \
    echo "✅ ffuf installed" || echo "❌ ffuf failed"

# Recon tools
RUN go install -v github.com/tomnomnom/assetfinder@latest && \
    echo "✅ assetfinder installed" || echo "❌ assetfinder failed"
RUN go install -v github.com/lc/gau/v2/cmd/gau@latest && \
    echo "✅ gau installed" || echo "❌ gau failed"
RUN go install -v github.com/tomnomnom/waybackurls@latest && \
    echo "✅ waybackurls installed" || echo "❌ waybackurls failed"

# XSS tools
RUN go install -v github.com/hahwul/dalfox/v2@latest && \
    echo "✅ dalfox installed" || echo "❌ dalfox failed"

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

# Install system dependencies and security tools
RUN apt-get update && apt-get install -y --no-install-recommends \
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
    # Additional utilities
    jq xmlstarlet perl libnet-ssleay-perl \
    # Clean up
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install nikto from source
RUN git clone https://github.com/sullo/nikto.git /opt/nikto \
    && chmod +x /opt/nikto/program/nikto.pl \
    && ln -s /opt/nikto/program/nikto.pl /usr/local/bin/nikto

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

# Install Python-based security tools
RUN pip install --no-cache-dir arjun paramspider && \
    echo "✅ Python security tools installed"

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
