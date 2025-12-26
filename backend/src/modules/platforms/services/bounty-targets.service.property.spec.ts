import * as fc from 'fast-check';
import { BountyTargetsService, BountyTargetsProgram, BountyTargetsScope } from './bounty-targets.service';

/**
 * Property-Based Tests for BountyTargetsService
 * 
 * These tests verify the correctness properties defined in the design document
 * for the bounty-data-sources feature.
 * 
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

describe('BountyTargetsService Property-Based Tests', () => {
  let service: BountyTargetsService;

  beforeEach(() => {
    service = new BountyTargetsService();
  });

  /**
   * **Feature: bounty-data-sources, Property 2: Data Transformation Preserves Source Information**
   * 
   * *For any* valid source data (bounty-targets program), transforming it to the internal format 
   * should preserve all essential fields: name, URL, bounty status, and scope targets should be 
   * extractable from the transformed result.
   * 
   * **Validates: Requirements 2.7**
   */
  describe('Property 2: Data Transformation Preserves Source Information (bounty-targets)', () => {
    
    // Arbitrary for generating scope targets
    const scopeTargetArb = fc.record({
      asset_type: fc.constantFrom('URL', 'WILDCARD', 'API', 'CIDR', 'OTHER'),
      asset_identifier: fc.oneof(
        fc.webUrl(),
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `*.${s}.com`),
        fc.string({ minLength: 1, maxLength: 50 })
      ),
      eligible_for_bounty: fc.boolean(),
      instruction: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
    });

    // Arbitrary for generating HackerOne raw data
    const hackerOneRawDataArb = fc.record({
      id: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
      handle: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      url: fc.option(fc.webUrl(), { nil: undefined }),
      offers_bounties: fc.boolean(),
      offers_swag: fc.boolean(),
      targets: fc.record({
        in_scope: fc.array(scopeTargetArb, { minLength: 0, maxLength: 10 }),
        out_of_scope: fc.array(scopeTargetArb, { minLength: 0, maxLength: 5 }),
      }),
    });

    // Arbitrary for generating Bugcrowd scope targets
    const bugcrowdScopeArb = fc.record({
      type: fc.constantFrom('website', 'api', 'android', 'ios', 'other'),
      target: fc.oneof(
        fc.webUrl(),
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `*.${s}.com`),
        fc.string({ minLength: 1, maxLength: 50 })
      ),
    });

    // Arbitrary for generating Bugcrowd raw data
    const bugcrowdRawDataArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      url: fc.option(fc.webUrl(), { nil: undefined }),
      targets: fc.record({
        in_scope: fc.array(bugcrowdScopeArb, { minLength: 0, maxLength: 10 }),
        out_of_scope: fc.array(bugcrowdScopeArb, { minLength: 0, maxLength: 5 }),
      }),
    });

    // Arbitrary for generating Intigriti scope targets
    const intigritiScopeArb = fc.record({
      type: fc.constantFrom('url', 'api', 'mobile', 'other'),
      endpoint: fc.oneof(
        fc.webUrl(),
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `*.${s}.com`),
        fc.string({ minLength: 1, maxLength: 50 })
      ),
    });

    // Arbitrary for generating Intigriti raw data
    const intigritiRawDataArb = fc.record({
      company_handle: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      url: fc.option(fc.webUrl(), { nil: undefined }),
      max_bounty: fc.option(fc.nat({ max: 100000 }), { nil: undefined }),
      min_bounty: fc.option(fc.nat({ max: 10000 }), { nil: undefined }),
      targets: fc.record({
        in_scope: fc.array(intigritiScopeArb, { minLength: 0, maxLength: 10 }),
        out_of_scope: fc.array(intigritiScopeArb, { minLength: 0, maxLength: 5 }),
      }),
    });

    // Arbitrary for generating YesWeHack scope
    const yeswehackScopeArb = fc.record({
      scope_type: fc.constantFrom('web-application', 'api', 'mobile', 'other'),
      scope: fc.oneof(
        fc.webUrl(),
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `*.${s}.com`),
        fc.string({ minLength: 1, maxLength: 50 })
      ),
    });

    // Arbitrary for generating YesWeHack raw data
    const yeswehackRawDataArb = fc.record({
      slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
      title: fc.string({ minLength: 1, maxLength: 100 }),
      url: fc.option(fc.webUrl(), { nil: undefined }),
      max_bounty: fc.option(fc.nat({ max: 100000 }), { nil: undefined }),
      min_bounty: fc.option(fc.nat({ max: 10000 }), { nil: undefined }),
      scopes: fc.array(yeswehackScopeArb, { minLength: 0, maxLength: 10 }),
    });

    // Arbitrary for generating Federacy scope
    const federacyScopeArb = fc.record({
      type: fc.constantFrom('website', 'api', 'other'),
      target: fc.oneof(
        fc.webUrl(),
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `*.${s}.com`),
        fc.string({ minLength: 1, maxLength: 50 })
      ),
    });

    // Arbitrary for generating Federacy raw data
    const federacyRawDataArb = fc.record({
      slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      url: fc.option(fc.webUrl(), { nil: undefined }),
      targets: fc.record({
        in_scope: fc.array(federacyScopeArb, { minLength: 0, maxLength: 10 }),
      }),
    });

    describe('HackerOne Data Transformation', () => {
      it('should preserve program name in transformation', () => {
        fc.assert(
          fc.property(hackerOneRawDataArb, (rawData) => {
            const result = service.transformHackerOneData([rawData]);
            return result.length === 1 && result[0].name === rawData.name;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve handle in transformation', () => {
        fc.assert(
          fc.property(hackerOneRawDataArb, (rawData) => {
            const result = service.transformHackerOneData([rawData]);
            return result.length === 1 && result[0].handle === rawData.handle;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve bounty status in transformation', () => {
        fc.assert(
          fc.property(hackerOneRawDataArb, (rawData) => {
            const result = service.transformHackerOneData([rawData]);
            return result.length === 1 && result[0].offersBounties === (rawData.offers_bounties || false);
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve in-scope target count', () => {
        fc.assert(
          fc.property(hackerOneRawDataArb, (rawData) => {
            const result = service.transformHackerOneData([rawData]);
            const expectedCount = rawData.targets?.in_scope?.length || 0;
            return result.length === 1 && result[0].inScope.length === expectedCount;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve out-of-scope target count', () => {
        fc.assert(
          fc.property(hackerOneRawDataArb, (rawData) => {
            const result = service.transformHackerOneData([rawData]);
            const expectedCount = rawData.targets?.out_of_scope?.length || 0;
            return result.length === 1 && result[0].outOfScope.length === expectedCount;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve scope target identifiers', () => {
        fc.assert(
          fc.property(hackerOneRawDataArb, (rawData) => {
            const result = service.transformHackerOneData([rawData]);
            if (result.length !== 1) return false;
            
            const inScopeTargets = rawData.targets?.in_scope || [];
            for (let i = 0; i < inScopeTargets.length; i++) {
              if (result[0].inScope[i].target !== inScopeTargets[i].asset_identifier) {
                return false;
              }
            }
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should set platform to hackerone', () => {
        fc.assert(
          fc.property(hackerOneRawDataArb, (rawData) => {
            const result = service.transformHackerOneData([rawData]);
            return result.length === 1 && result[0].platform === 'hackerone';
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Bugcrowd Data Transformation', () => {
      it('should preserve program name in transformation', () => {
        fc.assert(
          fc.property(bugcrowdRawDataArb, (rawData) => {
            const result = service.transformBugcrowdData([rawData]);
            return result.length === 1 && result[0].name === rawData.name;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve in-scope target count', () => {
        fc.assert(
          fc.property(bugcrowdRawDataArb, (rawData) => {
            const result = service.transformBugcrowdData([rawData]);
            const expectedCount = rawData.targets?.in_scope?.length || 0;
            return result.length === 1 && result[0].inScope.length === expectedCount;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve scope target values', () => {
        fc.assert(
          fc.property(bugcrowdRawDataArb, (rawData) => {
            const result = service.transformBugcrowdData([rawData]);
            if (result.length !== 1) return false;
            
            const inScopeTargets = rawData.targets?.in_scope || [];
            for (let i = 0; i < inScopeTargets.length; i++) {
              if (result[0].inScope[i].target !== inScopeTargets[i].target) {
                return false;
              }
            }
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should set platform to bugcrowd', () => {
        fc.assert(
          fc.property(bugcrowdRawDataArb, (rawData) => {
            const result = service.transformBugcrowdData([rawData]);
            return result.length === 1 && result[0].platform === 'bugcrowd';
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Intigriti Data Transformation', () => {
      it('should preserve program name in transformation', () => {
        fc.assert(
          fc.property(intigritiRawDataArb, (rawData) => {
            const result = service.transformIntigritiData([rawData]);
            return result.length === 1 && result[0].name === rawData.name;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve handle (company_handle) in transformation', () => {
        fc.assert(
          fc.property(intigritiRawDataArb, (rawData) => {
            const result = service.transformIntigritiData([rawData]);
            return result.length === 1 && result[0].handle === rawData.company_handle;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve max bounty in transformation', () => {
        fc.assert(
          fc.property(intigritiRawDataArb, (rawData) => {
            const result = service.transformIntigritiData([rawData]);
            return result.length === 1 && result[0].maxBounty === (rawData.max_bounty ?? null);
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve in-scope target count', () => {
        fc.assert(
          fc.property(intigritiRawDataArb, (rawData) => {
            const result = service.transformIntigritiData([rawData]);
            const expectedCount = rawData.targets?.in_scope?.length || 0;
            return result.length === 1 && result[0].inScope.length === expectedCount;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve scope endpoint values', () => {
        fc.assert(
          fc.property(intigritiRawDataArb, (rawData) => {
            const result = service.transformIntigritiData([rawData]);
            if (result.length !== 1) return false;
            
            const inScopeTargets = rawData.targets?.in_scope || [];
            for (let i = 0; i < inScopeTargets.length; i++) {
              if (result[0].inScope[i].target !== inScopeTargets[i].endpoint) {
                return false;
              }
            }
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should set platform to intigriti', () => {
        fc.assert(
          fc.property(intigritiRawDataArb, (rawData) => {
            const result = service.transformIntigritiData([rawData]);
            return result.length === 1 && result[0].platform === 'intigriti';
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('YesWeHack Data Transformation', () => {
      it('should preserve program title as name in transformation', () => {
        fc.assert(
          fc.property(yeswehackRawDataArb, (rawData) => {
            const result = service.transformYesWeHackData([rawData]);
            return result.length === 1 && result[0].name === rawData.title;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve slug as handle in transformation', () => {
        fc.assert(
          fc.property(yeswehackRawDataArb, (rawData) => {
            const result = service.transformYesWeHackData([rawData]);
            return result.length === 1 && result[0].handle === rawData.slug;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve scope count (from scopes array)', () => {
        fc.assert(
          fc.property(yeswehackRawDataArb, (rawData) => {
            const result = service.transformYesWeHackData([rawData]);
            const expectedCount = rawData.scopes?.length || 0;
            return result.length === 1 && result[0].inScope.length === expectedCount;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve scope values', () => {
        fc.assert(
          fc.property(yeswehackRawDataArb, (rawData) => {
            const result = service.transformYesWeHackData([rawData]);
            if (result.length !== 1) return false;
            
            const scopes = rawData.scopes || [];
            for (let i = 0; i < scopes.length; i++) {
              if (result[0].inScope[i].target !== scopes[i].scope) {
                return false;
              }
            }
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should set platform to yeswehack', () => {
        fc.assert(
          fc.property(yeswehackRawDataArb, (rawData) => {
            const result = service.transformYesWeHackData([rawData]);
            return result.length === 1 && result[0].platform === 'yeswehack';
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Federacy Data Transformation', () => {
      it('should preserve program name in transformation', () => {
        fc.assert(
          fc.property(federacyRawDataArb, (rawData) => {
            const result = service.transformFederacyData([rawData]);
            return result.length === 1 && result[0].name === rawData.name;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve slug as handle in transformation', () => {
        fc.assert(
          fc.property(federacyRawDataArb, (rawData) => {
            const result = service.transformFederacyData([rawData]);
            return result.length === 1 && result[0].handle === rawData.slug;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve in-scope target count', () => {
        fc.assert(
          fc.property(federacyRawDataArb, (rawData) => {
            const result = service.transformFederacyData([rawData]);
            const expectedCount = rawData.targets?.in_scope?.length || 0;
            return result.length === 1 && result[0].inScope.length === expectedCount;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve scope target values', () => {
        fc.assert(
          fc.property(federacyRawDataArb, (rawData) => {
            const result = service.transformFederacyData([rawData]);
            if (result.length !== 1) return false;
            
            const inScopeTargets = rawData.targets?.in_scope || [];
            for (let i = 0; i < inScopeTargets.length; i++) {
              if (result[0].inScope[i].target !== inScopeTargets[i].target) {
                return false;
              }
            }
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should set platform to federacy', () => {
        fc.assert(
          fc.property(federacyRawDataArb, (rawData) => {
            const result = service.transformFederacyData([rawData]);
            return result.length === 1 && result[0].platform === 'federacy';
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Cross-Platform Scope Extraction Properties', () => {
      it('should always produce valid BountyTargetsScope objects with required fields', () => {
        fc.assert(
          fc.property(hackerOneRawDataArb, (rawData) => {
            const result = service.transformHackerOneData([rawData]);
            if (result.length !== 1) return false;
            
            // Check all in-scope items have required fields
            for (const scope of result[0].inScope) {
              if (typeof scope.type !== 'string' || typeof scope.target !== 'string') {
                return false;
              }
            }
            
            // Check all out-of-scope items have required fields
            for (const scope of result[0].outOfScope) {
              if (typeof scope.type !== 'string' || typeof scope.target !== 'string') {
                return false;
              }
            }
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should filter out invalid entries (missing required fields)', () => {
        // Test with invalid data that should be filtered
        const invalidData = [
          { handle: 'valid', name: 'Valid' },
          { handle: '', name: 'Invalid Empty Handle' },
          { handle: 'another', name: '' },
          { name: 'Missing Handle' },
          { handle: 'missing-name' },
          null,
          undefined,
        ];

        const result = service.transformHackerOneData(invalidData as any);
        
        // Should only include the first valid entry
        expect(result.length).toBe(1);
        expect(result[0].handle).toBe('valid');
      });
    });
  });
});
