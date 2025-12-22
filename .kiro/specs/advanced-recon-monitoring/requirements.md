# Requirements Document

## Introduction

This feature implements an Advanced Reconnaissance and Monitoring System for the BugBounty Watchtower platform. The system integrates multiple external reconnaissance tools (AbuseIPDB, Waybackurls, Nuclei, Certificate Transparency), provides HTTP service monitoring with change detection, and offers a web-based fuzzing interface. The goal is to enable continuous monitoring of targets with automated alerting when significant changes occur (status codes, titles, technologies, favicons).

## Glossary

- **AbuseIPDB**: An IP address abuse reporting and lookup service for identifying malicious IPs
- **Waybackurls**: A tool that fetches URLs from the Wayback Machine for historical URL discovery
- **Nuclei**: A fast vulnerability scanner based on customizable templates
- **Certificate Transparency (cert_trans)**: Public logs of SSL/TLS certificates for discovering subdomains
- **Watchtower**: A monitoring component that tracks changes in HTTP services over time
- **FFUF**: A fast web fuzzer used for directory and file discovery
- **HTTP Probing**: The process of checking HTTP services for status, title, technologies, and other metadata
- **Fresh Service**: An HTTP service that was recently discovered or scanned
- **Change Detection**: The process of comparing current scan results with previous results to identify modifications
- **Favicon Hash**: A hash of a website's favicon used for fingerprinting and tracking changes

## Requirements

### Requirement 1

**User Story:** As a bug bounty hunter, I want to integrate AbuseIPDB lookups, so that I can identify potentially malicious IP addresses associated with my targets.

#### Acceptance Criteria

1. WHEN a user requests an AbuseIPDB lookup for an IP address THEN the Recon Service SHALL query the AbuseIPDB API and return abuse confidence score, country, ISP, and report count
2. WHEN the AbuseIPDB API returns data THEN the Recon Service SHALL store the results associated with the relevant subdomain or domain
3. WHEN an IP has an abuse confidence score above a configurable threshold THEN the Notification Service SHALL send an alert to configured channels
4. WHEN a user enables AbuseIPDB watching for a domain THEN the Cron Service SHALL periodically check all associated IPs for abuse reports

### Requirement 2

**User Story:** As a bug bounty hunter, I want to discover historical URLs using Waybackurls, so that I can find hidden endpoints and forgotten assets.

#### Acceptance Criteria

1. WHEN a user requests Waybackurls enumeration for a domain THEN the Recon Service SHALL execute waybackurls and parse the output
2. WHEN Waybackurls returns URLs THEN the Recon Service SHALL extract unique domains using unfurl and store them
3. WHEN new domains are discovered from Waybackurls THEN the Recon Service SHALL add them to the subdomain list for the parent domain
4. WHEN Waybackurls discovers new endpoints THEN the Endpoint Service SHALL store them with source attribution

### Requirement 3

**User Story:** As a bug bounty hunter, I want to run Nuclei scans against targets, so that I can automatically detect known vulnerabilities.

#### Acceptance Criteria

1. WHEN a user initiates a Nuclei scan for a target THEN the Scanner Service SHALL execute nuclei with specified templates
2. WHEN Nuclei discovers vulnerabilities THEN the Vulnerability Service SHALL store findings with severity, template ID, and matched content
3. WHEN a critical or high severity vulnerability is found THEN the Notification Service SHALL send an immediate alert
4. WHEN a user configures automatic Nuclei scanning THEN the Cron Service SHALL run scans on new live hosts

### Requirement 4

**User Story:** As a bug bounty hunter, I want to monitor Certificate Transparency logs, so that I can discover new subdomains as certificates are issued.

#### Acceptance Criteria

1. WHEN a user enables Certificate Transparency monitoring for a domain THEN the Recon Service SHALL query CT logs for certificates
2. WHEN new certificates are discovered THEN the Recon Service SHALL extract subdomains from the certificate's Subject Alternative Names
3. WHEN new subdomains are found via CT logs THEN the Subdomain Service SHALL add them with source set to cert_trans
4. WHEN CT monitoring discovers a new subdomain THEN the Notification Service SHALL send an alert

### Requirement 5

**User Story:** As a bug bounty hunter, I want to view live domains and subdomains on the subdomain page, so that I can focus on active targets.

#### Acceptance Criteria

1. WHEN a user views the subdomain page THEN the Frontend SHALL display a filter for live versus all subdomains
2. WHEN filtering by live subdomains THEN the API SHALL return only subdomains where isAlive equals true
3. WHEN displaying live subdomains THEN the Frontend SHALL show HTTP status, title, and technologies
4. WHEN a subdomain becomes live or goes offline THEN the Frontend SHALL update the display in real-time via WebSocket

### Requirement 6

**User Story:** As a bug bounty hunter, I want to probe single HTTP domains using Watchtower, so that I can get detailed service information.

#### Acceptance Criteria

1. WHEN a user requests a single domain probe THEN the HTTP Prober SHALL execute httpx with full options including favicon, headers, tech-detect, and redirect chain
2. WHEN probing completes THEN the HTTP Service SHALL store all extracted metadata including favicon hash, response headers, and technology stack
3. WHEN the probe returns JSON output THEN the API SHALL parse and return structured data to the frontend
4. WHEN probing a domain THEN the HTTP Prober SHALL use a 5-second timeout with 3 retries

### Requirement 7

**User Story:** As a bug bounty hunter, I want a web UI for fuzzing targets, so that I can discover hidden files and directories without using the command line.

#### Acceptance Criteria

1. WHEN a user accesses the fuzzing page THEN the Frontend SHALL display a form with URL input, wordlist selection, extensions, and filter options
2. WHEN a user submits a fuzzing job THEN the Backend SHALL execute ffuf with the specified parameters
3. WHEN ffuf discovers results THEN the Backend SHALL stream results to the frontend in real-time
4. WHEN configuring filters THEN the Frontend SHALL support match codes, filter words, filter lines, and filter size options
5. WHEN a fuzzing job completes THEN the Backend SHALL store results associated with the target domain

### Requirement 8

**User Story:** As a bug bounty hunter, I want to monitor HTTP services for changes, so that I can detect when targets are modified.

#### Acceptance Criteria

1. WHEN the HTTP monitoring job runs THEN the HTTP Service SHALL compare current scan results with previous scan data
2. WHEN a status code changes (e.g., 403 to 200) THEN the Notification Service SHALL send an alert with old and new values
3. WHEN a page title changes THEN the Notification Service SHALL send an alert with the title change details
4. WHEN technologies change THEN the HTTP Service SHALL flag the service and optionally send an alert
5. WHEN a favicon hash changes THEN the HTTP Service SHALL flag the service as changed
6. WHEN storing scan results THEN the HTTP Service SHALL preserve the previous scan data for comparison

### Requirement 9

**User Story:** As a bug bounty hunter, I want to search and filter HTTP services by various criteria, so that I can find interesting targets.

#### Acceptance Criteria

1. WHEN a user searches HTTP services THEN the API SHALL support filtering by status code, technology, CDN status, and freshness
2. WHEN filtering by fresh services THEN the API SHALL return services where isFresh equals true
3. WHEN searching through HTTP headers THEN the API SHALL support regex-based header value matching
4. WHEN filtering by changes THEN the API SHALL return services where statusCodeChanged, titleChanged, or techChanged equals true

### Requirement 10

**User Story:** As a bug bounty hunter, I want configurable alerting rules, so that I can receive notifications for specific conditions.

#### Acceptance Criteria

1. WHEN a user creates an alert rule for status code changes THEN the Alert Service SHALL monitor for matching conditions
2. WHEN a user creates an alert rule for title keywords (e.g., "index", "welcome") THEN the Alert Service SHALL check titles against the pattern
3. WHEN an alert condition is met THEN the Notification Service SHALL send alerts to all configured channels (Discord, Slack, Telegram, Email)
4. WHEN configuring alerts THEN the Frontend SHALL allow specifying severity levels and notification channels

