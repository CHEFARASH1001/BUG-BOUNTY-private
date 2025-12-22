FROM node:20-alpine

WORKDIR /app

# Install dependencies for Puppeteer and other tools
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    bind-tools \
    curl \
    git \
    go

# Install Go-based security tools
ENV GOPATH=/root/go
ENV PATH=$PATH:/root/go/bin

# Install shuffledns and massdns
RUN go install -v github.com/projectdiscovery/shuffledns/cmd/shuffledns@latest && \
    apk add --no-cache --virtual .build-deps build-base && \
    git clone https://github.com/blechschmidt/massdns.git /tmp/massdns && \
    cd /tmp/massdns && make && cp bin/massdns /usr/local/bin/ && \
    rm -rf /tmp/massdns && \
    apk del .build-deps

# Create resolvers file with public DNS servers
RUN mkdir -p /app && \
    echo "8.8.8.8" > /app/resolvers.txt && \
    echo "8.8.4.4" >> /app/resolvers.txt && \
    echo "1.1.1.1" >> /app/resolvers.txt && \
    echo "1.0.0.1" >> /app/resolvers.txt && \
    echo "9.9.9.9" >> /app/resolvers.txt && \
    echo "149.112.112.112" >> /app/resolvers.txt

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# List contents for debugging
RUN ls -la dist/ || echo "dist folder not found"

# Expose port
EXPOSE 4000

# Start the application
CMD ["node", "dist/main.js"]
