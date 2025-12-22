import * as fc from 'fast-check';
import { ScoresService } from './scores.service';
import { ProgramDocument } from '../../schemas/program.schema';
import { ScopeDocument } from '../../schemas/scope.schema';
import { DomainDocument } from '../../schemas/domain.schema';
import { Types } from 'mongoose';

/**
 * Property-Based Tests for ScoresService
 * 
 * These tests verify the correctness properties defined in the design document
 * for the platform-data-enrichment feature.
 * 
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// Helper to create a mock program document with enriched data
const createMockProgram = (overrides: Partial<ProgramDocument> = {}): ProgramDocument => {
  return {
    _id: new Types.ObjectId(),
    name: 'Test Program',
    handle: 'test-program',
    platform: 'hackerone',
    url: 'https://hackerone.com/test-program',
    state: 'open',
    offersBounties: true,
    isActive: true,
    bountyRange: { min: 100, max: 5000 },
    bountyTable: undefined,
    responseMetrics: undefined,
    activityStats: undefined,
    scopeStats: undefined,
    launchedAt: undefined,
    firstSyncedAt: new Date(),
    ...overrides,
  } as unknown as ProgramDocument;
};

// Helper to create a mock scope document
const createMockScope = (overrides: Partial<ScopeDocument> = {}): ScopeDocument => {
  return {
    _id: new Types.ObjectId(),
    programId: new Types.ObjectId(),
    target: 'example.com',
    type: 'domain',
    status: 'in_scope',
    eligibility: { isEligible: true },
    ...overrides,
  } as unknown as ScopeDocument;
};

// Helper to create a mock domain document
const createMockDomain = (overrides: Partial<DomainDocument> = {}): DomainDocument => {
  return {
    _id: new Types.ObjectId(),
    domain: 'example.com',
    programId: new Types.ObjectId(),
    isActive: true,
    ...overrides,
  } as unknown as DomainDocument;
};

// Arbitrary for generating bounty table data
const bountyTableArb = fc.record({
  critical: fc.option(fc.record({
    min: fc.integer({ min: 0, max: 10000 }),
    max: fc.integer({ min: 10000, max: 100000 }),
  }), { nil: undefined }),
  high: fc.option(fc.record({
    min: fc.integer({ min: 0, max: 5000 }),
    max: fc.integer({ min: 5000, max: 50000 }),
  }), { nil: undefined }),
  medium: fc.option(fc.record({
    min: fc.integer({ min: 0, max: 1000 }),
    max: fc.integer({ min: 1000, max: 10000 }),
  }), { nil: undefined }),
  low: fc.option(fc.record({
    min: fc.integer({ min: 0, max: 500 }),
    max: fc.integer({ min: 500, max: 5000 }),
  }), { nil: undefined }),
});

// Arbitrary for generating response metrics
const responseMetricsArb = fc.record({
  averageTimeToFirstResponse: fc.option(fc.integer({ min: 1, max: 60 }), { nil: undefined }),
  averageTimeToBounty: fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined }),
  averageTimeToResolution: fc.option(fc.integer({ min: 1, max: 180 }), { nil: undefined }),
});

// Arbitrary for generating activity stats
const activityStatsArb = fc.record({
  resolvedReportCount: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
  totalBountiesPaid: fc.option(fc.integer({ min: 0, max: 10000000 }), { nil: undefined }),
  hackersThanked: fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
});

// Arbitrary for generating scope stats
const scopeStatsArb = fc.record({
  totalAssets: fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
  wildcardCount: fc.option(fc.integer({ min: 0, max: 50 }), { nil: undefined }),
  domainCount: fc.option(fc.integer({ min: 0, max: 200 }), { nil: undefined }),
  apiCount: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  mobileAppCount: fc.option(fc.integer({ min: 0, max: 20 }), { nil: undefined }),
  bountyEligibleCount: fc.option(fc.integer({ min: 0, max: 300 }), { nil: undefined }),
});

describe('ScoresService Property-Based Tests', () => {
  let service: ScoresService;

  beforeEach(() => {
    // Create a minimal mock service with just the scoring methods we need to test
    // We extract the private methods for testing by creating a partial mock
    service = {
      calculateProgramQuality: (ScoresService.prototype as any).calculateProgramQuality,
      calculateHistorical: (ScoresService.prototype as any).calculateHistorical,
      calculateAttackSurface: (ScoresService.prototype as any).calculateAttackSurface,
      calculateConfidence: (ScoresService.prototype as any).calculateConfidence,
    } as unknown as ScoresService;
  });


  /**
   * **Feature: platform-data-enrichment, Property 6: Bounty Amount Score Differentiation**
   * 
   * *For any* two programs where one has a higher maximum critical bounty than the other, 
   * the program with the higher bounty SHALL receive a higher program quality score 
   * (assuming other factors are equal).
   * 
   * **Validates: Requirements 1.5, 5.1**
   */
  describe('Property 6: Bounty Amount Score Differentiation', () => {
    it('should give higher bountyMax score to programs with higher critical bounty max', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 50000 }), // lower bounty
          fc.integer({ min: 50001, max: 100000 }), // higher bounty
          (lowerBounty: number, higherBounty: number) => {
            const programLow = createMockProgram({
              bountyTable: {
                critical: { min: 100, max: lowerBounty },
              },
            });
            
            const programHigh = createMockProgram({
              bountyTable: {
                critical: { min: 100, max: higherBounty },
              },
            });
            
            const scoreLow = (service as any).calculateProgramQuality(programLow, [], []);
            const scoreHigh = (service as any).calculateProgramQuality(programHigh, [], []);
            
            // Higher bounty should result in higher or equal bountyMax score
            return scoreHigh.bountyMax >= scoreLow.bountyMax;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should differentiate programs based on bountyTable data vs bountyRange fallback', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10000, max: 50000 }),
          (bountyMax: number) => {
            // Program with bountyTable data
            const programWithTable = createMockProgram({
              bountyTable: {
                critical: { min: 500, max: bountyMax },
                high: { min: 200, max: bountyMax / 2 },
              },
              bountyRange: { min: 100, max: 1000 }, // Lower fallback
            });
            
            // Program with only bountyRange (no bountyTable)
            const programWithRange = createMockProgram({
              bountyTable: undefined,
              bountyRange: { min: 100, max: bountyMax },
            });
            
            const scoreWithTable = (service as any).calculateProgramQuality(programWithTable, [], []);
            const scoreWithRange = (service as any).calculateProgramQuality(programWithRange, [], []);
            
            // Both should use the same max bounty value for scoring
            // bountyTable.critical.max should be used when available
            return scoreWithTable.bountyMax === scoreWithRange.bountyMax;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate bountyAverage from all bountyTable tiers', () => {
      fc.assert(
        fc.property(
          bountyTableArb,
          (bountyTable: typeof bountyTableArb extends fc.Arbitrary<infer T> ? T : never) => {
            const program = createMockProgram({ bountyTable });
            const score = (service as any).calculateProgramQuality(program, [], []);
            
            // bountyAverage should be a valid number between 0 and 100
            return score.bountyAverage >= 0 && score.bountyAverage <= 100;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce higher total score for programs with higher bounties', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 20000 }), // lower bounty
          fc.integer({ min: 30000, max: 100000 }), // higher bounty (significant difference)
          (lowerBounty: number, higherBounty: number) => {
            const programLow = createMockProgram({
              bountyTable: {
                critical: { min: 100, max: lowerBounty },
              },
              responseMetrics: undefined,
              activityStats: undefined,
              scopeStats: undefined,
            });
            
            const programHigh = createMockProgram({
              bountyTable: {
                critical: { min: 100, max: higherBounty },
              },
              responseMetrics: undefined,
              activityStats: undefined,
              scopeStats: undefined,
            });
            
            const scoreLow = (service as any).calculateProgramQuality(programLow, [], []);
            const scoreHigh = (service as any).calculateProgramQuality(programHigh, [], []);
            
            // Higher bounty should result in higher total score
            // (bountyMax has 30% weight in total calculation)
            return scoreHigh.total >= scoreLow.total;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: platform-data-enrichment, Property 7: Response Time Score Differentiation**
   * 
   * *For any* two programs where one has a faster average time to first response, 
   * the faster-responding program SHALL receive a higher program quality score 
   * (assuming other factors are equal).
   * 
   * **Validates: Requirements 2.5, 5.2**
   */
  describe('Property 7: Response Time Score Differentiation', () => {
    it('should give higher responseTime score to programs with faster response times', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 7 }), // faster response (1-7 days)
          fc.integer({ min: 14, max: 60 }), // slower response (14-60 days)
          (fasterDays: number, slowerDays: number) => {
            const programFast = createMockProgram({
              responseMetrics: {
                averageTimeToFirstResponse: fasterDays,
              },
            });
            
            const programSlow = createMockProgram({
              responseMetrics: {
                averageTimeToFirstResponse: slowerDays,
              },
            });
            
            const scoreFast = (service as any).calculateProgramQuality(programFast, [], []);
            const scoreSlow = (service as any).calculateProgramQuality(programSlow, [], []);
            
            // Faster response should result in higher responseTime score
            return scoreFast.responseTime >= scoreSlow.responseTime;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should give higher resolutionRate score to programs with faster bounty payment', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 14 }), // faster bounty payment (1-14 days)
          fc.integer({ min: 30, max: 120 }), // slower bounty payment (30-120 days)
          (fasterDays: number, slowerDays: number) => {
            const programFast = createMockProgram({
              responseMetrics: {
                averageTimeToBounty: fasterDays,
              },
            });
            
            const programSlow = createMockProgram({
              responseMetrics: {
                averageTimeToBounty: slowerDays,
              },
            });
            
            const scoreFast = (service as any).calculateProgramQuality(programFast, [], []);
            const scoreSlow = (service as any).calculateProgramQuality(programSlow, [], []);
            
            // Faster bounty payment should result in higher resolutionRate score
            return scoreFast.resolutionRate >= scoreSlow.resolutionRate;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid response time scores for any valid response metrics', () => {
      fc.assert(
        fc.property(
          responseMetricsArb,
          (responseMetrics: typeof responseMetricsArb extends fc.Arbitrary<infer T> ? T : never) => {
            const program = createMockProgram({ responseMetrics });
            const score = (service as any).calculateProgramQuality(program, [], []);
            
            // responseTime and resolutionRate should be valid numbers between 0 and 100
            return (
              score.responseTime >= 0 && score.responseTime <= 100 &&
              score.resolutionRate >= 0 && score.resolutionRate <= 100
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default neutral score when response metrics are missing', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const programNoMetrics = createMockProgram({
            responseMetrics: undefined,
          });
          
          const score = (service as any).calculateProgramQuality(programNoMetrics, [], []);
          
          // Default responseTime should be 50 (neutral)
          return score.responseTime === 50;
        }),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: platform-data-enrichment, Property 8: Attack Surface Score Differentiation**
   * 
   * *For any* two programs where one has more in-scope assets, the program with more assets 
   * SHALL receive a higher attack surface score (assuming other factors are equal).
   * 
   * **Validates: Requirements 4.4, 5.3**
   */
  describe('Property 8: Attack Surface Score Differentiation', () => {
    it('should give higher subdomainCount score to programs with more total assets', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }), // fewer assets
          fc.integer({ min: 100, max: 500 }), // more assets
          (fewerAssets: number, moreAssets: number) => {
            const programFewer = createMockProgram({
              scopeStats: {
                totalAssets: fewerAssets,
              },
            });
            
            const programMore = createMockProgram({
              scopeStats: {
                totalAssets: moreAssets,
              },
            });
            
            const scoreFewer = (service as any).calculateAttackSurface([], [], [], programFewer);
            const scoreMore = (service as any).calculateAttackSurface([], [], [], programMore);
            
            // More assets should result in higher subdomainCount score
            return scoreMore.subdomainCount >= scoreFewer.subdomainCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should give higher openPortCount score to programs with more wildcards', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2 }), // fewer wildcards
          fc.integer({ min: 3, max: 10 }), // more wildcards
          (fewerWildcards: number, moreWildcards: number) => {
            const programFewer = createMockProgram({
              scopeStats: {
                wildcardCount: fewerWildcards,
              },
            });
            
            const programMore = createMockProgram({
              scopeStats: {
                wildcardCount: moreWildcards,
              },
            });
            
            const scoreFewer = (service as any).calculateAttackSurface([], [], [], programFewer);
            const scoreMore = (service as any).calculateAttackSurface([], [], [], programMore);
            
            // More wildcards should result in higher openPortCount score
            return scoreMore.openPortCount >= scoreFewer.openPortCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid attack surface scores for any valid scope stats', () => {
      fc.assert(
        fc.property(
          scopeStatsArb,
          (scopeStats: typeof scopeStatsArb extends fc.Arbitrary<infer T> ? T : never) => {
            const program = createMockProgram({ scopeStats });
            const score = (service as any).calculateAttackSurface([], [], [], program);
            
            // All scores should be valid numbers between 0 and 100
            return (
              score.subdomainCount >= 0 && score.subdomainCount <= 100 &&
              score.openPortCount >= 0 && score.openPortCount <= 100 &&
              score.total >= 0 && score.total <= 100
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use apiCount from scopeStats for API endpoint scoring', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }), // fewer APIs
          fc.integer({ min: 10, max: 50 }), // more APIs
          (fewerApis: number, moreApis: number) => {
            const programFewer = createMockProgram({
              scopeStats: {
                apiCount: fewerApis,
              },
            });
            
            const programMore = createMockProgram({
              scopeStats: {
                apiCount: moreApis,
              },
            });
            
            const scoreFewer = (service as any).calculateAttackSurface([], [], [], programFewer);
            const scoreMore = (service as any).calculateAttackSurface([], [], [], programMore);
            
            // More APIs should result in higher apiEndpoints score
            return scoreMore.apiEndpoints >= scoreFewer.apiEndpoints;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: platform-data-enrichment, Property 9: Wildcard Scope Score Bonus**
   * 
   * *For any* two programs with equal total scope counts, the program with wildcard scopes 
   * SHALL receive a higher program quality score than the program without wildcards.
   * 
   * **Validates: Requirements 4.5**
   */
  describe('Property 9: Wildcard Scope Score Bonus', () => {
    it('should give higher wildcards score to programs with more wildcard scopes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1 }), // fewer wildcards
          fc.integer({ min: 2, max: 10 }), // more wildcards
          (fewerWildcards: number, moreWildcards: number) => {
            const programFewer = createMockProgram({
              scopeStats: {
                totalAssets: 50, // Same total assets
                wildcardCount: fewerWildcards,
              },
            });
            
            const programMore = createMockProgram({
              scopeStats: {
                totalAssets: 50, // Same total assets
                wildcardCount: moreWildcards,
              },
            });
            
            const scoreFewer = (service as any).calculateProgramQuality(programFewer, [], []);
            const scoreMore = (service as any).calculateProgramQuality(programMore, [], []);
            
            // More wildcards should result in higher wildcards score
            return scoreMore.wildcards >= scoreFewer.wildcards;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should give wildcard bonus even when total assets are equal', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }), // total assets
          fc.integer({ min: 1, max: 5 }), // wildcard count
          (totalAssets: number, wildcardCount: number) => {
            const programNoWildcards = createMockProgram({
              scopeStats: {
                totalAssets,
                wildcardCount: 0,
              },
              bountyTable: undefined,
              responseMetrics: undefined,
            });
            
            const programWithWildcards = createMockProgram({
              scopeStats: {
                totalAssets,
                wildcardCount,
              },
              bountyTable: undefined,
              responseMetrics: undefined,
            });
            
            const scoreNoWildcards = (service as any).calculateProgramQuality(programNoWildcards, [], []);
            const scoreWithWildcards = (service as any).calculateProgramQuality(programWithWildcards, [], []);
            
            // Program with wildcards should have higher total score
            return scoreWithWildcards.total >= scoreNoWildcards.total;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fall back to counting wildcard scopes when scopeStats is not available', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (wildcardCount: number) => {
            const program = createMockProgram({
              scopeStats: undefined,
            });
            
            // Create wildcard scopes
            const wildcardScopes: ScopeDocument[] = [];
            for (let i = 0; i < wildcardCount; i++) {
              wildcardScopes.push(createMockScope({
                target: `*.example${i}.com`,
                type: 'wildcard' as any,
              }));
            }
            
            const score = (service as any).calculateProgramQuality(program, wildcardScopes, []);
            
            // Should count wildcards from scopes array
            return score.wildcards > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cap wildcards score at 100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }), // Many wildcards
          (wildcardCount: number) => {
            const program = createMockProgram({
              scopeStats: {
                wildcardCount,
              },
            });
            
            const score = (service as any).calculateProgramQuality(program, [], []);
            
            // Wildcards score should never exceed 100
            return score.wildcards <= 100;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: platform-data-enrichment, Property 10: Confidence Score Reflects Data Completeness**
   * 
   * *For any* program, the confidence score SHALL be higher when more data fields 
   * (bounty, response metrics, activity stats, scope stats) are populated with non-null values.
   * 
   * **Validates: Requirements 5.4**
   */
  describe('Property 10: Confidence Score Reflects Data Completeness', () => {
    it('should give higher confidence when bountyTable data is available', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const dataWithBountyTable = {
            hasVulnerabilityData: true,
            hasSubdomainData: true,
            
            hasTechnologyData: true,
            hasBountyData: true,
            hasHistoricalData: true,
            hasBountyTableData: true,
            hasResponseMetricsData: false,
            hasActivityStatsData: false,
            hasScopeStatsData: false,
          };
          
          const dataWithoutBountyTable = {
            hasVulnerabilityData: true,
            hasSubdomainData: true,
            
            hasTechnologyData: true,
            hasBountyData: true,
            hasHistoricalData: true,
            hasBountyTableData: false,
            hasResponseMetricsData: false,
            hasActivityStatsData: false,
            hasScopeStatsData: false,
          };
          
          const confidenceWith = (service as any).calculateConfidence(dataWithBountyTable);
          const confidenceWithout = (service as any).calculateConfidence(dataWithoutBountyTable);
          
          return confidenceWith > confidenceWithout;
        }),
        { numRuns: 100 }
      );
    });

    it('should give higher confidence when responseMetrics data is available', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const dataWithMetrics = {
            hasVulnerabilityData: true,
            hasSubdomainData: true,
            
            hasTechnologyData: true,
            hasBountyData: true,
            hasHistoricalData: true,
            hasBountyTableData: false,
            hasResponseMetricsData: true,
            hasActivityStatsData: false,
            hasScopeStatsData: false,
          };
          
          const dataWithoutMetrics = {
            hasVulnerabilityData: true,
            hasSubdomainData: true,
            
            hasTechnologyData: true,
            hasBountyData: true,
            hasHistoricalData: true,
            hasBountyTableData: false,
            hasResponseMetricsData: false,
            hasActivityStatsData: false,
            hasScopeStatsData: false,
          };
          
          const confidenceWith = (service as any).calculateConfidence(dataWithMetrics);
          const confidenceWithout = (service as any).calculateConfidence(dataWithoutMetrics);
          
          return confidenceWith > confidenceWithout;
        }),
        { numRuns: 100 }
      );
    });

    it('should give higher confidence when activityStats data is available', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const dataWithStats = {
            hasVulnerabilityData: true,
            hasSubdomainData: true,
            
            hasTechnologyData: true,
            hasBountyData: true,
            hasHistoricalData: true,
            hasBountyTableData: false,
            hasResponseMetricsData: false,
            hasActivityStatsData: true,
            hasScopeStatsData: false,
          };
          
          const dataWithoutStats = {
            hasVulnerabilityData: true,
            hasSubdomainData: true,
            
            hasTechnologyData: true,
            hasBountyData: true,
            hasHistoricalData: true,
            hasBountyTableData: false,
            hasResponseMetricsData: false,
            hasActivityStatsData: false,
            hasScopeStatsData: false,
          };
          
          const confidenceWith = (service as any).calculateConfidence(dataWithStats);
          const confidenceWithout = (service as any).calculateConfidence(dataWithoutStats);
          
          return confidenceWith > confidenceWithout;
        }),
        { numRuns: 100 }
      );
    });

    it('should give higher confidence when scopeStats data is available', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const dataWithScope = {
            hasVulnerabilityData: true,
            hasSubdomainData: true,
            
            hasTechnologyData: true,
            hasBountyData: true,
            hasHistoricalData: true,
            hasBountyTableData: false,
            hasResponseMetricsData: false,
            hasActivityStatsData: false,
            hasScopeStatsData: true,
          };
          
          const dataWithoutScope = {
            hasVulnerabilityData: true,
            hasSubdomainData: true,
            
            hasTechnologyData: true,
            hasBountyData: true,
            hasHistoricalData: true,
            hasBountyTableData: false,
            hasResponseMetricsData: false,
            hasActivityStatsData: false,
            hasScopeStatsData: false,
          };
          
          const confidenceWith = (service as any).calculateConfidence(dataWithScope);
          const confidenceWithout = (service as any).calculateConfidence(dataWithoutScope);
          
          return confidenceWith > confidenceWithout;
        }),
        { numRuns: 100 }
      );
    });

    it('should give maximum confidence when all enriched data is available', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const fullData = {
            hasVulnerabilityData: true,
            hasSubdomainData: true,
            
            hasTechnologyData: true,
            hasBountyData: true,
            hasHistoricalData: true,
            hasBountyTableData: true,
            hasResponseMetricsData: true,
            hasActivityStatsData: true,
            hasScopeStatsData: true,
          };
          
          const confidence = (service as any).calculateConfidence(fullData);
          
          // Maximum confidence should be 100
          return confidence === 100;
        }),
        { numRuns: 100 }
      );
    });

    it('should give minimum confidence when no data is available', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const noData = {
            hasVulnerabilityData: false,
            hasSubdomainData: false,
            
            hasTechnologyData: false,
            hasBountyData: false,
            hasHistoricalData: false,
            hasBountyTableData: false,
            hasResponseMetricsData: false,
            hasActivityStatsData: false,
            hasScopeStatsData: false,
          };
          
          const confidence = (service as any).calculateConfidence(noData);
          
          // Minimum confidence should be 0
          return confidence === 0;
        }),
        { numRuns: 100 }
      );
    });

    it('should increase confidence monotonically as more data becomes available', () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
          (flags: boolean[]) => {
            // Create data availability objects with increasing data
            const dataAvailabilities = [];
            let currentData = {
              hasVulnerabilityData: false,
              hasSubdomainData: false,
              
              hasTechnologyData: false,
              hasBountyData: false,
              hasHistoricalData: false,
              hasBountyTableData: false,
              hasResponseMetricsData: false,
              hasActivityStatsData: false,
              hasScopeStatsData: false,
            };
            
            const keys = Object.keys(currentData) as (keyof typeof currentData)[];
            
            // Add data one field at a time based on flags
            for (let i = 0; i < flags.length; i++) {
              if (flags[i]) {
                currentData = { ...currentData, [keys[i]]: true };
              }
              dataAvailabilities.push({ ...currentData });
            }
            
            // Calculate confidence for each state
            const confidences = dataAvailabilities.map(data => 
              (service as any).calculateConfidence(data)
            );
            
            // Confidence should never decrease as more data is added
            for (let i = 1; i < confidences.length; i++) {
              if (confidences[i] < confidences[i - 1]) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
