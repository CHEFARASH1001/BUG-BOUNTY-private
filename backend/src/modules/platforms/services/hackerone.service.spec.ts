import * as fc from 'fast-check';
import { HackerOneService, BountyTable, ResponseMetrics, ActivityStats } from './hackerone.service';
import { ConfigService } from '@nestjs/config';

/**
 * Property-Based Tests for HackerOneService
 * 
 * These tests verify the correctness properties defined in the design document
 * for the platform-data-enrichment feature.
 * 
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

describe('HackerOneService Property-Based Tests', () => {
  let service: HackerOneService;

  beforeEach(() => {
    // Create a mock ConfigService
    const mockConfigService = {
      get: jest.fn().mockReturnValue(''),
    } as unknown as ConfigService;
    
    service = new HackerOneService(mockConfigService);
  });

  /**
   * **Feature: platform-data-enrichment, Property 1: Bounty Data Extraction Preserves Values**
   * 
   * *For any* HackerOne API response containing bounty table data, the extracted 
   * bounty values stored in the Program document SHALL equal the original API 
   * values without modification or default substitution.
   * 
   * **Validates: Requirements 1.1, 1.2**
   */
  describe('Property 1: Bounty Data Extraction Preserves Values', () => {
    // Arbitrary for generating valid bounty amounts (non-negative numbers)
    const bountyAmountArb = fc.oneof(
      fc.nat({ max: 100000 }),  // Valid bounty amounts
      fc.constant(null),        // Null values
      fc.constant(undefined),   // Undefined values
    );

    // Arbitrary for generating bounty table API responses
    const bountyTableArb = fc.record({
      critical_minimum: bountyAmountArb,
      critical_maximum: bountyAmountArb,
      high_minimum: bountyAmountArb,
      high_maximum: bountyAmountArb,
      medium_minimum: bountyAmountArb,
      medium_maximum: bountyAmountArb,
      low_minimum: bountyAmountArb,
      low_maximum: bountyAmountArb,
    });

    it('should preserve bounty values exactly as provided in API response', () => {
      fc.assert(
        fc.property(bountyTableArb, (apiResponse: {
          critical_minimum: number | null | undefined;
          critical_maximum: number | null | undefined;
          high_minimum: number | null | undefined;
          high_maximum: number | null | undefined;
          medium_minimum: number | null | undefined;
          medium_maximum: number | null | undefined;
          low_minimum: number | null | undefined;
          low_maximum: number | null | undefined;
        }) => {
          const result = service.extractBountyTable(apiResponse);
          
          // If result is null, all values must have been undefined
          if (result === null) {
            const allUndefined = 
              apiResponse.critical_minimum === undefined &&
              apiResponse.critical_maximum === undefined &&
              apiResponse.high_minimum === undefined &&
              apiResponse.high_maximum === undefined &&
              apiResponse.medium_minimum === undefined &&
              apiResponse.medium_maximum === undefined &&
              apiResponse.low_minimum === undefined &&
              apiResponse.low_maximum === undefined;
            return allUndefined;
          }

          // Verify critical values are preserved
          if (result.critical) {
            const expectedMin = apiResponse.critical_minimum ?? null;
            const expectedMax = apiResponse.critical_maximum ?? null;
            if (result.critical.min !== expectedMin || result.critical.max !== expectedMax) {
              return false;
            }
          }

          // Verify high values are preserved
          if (result.high) {
            const expectedMin = apiResponse.high_minimum ?? null;
            const expectedMax = apiResponse.high_maximum ?? null;
            if (result.high.min !== expectedMin || result.high.max !== expectedMax) {
              return false;
            }
          }

          // Verify medium values are preserved
          if (result.medium) {
            const expectedMin = apiResponse.medium_minimum ?? null;
            const expectedMax = apiResponse.medium_maximum ?? null;
            if (result.medium.min !== expectedMin || result.medium.max !== expectedMax) {
              return false;
            }
          }

          // Verify low values are preserved
          if (result.low) {
            const expectedMin = apiResponse.low_minimum ?? null;
            const expectedMax = apiResponse.low_maximum ?? null;
            if (result.low.min !== expectedMin || result.low.max !== expectedMax) {
              return false;
            }
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should extract min/max for each severity level correctly', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 50000 }),  // critical min
          fc.nat({ max: 100000 }), // critical max
          fc.nat({ max: 25000 }),  // high min
          fc.nat({ max: 50000 }),  // high max
          (critMin: number, critMax: number, highMin: number, highMax: number) => {
            const apiResponse = {
              critical_minimum: critMin,
              critical_maximum: critMax,
              high_minimum: highMin,
              high_maximum: highMax,
            };

            const result = service.extractBountyTable(apiResponse);
            
            // Result should not be null when we have data
            if (result === null) return false;
            
            // Critical values should match exactly
            if (result.critical?.min !== critMin) return false;
            if (result.critical?.max !== critMax) return false;
            
            // High values should match exactly
            if (result.high?.min !== highMin) return false;
            if (result.high?.max !== highMax) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: platform-data-enrichment, Property 2: Missing Data Results in Null Not Zero**
   * 
   * *For any* API response where bounty, response metrics, or activity data is missing 
   * or undefined, the corresponding Program document fields SHALL be null rather than 
   * zero or any default numeric value.
   * 
   * **Validates: Requirements 1.4, 2.4, 6.3**
   */
  describe('Property 2: Missing Data Results in Null Not Zero', () => {
    it('should return null for bounty table when no data is provided', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const result = service.extractBountyTable(null);
          return result === null;
        }),
        { numRuns: 100 }
      );
    });

    it('should return null for bounty table when undefined is provided', () => {
      fc.assert(
        fc.property(fc.constant(undefined), () => {
          const result = service.extractBountyTable(undefined);
          return result === null;
        }),
        { numRuns: 100 }
      );
    });

    it('should return null for response metrics when no data is provided', () => {
      fc.assert(
        fc.property(fc.constant({}), () => {
          const result = service.extractResponseMetrics({});
          return result === null;
        }),
        { numRuns: 100 }
      );
    });

    it('should return null for activity stats when no data is provided', () => {
      fc.assert(
        fc.property(fc.constant({}), () => {
          const result = service.extractActivityStats({});
          return result === null;
        }),
        { numRuns: 100 }
      );
    });

    it('should use null not zero for missing bounty values within a bounty table', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 10000 }),
          (critMax: number) => {
            // Only provide critical_maximum, leave others undefined
            const apiResponse = {
              critical_maximum: critMax,
            };

            const result = service.extractBountyTable(apiResponse);
            
            if (result === null) return false;
            
            // critical_minimum should be null, not zero
            if (result.critical?.min !== null) return false;
            // critical_maximum should have the value
            if (result.critical?.max !== critMax) return false;
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use null not zero for missing response metric values', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 86400 * 30 }), // Up to 30 days in seconds
          (timeToFirstResponse: number) => {
            const node = {
              average_time_to_first_program_response: timeToFirstResponse,
              // Leave other metrics undefined
            };

            const result = service.extractResponseMetrics(node);
            
            if (result === null) return false;
            
            // averageTimeToFirstResponse should have a value
            if (result.averageTimeToFirstResponse === null) return false;
            // Other metrics should be null, not zero
            if (result.averageTimeToBounty !== null) return false;
            if (result.averageTimeToResolution !== null) return false;
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use null not zero for missing activity stat values', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 1000 }),
          (resolvedCount: number) => {
            const node = {
              resolved_report_count: resolvedCount,
              // Leave other stats undefined
            };

            const result = service.extractActivityStats(node);
            
            if (result === null) return false;
            
            // resolvedReportCount should have a value
            if (result.resolvedReportCount !== resolvedCount) return false;
            // Other stats should be null, not zero
            if (result.totalBountiesPaid !== null) return false;
            if (result.hackersThanked !== null) return false;
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: platform-data-enrichment, Property 3: Response Metrics Extraction Accuracy**
   * 
   * *For any* HackerOne API response containing response time metrics, the extracted 
   * values for time to first response, time to bounty, and time to resolution SHALL 
   * match the API values (converted from seconds to days).
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3**
   */
  describe('Property 3: Response Metrics Extraction Accuracy', () => {
    // Helper to convert seconds to days (matching the service implementation)
    const secondsToDays = (seconds: number): number => {
      return Math.round((seconds / 86400) * 100) / 100;
    };

    it('should correctly convert response times from seconds to days', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 86400 * 365 }), // Up to 1 year in seconds
          fc.nat({ max: 86400 * 365 }),
          fc.nat({ max: 86400 * 365 }),
          (timeToFirst: number, timeToBounty: number, timeToResolution: number) => {
            const node = {
              average_time_to_first_program_response: timeToFirst,
              average_time_to_bounty_awarded: timeToBounty,
              average_time_to_resolution: timeToResolution,
            };

            const result = service.extractResponseMetrics(node);
            
            if (result === null) return false;
            
            // Verify conversion from seconds to days
            const expectedFirst = secondsToDays(timeToFirst);
            const expectedBounty = secondsToDays(timeToBounty);
            const expectedResolution = secondsToDays(timeToResolution);
            
            if (result.averageTimeToFirstResponse !== expectedFirst) return false;
            if (result.averageTimeToBounty !== expectedBounty) return false;
            if (result.averageTimeToResolution !== expectedResolution) return false;
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract time to first response accurately', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 86400 * 30 }), // Up to 30 days in seconds
          (seconds: number) => {
            const node = {
              average_time_to_first_program_response: seconds,
            };

            const result = service.extractResponseMetrics(node);
            
            if (result === null) return false;
            
            const expectedDays = secondsToDays(seconds);
            return result.averageTimeToFirstResponse === expectedDays;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract time to bounty accurately', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 86400 * 60 }), // Up to 60 days in seconds
          (seconds: number) => {
            const node = {
              average_time_to_bounty_awarded: seconds,
            };

            const result = service.extractResponseMetrics(node);
            
            if (result === null) return false;
            
            const expectedDays = secondsToDays(seconds);
            return result.averageTimeToBounty === expectedDays;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract time to resolution accurately', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 86400 * 90 }), // Up to 90 days in seconds
          (seconds: number) => {
            const node = {
              average_time_to_resolution: seconds,
            };

            const result = service.extractResponseMetrics(node);
            
            if (result === null) return false;
            
            const expectedDays = secondsToDays(seconds);
            return result.averageTimeToResolution === expectedDays;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: platform-data-enrichment, Property 4: Activity Statistics Extraction Accuracy**
   * 
   * *For any* HackerOne API response containing activity statistics, the extracted 
   * values for resolved reports, total bounties paid, and hackers thanked SHALL 
   * match the API values.
   * 
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  describe('Property 4: Activity Statistics Extraction Accuracy', () => {
    it('should extract all activity statistics accurately', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 10000 }),    // resolved_report_count
          fc.nat({ max: 10000000 }), // total_bounties_paid_amount
          fc.nat({ max: 5000 }),     // hackers_thanked_count
          (resolvedCount: number, totalBounties: number, hackersThanked: number) => {
            const node = {
              resolved_report_count: resolvedCount,
              total_bounties_paid_amount: totalBounties,
              hackers_thanked_count: hackersThanked,
            };

            const result = service.extractActivityStats(node);
            
            if (result === null) return false;
            
            // Verify all values match exactly
            if (result.resolvedReportCount !== resolvedCount) return false;
            if (result.totalBountiesPaid !== totalBounties) return false;
            if (result.hackersThanked !== hackersThanked) return false;
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract resolved report count accurately', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 10000 }),
          (count: number) => {
            const node = {
              resolved_report_count: count,
            };

            const result = service.extractActivityStats(node);
            
            if (result === null) return false;
            return result.resolvedReportCount === count;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract total bounties paid accurately', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 10000000 }),
          (amount: number) => {
            const node = {
              total_bounties_paid_amount: amount,
            };

            const result = service.extractActivityStats(node);
            
            if (result === null) return false;
            return result.totalBountiesPaid === amount;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract hackers thanked count accurately', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 5000 }),
          (count: number) => {
            const node = {
              hackers_thanked_count: count,
            };

            const result = service.extractActivityStats(node);
            
            if (result === null) return false;
            return result.hackersThanked === count;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle zero values correctly (not treat as missing)', () => {
      fc.assert(
        fc.property(fc.constant(0), () => {
          const node = {
            resolved_report_count: 0,
            total_bounties_paid_amount: 0,
            hackers_thanked_count: 0,
          };

          const result = service.extractActivityStats(node);
          
          // Result should not be null when we have explicit zero values
          if (result === null) return false;
          
          // Zero values should be preserved, not converted to null
          if (result.resolvedReportCount !== 0) return false;
          if (result.totalBountiesPaid !== 0) return false;
          if (result.hackersThanked !== 0) return false;
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
