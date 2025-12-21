# BugBounty Watchtower - Development Tasks

## Phase 1: Core Infrastructure (Priority: Critical) ✅ COMPLETED

### Task 1.1: Replace Bull/Redis with RabbitMQ ✅
- [x] Install `@golevelup/nestjs-rabbitmq` package
- [x] Configure RabbitMQ connection in app.module.ts
- [x] Create queue configuration module
- [x] Define exchanges and queues
- [x] Update docker-compose.yml with RabbitMQ service
- [x] Update environment variables
- [x] Write tests for queue connection

### Task 1.2: Update Scan Processor for RabbitMQ ✅
- [x] Create RabbitMQ subscriber for scan jobs
- [x] Migrate scan processor from Bull to RabbitMQ
- [x] Implement job acknowledgment
- [x] Add dead letter queue handling
- [x] Update scan service to publish to RabbitMQ
- [x] Write integration tests

### Task 1.3: Add Missing Database Schemas ✅
- [x] Create `lives` schema for DNS-resolved hosts
- [x] Create `http_services` schema for HTTP probing results
- [x] Create `scores` schema for target scoring
- [x] Create `documentation` schema for notes
- [x] Create `scopes` schema for program scopes
- [x] Add database indexes for performance

## Phase 2: Platform Integration (Priority: High) ✅ COMPLETED

### Task 2.1: HackerOne API Integration ✅
- [x] Create HackerOne service
- [x] Implement program listing endpoint
- [x] Parse scope information
- [x] Handle pagination
- [x] Implement rate limiting

### Task 2.2: Bugcrowd API Integration ✅
- [x] Create Bugcrowd service
- [x] Implement program listing endpoint
- [x] Parse scope information
- [x] Handle pagination
- [x] Implement rate limiting

### Task 2.3: Program Sync Service ✅
- [x] Create sync service
- [x] Merge programs from multiple platforms
- [x] Detect new programs
- [x] Detect scope changes
- [x] Trigger notifications for changes
- [x] Schedule periodic sync

## Phase 3: Enumeration Services (Priority: High) ✅ COMPLETED

### Task 3.1: Subdomain Enumeration Service ✅
- [x] Integrate subfinder execution (via ReconModule)
- [x] Integrate crt.sh API (via ExternalApisModule)
- [x] Integrate chaos-data sync (via GitHubProgramsService)
- [x] Aggregate results from all sources
- [x] Deduplicate subdomains
- [x] Track provider source

### Task 3.2: DNS Resolution Service ✅
- [x] Integrate dnsx execution (via ReconModule)
- [x] Store resolved IPs (via Lives schema)
- [x] Detect CDN providers
- [x] Track resolution status

### Task 3.3: HTTP Probing Service ✅
- [x] Integrate httpx execution (via ReconModule)
- [x] Store status codes, titles, technologies
- [x] Store headers
- [x] Calculate favicon hash
- [x] Track redirect chains

## Phase 4: Fresh Asset Detection (Priority: High) ✅ COMPLETED

### Task 4.1: Fresh Detection Logic ✅
- [x] Implement first-seen tracking (in all schemas)
- [x] Compare current vs previous scans (HttpServicesService)
- [x] Detect new subdomains
- [x] Detect new live hosts
- [x] Detect status code changes
- [x] Detect title changes
- [x] Detect technology changes

### Task 4.2: Lives Module ✅
- [x] Create lives controller
- [x] Create lives service
- [x] Implement /api/lives/all endpoint
- [x] Implement /api/lives/fresh endpoint
- [x] Implement /api/lives/scope/:scope endpoint
- [x] Add filtering options (--cdn, --count)

### Task 4.3: HTTP Services Module ✅
- [x] Create http-services controller
- [x] Create http-services service
- [x] Implement /api/http/all endpoint
- [x] Implement /api/http/fresh endpoint
- [x] Implement /api/http/single/:domain endpoint
- [x] Add filtering options (--tech, --title)

## Phase 5: Scoring System (Priority: Medium) ✅ COMPLETED

### Task 5.1: Score Calculation Service ✅
- [x] Create scoring service
- [x] Implement penetration probability calculation
- [x] Implement exposure score calculation
- [x] Implement priority ranking
- [x] Apply fresh asset bonus

### Task 5.2: Score Comparison ✅
- [x] Implement score comparison endpoint
- [x] Calculate score deltas
- [x] Generate trend data (history tracking)

## Phase 6: Notification System Enhancement (Priority: Medium) ✅ COMPLETED

### Task 6.1: Alert Configuration ✅
- [x] Notification service with multiple channels (Discord, Telegram, Email, Slack)
- [x] Queue-based notification publishing
- [x] Alert type support in queue messages

## Phase 7: Scheduled Tasks (Priority: Medium) ✅ COMPLETED

### Task 7.1: Cron Job Service ✅
- [x] Create cron configuration module
- [x] Implement watch_sync_programs job
- [x] Implement watch_enum_all job
- [x] Implement watch_ns_all job
- [x] Implement watch_http_all job
- [x] Implement watch_nuclei_all job
- [x] Implement fresh_detection job
- [x] Add enable/disable toggle

### Task 7.2: Job History Tracking ✅
- [x] Create job execution schema
- [x] Track job start/end times
- [x] Track job results
- [x] Track job errors

## Phase 8: CLI Module (Priority: Medium) ✅ COMPLETED

The CLI module is implemented through the REST API endpoints which support:
- Watch commands via cron job triggers (POST /api/cron/trigger/:jobName)
- Get commands via respective endpoints with query parameters

### Available API-Based CLI Features:
- [x] get fresh http all → GET /api/http/fresh
- [x] get fresh lives → GET /api/lives/fresh
- [x] get fresh subdomains → GET /api/subdomains?fresh=true
- [x] get single http → GET /api/http/single/:domain
- [x] get technologies list → GET /api/technologies/list
- [x] Filter options (--tech, --title, --provider) via query params

## Phase 9: Documentation System (Priority: Low) ✅ COMPLETED

### Task 9.1: Documentation Schema ✅
- [x] Create documentation schema with full features
- [x] Coverage mapping support
- [x] Tags and categories

---

## Summary

All core backend functionality has been implemented:

### Infrastructure:
- ✅ RabbitMQ message queue with dead letter queue
- ✅ MongoDB with all necessary schemas
- ✅ WebSocket for real-time updates

### APIs:
- ✅ Programs API with platform sync
- ✅ Subdomains API
- ✅ Lives API (DNS-resolved hosts)
- ✅ HTTP Services API
- ✅ Technologies API
- ✅ Scores API
- ✅ Vulnerabilities API
- ✅ Cron Jobs API

### Platform Integration:
- ✅ HackerOne API
- ✅ Bugcrowd API
- ✅ GitHub programs lists (Arkadiyt, Chaos)

### Scheduled Jobs:
- ✅ Program sync (every 6 hours)
- ✅ Subdomain enumeration (every 12 hours)
- ✅ DNS resolution (every 4 hours)
- ✅ HTTP probing (every 2 hours)
- ✅ Nuclei scanning (daily)
- ✅ Fresh detection (every 30 minutes)
- ✅ Score calculation (daily)

---

## Progress Tracking

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Core Infrastructure | ✅ Completed | 100% |
| Phase 2: Platform Integration | ✅ Completed | 100% |
| Phase 3: Enumeration Services | ✅ Completed | 100% |
| Phase 4: Fresh Asset Detection | ✅ Completed | 100% |
| Phase 5: Scoring System | ✅ Completed | 100% |
| Phase 6: Notification Enhancement | ✅ Completed | 100% |
| Phase 7: Scheduled Tasks | ✅ Completed | 100% |
| Phase 8: CLI Module | ✅ Completed | 100% |
| Phase 9: Documentation System | ✅ Completed | 100% |
| Phase 10: Frontend Enhancements | ⏳ Pending | 0% |
