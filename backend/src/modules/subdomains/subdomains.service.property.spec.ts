import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SubdomainsService } from './subdomains.service';
import { Subdomain } from '../../schemas/subdomain.schema';
import { Domain } from '../../schemas/domain.schema';
import { Endpoint } from '../../schemas/endpoint.schema';

/**
 * Property-Based Tests for SubdomainsService
 *
 * These tests verify the correctness properties defined in the design document
 * for the advanced-recon-monitoring feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// Arbitraries for generating test data
const domainLabelArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));

const tldArb = fc.constantFrom('com', 'net', 'org', 'io', 'co');

const subdomainNameArb = fc.tuple(
  fc.array(domainLabelArb, { minLength: 0, maxLength: 2 }),
  domainLabelArb,
  tldArb,
).map(([subs, name, tld]) => {
  if (subs.length === 0) {
    return `${name}.${tld}`;
  }
  return `${subs.join('.')}.${name}.${tld}`;
});

const ipAddressArb = fc.tuple(
  fc.integer({ min: 1, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

const httpStatusArb = fc.integer({ min: 100, max: 599 });

const technologyArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z0-9._-]+$/.test(s));

const technologiesArb = fc.array(technologyArb, { minLength: 0, maxLength: 10 })
  .map(arr => [...new Set(arr)]);

// Subdomain data arbitrary
const subdomainDataArb = fc.record({
  subdomain: subdomainNameArb,
  isAlive: fc.boolean(),
  httpStatus: fc.option(httpStatusArb, { nil: undefined }),
  ip: fc.array(ipAddressArb, { minLength: 0, maxLength: 3 }),
  technologies: technologiesArb,
});

describe('SubdomainsService Property-Based Tests', () => {
  /**
   * **Feature: advanced-recon-monitoring, Property 11: Live Subdomain Filtering**
   *
   * *For any* collection of subdomains with mixed isAlive values, filtering for
   * live subdomains SHALL return exactly those where isAlive equals true.
   *
   * **Validates: Requirements 5.2**
   */
  describe('Property 11: Live Subdomain Filtering', () => {
    // Create mock service with filtering support
    const createFilteringMockService = (subdomains: any[]): SubdomainsService => {
      const mockSubdomainModel = {
        find: jest.fn().mockImplementation((query: any) => {
          let filtered = [...subdomains];
          
          // Apply isAlive filter
          if (query.isAlive !== undefined) {
            filtered = filtered.filter(s => s.isAlive === query.isAlive);
          }
          
          return {
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(filtered),
          };
        }),
        countDocuments: jest.fn().mockImplementation((query: any) => {
          let filtered = [...subdomains];
          
          if (query.isAlive !== undefined) {
            filtered = filtered.filter(s => s.isAlive === query.isAlive);
          }
          
          return Promise.resolve(filtered.length);
        }),
      };

      const mockDomainModel = {
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([]),
        }),
        findByIdAndUpdate: jest.fn().mockResolvedValue(null),
      };

      const mockEndpointModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([]),
        }),
        countDocuments: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      };

      const service = Object.create(SubdomainsService.prototype);
      (service as any).subdomainModel = mockSubdomainModel;
      (service as any).domainModel = mockDomainModel;
      (service as any).endpointModel = mockEndpointModel;
      
      return service;
    };

    it('should return only live subdomains when isAlive=true filter is applied', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(subdomainDataArb, { minLength: 1, maxLength: 30 }),
          async (subdomains) => {
            const mockService = createFilteringMockService(subdomains);
            
            const result = await mockService.findAll({ isAlive: true });
            
            // All returned subdomains should have isAlive = true
            for (const sub of result.data) {
              if (sub.isAlive !== true) return false;
            }
            
            // Count should match expected
            const expectedCount = subdomains.filter(s => s.isAlive === true).length;
            if (result.data.length !== expectedCount) return false;
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return only dead subdomains when isAlive=false filter is applied', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(subdomainDataArb, { minLength: 1, maxLength: 30 }),
          async (subdomains) => {
            const mockService = createFilteringMockService(subdomains);
            
            const result = await mockService.findAll({ isAlive: false });
            
            // All returned subdomains should have isAlive = false
            for (const sub of result.data) {
              if (sub.isAlive !== false) return false;
            }
            
            // Count should match expected
            const expectedCount = subdomains.filter(s => s.isAlive === false).length;
            if (result.data.length !== expectedCount) return false;
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return all subdomains when no isAlive filter is applied', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(subdomainDataArb, { minLength: 1, maxLength: 30 }),
          async (subdomains) => {
            const mockService = createFilteringMockService(subdomains);
            
            const result = await mockService.findAll({});
            
            // Should return all subdomains
            if (result.data.length !== subdomains.length) return false;
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should partition subdomains correctly between live and dead', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(subdomainDataArb, { minLength: 1, maxLength: 30 }),
          async (subdomains) => {
            const mockService = createFilteringMockService(subdomains);
            
            const liveResult = await mockService.findAll({ isAlive: true });
            const deadResult = await mockService.findAll({ isAlive: false });
            
            // Live + Dead should equal total
            const totalExpected = subdomains.length;
            const totalActual = liveResult.data.length + deadResult.data.length;
            
            if (totalActual !== totalExpected) return false;
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return empty array when filtering for live but all are dead', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(subdomainDataArb, { minLength: 1, maxLength: 20 }),
          async (subdomains) => {
            // Make all subdomains dead
            const allDeadSubdomains = subdomains.map(s => ({ ...s, isAlive: false }));
            const mockService = createFilteringMockService(allDeadSubdomains);
            
            const result = await mockService.findAll({ isAlive: true });
            
            return result.data.length === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return empty array when filtering for dead but all are live', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(subdomainDataArb, { minLength: 1, maxLength: 20 }),
          async (subdomains) => {
            // Make all subdomains live
            const allLiveSubdomains = subdomains.map(s => ({ ...s, isAlive: true }));
            const mockService = createFilteringMockService(allLiveSubdomains);
            
            const result = await mockService.findAll({ isAlive: false });
            
            return result.data.length === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve subdomain data integrity when filtering', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(subdomainDataArb, { minLength: 1, maxLength: 20 })
            .map(arr => {
              // Ensure unique subdomain names by using a Map
              const uniqueMap = new Map<string, any>();
              arr.forEach(s => uniqueMap.set(s.subdomain, s));
              return Array.from(uniqueMap.values());
            }),
          async (subdomains) => {
            // Skip if no subdomains after deduplication
            fc.pre(subdomains.length > 0);
            
            const mockService = createFilteringMockService(subdomains);
            
            const result = await mockService.findAll({ isAlive: true });
            
            // Each returned subdomain should have all its original data
            for (const returnedSub of result.data) {
              const original = subdomains.find(s => s.subdomain === returnedSub.subdomain);
              if (!original) return false;
              
              // Verify key fields are preserved
              if (returnedSub.isAlive !== original.isAlive) return false;
              if (returnedSub.httpStatus !== original.httpStatus) return false;
              if (JSON.stringify(returnedSub.ip) !== JSON.stringify(original.ip)) return false;
              if (JSON.stringify(returnedSub.technologies) !== JSON.stringify(original.technologies)) return false;
            }
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
