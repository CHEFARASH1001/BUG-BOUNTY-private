# 🎯 BugBounty Watchtower

> A comprehensive bug bounty reconnaissance and vulnerability assessment platform built with NestJS, Next.js, and MongoDB.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [CLI Commands](#cli-commands)
- [Scheduled Tasks](#scheduled-tasks)
- [Tool Integrations](#tool-integrations)
- [IP Rotation](#ip-rotation)
- [Notifications](#notifications)
- [Scoring System](#scoring-system)
- [Documentation System](#documentation-system)
- [Example Workflows](#example-workflows)

---

## 🔭 Overview

BugBounty Watchtower is an automated reconnaissance platform designed for bug bounty hunters and security researchers. It aggregates programs from HackerOne and Bugcrowd, performs continuous subdomain enumeration, DNS resolution, HTTP service discovery, and vulnerability assessment.

### Key Objectives

1. **Automated Program Sync** - Periodically fetch and sync bug bounty programs from multiple platforms
2. **Continuous Asset Discovery** - Enumerate subdomains using multiple providers and techniques
3. **Fresh Asset Detection** - Track new and changed assets with real-time notifications
4. **Vulnerability Assessment** - Automated scanning with Nuclei and custom scripts
5. **Scoring & Prioritization** - Score targets based on penetration probability and exposure
6. **Documentation Management** - Track learning notes and coverage mapping

---

## 🏗️ Architecture

The platform consists of three main components:

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                          │
│  Dashboard | Programs | Watchers | Subdomains | HTTP | Vulns   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (NestJS)                            │
│  API Layer | Services | CLI Module | Cron Jobs                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE (MongoDB)                          │
│  programs | scopes | subdomains | lives | http_services | vulns │
└─────────────────────────────────────────────────────────────────┘
```

See `architecture.mermaid` for the complete detailed flowchart.

---

## ✨ Features

### 1. Program Management
- Sync programs from HackerOne and Bugcrowd
- GitHub-based program tracking
- Scope management and filtering
- Program scoring and comparison

### 2. Subdomain Enumeration
Multiple providers for comprehensive coverage:

| Provider | Type | IP Rotation Required |
|----------|------|---------------------|
| subfinder | Passive | No |
| crt.sh | Passive | ⚠️ Yes |
| abuseipdb | Passive | ⚠️ Yes |
| chaos | Passive | No |
| waybackurls | Passive | No |
| gau | Passive | No |
| cert_trans | Passive | No |
| static_brute | Active | No |
| dynamic_brute | Active | No |

### 3. DNS Resolution
- Normal name resolution with dnsx
- Static DNS brute force with shuffledns
- Dynamic DNS brute force with dnsgen permutations
- Wildcard detection and filtering

### 4. HTTP Service Discovery
Comprehensive HTTP probing with httpx:
- Status codes and response headers
- Title extraction
- Technology detection
- Favicon hashing
- CDN detection
- Follow redirects and chain tracking

### 5. Vulnerability Assessment
- Nuclei template scanning
- Custom vulnerability scripts
- Directory fuzzing with ffuf
- Parameter discovery with Arjun

### 6. Real-time Notifications
Alert types:
- 🆕 New subdomain discovered
- 🟢 New live host detected
- 🔄 Status code change (e.g., 403 → 200)
- 📝 Title change
- 🛠️ Technology change
- 🔴 New vulnerability found

Channels: Discord, Telegram, Custom Webhooks

### 7. Documentation System
- Personal learning notes storage
- Technique library
- Coverage checker - map which documentation covers which targets
- Searchable knowledge base

---

## 🛠️ Tech Stack

### Backend
- **NestJS** - Backend framework
- **MongoDB** - Database
- **Bull** - Job queue for scheduled tasks

### Frontend
- **Next.js** - React framework
- **TailwindCSS** - Styling
- **ShadcnUI** - Component library

### Security Tools Integration
See [Tool Integrations](#tool-integrations) section for complete list.

---

## 📦 Installation

### Prerequisites
- Node.js 18+
- MongoDB 6+
- Go 1.21+ (for security tools)
- Python 3.10+

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure environment variables
npm run start:dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Tools Installation
```bash
# ProjectDiscovery tools
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install -v github.com/projectdiscovery/shuffledns/cmd/shuffledns@latest
go install -v github.com/projectdiscovery/katana/cmd/katana@latest

# Other tools
go install -v github.com/tomnomnom/waybackurls@latest
go install -v github.com/lc/gau/v2/cmd/gau@latest
go install -v github.com/ffuf/ffuf/v2@latest
go install -v github.com/tomnomnom/unfurl@latest

# Python tools
pip install dnsgen
```

---

## ⚙️ Configuration

### Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/watchtower

# Platforms
HACKERONE_API_KEY=your_key
HACKERONE_API_SECRET=your_secret
BUGCROWD_API_KEY=your_key

# Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id

# IP Rotation
PROXY_POOL_URL=http://proxy-service:8080

# Paths
WATCH_DIR=/opt/watchtower
WORDLISTS_DIR=/opt/wordlists
RESOLVERS_FILE=~/.resolvers
```

### Cron Configuration

```yaml
# config/cron.yaml
sync_programs:
  schedule: "0 */6 * * *"  # Every 6 hours
  enabled: true

enum_all:
  schedule: "0 */12 * * *"  # Every 12 hours
  enabled: true

ns_all:
  schedule: "0 */4 * * *"  # Every 4 hours
  enabled: true

http_all:
  schedule: "0 */2 * * *"  # Every 2 hours
  enabled: true

nuclei_all:
  schedule: "0 0 * * *"  # Daily
  enabled: true
```

---

## 📡 API Reference

### Programs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/programs` | GET | List all programs |
| `/api/programs/:id` | GET | Get program details |
| `/api/programs/sync` | POST | Trigger program sync |

### Subdomains

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/subdomains/:domain` | GET | Get subdomains of domain |
| `/api/subdomains/all` | GET | Get all subdomains |
| `/api/subdomains/fresh` | GET | Get fresh (new) subdomains |
| `/api/subdomains/scope/:scope` | GET | Get subdomains by scope |
| `/api/subdomains/provider/:provider` | GET | Get subdomains by provider |

### Live Hosts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/lives/all` | GET | Get all live hosts |
| `/api/lives/fresh` | GET | Get fresh live hosts |
| `/api/lives/scope/:scope` | GET | Get lives by scope |
| `/api/lives/provider/:provider` | GET | Get lives by provider |
| `/api/lives/subdomain/:subdomain` | GET | Get live details |

**Query Parameters:**
- `--cdn` - Filter by CDN status
- `--count` - Return count only
- `--all` - Include all records
- `--total` - Get total count

### HTTP Services

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/http/all` | GET | Get all HTTP services |
| `/api/http/fresh` | GET | Get fresh HTTP services |
| `/api/http/single/:domain` | GET | Get single HTTP service |

**Query Parameters:**
- `--tech <name>` - Filter by technology (e.g., NTLM, Basic)
- `--title <keyword>` - Filter by title
- `--provider <name>` - Filter by provider
- `--compare list` - Compare with previous scan

### Technologies

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/technologies/list` | GET | List all detected technologies |

### Documentation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/docs` | GET | List all documentation with filters |
| `/api/docs` | POST | Create documentation |
| `/api/docs/search` | GET | Full-text search (query param: `q`) |
| `/api/docs/stats` | GET | Get aggregate statistics |
| `/api/docs/coverage/:target` | GET | Get coverage for target |
| `/api/docs/:id` | GET | Get documentation by ID |
| `/api/docs/:id` | PUT | Update documentation |
| `/api/docs/:id` | DELETE | Delete documentation |
| `/api/docs/:id/pin` | POST | Pin documentation |
| `/api/docs/:id/pin` | DELETE | Unpin documentation |
| `/api/docs/:id/related/:relatedId` | POST | Add related document |
| `/api/docs/:id/related/:relatedId` | DELETE | Remove related document |

**Query Parameters for `/api/docs`:**
- `type` - Filter by type (note, technique, writeup, reference, checklist)
- `tag` - Filter by tag
- `category` - Filter by category
- `target` - Filter by target
- `technology` - Filter by technology
- `isPinned` - Filter by pinned status
- `limit` - Pagination limit
- `offset` - Pagination offset
- `sort` - Sort field

---

## 💻 CLI Commands

### Watch Commands (Continuous Monitoring)

```bash
# Subdomain Enumeration
watch_subfinder <domain>      # Run subfinder for domain
watch_crtsh <domain>          # Run crt.sh lookup
watch_enum_all                # Run all enumeration providers
watch_gau <domain>            # Run gau for domain
watch_wayback <domain>        # Run waybackurls for domain
watch_chaos                   # Sync chaos dataset
watch_sync_chaos              # Download and sync chaos data

# DNS Resolution
watch_ns <domain>             # DNS resolution for domain
watch_ns_all                  # DNS resolution for all subdomains
watch_ns_brute <domain>       # DNS brute force for domain

# HTTP Discovery
watch_http <domain>           # HTTP probe for domain
watch_http_all                # HTTP probe for all live hosts

# Vulnerability Scanning
watch_nuclei <domain>         # Run nuclei on domain
watch_nuclei_all              # Run nuclei on all HTTP services
watch_nuclei_fresh            # Run nuclei on fresh HTTP services

# Program Sync
watch_sync_programs           # Sync programs from platforms
```

### Get Commands (Data Retrieval)

```bash
# Fresh Assets
watchtower get fresh http all         # Get fresh HTTP services
watchtower get fresh lives            # Get fresh live subdomains
watchtower get fresh subdomains       # Get fresh subdomains

# Single Queries
watchtower get single http <domain>   # Get HTTP details for domain
watchtower get single target <scope>  # Get target details
watchtower get single subdomain <sub> # Get subdomain details
watchtower get single live <sub>      # Get live host details

# Filtered Queries
watchtower get http all --tech NTLM   # Filter by technology
watchtower get http all --tech Basic  # Filter by Basic auth
watchtower get http all --title admin # Filter by title
watchtower get http all --provider crtsh  # Filter by provider

# Lists and Counts
watchtower get technologies list      # List all technologies
watchtower get lives scope <name> --count     # Count lives in scope
watchtower get lives scope <name> --cdn       # Filter CDN hosts
watchtower get lives scope <name> --all       # Get all in scope
watchtower get subdomains scope <name> --count  # Count subdomains

# Comparison
watchtower get http all --compare list        # Compare with previous
watchtower get lives scope <name> --compare list
```

### Pipeline Examples

```bash
# Enumeration + Resolution
subfinder -d domain.com -all | dnsx -silent

# Get subdomains and scan with nuclei
curl -s http://127.0.0.1:5000/api/subdomains/domain.com | nuclei

# Get fresh lives and scan
curl -s http://127.0.0.1:5000/api/lives/fresh | nuclei

# Historical URL discovery
waybackurls domain.com | unfurl domains | sort -u

# Single HTTP check with JSON output
watchtower get single http domain.com | jq

# Technology count
watchtower get technologies list | jq -r ".[].name" | sort -u | wc -l

# Filter technologies
watchtower get technologies list | jq -r ".[].name" | sort -u | grep -v bootstrap | head -n 100
```

---

## ⏰ Scheduled Tasks

| Task | Description | Default Schedule |
|------|-------------|-----------------|
| `watch_sync_programs` | Sync programs from platforms | Every 6 hours |
| `watch_enum_all` | Full subdomain enumeration | Every 12 hours |
| `watch_ns_all` | DNS resolution for all | Every 4 hours |
| `watch_http_all` | HTTP discovery for all | Every 2 hours |
| `watch_nuclei_all` | Vulnerability scanning | Daily |
| `fresh_detection` | Detect fresh assets | Every 30 minutes |

---

## 🔧 Tool Integrations

### Reconnaissance Tools

| Tool | Purpose | Link |
|------|---------|------|
| subfinder | Passive subdomain enumeration | [GitHub](https://github.com/projectdiscovery/subfinder) |
| amass | Attack surface mapping | [GitHub](https://github.com/owasp-amass/amass) |
| findomain | Fast subdomain enumeration | [GitHub](https://github.com/Findomain/Findomain) |
| assetfinder | Find related domains | [GitHub](https://github.com/tomnomnom/assetfinder) |
| chaos | ProjectDiscovery chaos data | [GitHub](https://github.com/projectdiscovery/chaos-client) |

### DNS Tools

| Tool | Purpose | Link |
|------|---------|------|
| dnsx | DNS resolution and probing | [GitHub](https://github.com/projectdiscovery/dnsx) |
| shuffledns | High-speed DNS brute forcing | [GitHub](https://github.com/projectdiscovery/shuffledns) |
| massdns | High-performance DNS resolver | [GitHub](https://github.com/blechschmidt/massdns) |
| dnsgen | Generate DNS permutations | [GitHub](https://github.com/ProjectAnte/dnsgen) |

### HTTP Tools

| Tool | Purpose | Link |
|------|---------|------|
| httpx | HTTP probing and tech detection | [GitHub](https://github.com/projectdiscovery/httpx) |
| katana | Web crawling | [GitHub](https://github.com/projectdiscovery/katana) |
| hakrawler | Fast web crawler | [GitHub](https://github.com/hakluke/hakrawler) |

### URL Discovery

| Tool | Purpose | Link |
|------|---------|------|
| waybackurls | Fetch from Wayback Machine | [GitHub](https://github.com/tomnomnom/waybackurls) |
| gau | Get All URLs | [GitHub](https://github.com/lc/gau) |
| urlfinder | Extract URLs from responses | [GitHub](https://github.com/projectdiscovery/urlfinder) |
| unfurl | Parse and filter URLs | [GitHub](https://github.com/tomnomnom/unfurl) |

### Fuzzing & Discovery

| Tool | Purpose | Link |
|------|---------|------|
| ffuf | Web fuzzer | [GitHub](https://github.com/ffuf/ffuf) |
| feroxbuster | Recursive content discovery | [GitHub](https://github.com/epi052/feroxbuster) |
| dirsearch | Directory brute forcing | [GitHub](https://github.com/maurosoria/dirsearch) |
| arjun | HTTP parameter discovery | [GitHub](https://github.com/s0md3v/Arjun) |

### JavaScript Analysis

| Tool | Purpose | Link |
|------|---------|------|
| LinkFinder | Extract endpoints from JS | [GitHub](https://github.com/GerbenJavado/LinkFinder) |
| SecretFinder | Find secrets in JS | [GitHub](https://github.com/m4ll0k/SecretFinder) |
| JSParser | Parse JavaScript files | [GitHub](https://github.com/nahamsec/JSParser) |

### Vulnerability Scanning

| Tool | Purpose | Link |
|------|---------|------|
| nuclei | Template-based scanner | [GitHub](https://github.com/projectdiscovery/nuclei) |
| sqlmap | SQL injection detection | [GitHub](https://github.com/sqlmapproject/sqlmap) |
| trufflehog | Secret scanning | [GitHub](https://github.com/trufflesecurity/trufflehog) |

### Fingerprinting

| Tool | Purpose | Link |
|------|---------|------|
| wafw00f | WAF detection | [GitHub](https://github.com/EnableSecurity/wafw00f) |
| nmap | Network scanning | [GitHub](https://github.com/nmap/nmap) |

### Information Gathering

| Tool | Purpose | Link |
|------|---------|------|
| whois | Domain registration info | [GitHub](https://github.com/rfc1036/whois) |
| bgp.tools | ASN and BGP information | [GitHub](https://github.com/bgptools/bgptools) |
| spyhunt | OSINT discovery | [GitHub](https://github.com/spyhunt/spyhunt) |

---

## 🔄 IP Rotation

Some services require IP rotation to avoid rate limiting:

### Services Requiring Rotation

| Service | Rate Limit | Recommendation |
|---------|-----------|----------------|
| crt.sh | ~100 req/min | Rotating proxy pool |
| abuseipdb | 1000 req/day | API key + proxy |
| Google Search | Variable | Residential proxies |

### Configuration

```env
# Proxy Pool Configuration
PROXY_POOL_URL=http://proxy-service:8080
PROXY_ROTATION_INTERVAL=60  # seconds
PROXY_TYPE=rotating  # rotating | sticky

# Per-service configuration
CRTSH_USE_PROXY=true
ABUSEIPDB_USE_PROXY=true
```

### crt.sh Wildcard Handling

```python
# Filter out wildcard entries
if '*' not in name_value:
    # Process the subdomain
    name_value = row[0].strip()
    if re.search(r'\.\s*' + re.escape(domain), name_value, re.IGNORECASE):
        processed_results.add(name_value.lower().replace(f'.{domain}', ''))
```

---

## 📢 Notifications

### Supported Channels

1. **Discord** - Webhook integration
2. **Telegram** - Bot API
3. **Custom Webhook** - HTTP POST notifications

### Alert Configuration

```yaml
# config/notifications.yaml
channels:
  discord:
    enabled: true
    webhook_url: ${DISCORD_WEBHOOK_URL}
    
  telegram:
    enabled: true
    bot_token: ${TELEGRAM_BOT_TOKEN}
    chat_id: ${TELEGRAM_CHAT_ID}

alerts:
  new_subdomain:
    enabled: true
    channels: [discord, telegram]
    
  new_live:
    enabled: true
    channels: [discord, telegram]
    
  status_change:
    enabled: true
    channels: [discord]
    patterns:
      - from: 403
        to: 200
      - from: 404
        to: 200
        
  title_change:
    enabled: true
    channels: [telegram]
    keywords: [admin, login, dashboard]
    
  tech_change:
    enabled: true
    channels: [discord]
    
  vulnerability:
    enabled: true
    severity: [critical, high, medium]
    channels: [discord, telegram]
```

---

## 📈 Scoring System

### Score Components

1. **Penetration Probability Score**
   - Based on exposed services
   - Technology stack analysis
   - Historical vulnerability data

2. **Exposure Score**
   - Number of subdomains
   - Number of live hosts
   - Public ports exposed

3. **Priority Ranking**
   - Combined weighted score
   - Program value consideration
   - Fresh asset bonus

### Score Calculation

```javascript
// Simplified scoring algorithm
const calculateScore = (target) => {
  const pentestScore = calculatePentestProbability(target);
  const exposureScore = calculateExposure(target);
  const freshBonus = target.isFresh ? 1.2 : 1.0;
  
  return (pentestScore * 0.6 + exposureScore * 0.4) * freshBonus;
};
```

### UI Score Comparison

The dashboard provides:
- Side-by-side score comparison
- Trend analysis over time
- Category breakdown charts
- Top targets ranking

---

## 📖 Documentation System

The Documentation System is a fully implemented feature that enables bug bounty hunters to store personal learning notes, build a technique library, and map which documentation covers which targets.

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Learning Notes** | Store personal notes and findings with rich metadata | ✅ Implemented |
| **Technique Library** | Catalog attack techniques by type, tags, and categories | ✅ Implemented |
| **Coverage Checker** | Map which documentation covers which targets with relevance scores | ✅ Implemented |
| **Full-Text Search** | Search across title, content, and tags | ✅ Implemented |
| **Pinning** | Pin important docs for quick access | ✅ Implemented |
| **Related Docs** | Link related documentation together | ✅ Implemented |
| **View Tracking** | Track view counts and last accessed timestamps | ✅ Implemented |

### Document Types

The system supports five document types:

| Type | Use Case |
|------|----------|
| `note` | Personal learning notes and observations |
| `technique` | Attack techniques and methodologies |
| `writeup` | Bug bounty writeups and case studies |
| `reference` | Reference materials and cheat sheets |
| `checklist` | Testing checklists and procedures |

### API Endpoints

#### CRUD Operations

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/docs` | GET | List all documentation with filters | No |
| `/api/docs` | POST | Create new documentation | Yes |
| `/api/docs/:id` | GET | Get documentation by ID (increments view count) | No |
| `/api/docs/:id` | PUT | Update documentation | Yes |
| `/api/docs/:id` | DELETE | Delete documentation | Yes |

#### Search & Discovery

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/docs/search?q=<query>` | GET | Full-text search across title, content, tags | No |
| `/api/docs/coverage/:target` | GET | Get coverage for a specific target | No |
| `/api/docs/stats` | GET | Get aggregate statistics | No |

#### Pin Operations

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/docs/:id/pin` | POST | Pin a document | Yes |
| `/api/docs/:id/pin` | DELETE | Unpin a document | Yes |

#### Related Documents

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/docs/:id/related/:relatedId` | POST | Add related document | Yes |
| `/api/docs/:id/related/:relatedId` | DELETE | Remove related document | Yes |

### Query Parameters

The list endpoint (`GET /api/docs`) supports the following filters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by document type (note, technique, writeup, reference, checklist) |
| `tag` | string | Filter by tag |
| `category` | string | Filter by category |
| `target` | string | Filter by target |
| `technology` | string | Filter by technology |
| `isPinned` | boolean | Filter by pinned status |
| `limit` | number | Maximum number of results (pagination) |
| `offset` | number | Number of results to skip (pagination) |
| `sort` | string | Sort field and direction |

### Usage Examples

#### Create a Technique Document

```bash
curl -X POST http://localhost:3000/api/docs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "SQL Injection Techniques",
    "content": "# SQL Injection\n\n## Union-based SQLi\n...",
    "type": "technique",
    "tags": ["sqli", "injection", "database"],
    "categories": ["web-security"],
    "targets": ["example.com", "api.example.com"],
    "technologies": ["MySQL", "PostgreSQL"],
    "vulnerabilityTypes": ["SQL Injection"]
  }'
```

#### Search Documentation

```bash
# Full-text search
curl "http://localhost:3000/api/docs/search?q=sql+injection"

# Search with filters
curl "http://localhost:3000/api/docs/search?q=authentication&type=technique&limit=10"
```

#### Filter by Technology

```bash
# Get all docs related to a specific technology
curl "http://localhost:3000/api/docs?technology=React"
```

#### Get Coverage for a Target

```bash
curl http://localhost:3000/api/docs/coverage/target.com
```

**Response:**
```json
{
  "target": "target.com",
  "coverage": [
    {
      "docId": "507f1f77bcf86cd799439011",
      "title": "SQL Injection Techniques",
      "type": "technique",
      "relevanceScore": 1.0,
      "sections": ["Authentication Bypass", "Union-based SQLi"],
      "tags": ["sqli", "injection"]
    },
    {
      "docId": "507f1f77bcf86cd799439012",
      "title": "API Security Testing",
      "type": "checklist",
      "relevanceScore": 0.5,
      "sections": ["REST API Testing", "JWT Vulnerabilities"],
      "tags": ["api", "jwt"]
    }
  ]
}
```

#### Pin Important Documents

```bash
# Pin a document
curl -X POST http://localhost:3000/api/docs/507f1f77bcf86cd799439011/pin \
  -H "Authorization: Bearer <token>"

# Unpin a document
curl -X DELETE http://localhost:3000/api/docs/507f1f77bcf86cd799439011/pin \
  -H "Authorization: Bearer <token>"
```

#### Link Related Documents

```bash
# Add related document
curl -X POST http://localhost:3000/api/docs/doc1_id/related/doc2_id \
  -H "Authorization: Bearer <token>"

# Remove related document
curl -X DELETE http://localhost:3000/api/docs/doc1_id/related/doc2_id \
  -H "Authorization: Bearer <token>"
```

#### Get Statistics

```bash
curl http://localhost:3000/api/docs/stats
```

**Response:**
```json
{
  "total": 150,
  "byType": {
    "note": 45,
    "technique": 38,
    "writeup": 25,
    "reference": 30,
    "checklist": 12
  },
  "byTag": {
    "sqli": 15,
    "xss": 22,
    "ssrf": 8
  },
  "pinnedCount": 5
}
```

### Data Model

```javascript
// documentation collection
{
  _id: ObjectId,
  title: String,              // Required - document title
  content: String,            // Required - document content (supports markdown)
  type: String,               // note | technique | writeup | reference | checklist
  tags: [String],             // Searchable tags
  categories: [String],       // Category groupings
  targets: [String],          // Target names this doc covers
  technologies: [String],     // Related technologies
  vulnerabilityTypes: [String], // Vulnerability types covered
  coverage: [{                // Detailed coverage mapping
    targetId: ObjectId,
    targetType: String,
    targetName: String,
    relevanceScore: Number,   // 0-1 relevance score
    sections: [String]
  }],
  createdBy: ObjectId,        // User who created the doc
  updatedBy: ObjectId,        // User who last updated
  isPublic: Boolean,          // Public visibility flag
  isPinned: Boolean,          // Pinned for quick access
  viewCount: Number,          // Number of views
  relatedDocs: [ObjectId],    // Related documentation IDs
  lastAccessedAt: Date,       // Last view timestamp
  createdAt: Date,            // Auto-generated
  updatedAt: Date             // Auto-generated
}
```

### Sorting Behavior

- **Default sort**: Pinned documents appear first, then sorted by creation date (newest first)
- **View tracking**: Each GET request to `/api/docs/:id` increments the view count and updates `lastAccessedAt`
- **Related docs cleanup**: When a document is deleted, its ID is automatically removed from all other documents' `relatedDocs` arrays

### Indexes

The following indexes are created for optimal query performance:

- Full-text index on `title`, `content`, `tags`
- Single-field indexes on `type`, `tags`, `categories`, `targets`, `technologies`, `createdBy`
- Compound index on `isPinned` (desc) + `createdAt` (desc) for default sorting

---

## 📋 Example Workflows

### Complete Reconnaissance Flow

```bash
# 1. Sync programs
watch_sync_programs

# 2. Enumerate all subdomains
watch_enum_all

# 3. DNS resolution
watch_ns_all

# 4. HTTP discovery
watch_http_all

# 5. Vulnerability scanning
watch_nuclei_fresh
```

### Quick Target Assessment

```bash
# Single target quick scan
subfinder -d target.com -all | dnsx -silent | httpx -silent -json | nuclei
```

### Directory Fuzzing Workflow

```bash
# Basic fuzzing
ffuf -w /opt/wordlists/raft-words.txt -u https://target.com/FUZZ -mc all

# With extensions and filtering
ffuf -w /opt/wordlists/raft-words.txt -u https://target.com/FUZZ \
  -e .conf,.config,.json,.xml -mc all --fw 6 -c
```

### httpx Command Reference

```bash
# Full httpx scan
echo "subdomain.domain.com" | httpx -silent -json \
  -favicon -fhr -tech-detect -irh -include-chain \
  -timeout 5 -retries 3 -threads 5 -rate-limit 4 \
  -ports 443 -extract-fqdn \
  -H 'User-Agent: Mozilla/5.0...' \
  -H 'Referer: https://google.com'
```

### DNS Brute Force Workflow

```bash
# Static brute force preparation
curl -s https://wordlists-cdn.assetnote.io/data/manual/best-dns-wordlist.txt -o best-dns.txt
curl -s https://wordlists-cdn.assetnote.io/data/manual/2m-subdomains.txt -o 2m-subs.txt
crunch 1 4 abcdefghijklmnopqrstuvwxyz1234567890 > crunch.txt
cat best-dns.txt 2m-subs.txt crunch.txt | sort -u > static-words.txt
awk -v domain='target.com' '{print $0"."domain}' static-words.txt > domain-static.txt

# Run shuffledns
shuffledns -list domain-static.txt -d target.com -r ~/.resolvers \
  -m $(which massdns) -mode resolve -t 200 -silent > dns-brute-results.txt

# Dynamic brute force
curl -s https://raw.githubusercontent.com/AlephNullSK/dnsgen/master/dnsgen/words.txt -o dnsgen-words.txt
subfinder -d target.com -all | dnsx -silent | anew dns-brute-results.txt
cat dns-brute-results.txt | dnsgen -w dnsgen-words.txt - > dynamic-dns.txt
```

### dnsx Command Reference

```bash
# Basic resolution
subfinder -d domain.com -all | dnsx -silent

# With wildcard detection
subfinder -d domain.com -all | dnsx -silent -wd domain.com

# Full JSON output with response
dnsx -l subdomains.txt -silent -wd domain.com -resp -json \
  -r 8.8.4.4,129.250.35.251,208.67.222.222
```

### Chaos Data Sync

```bash
# Download and sync all chaos data
cd /tmp && \
curl -s https://chaos-data.projectdiscovery.io/index.json | \
jq -r ".[].URL" | while read url; do
  wget -q $url && unzip -q $(echo $url | rev | cut -d / -f 1 | rev)
done && rm -rf *.zip
```

---

## 📊 Database Schema

### Collections

```javascript
// programs
{
  _id: ObjectId,
  platform: "hackerone" | "bugcrowd",
  handle: String,
  name: String,
  url: String,
  scope: [String],
  bounty_range: { min: Number, max: Number },
  score: Number,
  synced_at: Date
}

// subdomains
{
  _id: ObjectId,
  domain: String,
  subdomain: String,
  program_id: ObjectId,
  provider: String,
  is_fresh: Boolean,
  discovered_at: Date
}

// lives
{
  _id: ObjectId,
  subdomain: String,
  ip: String,
  is_cdn: Boolean,
  provider: String,
  is_fresh: Boolean,
  resolved_at: Date
}

// http_services
{
  _id: ObjectId,
  url: String,
  subdomain: String,
  status_code: Number,
  title: String,
  technologies: [String],
  headers: Object,
  favicon_hash: String,
  is_cdn: Boolean,
  is_fresh: Boolean,
  scanned_at: Date,
  previous_scan: {
    status_code: Number,
    title: String,
    technologies: [String]
  }
}

// vulnerabilities
{
  _id: ObjectId,
  url: String,
  template: String,
  severity: String,
  name: String,
  description: String,
  detected_at: Date
}

// documentation
{
  _id: ObjectId,
  title: String,              // Required
  content: String,            // Required
  type: String,               // note | technique | writeup | reference | checklist
  tags: [String],
  categories: [String],
  targets: [String],          // Target names this doc covers
  technologies: [String],     // Related technologies
  vulnerabilityTypes: [String], // Vulnerability types covered
  coverage: [{                // Detailed coverage mapping
    targetId: ObjectId,
    targetType: String,
    targetName: String,
    relevanceScore: Number,
    sections: [String]
  }],
  createdBy: ObjectId,
  updatedBy: ObjectId,
  isPublic: Boolean,
  isPinned: Boolean,
  viewCount: Number,
  relatedDocs: [ObjectId],    // Related documentation IDs
  lastAccessedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/your-org/watchtower.git
cd watchtower

# Install dependencies
npm run install:all

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start MongoDB
docker-compose up -d mongodb

# Run backend
npm run start:backend

# Run frontend
npm run start:frontend

# Start watchers
watchtower watch --all
```

---

## 📄 License

MIT License - See LICENSE file for details.

---

## 🤝 Contributing

Contributions are welcome! Please read CONTRIBUTING.md for guidelines.

---

## 📞 Support

- Create an issue for bug reports
- Join Discord for community support
- Check documentation for FAQs

