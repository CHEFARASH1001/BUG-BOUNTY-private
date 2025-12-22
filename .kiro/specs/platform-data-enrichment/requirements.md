# Requirements Document

## Introduction

This feature addresses the issue where all bug bounty programs from HackerOne and Bugcrowd receive identical scores due to insufficient data collection during platform synchronization. The current system only captures basic program metadata (name, handle, URL, state) but lacks the rich data needed for meaningful score differentiation. This enhancement will collect comprehensive program data from both platforms and use that data to calculate accurate, differentiated scores for each program.

## Glossary

- **Program**: A bug bounty program hosted on a platform (HackerOne or Bugcrowd)
- **Platform Sync Service**: The service responsible for fetching and storing program data from external platforms
- **Scores Service**: The service that calculates priority scores for programs based on available data
- **Bounty Table**: The reward structure defining payouts for different vulnerability severities
- **Scope**: The assets (domains, APIs, mobile apps) that are in-scope for a bug bounty program
- **Response Metrics**: Statistics about how quickly a program responds to and resolves vulnerability reports
- **HackerOne GraphQL API**: The public GraphQL endpoint for fetching HackerOne program data
- **Bugcrowd Public API**: The public endpoint for fetching Bugcrowd program data

## Requirements

### Requirement 1

**User Story:** As a bug bounty hunter, I want to see accurate bounty reward information for each program, so that I can prioritize programs with higher payouts.

#### Acceptance Criteria

1. WHEN the system syncs HackerOne programs THEN the Platform Sync Service SHALL extract and store the minimum bounty amount for critical vulnerabilities
2. WHEN the system syncs HackerOne programs THEN the Platform Sync Service SHALL extract and store the maximum bounty amount for critical vulnerabilities
3. WHEN the system syncs Bugcrowd programs THEN the Platform Sync Service SHALL extract and store the minimum and maximum reward amounts
4. WHEN bounty data is unavailable from the API THEN the Platform Sync Service SHALL store null values rather than defaulting to zero
5. WHEN calculating program quality score THEN the Scores Service SHALL use the actual bounty values to differentiate programs

### Requirement 2

**User Story:** As a bug bounty hunter, I want to see program response metrics, so that I can choose programs that respond quickly to submissions.

#### Acceptance Criteria

1. WHEN the system syncs HackerOne programs THEN the Platform Sync Service SHALL extract and store the average time to first response in days
2. WHEN the system syncs HackerOne programs THEN the Platform Sync Service SHALL extract and store the average time to bounty payment in days
3. WHEN the system syncs HackerOne programs THEN the Platform Sync Service SHALL extract and store the average time to resolution in days
4. WHEN response metrics are unavailable THEN the Platform Sync Service SHALL store null values
5. WHEN calculating program quality score THEN the Scores Service SHALL factor in response time metrics to differentiate responsive programs

### Requirement 3

**User Story:** As a bug bounty hunter, I want to see program activity and reputation data, so that I can identify active and reputable programs.

#### Acceptance Criteria

1. WHEN the system syncs HackerOne programs THEN the Platform Sync Service SHALL extract and store the total number of resolved reports
2. WHEN the system syncs HackerOne programs THEN the Platform Sync Service SHALL extract and store the total bounties paid amount
3. WHEN the system syncs HackerOne programs THEN the Platform Sync Service SHALL extract and store the number of hackers thanked
4. WHEN the system syncs programs THEN the Platform Sync Service SHALL extract and store the program launch date
5. WHEN calculating historical score THEN the Scores Service SHALL use resolved reports count and bounties paid to assess program activity

### Requirement 4

**User Story:** As a bug bounty hunter, I want accurate scope information with asset counts, so that I can estimate the attack surface of each program.

#### Acceptance Criteria

1. WHEN the system syncs programs THEN the Platform Sync Service SHALL count and store the number of in-scope assets by type (domain, wildcard, API, mobile app)
2. WHEN the system syncs programs THEN the Platform Sync Service SHALL identify and flag wildcard scope entries
3. WHEN the system syncs programs THEN the Platform Sync Service SHALL store the total count of bounty-eligible assets
4. WHEN calculating attack surface score THEN the Scores Service SHALL use scope asset counts to estimate attack surface size
5. WHEN calculating program quality score THEN the Scores Service SHALL give higher scores to programs with wildcard scopes

### Requirement 5

**User Story:** As a bug bounty hunter, I want the scoring algorithm to produce differentiated scores based on actual program data, so that I can effectively prioritize my targets.

#### Acceptance Criteria

1. WHEN calculating scores for programs with bounty data THEN the Scores Service SHALL produce different scores based on bounty amounts
2. WHEN calculating scores for programs with response metrics THEN the Scores Service SHALL produce higher scores for faster-responding programs
3. WHEN calculating scores for programs with scope data THEN the Scores Service SHALL produce higher scores for programs with larger attack surfaces
4. WHEN a program lacks certain data THEN the Scores Service SHALL calculate a confidence score reflecting data completeness
5. WHEN displaying scores THEN the system SHALL show the confidence level alongside the score

### Requirement 6

**User Story:** As a system administrator, I want the sync process to handle API rate limits and errors gracefully, so that data collection remains reliable.

#### Acceptance Criteria

1. WHEN the HackerOne API returns rate limit errors THEN the Platform Sync Service SHALL implement exponential backoff and retry
2. WHEN the Bugcrowd API returns errors THEN the Platform Sync Service SHALL log the error and continue with remaining programs
3. WHEN partial data is returned from an API THEN the Platform Sync Service SHALL store available data and mark missing fields as null
4. WHEN sync completes THEN the Platform Sync Service SHALL log a summary of successful syncs, failures, and data completeness

