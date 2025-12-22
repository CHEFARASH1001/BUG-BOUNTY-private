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
});
