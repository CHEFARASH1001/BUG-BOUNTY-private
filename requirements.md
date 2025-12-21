# BugBounty Watchtower - Requirements Document

## 1. Functional Requirements

### 1.1 Program Management
- **FR-1.1.1**: Sync programs from HackerOne API
- **FR-1.1.2**: Sync programs from Bugcrowd API
- **FR-1.1.3**: Parse GitHub-based program lists
- **FR-1.1.4**: Store program metadata (name, scope, bounty range)
- **FR-1.1.5**: Filter programs by platform, bounty type, asset type

### 1.2 Subdomain Enumeration
- **FR-1.2.1**: Enumerate subdomains using subfinder
- **FR-1.2.2**: Query crt.sh for certificate transparency logs
- **FR-1.2.3**: Fetch chaos-data from ProjectDiscovery
- **FR-1.2.4**: Extract domains from waybackurls
- **FR-1.2.5**: Extract domains from gau (GetAllUrls)
- **FR-1.2.6**: Support static brute force with wordlists
- **FR-1.2.7**: Support dynamic brute force with dnsgen

### 1.3 DNS Resolution
- **FR-1.3.1**: Resolve subdomains using dnsx
- **FR-1.3.2**: High-speed resolution with shuffledns/massdns
- **FR-1.3.3**: Wildcard detection and filtering
- **FR-1.3.4**: Track DNS resolution status (resolved/failed)
- **FR-1.3.5**: Store IP addresses and CDN detection

### 1.4 HTTP Service Discovery
- **FR-1.4.1**: Probe HTTP/HTTPS services using httpx
- **FR-1.4.2**: Extract response headers
- **FR-1.4.3**: Detect page titles
- **FR-1.4.4**: Identify technologies/frameworks
- **FR-1.4.5**: Calculate favicon hash
- **FR-1.4.6**: Track redirect chains
- **FR-1.4.7**: Detect CDN providers

### 1.5 Vulnerability Assessment
- **FR-1.5.1**: Run nuclei template scans
- **FR-1.5.2**: Support custom nuclei templates
- **FR-1.5.3**: Directory fuzzing with ffuf
- **FR-1.5.4**: Parameter discovery with arjun
- **FR-1.5.5**: Store vulnerability evidence (request/response)

### 1.6 Fresh Asset Detection
- **FR-1.6.1**: Track first-seen timestamp for assets
- **FR-1.6.2**: Identify new subdomains
- **FR-1.6.3**: Identify new live hosts
- **FR-1.6.4**: Detect status code changes
- **FR-1.6.5**: Detect title changes
- **FR-1.6.6**: Detect technology changes

### 1.7 Notifications
- **FR-1.7.1**: Send Discord webhook notifications
- **FR-1.7.2**: Send Telegram bot messages
- **FR-1.7.3**: Send email alerts
- **FR-1.7.4**: Send Slack webhook notifications
- **FR-1.7.5**: Configurable alert types per channel

### 1.8 Scoring System
- **FR-1.8.1**: Calculate penetration probability score
- **FR-1.8.2**: Calculate exposure score
- **FR-1.8.3**: Calculate priority ranking
- **FR-1.8.4**: Apply fresh asset bonus
- **FR-1.8.5**: Compare scores between targets

### 1.9 Documentation System
- **FR-1.9.1**: Store learning notes
- **FR-1.9.2**: Tag notes with categories
- **FR-1.9.3**: Coverage checker for targets
- **FR-1.9.4**: Searchable knowledge base

### 1.10 CLI Commands
- **FR-1.10.1**: Watch commands for continuous monitoring
- **FR-1.10.2**: Get commands for data retrieval
- **FR-1.10.3**: Pipeline-friendly output formats
- **FR-1.10.4**: Filter options (--tech, --title, --provider)

### 1.11 Scheduled Tasks
- **FR-1.11.1**: Configurable cron schedules
- **FR-1.11.2**: Enable/disable individual tasks
- **FR-1.11.3**: Manual trigger option
- **FR-1.11.4**: Job execution history

## 2. Non-Functional Requirements

### 2.1 Performance
- **NFR-2.1.1**: API response time < 200ms for simple queries
- **NFR-2.1.2**: Support scanning 10,000+ subdomains per hour
- **NFR-2.1.3**: Queue processing latency < 5 seconds
- **NFR-2.1.4**: WebSocket real-time updates < 1 second

### 2.2 Scalability
- **NFR-2.2.1**: Horizontal scaling for API servers
- **NFR-2.2.2**: Queue worker auto-scaling
- **NFR-2.2.3**: Database sharding support
- **NFR-2.2.4**: Handle 1M+ subdomain records

### 2.3 Reliability
- **NFR-2.3.1**: 99.9% API uptime
- **NFR-2.3.2**: Automatic job retry with backoff
- **NFR-2.3.3**: Dead letter queue for failed jobs
- **NFR-2.3.4**: Graceful degradation on external API failures

### 2.4 Security
- **NFR-2.4.1**: JWT authentication with expiration
- **NFR-2.4.2**: Role-based access control
- **NFR-2.4.3**: API rate limiting
- **NFR-2.4.4**: Encrypted credentials storage
- **NFR-2.4.5**: Audit logging for sensitive operations

### 2.5 Usability
- **NFR-2.5.1**: Intuitive dashboard UI
- **NFR-2.5.2**: Mobile-responsive design
- **NFR-2.5.3**: Real-time scan progress
- **NFR-2.5.4**: Export to JSON/CSV formats

## 3. Technical Requirements

### 3.1 Backend Stack
- **TR-3.1.1**: Node.js 18+ with NestJS framework
- **TR-3.1.2**: TypeScript 5.0+
- **TR-3.1.3**: MongoDB 7.0+ for data storage
- **TR-3.1.4**: RabbitMQ 3.12+ for message queuing
- **TR-3.1.5**: Mongoose ODM for database operations

### 3.2 Frontend Stack
- **TR-3.2.1**: Next.js 14 with App Router
- **TR-3.2.2**: React 18+
- **TR-3.2.3**: TailwindCSS for styling
- **TR-3.2.4**: shadcn/ui component library
- **TR-3.2.5**: Socket.io client for real-time updates

### 3.3 External Tools
- **TR-3.3.1**: subfinder for passive enumeration
- **TR-3.3.2**: dnsx for DNS resolution
- **TR-3.3.3**: httpx for HTTP probing
- **TR-3.3.4**: nuclei for vulnerability scanning
- **TR-3.3.5**: shuffledns for DNS brute force

### 3.4 Infrastructure
- **TR-3.4.1**: Docker containerization
- **TR-3.4.2**: Docker Compose for local development
- **TR-3.4.3**: Health check endpoints
- **TR-3.4.4**: Structured logging (JSON format)

## 4. External API Requirements

### 4.1 Bug Bounty Platforms
- **EXT-4.1.1**: HackerOne API v1 (GraphQL)
- **EXT-4.1.2**: Bugcrowd API
- **EXT-4.1.3**: GitHub API for program lists

### 4.2 Reconnaissance APIs
- **EXT-4.2.1**: Shodan API
- **EXT-4.2.2**: SecurityTrails API
- **EXT-4.2.3**: VirusTotal API
- **EXT-4.2.4**: Censys API
- **EXT-4.2.5**: crt.sh (Certificate Transparency)

### 4.3 IP Rotation Requirements
- **EXT-4.3.1**: Proxy pool for rate-limited services
- **EXT-4.3.2**: crt.sh requires IP rotation
- **EXT-4.3.3**: abuseipdb requires IP rotation

## 5. Data Requirements

### 5.1 Data Retention
- **DR-5.1.1**: Keep all historical subdomain records
- **DR-5.1.2**: Keep vulnerability evidence for 90 days
- **DR-5.1.3**: Keep scan logs for 30 days
- **DR-5.1.4**: Archive old data after 1 year

### 5.2 Data Backup
- **DR-5.2.1**: Daily database backups
- **DR-5.2.2**: Point-in-time recovery capability
- **DR-5.2.3**: Backup encryption at rest

## 6. Integration Requirements

### 6.1 Pipeline Integration
- **INT-6.1.1**: STDIN/STDOUT for CLI commands
- **INT-6.1.2**: JSON output format option
- **INT-6.1.3**: Exit codes for script automation

### 6.2 Webhook Integration
- **INT-6.2.1**: Outgoing webhook support
- **INT-6.2.2**: Configurable payload format
- **INT-6.2.3**: Retry on delivery failure

