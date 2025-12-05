# 🔒 Bug Bounty Automation Platform

A comprehensive, scalable bug bounty automation platform built with **Next.js**, **NestJS**, and **MongoDB**. Automate your reconnaissance and vulnerability scanning workflows with ease.

![Dashboard Preview](https://via.placeholder.com/1200x600/0a0a0f/22c55e?text=Bug+Bounty+Automation+Platform)

## 🚀 Features

### Reconnaissance
- **Subdomain Enumeration** - Multiple sources including:
  - Subfinder integration
  - SecurityTrails API
  - crt.sh Certificate Transparency
  - VirusTotal
  - AlienVault OTX
  - HackerTarget
  - DNS bruteforce

- **Port Scanning** - Fast port scanning with:
  - Naabu integration
  - Service detection
  - Banner grabbing

- **HTTP Probing** - Alive host detection with:
  - HTTPx integration
  - Technology detection
  - Title extraction
  - Content-length analysis

### Vulnerability Scanning
- **Nuclei Integration** - Automated vulnerability scanning with:
  - CVE detection
  - Misconfigurations
  - Exposures
  - Default credentials
  - Subdomain takeover

- **Custom Vulnerability Checks**:
  - XSS detection
  - SQL Injection testing
  - SSRF detection
  - Open redirect checking
  - LFI/RFI testing
  - CORS misconfiguration
  - Security header analysis

### External API Integrations
- **Shodan** - Host information, search, exploits
- **SecurityTrails** - Subdomains, DNS history, WHOIS
- **VirusTotal** - Domain/IP reputation, file analysis
- **Censys** - Certificate search, host lookup
- **Hunter.io** - Email discovery
- **URLScan.io** - URL analysis, screenshots

### Automation & Scaling
- **Bull/Redis Queue** - Async job processing with:
  - Priority queuing
  - Retry logic
  - Progress tracking
  - Real-time updates via WebSocket

- **Scheduled Scans** - Automatic recurring scans

### Notifications
- **Slack** - Webhook integration
- **Discord** - Webhook integration
- **Email** - SMTP support
- **Telegram** - Bot integration

### Reporting
- **PDF Reports** - Professional vulnerability reports
- **CSV Export** - Vulnerabilities, subdomains
- **JSON Export** - Full data export

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js       │────▶│   NestJS        │────▶│   MongoDB       │
│   Frontend      │◀────│   Backend API   │◀────│   Database      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────▼─────┐         ┌─────▼─────┐
              │   Redis   │         │  Docker   │
              │   Queue   │         │  Scanners │
              └───────────┘         └───────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          │              │              │
                    ┌─────▼────┐  ┌─────▼────┐  ┌─────▼────┐
                    │  Nuclei  │  │  HTTPx   │  │ Subfinder│
                    └──────────┘  └──────────┘  └──────────┘
```

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- API keys for external services (optional but recommended)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
cd /path/to/project

# Copy environment file
cp env.sample .env

# Edit .env with your API keys and configuration
nano .env
```

### 2. Configure API Keys

Edit `.env` and add your API keys:

```env
# Required for full functionality
SHODAN_API_KEY=your_shodan_key
SECURITYTRAILS_API_KEY=your_securitytrails_key
VIRUSTOTAL_API_KEY=your_virustotal_key

# Optional but recommended
CENSYS_API_ID=your_censys_id
CENSYS_API_SECRET=your_censys_secret
HUNTER_API_KEY=your_hunter_key

# Notifications (optional)
SLACK_WEBHOOK_URL=your_slack_webhook
DISCORD_WEBHOOK_URL=your_discord_webhook
```

### 3. Start Services

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **API Documentation**: http://localhost:4000/api/docs

## 📖 Usage

### Adding a Domain

1. Navigate to **Dashboard** → **Domains**
2. Click **Add Domain**
3. Enter the target domain (e.g., `example.com`)
4. Select a program or create one
5. Enable **Auto Scan** for immediate scanning
6. Click **Add Domain**

### Starting a Scan

1. Go to the domain's page
2. Click **Start Scan**
3. Select scan type:
   - **Full Scan** - Complete reconnaissance
   - **Subdomain Only** - Just subdomain enumeration
   - **Port Scan** - Port scanning only
   - **Nuclei Scan** - Vulnerability scanning
4. Monitor progress in real-time

### Viewing Results

- **Subdomains**: View all discovered subdomains with status
- **Vulnerabilities**: Filter by severity, status, type
- **Endpoints**: Discovered URLs and API endpoints
- **Reports**: Generate PDF/CSV reports

## 🔧 Configuration

### Scan Settings

```typescript
// Default scan configuration
{
  includeSubdomains: true,
  includePorts: true,
  includeNuclei: true,
  includeScreenshots: true,
  includeTechnologies: true,
  threads: 25,
  rateLimit: 100,
  timeout: 10,
}
```

### Nuclei Templates

By default, scans use these template categories:
- `cves/` - CVE exploits
- `exposures/` - Information disclosure
- `misconfiguration/` - Misconfigurations
- `vulnerabilities/` - Common vulnerabilities
- `default-logins/` - Default credentials
- `takeovers/` - Subdomain takeover

## 📡 API Reference

### Authentication

```bash
# Login
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

# Register
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "password",
  "name": "User Name"
}
```

### Domains

```bash
# List domains
GET /api/v1/domains

# Add domain
POST /api/v1/domains
{
  "domain": "example.com",
  "programId": "program_id",
  "autoScan": true
}

# Start scan
POST /api/v1/domains/:id/scan
```

### Vulnerabilities

```bash
# List vulnerabilities
GET /api/v1/vulnerabilities?severity=high&status=new

# Update status
PUT /api/v1/vulnerabilities/:id/status
{
  "status": "confirmed"
}
```

Full API documentation available at `/api/docs` when running the backend.

## 🔔 WebSocket Events

Connect to `/ws` namespace for real-time updates:

```javascript
// Subscribe to scan updates
socket.emit('subscribe:scan', { scanId: 'scan_id' });

// Receive updates
socket.on('scan:update', (data) => {
  console.log(data.progress, data.currentStep);
});

// New vulnerability found
socket.on('vulnerability:new', (data) => {
  console.log('New vulnerability:', data.vulnerability);
});
```

## 🐳 Docker Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 3000 | Next.js web application |
| backend | 4000 | NestJS API server |
| mongodb | 27017 | MongoDB database |
| redis | 6379 | Redis for job queue |
| nuclei | - | Nuclei scanner |
| httpx | - | HTTP prober |
| subfinder | - | Subdomain finder |
| naabu | - | Port scanner |

## 🛠️ Development

### Local Development

```bash
# Backend
cd backend
npm install
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend
npm run test

# Frontend tests
cd frontend
npm run test
```

## 📊 Dashboard Features

- **Real-time Statistics** - Live vulnerability and scan metrics
- **Activity Timeline** - Recent scans and findings
- **Severity Distribution** - Visual breakdown of vulnerabilities
- **Quick Actions** - One-click scan initiation
- **Search** - Global search across all assets

## 🔐 Security Considerations

- All API endpoints require authentication
- Passwords are hashed with bcrypt
- JWT tokens with refresh token rotation
- Rate limiting on all endpoints
- Input validation on all requests
- CORS properly configured

## 📝 License

MIT License - Feel free to use for your bug bounty activities!

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines.

## 📧 Support

For issues and feature requests, please open a GitHub issue.

---

**Happy Bug Hunting! 🐛🔍**

