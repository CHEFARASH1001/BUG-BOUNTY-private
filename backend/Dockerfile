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
    git

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
