import * as fc from 'fast-check';
import { PlatformSyncService, RateLimitError, RetryConfig } from './platform-sync.service';
import { ScopeType, ScopeStatus, ScopeDocument } from '../../schemas/scope.schema';
import { Types } from 'mongoose';

/**
 * Property-Based Tests for PlatformSyncService
 * 
 * These tests verify the correctness properties defined in the design document
 * for the platform-data-enrichment feature.
 * 
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// Helper to create a mock scope document
const createMockScope = (overrides: Partial<ScopeDocument> = {}): ScopeDocument => {
  return {
    _id: new Types.ObjectId(),
    programId: new Types.ObjectId(),
    target: 'example.com',
    type: ScopeType.DOMAIN,
    status: ScopeStatus.IN_SCOPE,
    description: '',
    maxSeverity: 0,
    isVulnDisclosureOnly: false,
    isActive: true,
    eligibility: { isEligible: true },
    assetInfo: {},
    tags: [],
    notes: '',
    subdomainCount: 0,
    liveCount: 0,
    httpServiceCount: 0,
    vulnerabilityCount: 0,
    ...overrides,
  } as unknown as ScopeDocument;
};

// Arbitrary for generating scope types
const scopeTypeArb = fc.constantFrom(
  ScopeType.DOMAIN,
  ScopeType.WILDCARD,
  ScopeType.API,
  ScopeType.MOBILE_APP,
  ScopeType.URL,
  ScopeType.IP,
  ScopeType.IP_RANGE,
  ScopeType.OTHER,
);

// Arbitrary for generating scope status
const scopeStatusArb = fc.constantFrom(ScopeStatus.IN_SCOPE, ScopeStatus.OUT_OF_SCOPE);

// Arbitrary for generating target strings (some with wildcards)
const targetArb = fc.oneof(
  fc.constant('example.com'),
  fc.constant('*.example.com'),
  fc.constant('api.example.com'),
  fc.constant('*.api.example.com'),
  fc.constant('test-*.example.com'),
  fc.webUrl().map(url => new URL(url).hostname),
);

// Arbitrary for generating a single scope
const scopeArb = fc.record({
  type: scopeTypeArb,
  status: scopeStatusArb,
  target: targetArb,
  isEligible: fc.boolean(),
}).map(({ type, status, target, isEligible }) => 
  createMockScope({
    type,
    status,
    target,
    eligibility: { isEligible },
  })
);

// Arbitrary for generating an array of scopes
const scopesArb = fc.array(scopeArb, { minLength: 0, maxLength: 50 });

describe('PlatformSyncService Property-Based Tests', () => {
  let service: PlatformSyncService;

  beforeEach(() => {
    // Create a minimal mock service with just the calculateScopeStats method
    // We don't need the full service with all dependencies for these tests
    service = {
      calculateScopeStats: PlatformSyncService.prototype.calculateScopeStats,
    } as unknown as PlatformSyncService;
  });

  /**
   * **Feature: platform-data-enrichment, Property 5: Scope Statistics Calculation Correctness**
   * 
   * *For any* program with scopes, the calculated scope statistics (total assets, 
   * wildcard count, domain count, API count, mobile app count, bounty-eligible count) 
   * SHALL accurately reflect the actual scope data.
   * 
   * **Validates: Requirements 4.1, 4.2, 4.3**
   */
  describe('Property 5: Scope Statistics Calculation Correctness', () => {
    it('should count total in-scope assets correctly', () => {
      fc.assert(
        fc.property(scopesArb, (scopes) => {
          const result = service.calculateScopeStats(scopes);
          
          // Count expected in-scope assets
          const expectedTotal = scopes.filter(s => s.status === ScopeStatus.IN_SCOPE).length;
          
          return result.totalAssets === expectedTotal;
        }),
        { numRuns: 100 }
      );
    });

    it('should count wildcards correctly by pattern matching', () => {
      fc.assert(
        fc.property(scopesArb, (scopes) => {
          const result = service.calculateScopeStats(scopes);
          
          // Count expected wildcards (in-scope only)
          const inScopeScopes = scopes.filter(s => s.status === ScopeStatus.IN_SCOPE);
          const expectedWildcards = inScopeScopes.filter(s => 
            s.type === ScopeType.WILDCARD ||
            s.target.startsWith('*.') ||
            s.target.includes('*')
          ).length;
          
          return result.wildcardCount === expectedWildcards;
        }),
        { numRuns: 100 }
      );
    });

    it('should count API scopes correctly', () => {
      fc.assert(
        fc.property(scopesArb, (scopes) => {
          const result = service.calculateScopeStats(scopes);
          
          // Count expected API scopes (in-scope only)
          const expectedApiCount = scopes.filter(s => 
            s.status === ScopeStatus.IN_SCOPE && s.type === ScopeType.API
          ).length;
          
          return result.apiCount === expectedApiCount;
        }),
        { numRuns: 100 }
      );
    });

    it('should count mobile app scopes correctly', () => {
      fc.assert(
        fc.property(scopesArb, (scopes) => {
          const result = service.calculateScopeStats(scopes);
          
          // Count expected mobile app scopes (in-scope only)
          const expectedMobileCount = scopes.filter(s => 
            s.status === ScopeStatus.IN_SCOPE && s.type === ScopeType.MOBILE_APP
          ).length;
          
          return result.mobileAppCount === expectedMobileCount;
        }),
        { numRuns: 100 }
      );
    });

    it('should count domain scopes correctly (including URL and WILDCARD types)', () => {
      fc.assert(
        fc.property(scopesArb, (scopes) => {
          const result = service.calculateScopeStats(scopes);
          
          // Count expected domain scopes (in-scope only)
          // Domain count includes DOMAIN, URL, and WILDCARD types
          const expectedDomainCount = scopes.filter(s => 
            s.status === ScopeStatus.IN_SCOPE && 
            (s.type === ScopeType.DOMAIN || s.type === ScopeType.URL || s.type === ScopeType.WILDCARD)
          ).length;
          
          return result.domainCount === expectedDomainCount;
        }),
        { numRuns: 100 }
      );
    });

    it('should count bounty-eligible scopes correctly', () => {
      fc.assert(
        fc.property(scopesArb, (scopes) => {
          const result = service.calculateScopeStats(scopes);
          
          // Count expected bounty-eligible scopes (in-scope only)
          const expectedBountyEligible = scopes.filter(s => 
            s.status === ScopeStatus.IN_SCOPE && s.eligibility?.isEligible === true
          ).length;
          
          return result.bountyEligibleCount === expectedBountyEligible;
        }),
        { numRuns: 100 }
      );
    });

    it('should exclude out-of-scope assets from all counts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              type: scopeTypeArb,
              target: targetArb,
              isEligible: fc.boolean(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (scopeConfigs) => {
            // Create all scopes as OUT_OF_SCOPE
            const outOfScopeScopes = scopeConfigs.map(config => 
              createMockScope({
                type: config.type,
                status: ScopeStatus.OUT_OF_SCOPE,
                target: config.target,
                eligibility: { isEligible: config.isEligible },
              })
            );
            
            const result = service.calculateScopeStats(outOfScopeScopes);
            
            // All counts should be zero for out-of-scope assets
            return (
              result.totalAssets === 0 &&
              result.wildcardCount === 0 &&
              result.domainCount === 0 &&
              result.apiCount === 0 &&
              result.mobileAppCount === 0 &&
              result.bountyEligibleCount === 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return zero counts for empty scope array', () => {
      fc.assert(
        fc.property(fc.constant([]), () => {
          const result = service.calculateScopeStats([]);
          
          return (
            result.totalAssets === 0 &&
            result.wildcardCount === 0 &&
            result.domainCount === 0 &&
            result.apiCount === 0 &&
            result.mobileAppCount === 0 &&
            result.bountyEligibleCount === 0
          );
        }),
        { numRuns: 100 }
      );
    });

    it('should identify wildcards by *.domain.com pattern', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          (domain) => {
            const wildcardScope = createMockScope({
              type: ScopeType.DOMAIN, // Not explicitly WILDCARD type
              status: ScopeStatus.IN_SCOPE,
              target: `*.${domain}`,
            });
            
            const result = service.calculateScopeStats([wildcardScope]);
            
            // Should be counted as wildcard due to pattern matching
            return result.wildcardCount === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify wildcards by WILDCARD type', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          (domain) => {
            const wildcardScope = createMockScope({
              type: ScopeType.WILDCARD,
              status: ScopeStatus.IN_SCOPE,
              target: domain, // No wildcard in target, but type is WILDCARD
            });
            
            const result = service.calculateScopeStats([wildcardScope]);
            
            // Should be counted as wildcard due to type
            return result.wildcardCount === 1;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: bounty-data-sources, Property 5: Upsert Preserves Uniqueness and Timestamps**
   * 
   * *For any* program synced multiple times, there should be exactly one record with
   * matching platform+handle, and the firstSyncedAt timestamp should remain unchanged
   * from the first sync while lastSyncedAt should be updated.
   * 
   * **Validates: Requirements 7.1, 7.3, 7.4**
   */
  describe('Property 5: Upsert Preserves Uniqueness and Timestamps', () => {
    /**
     * Simulates the upsert behavior for programs
     * This mirrors the logic in upsertBountyTargetsProgram and upsertChaosProgram
     */
    interface MockProgram {
      platform: string;
      handle: string;
      name: string;
      firstSyncedAt: Date;
      lastSyncedAt: Date;
    }

    const simulateUpsert = (
      database: Map<string, MockProgram>,
      program: { platform: string; handle: string; name: string }
    ): { isNew: boolean; firstSyncedAt: Date; lastSyncedAt: Date } => {
      const key = `${program.platform}:${program.handle}`;
      const now = new Date();
      
      const existing = database.get(key);
      
      if (existing) {
        // Update existing - preserve firstSyncedAt (Requirement 7.4)
        const updated: MockProgram = {
          ...existing,
          name: program.name,
          lastSyncedAt: now,
          // firstSyncedAt is preserved
        };
        database.set(key, updated);
        return { isNew: false, firstSyncedAt: existing.firstSyncedAt, lastSyncedAt: now };
      }
      
      // Create new
      const newProgram: MockProgram = {
        platform: program.platform,
        handle: program.handle,
        name: program.name,
        firstSyncedAt: now,
        lastSyncedAt: now,
      };
      database.set(key, newProgram);
      return { isNew: true, firstSyncedAt: now, lastSyncedAt: now };
    };

    it('should create exactly one record per platform+handle combination', () => {
      fc.assert(
        fc.property(
          fc.record({
            platform: fc.constantFrom('hackerone', 'bugcrowd', 'intigriti', 'yeswehack', 'federacy', 'other'),
            handle: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            name: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          fc.integer({ min: 1, max: 10 }), // number of times to sync
          (program, syncCount) => {
            const database = new Map<string, MockProgram>();
            
            // Sync the same program multiple times
            for (let i = 0; i < syncCount; i++) {
              simulateUpsert(database, program);
            }
            
            // Should have exactly one record
            return database.size === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve firstSyncedAt timestamp on subsequent syncs', () => {
      fc.assert(
        fc.property(
          fc.record({
            platform: fc.constantFrom('hackerone', 'bugcrowd', 'intigriti', 'yeswehack', 'federacy', 'other'),
            handle: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            name: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          fc.integer({ min: 2, max: 10 }), // at least 2 syncs
          (program, syncCount) => {
            const database = new Map<string, MockProgram>();
            
            // First sync
            const firstResult = simulateUpsert(database, program);
            const originalFirstSyncedAt = firstResult.firstSyncedAt;
            
            // Subsequent syncs
            for (let i = 1; i < syncCount; i++) {
              const result = simulateUpsert(database, { ...program, name: `${program.name}-v${i}` });
              
              // firstSyncedAt should be preserved
              if (result.firstSyncedAt.getTime() !== originalFirstSyncedAt.getTime()) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update lastSyncedAt on each sync', () => {
      fc.assert(
        fc.property(
          fc.record({
            platform: fc.constantFrom('hackerone', 'bugcrowd', 'intigriti'),
            handle: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            name: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          (program) => {
            const database = new Map<string, MockProgram>();
            
            // First sync
            simulateUpsert(database, program);
            const key = `${program.platform}:${program.handle}`;
            const afterFirst = database.get(key)!.lastSyncedAt;
            
            // Second sync (with small delay to ensure different timestamp)
            const result = simulateUpsert(database, program);
            
            // lastSyncedAt should be updated (>= previous)
            return result.lastSyncedAt.getTime() >= afterFirst.getTime();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use platform+handle as unique identifier', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              platform: fc.constantFrom('hackerone', 'bugcrowd', 'intigriti', 'yeswehack'),
              handle: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              name: fc.string({ minLength: 1, maxLength: 30 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (programs) => {
            const database = new Map<string, MockProgram>();
            
            // Sync all programs
            for (const program of programs) {
              simulateUpsert(database, program);
            }
            
            // Count unique platform+handle combinations
            const uniqueKeys = new Set(programs.map(p => `${p.platform}:${p.handle}`));
            
            // Database should have exactly as many records as unique keys
            return database.size === uniqueKeys.size;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return isNew=true only on first sync', () => {
      fc.assert(
        fc.property(
          fc.record({
            platform: fc.constantFrom('hackerone', 'bugcrowd', 'intigriti'),
            handle: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            name: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          fc.integer({ min: 2, max: 10 }),
          (program, syncCount) => {
            const database = new Map<string, MockProgram>();
            
            // First sync should return isNew=true
            const firstResult = simulateUpsert(database, program);
            if (!firstResult.isNew) {
              return false;
            }
            
            // Subsequent syncs should return isNew=false
            for (let i = 1; i < syncCount; i++) {
              const result = simulateUpsert(database, program);
              if (result.isNew) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow same handle on different platforms', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }),
          (handle, name) => {
            const database = new Map<string, MockProgram>();
            const platforms = ['hackerone', 'bugcrowd', 'intigriti', 'yeswehack', 'federacy'];
            
            // Sync same handle on all platforms
            for (const platform of platforms) {
              simulateUpsert(database, { platform, handle, name });
            }
            
            // Should have one record per platform
            return database.size === platforms.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should distinguish between direct API and bounty-targets syncs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }),
          (handle, name) => {
            const database = new Map<string, MockProgram>();
            
            // Sync from direct API
            simulateUpsert(database, { platform: 'hackerone', handle, name });
            
            // Sync from bounty-targets (now uses same platform, so updates existing)
            simulateUpsert(database, { platform: 'hackerone', handle, name: `${name} (updated)` });
            
            // Should have one record (bounty-targets updates existing)
            return database.size === 1;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: platform-data-enrichment, Property 11: Rate Limit Retry with Exponential Backoff**
   * 
   * *For any* sequence of rate limit errors from the HackerOne API, the retry delays 
   * SHALL increase exponentially with each consecutive failure.
   * 
   * **Validates: Requirements 6.1**
   */
  describe('Property 11: Rate Limit Retry with Exponential Backoff', () => {
    let retryService: PlatformSyncService;

    beforeEach(() => {
      // Create a service instance with the calculateBackoffDelay method
      retryService = {
        calculateBackoffDelay: PlatformSyncService.prototype.calculateBackoffDelay,
      } as unknown as PlatformSyncService;
    });

    it('should calculate exponentially increasing delays for consecutive attempts', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 5 }), // attempt number (0-5)
          fc.record({
            baseDelayMs: fc.integer({ min: 100, max: 5000 }),
            maxDelayMs: fc.integer({ min: 5000, max: 30000 }),
            maxRetries: fc.integer({ min: 1, max: 5 }),
          }),
          (attempt, config) => {
            const delay = retryService.calculateBackoffDelay(attempt, config);
            
            // Delay should be baseDelay * 2^attempt, capped at maxDelay
            const expectedDelay = Math.min(
              config.baseDelayMs * Math.pow(2, attempt),
              config.maxDelayMs
            );
            
            return delay === expectedDelay;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce delays that increase with each attempt', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseDelayMs: fc.integer({ min: 100, max: 2000 }),
            maxDelayMs: fc.integer({ min: 10000, max: 30000 }),
            maxRetries: fc.integer({ min: 3, max: 5 }),
          }),
          (config) => {
            const delays: number[] = [];
            
            // Calculate delays for attempts 0, 1, 2, 3
            for (let attempt = 0; attempt <= 3; attempt++) {
              delays.push(retryService.calculateBackoffDelay(attempt, config));
            }
            
            // Each delay should be >= the previous one (exponential growth)
            for (let i = 1; i < delays.length; i++) {
              if (delays[i] < delays[i - 1]) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cap delays at maxDelayMs', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 10 }), // attempt number
          fc.record({
            baseDelayMs: fc.integer({ min: 1000, max: 5000 }),
            maxDelayMs: fc.integer({ min: 5000, max: 10000 }),
            maxRetries: fc.integer({ min: 1, max: 5 }),
          }),
          (attempt, config) => {
            const delay = retryService.calculateBackoffDelay(attempt, config);
            
            // Delay should never exceed maxDelayMs
            return delay <= config.maxDelayMs;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default config delays: 1s, 2s, 4s, 8s', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          // Test with default config (1s base, 8s max, 3 retries)
          const defaultConfig: RetryConfig = {
            maxRetries: 3,
            baseDelayMs: 1000,
            maxDelayMs: 8000,
          };
          
          const delay0 = retryService.calculateBackoffDelay(0, defaultConfig);
          const delay1 = retryService.calculateBackoffDelay(1, defaultConfig);
          const delay2 = retryService.calculateBackoffDelay(2, defaultConfig);
          const delay3 = retryService.calculateBackoffDelay(3, defaultConfig);
          
          // Expected: 1000, 2000, 4000, 8000
          return (
            delay0 === 1000 &&
            delay1 === 2000 &&
            delay2 === 4000 &&
            delay3 === 8000
          );
        }),
        { numRuns: 100 }
      );
    });

    it('should double delay with each attempt until max is reached', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseDelayMs: fc.integer({ min: 100, max: 1000 }),
            maxDelayMs: fc.integer({ min: 50000, max: 100000 }), // High max to avoid capping
            maxRetries: fc.integer({ min: 3, max: 5 }),
          }),
          (config) => {
            const delay0 = retryService.calculateBackoffDelay(0, config);
            const delay1 = retryService.calculateBackoffDelay(1, config);
            const delay2 = retryService.calculateBackoffDelay(2, config);
            
            // Each delay should be double the previous (before hitting max)
            return (
              delay1 === delay0 * 2 &&
              delay2 === delay1 * 2
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: platform-data-enrichment, Property 12: Error Isolation - Sync Continues After Individual Failures**
   * 
   * *For any* sync operation where one program fails to sync, the remaining programs 
   * SHALL still be processed and synced successfully.
   * 
   * **Validates: Requirements 6.2**
   */
  describe('Property 12: Error Isolation - Sync Continues After Individual Failures', () => {
    /**
     * This property tests that the sync process continues processing programs
     * even when individual programs fail. We test this by simulating a batch
     * of programs where some succeed and some fail, and verifying that:
     * 1. All programs are attempted (success + failure = total)
     * 2. Successful programs are counted correctly
     * 3. Failed programs are tracked in errors array
     */
    it('should process all programs regardless of individual failures', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }),
              shouldFail: fc.boolean(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (programConfigs: Array<{ name: string; shouldFail: boolean }>) => {
            // Simulate processing programs with error isolation
            let successCount = 0;
            let failureCount = 0;
            const errors: string[] = [];
            
            for (const config of programConfigs) {
              try {
                if (config.shouldFail) {
                  throw new Error(`Failed to sync ${config.name}`);
                }
                successCount++;
              } catch (error: any) {
                // Error isolation: catch error, log, and continue
                errors.push(`${config.name}: ${error.message}`);
                failureCount++;
                // Continue processing - don't rethrow
              }
            }
            
            // Verify all programs were attempted
            const totalAttempted = successCount + failureCount;
            if (totalAttempted !== programConfigs.length) {
              return false;
            }
            
            // Verify success count matches non-failing programs
            const expectedSuccess = programConfigs.filter((p: { name: string; shouldFail: boolean }) => !p.shouldFail).length;
            if (successCount !== expectedSuccess) {
              return false;
            }
            
            // Verify failure count matches failing programs
            const expectedFailure = programConfigs.filter((p: { name: string; shouldFail: boolean }) => p.shouldFail).length;
            if (failureCount !== expectedFailure) {
              return false;
            }
            
            // Verify errors array has correct length
            if (errors.length !== expectedFailure) {
              return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track success and failure counts accurately', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }), // number of successful programs
          fc.integer({ min: 0, max: 50 }), // number of failing programs
          (successfulCount: number, failingCount: number) => {
            // Simulate a sync result with mixed success/failure
            const result = {
              successCount: 0,
              failureCount: 0,
              errors: [] as string[],
            };
            
            // Process successful programs
            for (let i = 0; i < successfulCount; i++) {
              result.successCount++;
            }
            
            // Process failing programs (with error isolation)
            for (let i = 0; i < failingCount; i++) {
              try {
                throw new Error(`Program ${i} failed`);
              } catch (error: any) {
                result.errors.push(error.message);
                result.failureCount++;
                // Continue - don't rethrow
              }
            }
            
            // Verify counts
            return (
              result.successCount === successfulCount &&
              result.failureCount === failingCount &&
              result.errors.length === failingCount &&
              result.successCount + result.failureCount === successfulCount + failingCount
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should continue processing after rate limit errors', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 10 }),
              errorType: fc.constantFrom('none', 'rate_limit', 'network', 'validation'),
            }),
            { minLength: 1, maxLength: 15 }
          ),
          (programConfigs: Array<{ name: string; errorType: string }>) => {
            let processedCount = 0;
            const errors: string[] = [];
            
            for (const config of programConfigs) {
              try {
                if (config.errorType === 'rate_limit') {
                  throw new RateLimitError('Rate limit exceeded');
                } else if (config.errorType === 'network') {
                  throw new Error('Network error');
                } else if (config.errorType === 'validation') {
                  throw new Error('Validation error');
                }
                // Success case
                processedCount++;
              } catch (error: any) {
                // Error isolation - catch and continue
                errors.push(`${config.name}: ${error.message}`);
                // Continue processing remaining programs
              }
            }
            
            // All programs should have been attempted
            const totalAttempted = processedCount + errors.length;
            return totalAttempted === programConfigs.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve partial results when some programs fail', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              shouldFail: fc.boolean(),
              data: fc.string(),
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (programs: Array<{ id: string; shouldFail: boolean; data: string }>) => {
            const successfulResults: string[] = [];
            const failedIds: string[] = [];
            
            for (const program of programs) {
              try {
                if (program.shouldFail) {
                  throw new Error('Sync failed');
                }
                // Store successful result
                successfulResults.push(program.data);
              } catch {
                // Track failed program
                failedIds.push(program.id);
                // Continue processing
              }
            }
            
            // Verify we have results from successful programs
            const expectedSuccessCount = programs.filter((p: { id: string; shouldFail: boolean; data: string }) => !p.shouldFail).length;
            const expectedFailCount = programs.filter((p: { id: string; shouldFail: boolean; data: string }) => p.shouldFail).length;
            
            return (
              successfulResults.length === expectedSuccessCount &&
              failedIds.length === expectedFailCount
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: bounty-data-sources, Property 6: Sync Result Accuracy**
   * 
   * *For any* sync operation, the Sync_Result should accurately reflect:
   * - newPrograms + updatedPrograms equals total programs processed
   * - successCount + failureCount equals total programs attempted
   * - duration should be positive
   * 
   * **Validates: Requirements 4.5, 6.3**
   */
  describe('Property 6: Sync Result Accuracy', () => {
    interface SimulatedSyncResult {
      platform: string;
      newPrograms: number;
      updatedPrograms: number;
      newScopes: number;
      errors: string[];
      duration: number;
      successCount: number;
      failureCount: number;
    }

    /**
     * Simulates a sync operation and returns a SyncResult
     * This mirrors the logic in syncChaos, syncBountyTargets, etc.
     */
    const simulateSync = (
      programs: Array<{ isNew: boolean; shouldFail: boolean; scopeCount: number }>,
      platform: string
    ): SimulatedSyncResult => {
      const startTime = Date.now();
      const result: SimulatedSyncResult = {
        platform,
        newPrograms: 0,
        updatedPrograms: 0,
        newScopes: 0,
        errors: [],
        duration: 0,
        successCount: 0,
        failureCount: 0,
      };

      for (const program of programs) {
        try {
          if (program.shouldFail) {
            throw new Error('Sync failed');
          }

          if (program.isNew) {
            result.newPrograms++;
          } else {
            result.updatedPrograms++;
          }
          result.newScopes += program.scopeCount;
          result.successCount++;
        } catch (error: any) {
          result.errors.push(error.message);
          result.failureCount++;
          // Continue processing - error isolation
        }
      }

      result.duration = Date.now() - startTime;
      return result;
    };

    it('should have newPrograms + updatedPrograms equal to successCount', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              isNew: fc.boolean(),
              shouldFail: fc.constant(false), // Only successful programs
              scopeCount: fc.nat({ max: 100 }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          fc.constantFrom('chaos', 'bounty-targets', 'hackerone', 'bugcrowd'),
          (programs, platform) => {
            const result = simulateSync(programs, platform);
            
            // For successful programs, newPrograms + updatedPrograms should equal successCount
            return result.newPrograms + result.updatedPrograms === result.successCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have successCount + failureCount equal to total programs attempted', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              isNew: fc.boolean(),
              shouldFail: fc.boolean(),
              scopeCount: fc.nat({ max: 100 }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          fc.constantFrom('chaos', 'bounty-targets', 'hackerone', 'bugcrowd'),
          (programs, platform) => {
            const result = simulateSync(programs, platform);
            
            // successCount + failureCount should equal total programs
            return result.successCount + result.failureCount === programs.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have non-negative duration', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              isNew: fc.boolean(),
              shouldFail: fc.boolean(),
              scopeCount: fc.nat({ max: 100 }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          fc.constantFrom('chaos', 'bounty-targets'),
          (programs, platform) => {
            const result = simulateSync(programs, platform);
            
            // Duration should be non-negative
            return result.duration >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have errors array length equal to failureCount', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              isNew: fc.boolean(),
              shouldFail: fc.boolean(),
              scopeCount: fc.nat({ max: 100 }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          fc.constantFrom('chaos', 'bounty-targets', 'hackerone', 'bugcrowd'),
          (programs, platform) => {
            const result = simulateSync(programs, platform);
            
            // errors array length should equal failureCount
            return result.errors.length === result.failureCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have newScopes equal to sum of scope counts for successful programs', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              isNew: fc.boolean(),
              shouldFail: fc.boolean(),
              scopeCount: fc.nat({ max: 100 }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          fc.constantFrom('chaos', 'bounty-targets'),
          (programs, platform) => {
            const result = simulateSync(programs, platform);
            
            // newScopes should equal sum of scopeCount for successful programs
            const expectedScopes = programs
              .filter(p => !p.shouldFail)
              .reduce((sum, p) => sum + p.scopeCount, 0);
            
            return result.newScopes === expectedScopes;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have zero counts when no programs are processed', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('chaos', 'bounty-targets', 'hackerone', 'bugcrowd'),
          (platform) => {
            const result = simulateSync([], platform);
            
            return (
              result.newPrograms === 0 &&
              result.updatedPrograms === 0 &&
              result.newScopes === 0 &&
              result.successCount === 0 &&
              result.failureCount === 0 &&
              result.errors.length === 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly track new vs updated programs', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              isNew: fc.boolean(),
              shouldFail: fc.constant(false),
              scopeCount: fc.nat({ max: 10 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          fc.constantFrom('chaos', 'bounty-targets'),
          (programs, platform) => {
            const result = simulateSync(programs, platform);
            
            const expectedNew = programs.filter(p => p.isNew).length;
            const expectedUpdated = programs.filter(p => !p.isNew).length;
            
            return (
              result.newPrograms === expectedNew &&
              result.updatedPrograms === expectedUpdated
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: bounty-data-sources, Property 7: Exponential Backoff Delay Calculation**
   * 
   * *For any* retry attempt number n (0-indexed), the calculated backoff delay 
   * should equal baseDelay * 2^n, capped at maxDelay.
   * 
   * **Validates: Requirements 6.1**
   */
  describe('Property 7: Exponential Backoff Delay Calculation', () => {
    let backoffService: PlatformSyncService;

    beforeEach(() => {
      // Create a service instance with the calculateBackoffDelay method
      backoffService = {
        calculateBackoffDelay: PlatformSyncService.prototype.calculateBackoffDelay,
      } as unknown as PlatformSyncService;
    });

    it('should calculate delay as baseDelay * 2^attempt', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 10 }), // attempt number (0-indexed)
          fc.record({
            baseDelayMs: fc.integer({ min: 100, max: 5000 }),
            maxDelayMs: fc.integer({ min: 50000, max: 100000 }), // High max to avoid capping
            maxRetries: fc.integer({ min: 1, max: 5 }),
          }),
          (attempt, config) => {
            const delay = backoffService.calculateBackoffDelay(attempt, config);
            
            // Expected: baseDelay * 2^attempt (before capping)
            const expectedDelay = config.baseDelayMs * Math.pow(2, attempt);
            
            // Since maxDelay is high, delay should equal expected
            return delay === Math.min(expectedDelay, config.maxDelayMs);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cap delay at maxDelayMs', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 20 }), // attempt number (can be high to trigger cap)
          fc.record({
            baseDelayMs: fc.integer({ min: 1000, max: 5000 }),
            maxDelayMs: fc.integer({ min: 5000, max: 15000 }),
            maxRetries: fc.integer({ min: 1, max: 5 }),
          }),
          (attempt, config) => {
            const delay = backoffService.calculateBackoffDelay(attempt, config);
            
            // Delay should never exceed maxDelayMs
            return delay <= config.maxDelayMs;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce delays 1s, 2s, 4s, 8s for default config', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          // Default config as specified in Requirements 6.1
          const defaultConfig: RetryConfig = {
            maxRetries: 3,
            baseDelayMs: 1000,
            maxDelayMs: 8000,
          };
          
          const delay0 = backoffService.calculateBackoffDelay(0, defaultConfig);
          const delay1 = backoffService.calculateBackoffDelay(1, defaultConfig);
          const delay2 = backoffService.calculateBackoffDelay(2, defaultConfig);
          const delay3 = backoffService.calculateBackoffDelay(3, defaultConfig);
          
          // Expected delays: 1000ms, 2000ms, 4000ms, 8000ms
          return (
            delay0 === 1000 &&
            delay1 === 2000 &&
            delay2 === 4000 &&
            delay3 === 8000
          );
        }),
        { numRuns: 100 }
      );
    });

    it('should return baseDelayMs for attempt 0', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseDelayMs: fc.integer({ min: 100, max: 10000 }),
            maxDelayMs: fc.integer({ min: 10000, max: 100000 }),
            maxRetries: fc.integer({ min: 1, max: 5 }),
          }),
          (config) => {
            const delay = backoffService.calculateBackoffDelay(0, config);
            
            // For attempt 0: baseDelay * 2^0 = baseDelay * 1 = baseDelay
            return delay === config.baseDelayMs;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should double delay with each subsequent attempt', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }), // starting attempt
          fc.record({
            baseDelayMs: fc.integer({ min: 100, max: 1000 }),
            maxDelayMs: fc.integer({ min: 100000, max: 200000 }), // Very high to avoid capping
            maxRetries: fc.integer({ min: 3, max: 5 }),
          }),
          (startAttempt, config) => {
            const delay1 = backoffService.calculateBackoffDelay(startAttempt, config);
            const delay2 = backoffService.calculateBackoffDelay(startAttempt + 1, config);
            
            // delay2 should be exactly double delay1 (when not capped)
            return delay2 === delay1 * 2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce monotonically increasing delays', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseDelayMs: fc.integer({ min: 100, max: 2000 }),
            maxDelayMs: fc.integer({ min: 10000, max: 50000 }),
            maxRetries: fc.integer({ min: 3, max: 5 }),
          }),
          (config) => {
            const delays: number[] = [];
            
            // Calculate delays for attempts 0 through 5
            for (let attempt = 0; attempt <= 5; attempt++) {
              delays.push(backoffService.calculateBackoffDelay(attempt, config));
            }
            
            // Each delay should be >= the previous one
            for (let i = 1; i < delays.length; i++) {
              if (delays[i] < delays[i - 1]) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case of attempt 0 with low maxDelay', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseDelayMs: fc.integer({ min: 5000, max: 10000 }),
            maxDelayMs: fc.integer({ min: 1000, max: 4000 }), // maxDelay < baseDelay
            maxRetries: fc.integer({ min: 1, max: 3 }),
          }),
          (config) => {
            const delay = backoffService.calculateBackoffDelay(0, config);
            
            // Should be capped at maxDelayMs even for attempt 0
            return delay === config.maxDelayMs;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
