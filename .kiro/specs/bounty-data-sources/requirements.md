# Requirements Document

## Introduction

This feature extends the platform sync system to integrate additional bug bounty program data sources: ProjectDiscovery Chaos API and the bounty-targets-data GitHub repository. These sources provide comprehensive, fast, and regularly updated bug bounty program information including scope data, making them valuable additions to the existing HackerOne and Bugcrowd sync capabilities.

ProjectDiscovery Chaos provides subdomain data for bug bounty programs, while bounty-targets-data aggregates program information from multiple platforms (HackerOne, Bugcrowd, Intigriti, Federacy, YesWeHack) into a single, easily consumable format.

## Glossary

- **Chaos_Service**: The service responsible for fetching and processing data from ProjectDiscovery Chaos API
- **Bounty_Targets_Service**: The service responsible for fetching and processing data from the bounty-targets-data GitHub repository
- **Platform_Sync_Service**: The existing orchestration service that coordinates sync operations across all platform data sources
- **Program**: A bug bounty program entity stored in the database
- **Scope**: An in-scope or out-of-scope target asset belonging to a program
- **Domain**: A domain entity extracted from scope targets for reconnaissance
- **Sync_Result**: The result object containing statistics from a sync operation

## Requirements

### Requirement 1: Chaos API Integration

**User Story:** As a bug bounty hunter, I want to sync program data from ProjectDiscovery Chaos, so that I can access comprehensive subdomain data for bug bounty programs.

#### Acceptance Criteria

1. THE Chaos_Service SHALL fetch the program index from the Chaos API endpoint `https://chaos-data.projectdiscovery.io/index.json`
2. WHEN fetching program data, THE Chaos_Service SHALL extract program name, URL, bounty status, and subdomain count for each program
3. WHEN a program has subdomain data available, THE Chaos_Service SHALL store the subdomain download URL for later retrieval
4. THE Chaos_Service SHALL normalize program names to create consistent handles (lowercase, hyphenated)
5. IF the Chaos API returns an error, THEN THE Chaos_Service SHALL log the error and return an empty result without crashing
6. WHEN syncing Chaos data, THE Platform_Sync_Service SHALL create new programs or update existing programs with matching handles

### Requirement 2: Bounty Targets Data Integration

**User Story:** As a bug bounty hunter, I want to sync program data from bounty-targets-data, so that I can access aggregated scope information from multiple bug bounty platforms.

#### Acceptance Criteria

1. THE Bounty_Targets_Service SHALL fetch program data from the raw GitHub URL `https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/main/data/`
2. WHEN fetching HackerOne data, THE Bounty_Targets_Service SHALL parse the `hackerone_data.json` file
3. WHEN fetching Bugcrowd data, THE Bounty_Targets_Service SHALL parse the `bugcrowd_data.json` file
4. WHEN fetching Intigriti data, THE Bounty_Targets_Service SHALL parse the `intigriti_data.json` file
5. WHEN fetching YesWeHack data, THE Bounty_Targets_Service SHALL parse the `yeswehack_data.json` file
6. WHEN fetching Federacy data, THE Bounty_Targets_Service SHALL parse the `federacy_data.json` file
7. FOR ALL programs from bounty-targets-data, THE Bounty_Targets_Service SHALL extract in-scope and out-of-scope targets
8. IF a data file fetch fails, THEN THE Bounty_Targets_Service SHALL log the error and continue with remaining files

### Requirement 3: Scope Extraction and Domain Creation

**User Story:** As a bug bounty hunter, I want scope targets automatically extracted and stored as domains, so that I can run reconnaissance on them.

#### Acceptance Criteria

1. WHEN processing scope targets, THE Platform_Sync_Service SHALL identify domain-type targets (URLs, wildcards)
2. WHEN a wildcard target is found (e.g., `*.example.com`), THE Platform_Sync_Service SHALL extract the base domain
3. WHEN a URL target is found, THE Platform_Sync_Service SHALL extract the domain portion
4. THE Platform_Sync_Service SHALL create Domain entities for all extracted domains linked to their parent program
5. WHEN a domain already exists, THE Platform_Sync_Service SHALL update the lastSeen timestamp
6. THE Platform_Sync_Service SHALL distinguish between in-scope and out-of-scope targets using the Scope status field

### Requirement 4: Sync Orchestration

**User Story:** As a system administrator, I want to trigger syncs for individual data sources or all sources at once, so that I can control data freshness.

#### Acceptance Criteria

1. THE Platform_Sync_Service SHALL provide a method to sync only Chaos data
2. THE Platform_Sync_Service SHALL provide a method to sync only bounty-targets-data
3. THE Platform_Sync_Service SHALL include Chaos and bounty-targets-data in the syncAllPlatforms operation
4. WHEN syncing all platforms, THE Platform_Sync_Service SHALL execute syncs sequentially to avoid rate limiting
5. THE Platform_Sync_Service SHALL return a Sync_Result for each data source with counts of new/updated programs and scopes

### Requirement 5: API Endpoints

**User Story:** As a frontend developer, I want API endpoints to trigger and monitor data source syncs, so that I can build sync management UI.

#### Acceptance Criteria

1. THE Platforms_Controller SHALL expose a POST endpoint `/platforms/sync/chaos` to trigger Chaos sync
2. THE Platforms_Controller SHALL expose a POST endpoint `/platforms/sync/bounty-targets` to trigger bounty-targets-data sync
3. THE Platforms_Controller SHALL expose a GET endpoint `/platforms/chaos/programs` to fetch live Chaos program data
4. THE Platforms_Controller SHALL expose a GET endpoint `/platforms/bounty-targets/programs` to fetch live bounty-targets program data
5. WHEN an endpoint is called, THE Platforms_Controller SHALL require JWT authentication

### Requirement 6: Error Handling and Resilience

**User Story:** As a system administrator, I want robust error handling during syncs, so that partial failures don't prevent other programs from syncing.

#### Acceptance Criteria

1. WHEN a rate limit (429) response is received, THE service SHALL retry with exponential backoff (1s, 2s, 4s, 8s delays)
2. WHEN processing individual programs, THE service SHALL catch errors per program and continue with remaining programs
3. THE service SHALL track success and failure counts in the Sync_Result
4. WHEN all retries are exhausted, THE service SHALL log the final error and continue with remaining operations
5. THE service SHALL log sync duration and summary statistics upon completion

### Requirement 7: Data Deduplication

**User Story:** As a bug bounty hunter, I want programs from different sources to be deduplicated, so that I don't see duplicate entries.

#### Acceptance Criteria

1. WHEN a program exists with the same platform and handle, THE Platform_Sync_Service SHALL update the existing record
2. WHEN bounty-targets-data provides data for a platform already synced directly (HackerOne, Bugcrowd), THE Platform_Sync_Service SHALL prefer the direct API data
3. THE Platform_Sync_Service SHALL use platform + handle as the unique identifier for deduplication
4. WHEN updating an existing program, THE Platform_Sync_Service SHALL preserve the firstSyncedAt timestamp

### Requirement 8: Scheduled Sync Support

**User Story:** As a system administrator, I want new data sources included in scheduled syncs, so that data stays fresh automatically.

#### Acceptance Criteria

1. WHEN the scheduled sync runs (every 6 hours), THE Platform_Sync_Service SHALL include Chaos sync
2. WHEN the scheduled sync runs, THE Platform_Sync_Service SHALL include bounty-targets-data sync
3. THE Platform_Sync_Service SHALL log the start and completion of each data source sync
4. IF a data source sync fails, THEN THE Platform_Sync_Service SHALL continue with remaining data sources
