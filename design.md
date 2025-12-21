# BugBounty Watchtower - System Design Document

## 1. System Overview

BugBounty Watchtower is an automated reconnaissance and vulnerability assessment platform for bug bounty hunters. The system provides continuous monitoring of bug bounty programs, subdomain enumeration, HTTP service discovery, and vulnerability scanning.

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Dashboard │ │Programs  │ │Subdomains│ │   HTTP   │ │  Vulns   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (NestJS)                                 │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐  │
│  │    REST API        │ │    WebSocket       │ │    CLI Module      │  │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                         Core Services                               ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      ││
│  │  │  Sync   │ │  Enum   │ │   DNS   │ │  HTTP   │ │  Vuln   │      ││
│  │  │ Service │ │ Service │ │ Service │ │ Service │ │ Service │      ││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘      ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                              ││
│  │  │ Notify  │ │ Score   │ │  Cron   │                              ││
│  │  │ Service │ │ Service │ │ Service │                              ││
│  │  └─────────┘ └─────────┘ └─────────┘                              ││
│  └────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
           │                    │                       │
           ▼                    ▼                       ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│    MongoDB       │  │    RabbitMQ      │  │   External Services      │
│  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌──────┐ ┌──────────┐  │
│  │ programs   │  │  │  │ scan_queue │  │  │  │H1 API│ │Bugcrowd  │  │
│  │ subdomains │  │  │  │ enum_queue │  │  │  └──────┘ └──────────┘  │
│  │ lives      │  │  │  │ http_queue │  │  │  ┌──────┐ ┌──────────┐  │
│  │ http_svc   │  │  │  │ vuln_queue │  │  │  │Nuclei│ │ httpx    │  │
│  │ vulns      │  │  │  └────────────┘  │  │  └──────┘ └──────────┘  │
│  └────────────┘  │  └──────────────────┘  └──────────────────────────┘
└──────────────────┘
```

### 2.2 Component Details

#### Frontend (Next.js 14)
- **Dashboard**: Real-time overview with score comparisons and analytics
- **Programs Management**: Sync and manage bug bounty programs
- **Subdomains View**: Browse live/fresh/all subdomains with filtering
- **HTTP Services**: View technologies, headers, status codes
- **Vulnerabilities**: Nuclei scan results with severity filtering
- **Documentation**: Learning notes and coverage checker
- **Notifications Center**: Alert configuration and history
- **Settings**: Cron job configuration and API keys

#### Backend (NestJS)
- **REST API Layer**: RESTful endpoints for all data operations
- **WebSocket Gateway**: Real-time scan progress and notifications
- **CLI Module**: Command-line interface for automation scripts

#### Message Queue (RabbitMQ)
- **scan_queue**: Full scan job processing
- **enum_queue**: Subdomain enumeration jobs
- **dns_queue**: DNS resolution jobs
- **http_queue**: HTTP probing jobs
- **vuln_queue**: Vulnerability scanning jobs
- **notify_queue**: Notification delivery

#### Database (MongoDB)
- **programs**: Bug bounty program metadata
- **scopes**: Target scopes per program
- **domains**: Root domains
- **subdomains**: Discovered subdomains
- **lives**: DNS-resolved live hosts
- **http_services**: HTTP probing results
- **vulnerabilities**: Detected vulnerabilities
- **documentation**: Learning notes
- **notifications**: Alert history
- **scores**: Target scoring data

## 3. Data Flow

### 3.1 Program Sync Flow
```
HackerOne/Bugcrowd API → Sync Service → programs collection
                                      → scopes collection
                                      → domains collection
```

### 3.2 Enumeration Flow
```
domains → Enum Service → subfinder/crt.sh/chaos → subdomains collection
```

### 3.3 DNS Resolution Flow
```
subdomains → DNS Service → dnsx/shuffledns → lives collection
```

### 3.4 HTTP Discovery Flow
```
lives → HTTP Service → httpx → http_services collection
```

### 3.5 Vulnerability Flow
```
http_services → Vuln Service → nuclei → vulnerabilities collection
```

## 4. Queue Architecture (RabbitMQ)

### 4.1 Exchange Configuration
```
watchtower.direct (direct exchange)
├── scan.full
├── scan.subdomain
├── scan.dns
├── scan.http
├── scan.nuclei
└── notify.*
```

### 4.2 Queue Definitions
| Queue Name | Purpose | Concurrency | TTL |
|------------|---------|-------------|-----|
| watchtower.scans | Full scan jobs | 3 | 24h |
| watchtower.enum | Subdomain enum | 5 | 12h |
| watchtower.dns | DNS resolution | 10 | 6h |
| watchtower.http | HTTP probing | 10 | 6h |
| watchtower.nuclei | Vuln scanning | 3 | 24h |
| watchtower.notify | Notifications | 10 | 1h |

### 4.3 Dead Letter Queue
Failed jobs are routed to `watchtower.dlq` for manual review and retry.

## 5. API Design

### 5.1 REST Endpoints

#### Programs
- `GET /api/programs` - List programs with filtering
- `GET /api/programs/:id` - Get program details
- `POST /api/programs/sync` - Trigger platform sync

#### Subdomains
- `GET /api/subdomains/:domain` - Get domain subdomains
- `GET /api/subdomains/all` - Get all subdomains
- `GET /api/subdomains/fresh` - Get fresh subdomains

#### Lives
- `GET /api/lives/all` - Get all live hosts
- `GET /api/lives/fresh` - Get fresh live hosts
- `GET /api/lives/scope/:scope` - Get by scope

#### HTTP Services
- `GET /api/http/all` - Get all HTTP services
- `GET /api/http/fresh` - Get fresh HTTP services
- `GET /api/http/single/:domain` - Get single service details

#### Technologies
- `GET /api/technologies/list` - List all technologies

#### Vulnerabilities
- `GET /api/vulnerabilities` - List vulnerabilities
- `GET /api/nuclei/results` - Get nuclei results

### 5.2 WebSocket Events
- `scan:update` - Scan progress updates
- `asset:new` - New asset discovered
- `vuln:new` - New vulnerability found
- `notify:alert` - Real-time alerts

## 6. Scheduling System

### 6.1 Cron Jobs
| Job | Schedule | Description |
|-----|----------|-------------|
| watch_sync_programs | Every 6 hours | Sync from platforms |
| watch_enum_all | Every 12 hours | Full enumeration |
| watch_ns_all | Every 4 hours | DNS resolution |
| watch_http_all | Every 2 hours | HTTP discovery |
| watch_nuclei_all | Daily | Vulnerability scan |
| fresh_detection | Every 30 minutes | Detect fresh assets |

### 6.2 Job Priority
1. Critical: Vulnerability alerts
2. High: Fresh asset detection
3. Medium: HTTP discovery
4. Low: Full enumeration

## 7. Scoring System

### 7.1 Score Components
- **Penetration Probability**: Technology stack, exposed services
- **Exposure Score**: Subdomain count, live hosts, open ports
- **Priority Ranking**: Weighted combination with fresh bonus

### 7.2 Score Formula
```javascript
score = (pentestScore * 0.6 + exposureScore * 0.4) * freshBonus
freshBonus = isFresh ? 1.2 : 1.0
```

## 8. Notification System

### 8.1 Alert Types
- New subdomain discovered
- New live host detected
- Status code change (403 → 200)
- Title change
- Technology change
- New vulnerability found

### 8.2 Channels
- Discord (webhook)
- Telegram (bot API)
- Email (SMTP)
- Slack (webhook)

## 9. Security Considerations

### 9.1 Authentication
- JWT-based authentication
- Role-based access control (RBAC)
- API key management for external services

### 9.2 Rate Limiting
- Per-user request limits
- Per-IP throttling
- External API rate limit handling

### 9.3 Data Protection
- Encrypted credentials storage
- Audit logging
- Secure WebSocket connections

## 10. Scalability

### 10.1 Horizontal Scaling
- Stateless API servers
- RabbitMQ cluster for queue distribution
- MongoDB replica set

### 10.2 Performance Optimization
- Database indexing strategy
- Connection pooling
- Result caching with TTL

