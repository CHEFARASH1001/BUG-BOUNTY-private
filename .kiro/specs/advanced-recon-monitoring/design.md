# Design Document

## Overview

The Advanced Reconnaissance and Monitoring System extends the BugBounty Watchtower platform with comprehensive external tool integrations, HTTP service monitoring with change detection, DNS brute forcing capabilities, and a web-based fuzzing interface. The system follows the existing NestJS modular architecture, integrating with the current schemas and services while adding new capabilities for continuous target monitoring, DNS enumeration, and alerting. Additionally, a CLI interface (Watchtower CLI) provides command-line access to query targets, HTTP services, and live hosts with comparison capabilities.

## Architecture

```mermaid
graph TB
    subgraph Frontend
        FuzzPage[Fuzzing Page]
        SubdomainPage[Subdomain Page]
        HTTPPage[HTTP Services Page]
        AlertConfig[Alert Configuration]
        DNSBrutePage[DNS Brute Page]
    end

    subgraph CLI
        WatchtowerCLI[Watchtower CLI]
    end

    subgraph Backend API
        ReconModule[Recon Module]
        ScannerModule[Scanner Module]
        HTTPServiceModule[HTTP Services Module]
        AlertModule[Alert Module]
        CronModule[Cron Module]
        CLIModule[CLI Module]
    end

    subgraph External Tools
        AbuseIPDB[AbuseIPDB API]
        Waybackurls[waybackurls CLI]
        GAU[gau CLI]
        Nuclei[nuclei CLI]
        FFUF[ffuf CLI]
        HTTPx[httpx CLI]
        CertSpotter[Certificate Transparency]
        ShuffleDNS[shuffledns CLI]
        MassDNS[massdns CLI]
        DNSGen[dnsgen CLI]
        DNSX[dnsx CLI]
        ChaosAPI[Chaos ProjectDiscovery]
    end

    subgraph Services
        AbuseIPDBService[AbuseIPDB Service]
        WaybackService[Wayback Service]
        GAUService[GAU Service]
        NucleiService[Nuclei Service]
        FuzzService[Fuzz Service]
        HTTPMonitorService[HTTP Monitor Service]
        CTService[CT Service]
        AlertService[Alert Service]
        DNSBruteService[DNS Brute Service]
        ChaosService[Chaos Service]
        WordlistService[Wordlist Service]
    end

    subgraph Data Layer
        MongoDB[(MongoDB)]
        Redis[(Redis Queue)]
        WordlistStorage[(Wordlist Storage)]
    end

    FuzzPage --> FuzzService
    SubdomainPage --> ReconModule
    HTTPPage --> HTTPServiceModule
    AlertConfig --> AlertModule
    DNSBrutePage --> DNSBruteService
    WatchtowerCLI --> CLIModule

    ReconModule --> AbuseIPDBService
    ReconModule --> WaybackService
    ReconModule --> GAUService
    ReconModule --> CTService
    ReconModule --> DNSBruteService
    ReconModule --> ChaosService
    ScannerModule --> NucleiService
    HTTPServiceModule --> HTTPMonitorService
    HTTPServiceModule --> FuzzService

    AbuseIPDBService --> AbuseIPDB
    WaybackService --> Waybackurls
    GAUService --> GAU
    NucleiService --> Nuclei
    FuzzService --> FFUF
    HTTPMonitorService --> HTTPx
    CTService --> CertSpotter
    DNSBruteService --> ShuffleDNS
    DNSBruteService --> MassDNS
    DNSBruteService --> DNSGen
    DNSBruteService --> DNSX
    ChaosService --> ChaosAPI
    WordlistService --> WordlistStorage

    AlertService --> NotificationService[Notification Service]
    CronModule --> HTTPMonitorService
    CronModule --> CTService
    CronModule --> AbuseIPDBService
    CronModule --> ChaosService
    CronModule --> DNSBruteService

    Services --> MongoDB
    Services --> Redis
```

## Components and Interfaces

### 1. AbuseIPDB Service

```typescript
interface AbuseIPDBResult {
  ipAddress: string;
  isPublic: boolean;
  abuseConfidenceScore: number;
  countryCode: string;
  isp: string;
  domain: string;
  totalReports: number;
  lastReportedAt: Date;
  isWhitelisted: boolean;
}

interface AbuseIPDBService {
  checkIP(ip: string): Promise<AbuseIPDBResult>;
  checkIPs(ips: string[]): Promise<AbuseIPDBResult[]>;
  getReportsForIP(ip: string, maxAge?: number): Promise<AbuseReport[]>;
}
```

### 2. Wayback Service

```typescript
interface WaybackResult {
  domain: string;
  urls: string[];
  extractedDomains: string[];
  extractedEndpoints: string[];
  timestamp: Date;
}

interface WaybackService {
  fetchUrls(domain: string): Promise<WaybackResult>;
  extractDomains(urls: string[]): string[];
  extractEndpoints(urls: string[]): Endpoint[];
}
```

### 3. Nuclei Service

```typescript
interface NucleiResult {
  templateId: string;
  templateName: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  host: string;
  matchedAt: string;
  extractedResults: string[];
  timestamp: Date;
  curl: string;
  matcher: string;
}

interface NucleiService {
  scan(targets: string[], templates?: string[]): Promise<NucleiResult[]>;
  scanSingle(target: string, templates?: string[]): Promise<NucleiResult[]>;
  getAvailableTemplates(): Promise<string[]>;
}
```

### 4. Certificate Transparency Service

```typescript
interface CTResult {
  domain: string;
  subdomains: string[];
  certificates: {
    issuer: string;
    notBefore: Date;
    notAfter: Date;
    serialNumber: string;
  }[];
}

interface CTService {
  queryDomain(domain: string): Promise<CTResult>;
  watchDomain(domain: string): void;
  stopWatching(domain: string): void;
}
```

### 5. Fuzz Service

```typescript
interface FuzzConfig {
  url: string;
  wordlist: string;
  extensions?: string[];
  matchCodes?: number[];
  filterWords?: number;
  filterLines?: number;
  filterSize?: number;
  threads?: number;
  timeout?: number;
}

interface FuzzResult {
  url: string;
  status: number;
  length: number;
  words: number;
  lines: number;
  contentType: string;
  redirectLocation?: string;
}

interface FuzzService {
  startFuzz(config: FuzzConfig): AsyncGenerator<FuzzResult>;
  stopFuzz(jobId: string): void;
  getAvailableWordlists(): Promise<string[]>;
}
```

### 6. HTTP Monitor Service

```typescript
interface HTTPMonitorConfig {
  targets: string[];
  options: {
    favicon: boolean;
    followRedirects: boolean;
    techDetect: boolean;
    includeHeaders: boolean;
    includeChain: boolean;
    timeout: number;
    retries: number;
  };
}

interface HTTPChangeEvent {
  url: string;
  changeType: 'status_code' | 'title' | 'technology' | 'favicon' | 'content';
  previousValue: any;
  currentValue: any;
  detectedAt: Date;
}

interface HTTPMonitorService {
  probe(config: HTTPMonitorConfig): Promise<HttpProbeResult[]>;
  probeSingle(url: string): Promise<HttpProbeResult>;
  detectChanges(current: HttpProbeResult, previous: HttpProbeResult): HTTPChangeEvent[];
  watchAll(): Promise<void>;
  watchFresh(): Promise<void>;
}
```

### 7. Alert Service

```typescript
interface AlertRule {
  id: string;
  name: string;
  condition: {
    type: 'status_change' | 'title_match' | 'tech_change' | 'favicon_change' | 'abuse_score';
    operator: 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than';
    value: any;
    previousValue?: any;
  };
  severity: 'info' | 'warning' | 'critical';
  channels: ('discord' | 'slack' | 'telegram' | 'email')[];
  enabled: boolean;
}

interface AlertService {
  createRule(rule: AlertRule): Promise<AlertRule>;
  updateRule(id: string, rule: Partial<AlertRule>): Promise<AlertRule>;
  deleteRule(id: string): Promise<void>;
  evaluateCondition(event: HTTPChangeEvent, rule: AlertRule): boolean;
  triggerAlert(event: HTTPChangeEvent, rule: AlertRule): Promise<void>;
}
```

### 8. DNS Brute Service

```typescript
interface WordlistConfig {
  sources: {
    bestDns: boolean;
    twoMillionSubdomains: boolean;
    crunch: boolean;
    custom?: string[];
  };
  crunchConfig?: {
    minLength: number;
    maxLength: number;
    charset: string;
  };
}

interface DNSBruteConfig {
  domain: string;
  wordlistConfig: WordlistConfig;
  threads: number;
  resolvers: string;
  mode: 'static' | 'dynamic';
}

interface DNSBruteJob {
  id: string;
  domain: string;
  status: 'pending' | 'preparing' | 'running' | 'completed' | 'failed';
  mode: 'static' | 'dynamic';
  progress: number;
  discoveredCount: number;
  startedAt: Date;
  completedAt?: Date;
  results: string[];
}

interface DNSBruteService {
  prepareStaticWordlist(config: WordlistConfig, domain: string): Promise<string>;
  prepareDynamicWordlist(existingSubdomains: string[]): Promise<string>;
  runStaticBrute(config: DNSBruteConfig): AsyncGenerator<string>;
  runDynamicBrute(domain: string, existingSubdomains: string[]): AsyncGenerator<string>;
  getJobStatus(jobId: string): Promise<DNSBruteJob>;
  cancelJob(jobId: string): Promise<void>;
}
```

### 9. GAU Service

```typescript
interface GAUConfig {
  domain: string;
  providers?: ('wayback' | 'commoncrawl' | 'otx' | 'urlscan')[];
  blacklist?: string[];
  threads?: number;
}

interface GAUResult {
  domain: string;
  urls: string[];
  extractedDomains: string[];
  extractedEndpoints: string[];
  providers: string[];
  timestamp: Date;
}

interface GAUService {
  fetchUrls(config: GAUConfig): Promise<GAUResult>;
  extractDomains(urls: string[]): string[];
  extractEndpoints(urls: string[]): Endpoint[];
}
```

### 10. Chaos Service

```typescript
interface ChaosProgram {
  name: string;
  url: string;
  count: number;
  lastUpdated: Date;
}

interface ChaosSyncResult {
  program: string;
  subdomainsImported: number;
  newSubdomains: number;
  timestamp: Date;
}

interface ChaosService {
  fetchIndex(): Promise<ChaosProgram[]>;
  syncProgram(programName: string): Promise<ChaosSyncResult>;
  syncAll(): Promise<ChaosSyncResult[]>;
  findMatchingPrograms(query: string): Promise<ChaosProgram[]>;
}
```

### 11. Wordlist Service

```typescript
interface WordlistInfo {
  name: string;
  path: string;
  lineCount: number;
  sizeBytes: number;
  lastUpdated: Date;
  source: string;
}

interface WordlistService {
  downloadWordlist(url: string, name: string): Promise<WordlistInfo>;
  generateCrunch(minLen: number, maxLen: number, charset: string): Promise<string>;
  mergeWordlists(paths: string[], outputPath: string): Promise<WordlistInfo>;
  appendDomain(wordlistPath: string, domain: string, outputPath: string): Promise<string>;
  getAvailableWordlists(): Promise<WordlistInfo[]>;
  getWordlistStats(name: string): Promise<WordlistInfo>;
}
```

### 12. Watchtower CLI Service

```typescript
interface CLIQueryOptions {
  format: 'json' | 'table';
  compare?: boolean;
  filter?: Record<string, any>;
}

interface SingleTargetResult {
  program: string;
  domains: string[];
  subdomainCount: number;
  liveCount: number;
  lastScanAt: Date;
  scope: {
    inScope: string[];
    outOfScope: string[];
  };
}

interface HTTPQueryResult {
  url: string;
  status: number;
  title: string;
  technologies: string[];
  changed: boolean;
  changeDetails?: {
    statusChanged: boolean;
    titleChanged: boolean;
    techChanged: boolean;
    previousStatus?: number;
    previousTitle?: string;
  };
}

interface LivesQueryResult {
  subdomain: string;
  ip: string;
  status: number;
  title: string;
  discoveredAt: Date;
  isNew: boolean;
  hasChanged: boolean;
}

interface WatchtowerCLIService {
  getSingleTarget(programName: string, options: CLIQueryOptions): Promise<SingleTargetResult>;
  getHTTPAll(options: CLIQueryOptions): Promise<HTTPQueryResult[]>;
  getHTTPByProgram(programName: string, options: CLIQueryOptions): Promise<HTTPQueryResult[]>;
  getLivesScope(programName: string, options: CLIQueryOptions): Promise<LivesQueryResult[]>;
  formatOutput(data: any, format: 'json' | 'table'): string;
}
```

## Data Models

### Alert Rule Schema

```typescript
@Schema({ timestamps: true })
export class AlertRule {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Object, required: true })
  condition: {
    type: string;
    operator: string;
    value: any;
    previousValue?: any;
  };

  @Prop({ enum: ['info', 'warning', 'critical'], default: 'info' })
  severity: string;

  @Prop({ type: [String], default: [] })
  channels: string[];

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Program' })
  programId?: Types.ObjectId;
}
```

### Fuzz Job Schema

```typescript
@Schema({ timestamps: true })
export class FuzzJob {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  wordlist: string;

  @Prop({ type: [String], default: [] })
  extensions: string[];

  @Prop({ type: Object })
  filters: {
    matchCodes?: number[];
    filterWords?: number;
    filterLines?: number;
    filterSize?: number;
  };

  @Prop({ enum: ['pending', 'running', 'completed', 'failed', 'cancelled'], default: 'pending' })
  status: string;

  @Prop({ type: [Object], default: [] })
  results: FuzzResult[];

  @Prop()
  startedAt: Date;

  @Prop()
  completedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Program' })
  programId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;
}
```

### AbuseIPDB Result Schema

```typescript
@Schema({ timestamps: true })
export class AbuseIPDBResult {
  @Prop({ required: true })
  ipAddress: string;

  @Prop()
  abuseConfidenceScore: number;

  @Prop()
  countryCode: string;

  @Prop()
  isp: string;

  @Prop()
  domain: string;

  @Prop()
  totalReports: number;

  @Prop()
  lastReportedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Subdomain' })
  subdomainId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Domain' })
  domainId?: Types.ObjectId;

  @Prop()
  checkedAt: Date;
}
```

### DNS Brute Job Schema

```typescript
@Schema({ timestamps: true })
export class DNSBruteJob {
  @Prop({ required: true })
  domain: string;

  @Prop({ enum: ['static', 'dynamic'], required: true })
  mode: string;

  @Prop({ type: Object })
  wordlistConfig: {
    sources: {
      bestDns: boolean;
      twoMillionSubdomains: boolean;
      crunch: boolean;
      custom?: string[];
    };
    crunchConfig?: {
      minLength: number;
      maxLength: number;
      charset: string;
    };
  };

  @Prop({ default: 200 })
  threads: number;

  @Prop({ enum: ['pending', 'preparing', 'running', 'completed', 'failed', 'cancelled'], default: 'pending' })
  status: string;

  @Prop({ default: 0 })
  progress: number;

  @Prop({ default: 0 })
  discoveredCount: number;

  @Prop({ type: [String], default: [] })
  results: string[];

  @Prop()
  startedAt: Date;

  @Prop()
  completedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Program' })
  programId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;
}
```

### Wordlist Schema

```typescript
@Schema({ timestamps: true })
export class Wordlist {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  path: string;

  @Prop()
  sourceUrl: string;

  @Prop({ default: 0 })
  lineCount: number;

  @Prop({ default: 0 })
  sizeBytes: number;

  @Prop()
  lastUpdated: Date;

  @Prop({ enum: ['assetnote', 'custom', 'generated', 'merged'] })
  source: string;

  @Prop({ default: false })
  isReady: boolean;
}
```

### Chaos Sync Schema

```typescript
@Schema({ timestamps: true })
export class ChaosSync {
  @Prop({ required: true })
  programName: string;

  @Prop()
  chaosUrl: string;

  @Prop({ default: 0 })
  subdomainsImported: number;

  @Prop({ default: 0 })
  newSubdomains: number;

  @Prop()
  syncedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Program' })
  programId?: Types.ObjectId;

  @Prop({ default: false })
  watchEnabled: boolean;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: AbuseIPDB Response Parsing
*For any* valid AbuseIPDB API response, parsing the response SHALL extract and return all required fields (abuseConfidenceScore, countryCode, isp, totalReports) with correct types.
**Validates: Requirements 1.1**

### Property 2: AbuseIPDB Result Persistence
*For any* AbuseIPDB lookup result, storing the result SHALL create a database record with correct subdomain/domain association that can be retrieved.
**Validates: Requirements 1.2**

### Property 3: Abuse Score Threshold Alerting
*For any* IP with an abuse confidence score and any configured threshold, an alert SHALL be triggered if and only if the score exceeds the threshold.
**Validates: Requirements 1.3**

### Property 4: Domain Extraction from URLs
*For any* list of URLs, extracting domains SHALL return a set of unique, valid domain names with no duplicates.
**Validates: Requirements 2.2**

### Property 5: Wayback Discovery Storage
*For any* domains or endpoints discovered from Waybackurls, storing them SHALL create records with source attribution set to "waybackurls" and correct parent domain association.
**Validates: Requirements 2.3, 2.4**

### Property 6: Nuclei Command Construction
*For any* target list and template selection, the constructed Nuclei command SHALL include all specified targets and templates with correct syntax.
**Validates: Requirements 3.1**

### Property 7: Nuclei Result Parsing
*For any* valid Nuclei JSON output, parsing SHALL extract severity, templateId, host, and matchedAt fields correctly for each finding.
**Validates: Requirements 3.2**

### Property 8: Severity-Based Alerting
*For any* vulnerability finding, an immediate alert SHALL be triggered if and only if severity equals "critical" or "high".
**Validates: Requirements 3.3**

### Property 9: Certificate SAN Extraction
*For any* certificate with Subject Alternative Names, extraction SHALL return all valid subdomains from the SAN field.
**Validates: Requirements 4.2**

### Property 10: CT Discovery Attribution
*For any* subdomain discovered via Certificate Transparency, storing it SHALL set the source field to "cert_trans".
**Validates: Requirements 4.3**

### Property 11: Live Subdomain Filtering
*For any* collection of subdomains with mixed isAlive values, filtering for live subdomains SHALL return exactly those where isAlive equals true.
**Validates: Requirements 5.2**

### Property 12: HTTPx Command Options
*For any* single domain probe request, the constructed httpx command SHALL include favicon, tech-detect, headers, redirect chain, timeout=5, and retries=3 flags.
**Validates: Requirements 6.1, 6.4**

### Property 13: HTTP Probe Result Storage
*For any* HTTP probe result, storing it SHALL persist all metadata fields (faviconHash, headers, technologies, statusCode, title) retrievably.
**Validates: Requirements 6.2**

### Property 14: HTTPx JSON Parsing
*For any* valid httpx JSON output line, parsing SHALL produce a structured HttpProbeResult with all fields correctly mapped.
**Validates: Requirements 6.3**

### Property 15: FFUF Command Construction
*For any* FuzzConfig with URL, wordlist, extensions, and filters, the constructed ffuf command SHALL include all specified parameters with correct syntax.
**Validates: Requirements 7.2**

### Property 16: Fuzz Result Storage
*For any* completed fuzzing job with results, storing SHALL associate all results with the correct target domain.
**Validates: Requirements 7.5**

### Property 17: HTTP Change Detection
*For any* pair of HTTP scan results (previous and current) for the same URL, change detection SHALL correctly identify differences in statusCode, title, technologies, and faviconHash, setting appropriate change flags.
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

### Property 18: Previous Scan Preservation
*For any* HTTP service update with new scan data, the previous scan data SHALL be preserved in the previousScan field before updating current values.
**Validates: Requirements 8.6**

### Property 19: HTTP Service Filtering
*For any* collection of HTTP services and filter criteria (statusCode, technology, isCdn, isFresh, change flags), filtering SHALL return exactly the services matching all specified criteria.
**Validates: Requirements 9.1, 9.2, 9.4**

### Property 20: Header Regex Matching
*For any* HTTP service with headers and a regex pattern, header search SHALL return the service if and only if any header value matches the pattern.
**Validates: Requirements 9.3**

### Property 21: Alert Rule Condition Evaluation
*For any* alert rule with a condition and any HTTP change event, condition evaluation SHALL return true if and only if the event matches the rule's condition type, operator, and value.
**Validates: Requirements 10.1, 10.2**

### Property 22: Multi-Channel Alert Delivery
*For any* triggered alert with configured channels, the notification service SHALL attempt delivery to all specified channels.
**Validates: Requirements 10.3**

### Property 23: Static Wordlist Merge
*For any* set of wordlist sources (bestDns, 2m-subdomains, crunch output), merging SHALL produce a deduplicated list containing entries from all sources.
**Validates: Requirements 11.1, 11.3**

### Property 24: Crunch Command Construction
*For any* crunch configuration with min/max length and charset, the constructed crunch command SHALL include correct length parameters (1-4) and alphanumeric charset.
**Validates: Requirements 11.2**

### Property 25: Domain Appending to Wordlist
*For any* wordlist entries and target domain, appending the domain SHALL produce entries where each line ends with ".{domain}" and no duplicates exist.
**Validates: Requirements 11.3**

### Property 26: ShuffleDNS Command Construction
*For any* DNS brute configuration, the constructed shuffledns command SHALL include massdns mode flag, 200 threads, resolver file, and input wordlist.
**Validates: Requirements 11.4**

### Property 27: DNS Brute Source Attribution
*For any* subdomain discovered via DNS brute forcing, storing it SHALL set the source field to "dns_brute".
**Validates: Requirements 11.5**

### Property 28: DNSGen Command Construction
*For any* list of existing subdomains and wordlist path, the constructed dnsgen command SHALL include the subdomain input and wordlist flag.
**Validates: Requirements 12.3**

### Property 29: DNSX Command Construction
*For any* list of permutations to resolve, the constructed dnsx command SHALL include silent mode and the input list.
**Validates: Requirements 12.4**

### Property 30: Dynamic Brute Source Attribution
*For any* subdomain discovered via dynamic DNS brute forcing (dnsgen), storing it SHALL set the source field to "dns_gen".
**Validates: Requirements 12.5**

### Property 31: GAU Command Construction
*For any* GAU configuration with domain and providers, the constructed gau command SHALL include the domain and all specified provider flags.
**Validates: Requirements 13.1**

### Property 32: GAU Source Attribution
*For any* subdomain discovered via GAU, storing it SHALL set the source field to "gau".
**Validates: Requirements 13.3**

### Property 33: Chaos Index Parsing
*For any* valid Chaos index JSON response, parsing SHALL extract program names, URLs, and subdomain counts correctly.
**Validates: Requirements 14.1**

### Property 34: Chaos ZIP Extraction
*For any* Chaos ZIP file for a program, extraction SHALL produce a list of subdomains matching the expected count.
**Validates: Requirements 14.2**

### Property 35: Chaos Source Attribution
*For any* subdomain imported from Chaos, storing it SHALL set the source field to "chaos".
**Validates: Requirements 14.3**

### Property 36: Chaos Sync Count Accuracy
*For any* Chaos sync operation, the reported new subdomain count SHALL equal the difference between imported count and previously existing count.
**Validates: Requirements 14.4**

### Property 37: CLI Single Target Query
*For any* program with domains and subdomains, querying single target SHALL return all associated domains and subdomains with correct counts.
**Validates: Requirements 15.1, 15.2**

### Property 38: CLI Output Format
*For any* query result and format option (json/table), the output SHALL be valid JSON when json format is specified, or properly formatted table otherwise.
**Validates: Requirements 15.4**

### Property 39: CLI HTTP Query
*For any* collection of HTTP services, querying http all SHALL return all services with url, status, title, technologies, and change indicators.
**Validates: Requirements 16.1**

### Property 40: CLI Compare Flag
*For any* HTTP services with change flags, using compare list SHALL mark services where any change flag is true.
**Validates: Requirements 16.2**

### Property 41: CLI Lives Scope Query
*For any* program with subdomains having mixed isAlive and scope values, querying lives scope SHALL return only subdomains where isAlive equals true AND inScope equals true.
**Validates: Requirements 17.1**

### Property 42: CLI Lives Compare
*For any* live subdomains with discovery timestamps, using compare list SHALL mark subdomains discovered within the comparison window as new.
**Validates: Requirements 17.2**

### Property 43: Wordlist Statistics
*For any* stored wordlist file, getting statistics SHALL return accurate line count and file size matching the actual file.
**Validates: Requirements 18.3**

### Property 44: DNS Brute Progress Calculation
*For any* DNS brute job with total wordlist size and processed count, progress percentage SHALL equal (processed / total) * 100.
**Validates: Requirements 19.1**

### Property 45: DNS Brute Job History
*For any* user with completed DNS brute jobs, querying history SHALL return all jobs with their configurations, results, and timestamps.
**Validates: Requirements 19.4**

## Error Handling

### External Tool Failures
- CLI tool execution failures (waybackurls, nuclei, ffuf, httpx, shuffledns, dnsgen, dnsx, gau) SHALL be caught and logged with appropriate error messages
- Timeout errors SHALL trigger retry logic up to the configured retry count
- Tool not found errors SHALL return a clear error message indicating the missing dependency
- massdns binary not found SHALL return specific installation instructions

### API Failures
- AbuseIPDB API rate limiting SHALL be handled with exponential backoff
- Certificate Transparency API failures SHALL be logged and the operation retried
- Chaos API failures SHALL be logged and cached data used if available
- Network timeouts SHALL not crash the service; partial results SHALL be returned where possible

### Data Validation
- Invalid IP addresses SHALL be rejected before AbuseIPDB lookup
- Malformed URLs SHALL be rejected before fuzzing
- Invalid regex patterns in header search SHALL return a validation error
- Invalid domain names SHALL be rejected before DNS brute forcing

### Change Detection Edge Cases
- First scan of a service (no previous data) SHALL not trigger change alerts
- Services with null/undefined fields SHALL be handled gracefully in comparisons
- Empty technology arrays SHALL be treated as "no technologies detected"

### DNS Brute Specific Errors
- Wordlist download failures SHALL be retried with exponential backoff
- Crunch generation failures (disk space, memory) SHALL be caught and reported
- ShuffleDNS resolver failures SHALL fall back to default resolvers
- Large wordlist operations SHALL use streaming to avoid memory exhaustion

### CLI Error Handling
- Invalid program names SHALL return "program not found" error
- Invalid filter parameters SHALL return validation error with usage hints
- Network connectivity issues SHALL return appropriate error messages
- Empty result sets SHALL return informative "no results" message rather than error

## Testing Strategy

### Unit Testing
Unit tests will cover:
- Individual service method logic
- Data transformation and parsing functions
- Validation logic for inputs
- Error handling paths
- CLI command parsing and output formatting

### Property-Based Testing
Property-based tests will use **fast-check** library for TypeScript to verify:
- All 45 correctness properties defined above
- Each property test SHALL run a minimum of 100 iterations
- Each property test SHALL be tagged with format: `**Feature: advanced-recon-monitoring, Property {number}: {property_text}**`

### Test Organization
- Property tests SHALL be co-located with the service they test using `.property.spec.ts` suffix
- Unit tests SHALL use `.spec.ts` suffix
- Integration tests SHALL use `.integration.spec.ts` suffix

### Generators
Custom generators will be created for:
- Valid IP addresses (IPv4 and IPv6)
- Valid URLs with various schemes and paths
- HTTP probe results with realistic field values
- Nuclei JSON output format
- HTTPx JSON output format
- Alert rules with various condition types
- FuzzConfig objects with valid parameters
- Valid domain names and subdomains
- Wordlist entries (alphanumeric strings)
- DNS brute job configurations
- GAU configuration objects
- Chaos index JSON responses
- CLI query options and filter parameters
- Program objects with domains and subdomains
- Scope configurations (in-scope/out-of-scope lists)
