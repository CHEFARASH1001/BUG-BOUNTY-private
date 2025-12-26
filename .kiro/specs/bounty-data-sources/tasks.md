# Implementation Plan: Bounty Data Sources Integration

## Overview

This implementation adds ProjectDiscovery Chaos and bounty-targets-data as new data sources for the platform sync system. The implementation follows the existing patterns established by HackerOneService and BugcrowdService, extending PlatformSyncService with new sync methods.

## Tasks

- [x] 1. Create ChaosService for ProjectDiscovery Chaos API
  - [x] 1.1 Create chaos.service.ts with ChaosService class
    - Define ChaosIndexEntry and ChaosProgram interfaces
    - Implement fetchProgramIndex() to fetch from chaos-data.projectdiscovery.io/index.json
    - Implement normalizeHandle() for consistent handle generation
    - Implement transformToProgram() for data transformation
    - Implement getPrograms() as the main public method
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Write property test for handle normalization
    - **Property 1: Handle Normalization Consistency**
    - **Validates: Requirements 1.4**

  - [x] 1.3 Write property test for data transformation
    - **Property 2: Data Transformation Preserves Source Information** (Chaos portion)
    - **Validates: Requirements 1.2**

- [x] 2. Create BountyTargetsService for bounty-targets-data
  - [x] 2.1 Create bounty-targets.service.ts with BountyTargetsService class
    - Define BountyTargetsProgram and BountyTargetsScope interfaces
    - Implement fetchPlatformData() to fetch individual platform JSON files
    - Implement transformHackerOneData() for HackerOne format
    - Implement transformBugcrowdData() for Bugcrowd format
    - Implement transformIntigritiData() for Intigriti format
    - Implement transformYesWeHackData() for YesWeHack format
    - Implement transformFederacyData() for Federacy format
    - Implement getAllPrograms() to aggregate all platforms
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 2.2 Write property test for scope extraction
    - **Property 2: Data Transformation Preserves Source Information** (bounty-targets portion)
    - **Validates: Requirements 2.7**

- [x] 3. Checkpoint - Verify services compile and basic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend PlatformSyncService with new sync methods
  - [x] 4.1 Add syncChaos() method to PlatformSyncService
    - Inject ChaosService dependency
    - Implement upsertChaosProgram() for program creation/update
    - Track new/updated counts in SyncResult
    - Use existing withRetry() for rate limit handling
    - _Requirements: 1.6, 4.1, 6.1, 6.2_

  - [x] 4.2 Add syncBountyTargets() method to PlatformSyncService
    - Inject BountyTargetsService dependency
    - Implement upsertBountyTargetsProgram() for program creation/update
    - Implement syncBountyTargetsScopes() for scope sync
    - Skip programs already synced from direct APIs (deduplication)
    - _Requirements: 4.2, 7.1, 7.2, 7.3, 7.4_

  - [x] 4.3 Update syncAllPlatforms() to include new sources
    - Add syncChaos() call after existing syncs
    - Add syncBountyTargets() call last (for deduplication)
    - Aggregate results from all sources
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 4.4 Write property test for domain extraction
    - **Property 3: Domain Extraction from Targets**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 4.5 Write property test for error isolation
    - **Property 4: Error Isolation Continues Processing**
    - **Validates: Requirements 6.2, 6.4**

  - [x] 4.6 Write property test for upsert behavior
    - **Property 5: Upsert Preserves Uniqueness and Timestamps**
    - **Validates: Requirements 7.1, 7.3, 7.4**

- [x] 5. Checkpoint - Verify sync methods work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add API endpoints to PlatformsController
  - [x] 6.1 Add sync endpoints for new data sources
    - POST /platforms/sync/chaos endpoint
    - POST /platforms/sync/bounty-targets endpoint
    - Apply JwtAuthGuard to both endpoints
    - _Requirements: 5.1, 5.2, 5.5_

  - [x] 6.2 Add live data fetch endpoints
    - GET /platforms/chaos/programs endpoint
    - GET /platforms/bounty-targets/programs endpoint
    - _Requirements: 5.3, 5.4_

- [x] 7. Update PlatformsModule with new providers
  - [x] 7.1 Register new services in PlatformsModule
    - Add ChaosService to providers array
    - Add BountyTargetsService to providers array
    - Add to exports if needed by other modules
    - _Requirements: 4.1, 4.2_

- [x] 8. Add scheduled sync support
  - [x] 8.1 Update scheduledSync() to include new sources
    - Chaos sync included in 6-hour schedule
    - Bounty-targets sync included in 6-hour schedule
    - Log start/completion of each source
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 9. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Write remaining property tests
  - [x] 10.1 Write property test for sync result accuracy
    - **Property 6: Sync Result Accuracy**
    - **Validates: Requirements 4.5, 6.3**

  - [x] 10.2 Write property test for backoff calculation
    - **Property 7: Exponential Backoff Delay Calculation**
    - **Validates: Requirements 6.1**

  - [x] 10.3 Write property test for API error handling
    - **Property 8: API Error Returns Empty Result**
    - **Validates: Requirements 1.5, 2.8**

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows existing patterns from HackerOneService and BugcrowdService
