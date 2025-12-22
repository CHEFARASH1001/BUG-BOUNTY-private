import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { HttpServicesService } from './http-services.service';
import { HttpService as HttpServiceSchema } from '../../schemas/http-service.schema';
import { Live } from '../../schemas/live.schema';

/**
 * Property-Based Tests for HttpServicesService
 *
 * These tests verify the correctness properties defined in the design document
 * for the advanced-recon-monitoring feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// In-memory store for mock database
let mockHttpServices: Map<string, any>;

// Helper to create a mock document with Mongoose-like behavior
const createMockDocument = (data: any): any => {
  const id = data._id || new Types.ObjectId();
  const doc = {
    _id: id,
    ...data,
    save: jest.fn().mockImplementation(function(this: any) {
      mockHttpServices.set(this.url, this);
      return Promise.resolve(this);
    }),
    toObject: function () {
      return { ...this };
    },
  };
  return doc;
};

// Arbitraries for generating test data
const statusCodeArb = fc.integer({ min: 100, max: 599 });

const titleArb = fc.string({ minLength: 0, maxLength: 100 })
  .filter(s => !s.includes('\n') && !s.includes('\r'));

const technologyArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z0-9._-]+$/.test(s));

const technologiesArb = fc.array(technologyArb, { minLength: 0, maxLength: 10 })
  .map(arr => [...new Set(arr)]);

const hexCharArb = fc.constantFrom(
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'a', 'b', 'c', 'd', 'e', 'f'
);

const hashArb = fc.array(hexCharArb, { minLength: 32, maxLength: 32 })
  .map(chars => chars.join(''));

const domainLabelArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));

const tldArb = fc.constantFrom('com', 'net', 'org', 'io', 'co');

const subdomainArb = fc.tuple(
  fc.array(domainLabelArb, { minLength: 0, maxLength: 2 }),
  domainLabelArb,
  tldArb,
).map(([subs, name, tld]) => {
  if (subs.length === 0) {
    return `${name}.${tld}`;
  }
  return `${subs.join('.')}.${name}.${tld}`;
});

const protocolArb = fc.constantFrom('http://', 'https://');

const urlArb = fc.tuple(protocolArb, subdomainArb)
  .map(([protocol, domain]) => `${protocol}${domain}`);

const contentLengthArb = fc.integer({ min: 0, max: 10000000 });

const contentTypeArb = fc.constantFrom('text/html', 'application/json', 'text/plain', 'text/css');

const webServerArb = fc.constantFrom('nginx', 'Apache', 'cloudflare', 'Microsoft-IIS', '');

const headerKeyArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z0-9-]+$/.test(s));

const headerValueArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => !s.includes('\n') && !s.includes('\r'));

const headersArb = fc.dictionary(headerKeyArb, headerValueArb, { minKeys: 0, maxKeys: 10 });

// HTTP service data arbitrary
const httpServiceDataArb = fc.record({
  url: urlArb,
  subdomain: subdomainArb,
  statusCode: statusCodeArb,
  title: titleArb,
  contentLength: contentLengthArb,
  contentType: contentTypeArb,
  webServer: webServerArb,
  technologies: technologiesArb,
  headers: headersArb,
  faviconHash: fc.option(hashArb, { nil: undefined }),
  bodyHash: fc.option(hashArb, { nil: undefined }),
});

describe('HttpServicesService Property-Based Tests', () => {
  let service: HttpServicesService;

  beforeEach(async () => {
    mockHttpServices = new Map();

    const mockHttpServiceModel = {
      create: jest.fn().mockImplementation((data: any) => {
        const doc = createMockDocument(data);
        mockHttpServices.set(doc.url, doc);
        return Promise.resolve(doc);
      }),
      findOne: jest.fn().mockImplementation((query: any) => {
        if (query.url) {
          const existingDoc = mockHttpServices.get(query.url);
          if (existingDoc) {
            // Return a document with save method
            return Promise.resolve(existingDoc);
          }
        }
        return Promise.resolve(null);
      }),
      find: jest.fn().mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(Array.from(mockHttpServices.values())),
      })),
      countDocuments: jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(mockHttpServices.size),
      })),
    };

    const mockLiveModel = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpServicesService,
        {
          provide: getModelToken(HttpServiceSchema.name),
          useValue: mockHttpServiceModel,
        },
        {
          provide: getModelToken(Live.name),
          useValue: mockLiveModel,
        },
      ],
    }).compile();

    service = module.get<HttpServicesService>(HttpServicesService);
  });

  afterEach(() => {
    mockHttpServices.clear();
  });


  /**
   * **Feature: advanced-recon-monitoring, Property 13: HTTP Probe Result Storage**
   *
   * *For any* HTTP probe result, storing it SHALL persist all metadata fields
   * (faviconHash, headers, technologies, statusCode, title) retrievably.
   *
   * **Validates: Requirements 6.2**
   */
  describe('Property 13: HTTP Probe Result Storage', () => {
    it('should store and retrieve all metadata fields correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpServiceDataArb,
          async (serviceData) => {
            // Clear previous data
            mockHttpServices.clear();

            // Extract domain from subdomain
            const parts = serviceData.subdomain.split('.');
            const domain = parts.length > 2 
              ? parts.slice(-2).join('.') 
              : serviceData.subdomain;

            // Store the HTTP service
            const { doc } = await service.upsertHttpService({
              url: serviceData.url,
              subdomain: serviceData.subdomain,
              domain,
              statusCode: serviceData.statusCode,
              title: serviceData.title,
              contentLength: serviceData.contentLength,
              contentType: serviceData.contentType,
              webServer: serviceData.webServer,
              technologies: serviceData.technologies,
              headers: serviceData.headers,
              faviconHash: serviceData.faviconHash,
              bodyHash: serviceData.bodyHash,
            });

            // Verify all fields are stored correctly
            if (doc.url !== serviceData.url) return false;
            if (doc.subdomain !== serviceData.subdomain) return false;
            if (doc.statusCode !== serviceData.statusCode) return false;
            if (doc.title !== serviceData.title) return false;
            if (doc.contentLength !== serviceData.contentLength) return false;
            if (doc.contentType !== serviceData.contentType) return false;
            if (doc.webServer !== serviceData.webServer) return false;

            // Verify technologies array
            if (JSON.stringify(doc.technologies?.sort()) !== JSON.stringify(serviceData.technologies?.sort())) {
              return false;
            }

            // Verify headers object
            if (JSON.stringify(doc.headers) !== JSON.stringify(serviceData.headers)) {
              return false;
            }

            // Verify optional fields
            if (serviceData.faviconHash !== undefined && doc.faviconHash !== serviceData.faviconHash) {
              return false;
            }
            if (serviceData.bodyHash !== undefined && doc.bodyHash !== serviceData.bodyHash) {
              return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should mark new services as fresh', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpServiceDataArb,
          async (serviceData) => {
            mockHttpServices.clear();

            const parts = serviceData.subdomain.split('.');
            const domain = parts.length > 2 
              ? parts.slice(-2).join('.') 
              : serviceData.subdomain;

            const { isNew, doc } = await service.upsertHttpService({
              url: serviceData.url,
              subdomain: serviceData.subdomain,
              domain,
              statusCode: serviceData.statusCode,
              title: serviceData.title,
            });

            // New services should be marked as fresh
            if (!isNew) return false;
            if (!doc.isFresh) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should set firstSeen and lastSeen timestamps on new services', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpServiceDataArb,
          async (serviceData) => {
            mockHttpServices.clear();

            const parts = serviceData.subdomain.split('.');
            const domain = parts.length > 2 
              ? parts.slice(-2).join('.') 
              : serviceData.subdomain;

            const beforeCreate = new Date();
            
            const { doc } = await service.upsertHttpService({
              url: serviceData.url,
              subdomain: serviceData.subdomain,
              domain,
              statusCode: serviceData.statusCode,
            });

            const afterCreate = new Date();

            // Timestamps should be set
            if (!doc.firstSeen) return false;
            if (!doc.lastSeen) return false;
            if (!doc.scannedAt) return false;

            // Timestamps should be within the test window
            if (doc.firstSeen < beforeCreate || doc.firstSeen > afterCreate) return false;
            if (doc.lastSeen < beforeCreate || doc.lastSeen > afterCreate) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve technologies array integrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpServiceDataArb,
          async (serviceData) => {
            mockHttpServices.clear();

            const parts = serviceData.subdomain.split('.');
            const domain = parts.length > 2 
              ? parts.slice(-2).join('.') 
              : serviceData.subdomain;

            const { doc } = await service.upsertHttpService({
              url: serviceData.url,
              subdomain: serviceData.subdomain,
              domain,
              technologies: serviceData.technologies,
            });

            // Technologies should be an array
            if (!Array.isArray(doc.technologies)) return false;

            // All original technologies should be present
            for (const tech of serviceData.technologies) {
              if (!doc.technologies.includes(tech)) return false;
            }

            // No extra technologies should be added
            if (doc.technologies.length !== serviceData.technologies.length) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve headers object integrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpServiceDataArb,
          async (serviceData) => {
            mockHttpServices.clear();

            const parts = serviceData.subdomain.split('.');
            const domain = parts.length > 2 
              ? parts.slice(-2).join('.') 
              : serviceData.subdomain;

            const { doc } = await service.upsertHttpService({
              url: serviceData.url,
              subdomain: serviceData.subdomain,
              domain,
              headers: serviceData.headers,
            });

            // Headers should be an object
            if (typeof doc.headers !== 'object') return false;

            // All original headers should be present with correct values
            for (const [key, value] of Object.entries(serviceData.headers)) {
              if (doc.headers[key] !== value) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 19: HTTP Service Filtering**
   *
   * *For any* collection of HTTP services and filter criteria (statusCode, technology,
   * isCdn, isFresh, change flags), filtering SHALL return exactly the services
   * matching all specified criteria.
   *
   * **Validates: Requirements 9.1, 9.2, 9.4**
   */
  describe('Property 19: HTTP Service Filtering', () => {
    // Extended HTTP service data with filtering fields
    const httpServiceWithFiltersArb = fc.record({
      url: urlArb,
      subdomain: subdomainArb,
      statusCode: statusCodeArb,
      title: titleArb,
      technologies: technologiesArb,
      isCdn: fc.boolean(),
      isFresh: fc.boolean(),
      statusCodeChanged: fc.boolean(),
      titleChanged: fc.boolean(),
      techChanged: fc.boolean(),
    });

    // Create mock service with filtering support
    const createFilteringMockService = (services: any[]): HttpServicesService => {
      const mockHttpServiceModel = {
        find: jest.fn().mockImplementation((query: any) => {
          let filtered = [...services];
          
          // Apply filters based on query
          if (query.statusCode !== undefined) {
            filtered = filtered.filter(s => s.statusCode === query.statusCode);
          }
          if (query.technologies !== undefined) {
            const techRegex = query.technologies.$regex;
            if (techRegex) {
              filtered = filtered.filter(s => 
                s.technologies?.some((t: string) => techRegex.test(t))
              );
            }
          }
          if (query.isCdn !== undefined) {
            filtered = filtered.filter(s => s.isCdn === query.isCdn);
          }
          if (query.isFresh !== undefined) {
            filtered = filtered.filter(s => s.isFresh === query.isFresh);
          }
          if (query.statusCodeChanged !== undefined) {
            filtered = filtered.filter(s => s.statusCodeChanged === query.statusCodeChanged);
          }
          if (query.titleChanged !== undefined) {
            filtered = filtered.filter(s => s.titleChanged === query.titleChanged);
          }
          if (query.techChanged !== undefined) {
            filtered = filtered.filter(s => s.techChanged === query.techChanged);
          }
          
          return {
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(filtered),
          };
        }),
        countDocuments: jest.fn().mockImplementation(() => ({
          exec: jest.fn().mockResolvedValue(services.length),
        })),
      };

      const mockLiveModel = {
        find: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      };

      const service = Object.create(HttpServicesService.prototype);
      (service as any).httpServiceModel = mockHttpServiceModel;
      (service as any).liveModel = mockLiveModel;
      (service as any).logger = { warn: jest.fn(), error: jest.fn() };
      
      return service;
    };

    it('should filter by statusCode correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(httpServiceWithFiltersArb, { minLength: 1, maxLength: 20 }),
          statusCodeArb,
          async (services, filterStatusCode) => {
            const mockService = createFilteringMockService(services);
            
            const result = await mockService.findAll({ statusCode: filterStatusCode });
            
            // All returned services should have the matching status code
            for (const svc of result) {
              if (svc.statusCode !== filterStatusCode) return false;
            }
            
            // All services with matching status code should be returned
            const expected = services.filter(s => s.statusCode === filterStatusCode);
            if (result.length !== expected.length) return false;
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should filter by isCdn correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(httpServiceWithFiltersArb, { minLength: 1, maxLength: 20 }),
          fc.boolean(),
          async (services, filterIsCdn) => {
            const mockService = createFilteringMockService(services);
            
            const result = await mockService.findAll({ isCdn: filterIsCdn });
            
            // All returned services should have the matching isCdn value
            for (const svc of result) {
              if (svc.isCdn !== filterIsCdn) return false;
            }
            
            // All services with matching isCdn should be returned
            const expected = services.filter(s => s.isCdn === filterIsCdn);
            if (result.length !== expected.length) return false;
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should filter by isFresh correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(httpServiceWithFiltersArb, { minLength: 1, maxLength: 20 }),
          fc.boolean(),
          async (services, filterIsFresh) => {
            const mockService = createFilteringMockService(services);
            
            const result = await mockService.findAll({ isFresh: filterIsFresh });
            
            // All returned services should have the matching isFresh value
            for (const svc of result) {
              if (svc.isFresh !== filterIsFresh) return false;
            }
            
            // All services with matching isFresh should be returned
            const expected = services.filter(s => s.isFresh === filterIsFresh);
            if (result.length !== expected.length) return false;
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should filter by statusCodeChanged correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(httpServiceWithFiltersArb, { minLength: 1, maxLength: 20 }),
          fc.boolean(),
          async (services, filterStatusCodeChanged) => {
            const mockService = createFilteringMockService(services);
            
            const result = await mockService.findAll({ statusCodeChanged: filterStatusCodeChanged });
            
            // All returned services should have the matching statusCodeChanged value
            for (const svc of result) {
              if (svc.statusCodeChanged !== filterStatusCodeChanged) return false;
            }
            
            // All services with matching statusCodeChanged should be returned
            const expected = services.filter(s => s.statusCodeChanged === filterStatusCodeChanged);
            if (result.length !== expected.length) return false;
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should filter by titleChanged correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(httpServiceWithFiltersArb, { minLength: 1, maxLength: 20 }),
          fc.boolean(),
          async (services, filterTitleChanged) => {
            const mockService = createFilteringMockService(services);
            
            const result = await mockService.findAll({ titleChanged: filterTitleChanged });
            
            // All returned services should have the matching titleChanged value
            for (const svc of result) {
              if (svc.titleChanged !== filterTitleChanged) return false;
            }
            
            // All services with matching titleChanged should be returned
            const expected = services.filter(s => s.titleChanged === filterTitleChanged);
            if (result.length !== expected.length) return false;
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should filter by techChanged correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(httpServiceWithFiltersArb, { minLength: 1, maxLength: 20 }),
          fc.boolean(),
          async (services, filterTechChanged) => {
            const mockService = createFilteringMockService(services);
            
            const result = await mockService.findAll({ techChanged: filterTechChanged });
            
            // All returned services should have the matching techChanged value
            for (const svc of result) {
              if (svc.techChanged !== filterTechChanged) return false;
            }
            
            // All services with matching techChanged should be returned
            const expected = services.filter(s => s.techChanged === filterTechChanged);
            if (result.length !== expected.length) return false;
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should apply multiple filters correctly (AND logic)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(httpServiceWithFiltersArb, { minLength: 1, maxLength: 20 }),
          fc.boolean(),
          fc.boolean(),
          async (services, filterIsFresh, filterIsCdn) => {
            const mockService = createFilteringMockService(services);
            
            const result = await mockService.findAll({ 
              isFresh: filterIsFresh, 
              isCdn: filterIsCdn 
            });
            
            // All returned services should match ALL filter criteria
            for (const svc of result) {
              if (svc.isFresh !== filterIsFresh) return false;
              if (svc.isCdn !== filterIsCdn) return false;
            }
            
            // All services matching ALL criteria should be returned
            const expected = services.filter(s => 
              s.isFresh === filterIsFresh && s.isCdn === filterIsCdn
            );
            if (result.length !== expected.length) return false;
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return empty array when no services match filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(httpServiceWithFiltersArb, { minLength: 0, maxLength: 10 }),
          async (services) => {
            // Create services where all have isFresh = true
            const allFreshServices = services.map(s => ({ ...s, isFresh: true }));
            const mockService = createFilteringMockService(allFreshServices);
            
            // Filter for isFresh = false should return empty
            const result = await mockService.findAll({ isFresh: false });
            
            return result.length === 0;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 20: Header Regex Matching**
   *
   * *For any* HTTP service with headers and a regex pattern, header search
   * SHALL return the service if and only if any header value matches the pattern.
   *
   * **Validates: Requirements 9.3**
   */
  describe('Property 20: Header Regex Matching', () => {
    // Create a minimal service instance for testing the pure function
    const createMinimalService = (): HttpServicesService => {
      const service = Object.create(HttpServicesService.prototype);
      (service as any).logger = { warn: jest.fn(), error: jest.fn() };
      return service;
    };

    it('should match when header value contains the pattern', async () => {
      await fc.assert(
        fc.asyncProperty(
          headersArb,
          async (headers) => {
            // Skip if no headers
            fc.pre(Object.keys(headers).length > 0);
            
            const service = createMinimalService();
            
            // Pick a random header value to search for
            const headerValues = Object.values(headers);
            const targetValue = headerValues[0];
            
            // Skip if target value is empty or too short
            fc.pre(targetValue.length >= 2);
            
            // Use a substring of the value as the pattern (escape special chars)
            const substring = targetValue.substring(0, Math.min(3, targetValue.length));
            const escapedPattern = substring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            const result = service.matchHeadersWithRegex(headers, escapedPattern);
            
            // Should match since we're searching for a substring that exists
            return result === true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not match when no header value contains the pattern', async () => {
      await fc.assert(
        fc.asyncProperty(
          headersArb,
          async (headers) => {
            const service = createMinimalService();
            
            // Use a pattern that won't match any header value
            const impossiblePattern = 'ZZZZUNMATCHABLEZZZZPATTERN12345';
            
            const result = service.matchHeadersWithRegex(headers, impossiblePattern);
            
            // Should not match
            return result === false;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return false for undefined headers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          async (pattern) => {
            const service = createMinimalService();
            
            const result = service.matchHeadersWithRegex(undefined, pattern);
            
            return result === false;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return false for empty headers object', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          async (pattern) => {
            const service = createMinimalService();
            
            const result = service.matchHeadersWithRegex({}, pattern);
            
            return result === false;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle invalid regex patterns gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          headersArb,
          async (headers) => {
            const service = createMinimalService();
            
            // Truly invalid regex patterns that will always throw
            const invalidPatterns = ['[invalid', '(unclosed', '(?invalid)', '\\'];
            
            for (const pattern of invalidPatterns) {
              try {
                const result = service.matchHeadersWithRegex(headers, pattern);
                // Should return false for invalid patterns, not throw
                if (result !== false) return false;
              } catch {
                // If it throws, that's also acceptable behavior for invalid patterns
                // but our implementation should handle it gracefully
                return false;
              }
            }
            
            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should be case-insensitive when matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z]+$/.test(s)),
          async (value) => {
            const service = createMinimalService();
            
            const headers = { 'X-Custom-Header': value };
            
            // Search with lowercase pattern
            const lowerResult = service.matchHeadersWithRegex(headers, value.toLowerCase());
            // Search with uppercase pattern
            const upperResult = service.matchHeadersWithRegex(headers, value.toUpperCase());
            
            // Both should match (case-insensitive)
            return lowerResult === true && upperResult === true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should match regex patterns correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { headers: { 'Server': 'nginx/1.18.0' } as Record<string, string>, pattern: 'nginx', expected: true },
            { headers: { 'Server': 'Apache/2.4.41' } as Record<string, string>, pattern: 'apache', expected: true },
            { headers: { 'X-Powered-By': 'PHP/7.4' } as Record<string, string>, pattern: 'php', expected: true },
            { headers: { 'Content-Type': 'text/html' } as Record<string, string>, pattern: 'html', expected: true },
            { headers: { 'Server': 'nginx' } as Record<string, string>, pattern: 'apache', expected: false },
            { headers: { 'Server': 'nginx/1.18.0' } as Record<string, string>, pattern: '\\d+\\.\\d+', expected: true },
            { headers: { 'X-Custom': 'value123' } as Record<string, string>, pattern: '[0-9]+', expected: true },
          ),
          async ({ headers, pattern, expected }) => {
            const service = createMinimalService();
            
            const result = service.matchHeadersWithRegex(headers, pattern);
            
            return result === expected;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should match any header value, not just specific keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(headerKeyArb, { minLength: 2, maxLength: 5 }),
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
          async (keys, uniqueValue) => {
            fc.pre(keys.length >= 2);
            
            const service = createMinimalService();
            
            // Create headers with different values, one containing the unique value
            const headers: Record<string, string> = {};
            keys.forEach((key, index) => {
              if (index === keys.length - 1) {
                headers[key] = `prefix-${uniqueValue}-suffix`;
              } else {
                headers[key] = `other-value-${index}`;
              }
            });
            
            const result = service.matchHeadersWithRegex(headers, uniqueValue);
            
            // Should match because one header contains the value
            return result === true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
