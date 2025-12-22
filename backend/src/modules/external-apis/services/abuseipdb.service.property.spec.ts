import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import {
  AbuseIPDBService,
  AbuseIPDBApiResponse,
} from './abuseipdb.service';
import { AbuseIPDBResult } from '../../../schemas/abuseipdb-result.schema';

/**
 * Property-Based Tests for AbuseIPDBService
 *
 * These tests verify the correctness properties defined in the design document
 * for the advanced-recon-monitoring feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// In-memory store for mock database
let mockResults: Map<string, any>;

// Helper to create a mock document with Mongoose-like behavior
const createMockDocument = (data: any): any => {
  const id = data._id || new Types.ObjectId();
  const doc = {
    _id: id,
    ...data,
    toObject: function () {
      return { ...this };
    },
  };
  return doc;
};

// Arbitraries for generating test data
const ipv4Arb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

const countryCodeArb = fc.string({ minLength: 2, maxLength: 2 })
  .filter((s) => /^[A-Z]{2}$/.test(s))
  .map((s) => s.toUpperCase());

const ispArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

const domainArb = fc.tuple(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9]+$/.test(s)),
  fc.constantFrom('com', 'net', 'org', 'io', 'co'),
).map(([name, tld]) => `${name}.${tld}`);

const abuseScoreArb = fc.integer({ min: 0, max: 100 });

const totalReportsArb = fc.integer({ min: 0, max: 100000 });

const dateStringArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
  .filter((d) => !isNaN(d.getTime()))
  .map((d) => d.toISOString());

const abuseIPDBApiResponseArb: fc.Arbitrary<AbuseIPDBApiResponse> = fc.record({
  data: fc.record({
    ipAddress: ipv4Arb,
    isPublic: fc.boolean(),
    abuseConfidenceScore: abuseScoreArb,
    countryCode: countryCodeArb,
    isp: ispArb,
    domain: domainArb,
    totalReports: totalReportsArb,
    lastReportedAt: fc.option(dateStringArb, { nil: null }),
    isWhitelisted: fc.boolean(),
  }),
});

describe('AbuseIPDBService Property-Based Tests', () => {
  let service: AbuseIPDBService;

  beforeEach(async () => {
    mockResults = new Map();

    const mockModel = {
      create: jest.fn().mockImplementation((data: any) => {
        const doc = createMockDocument(data);
        mockResults.set(doc._id.toString(), doc);
        return Promise.resolve(doc);
      }),
      find: jest.fn().mockImplementation((query: any = {}) => {
        let results = Array.from(mockResults.values());

        if (query.ipAddress) {
          results = results.filter((doc) => doc.ipAddress === query.ipAddress);
        }
        if (query.subdomainId) {
          results = results.filter(
            (doc) => doc.subdomainId?.toString() === query.subdomainId.toString(),
          );
        }
        if (query.domainId) {
          results = results.filter(
            (doc) => doc.domainId?.toString() === query.domainId.toString(),
          );
        }

        return {
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(results),
          }),
        };
      }),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-api-key'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbuseIPDBService,
        {
          provide: getModelToken(AbuseIPDBResult.name),
          useValue: mockModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AbuseIPDBService>(AbuseIPDBService);
  });

  afterEach(() => {
    mockResults.clear();
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 1: AbuseIPDB Response Parsing**
   *
   * *For any* valid AbuseIPDB API response, parsing the response SHALL extract
   * and return all required fields (abuseConfidenceScore, countryCode, isp,
   * totalReports) with correct types.
   *
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: AbuseIPDB Response Parsing', () => {
    it('should extract all required fields with correct types from API response', async () => {
      await fc.assert(
        fc.asyncProperty(abuseIPDBApiResponseArb, async (apiResponse) => {
          const parsed = service.parseApiResponse(apiResponse);

          // Verify ipAddress is extracted correctly
          if (parsed.ipAddress !== apiResponse.data.ipAddress) return false;

          // Verify abuseConfidenceScore is extracted correctly and is a number
          if (typeof parsed.abuseConfidenceScore !== 'number') return false;
          if (parsed.abuseConfidenceScore !== apiResponse.data.abuseConfidenceScore) return false;

          // Verify countryCode is extracted correctly
          if (parsed.countryCode !== apiResponse.data.countryCode) return false;

          // Verify isp is extracted correctly
          if (parsed.isp !== apiResponse.data.isp) return false;

          // Verify totalReports is extracted correctly and is a number
          if (typeof parsed.totalReports !== 'number') return false;
          if (parsed.totalReports !== apiResponse.data.totalReports) return false;

          // Verify isPublic is extracted correctly
          if (parsed.isPublic !== apiResponse.data.isPublic) return false;

          // Verify domain is extracted correctly
          if (parsed.domain !== apiResponse.data.domain) return false;

          // Verify isWhitelisted is extracted correctly
          if (parsed.isWhitelisted !== apiResponse.data.isWhitelisted) return false;

          // Verify lastReportedAt is converted to Date or null
          if (apiResponse.data.lastReportedAt === null) {
            if (parsed.lastReportedAt !== null) return false;
          } else {
            if (!(parsed.lastReportedAt instanceof Date)) return false;
            const expectedDate = new Date(apiResponse.data.lastReportedAt);
            if (parsed.lastReportedAt.getTime() !== expectedDate.getTime()) return false;
          }

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('should handle null lastReportedAt correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          abuseIPDBApiResponseArb.map((response) => ({
            ...response,
            data: { ...response.data, lastReportedAt: null },
          })),
          async (apiResponse) => {
            const parsed = service.parseApiResponse(apiResponse);
            return parsed.lastReportedAt === null;
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  /**
   * **Feature: advanced-recon-monitoring, Property 2: AbuseIPDB Result Persistence**
   *
   * *For any* AbuseIPDB lookup result, storing the result SHALL create a database
   * record with correct subdomain/domain association that can be retrieved.
   *
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: AbuseIPDB Result Persistence', () => {
    it('should store result with correct subdomain association and retrieve it', async () => {
      await fc.assert(
        fc.asyncProperty(abuseIPDBApiResponseArb, async (apiResponse) => {
          const parsed = service.parseApiResponse(apiResponse);
          const subdomainId = new Types.ObjectId();

          // Store the result
          const stored = await service.storeResult(parsed, { subdomainId });

          // Verify stored document has correct fields
          if (stored.ipAddress !== parsed.ipAddress) return false;
          if (stored.abuseConfidenceScore !== parsed.abuseConfidenceScore) return false;
          if (stored.countryCode !== parsed.countryCode) return false;
          if (stored.isp !== parsed.isp) return false;
          if (stored.totalReports !== parsed.totalReports) return false;
          if (stored.subdomainId?.toString() !== subdomainId.toString()) return false;

          // Retrieve and verify
          const retrieved = await service.getResultsForSubdomain(subdomainId);
          if (retrieved.length !== 1) return false;
          if (retrieved[0].ipAddress !== parsed.ipAddress) return false;

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('should store result with correct domain association and retrieve it', async () => {
      await fc.assert(
        fc.asyncProperty(abuseIPDBApiResponseArb, async (apiResponse) => {
          // Clear previous results
          mockResults.clear();

          const parsed = service.parseApiResponse(apiResponse);
          const domainId = new Types.ObjectId();

          // Store the result
          const stored = await service.storeResult(parsed, { domainId });

          // Verify stored document has correct domain association
          if (stored.domainId?.toString() !== domainId.toString()) return false;

          // Retrieve and verify
          const retrieved = await service.getResultsForDomain(domainId);
          if (retrieved.length !== 1) return false;
          if (retrieved[0].ipAddress !== parsed.ipAddress) return false;

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('should store result retrievable by IP address', async () => {
      await fc.assert(
        fc.asyncProperty(abuseIPDBApiResponseArb, async (apiResponse) => {
          // Clear previous results
          mockResults.clear();

          const parsed = service.parseApiResponse(apiResponse);

          // Store the result
          await service.storeResult(parsed);

          // Retrieve by IP and verify
          const retrieved = await service.getResultsForIP(parsed.ipAddress);
          if (retrieved.length !== 1) return false;
          if (retrieved[0].abuseConfidenceScore !== parsed.abuseConfidenceScore) return false;

          return true;
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 3: Abuse Score Threshold Alerting**
   *
   * *For any* IP with an abuse confidence score and any configured threshold,
   * an alert SHALL be triggered if and only if the score exceeds the threshold.
   *
   * **Validates: Requirements 1.3**
   */
  describe('Property 3: Abuse Score Threshold Alerting', () => {
    it('should return true when score exceeds threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          abuseScoreArb,
          fc.integer({ min: 0, max: 99 }),
          async (score, threshold) => {
            // Only test when score > threshold
            fc.pre(score > threshold);
            return service.exceedsThreshold(score, threshold) === true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return false when score does not exceed threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          abuseScoreArb,
          fc.integer({ min: 0, max: 100 }),
          async (score, threshold) => {
            // Only test when score <= threshold
            fc.pre(score <= threshold);
            return service.exceedsThreshold(score, threshold) === false;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly determine threshold crossing for any score/threshold pair', async () => {
      await fc.assert(
        fc.asyncProperty(
          abuseScoreArb,
          fc.integer({ min: 0, max: 100 }),
          async (score, threshold) => {
            const result = service.exceedsThreshold(score, threshold);
            const expected = score > threshold;
            return result === expected;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
