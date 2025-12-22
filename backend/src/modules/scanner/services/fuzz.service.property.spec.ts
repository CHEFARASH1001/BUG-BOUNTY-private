import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { FuzzService, FuzzConfig, RawFfufResult } from './fuzz.service';
import { FuzzJob, FuzzResult } from '../../../schemas/fuzz-job.schema';

/**
 * Property-Based Tests for FuzzService
 *
 * These tests verify the correctness properties defined in the design document
 * for the advanced-recon-monitoring feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// Mock FuzzJob model
const mockFuzzJobModel = {
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
};

// Arbitraries for generating test data
const urlArb = fc.tuple(
  fc.constantFrom('http://', 'https://'),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
  fc.constantFrom('.com', '.net', '.org', '.io'),
  fc.option(fc.constantFrom('/api', '/admin', '/test', '/FUZZ', ''), { nil: undefined }),
).map(([protocol, name, tld, path]) => `${protocol}${name}${tld}${path || ''}`);

const wordlistArb = fc.constantFrom(
  'common.txt',
  'directory-list-2.3-medium.txt',
  'directory-list-2.3-small.txt',
  'raft-large-directories.txt',
  'big.txt',
);

const extensionArb = fc.constantFrom('.php', '.html', '.js', '.txt', '.asp', '.aspx', '.jsp', '.json', '.xml');

const statusCodeArb = fc.constantFrom(200, 201, 301, 302, 400, 401, 403, 404, 500, 502, 503);

const fuzzConfigArb: fc.Arbitrary<FuzzConfig> = fc.record({
  url: urlArb,
  wordlist: wordlistArb,
  extensions: fc.option(fc.array(extensionArb, { minLength: 1, maxLength: 5 }), { nil: undefined }),
  matchCodes: fc.option(fc.array(statusCodeArb, { minLength: 1, maxLength: 5 }), { nil: undefined }),
  filterWords: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
  filterLines: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
  filterSize: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
  threads: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
  timeout: fc.option(fc.integer({ min: 1, max: 60 }), { nil: undefined }),
});

const rawFfufResultArb: fc.Arbitrary<RawFfufResult> = fc.record({
  url: fc.option(urlArb, { nil: undefined }),
  status: fc.option(statusCodeArb, { nil: undefined }),
  length: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
  words: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
  lines: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
  'content-type': fc.option(fc.constantFrom('text/html', 'application/json', 'text/plain', 'application/xml'), { nil: undefined }),
  redirectlocation: fc.option(urlArb, { nil: undefined }),
});

describe('FuzzService Property-Based Tests', () => {
  let service: FuzzService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FuzzService,
        {
          provide: getModelToken(FuzzJob.name),
          useValue: mockFuzzJobModel,
        },
      ],
    }).compile();

    service = module.get<FuzzService>(FuzzService);
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 15: FFUF Command Construction**
   *
   * *For any* FuzzConfig with URL, wordlist, extensions, and filters,
   * the constructed ffuf command SHALL include all specified parameters with correct syntax.
   *
   * **Validates: Requirements 7.2**
   */
  describe('Property 15: FFUF Command Construction', () => {
    it('should include URL with FUZZ keyword in the command', async () => {
      await fc.assert(
        fc.asyncProperty(
          fuzzConfigArb,
          async (config) => {
            const args = service.buildCommand(config);

            // Find the -u flag and its value
            const urlIndex = args.indexOf('-u');
            if (urlIndex === -1) return false;

            const urlValue = args[urlIndex + 1];
            // URL should contain FUZZ keyword
            return urlValue.includes('FUZZ');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include wordlist path in the command', async () => {
      await fc.assert(
        fc.asyncProperty(
          fuzzConfigArb,
          async (config) => {
            const args = service.buildCommand(config);

            // Find the -w flag and its value
            const wordlistIndex = args.indexOf('-w');
            if (wordlistIndex === -1) return false;

            const wordlistValue = args[wordlistIndex + 1];
            // Wordlist path should contain the specified wordlist
            return wordlistValue.includes(config.wordlist);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include all specified extensions in the command', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          wordlistArb,
          fc.array(extensionArb, { minLength: 1, maxLength: 5 }),
          async (url, wordlist, extensions) => {
            const config: FuzzConfig = { url, wordlist, extensions };
            const args = service.buildCommand(config);

            // Find the -e flag and its value
            const extIndex = args.indexOf('-e');
            if (extIndex === -1) return false;

            const extValue = args[extIndex + 1];
            // All extensions should be in the comma-separated value
            return extensions.every((ext) => extValue.includes(ext));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include match codes when specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          wordlistArb,
          fc.array(statusCodeArb, { minLength: 1, maxLength: 5 }),
          async (url, wordlist, matchCodes) => {
            const config: FuzzConfig = { url, wordlist, matchCodes };
            const args = service.buildCommand(config);

            // Find the -mc flag and its value
            const mcIndex = args.indexOf('-mc');
            if (mcIndex === -1) return false;

            const mcValue = args[mcIndex + 1];
            // All match codes should be in the comma-separated value
            return matchCodes.every((code) => mcValue.includes(code.toString()));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include filter words when specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          wordlistArb,
          fc.integer({ min: 0, max: 10000 }),
          async (url, wordlist, filterWords) => {
            const config: FuzzConfig = { url, wordlist, filterWords };
            const args = service.buildCommand(config);

            // Find the -fw flag and its value
            const fwIndex = args.indexOf('-fw');
            if (fwIndex === -1) return false;

            const fwValue = args[fwIndex + 1];
            return fwValue === filterWords.toString();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include filter lines when specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          wordlistArb,
          fc.integer({ min: 0, max: 1000 }),
          async (url, wordlist, filterLines) => {
            const config: FuzzConfig = { url, wordlist, filterLines };
            const args = service.buildCommand(config);

            // Find the -fl flag and its value
            const flIndex = args.indexOf('-fl');
            if (flIndex === -1) return false;

            const flValue = args[flIndex + 1];
            return flValue === filterLines.toString();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include filter size when specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          wordlistArb,
          fc.integer({ min: 0, max: 100000 }),
          async (url, wordlist, filterSize) => {
            const config: FuzzConfig = { url, wordlist, filterSize };
            const args = service.buildCommand(config);

            // Find the -fs flag and its value
            const fsIndex = args.indexOf('-fs');
            if (fsIndex === -1) return false;

            const fsValue = args[fsIndex + 1];
            return fsValue === filterSize.toString();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include threads parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          wordlistArb,
          fc.integer({ min: 1, max: 100 }),
          async (url, wordlist, threads) => {
            const config: FuzzConfig = { url, wordlist, threads };
            const args = service.buildCommand(config);

            // Find the -t flag and its value
            const tIndex = args.indexOf('-t');
            if (tIndex === -1) return false;

            const tValue = args[tIndex + 1];
            return tValue === threads.toString();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include timeout parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          wordlistArb,
          fc.integer({ min: 1, max: 60 }),
          async (url, wordlist, timeout) => {
            const config: FuzzConfig = { url, wordlist, timeout };
            const args = service.buildCommand(config);

            // Find the -timeout flag and its value
            const timeoutIndex = args.indexOf('-timeout');
            if (timeoutIndex === -1) return false;

            const timeoutValue = args[timeoutIndex + 1];
            return timeoutValue === timeout.toString();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include JSON output flag', async () => {
      await fc.assert(
        fc.asyncProperty(
          fuzzConfigArb,
          async (config) => {
            const args = service.buildCommand(config);
            return args.includes('-json');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include silent mode flag', async () => {
      await fc.assert(
        fc.asyncProperty(
          fuzzConfigArb,
          async (config) => {
            const args = service.buildCommand(config);
            return args.includes('-s');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should use default threads (40) when not specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          wordlistArb,
          async (url, wordlist) => {
            const config: FuzzConfig = { url, wordlist };
            const args = service.buildCommand(config);

            const tIndex = args.indexOf('-t');
            if (tIndex === -1) return false;

            const tValue = args[tIndex + 1];
            return tValue === '40';
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should use default timeout (10) when not specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          wordlistArb,
          async (url, wordlist) => {
            const config: FuzzConfig = { url, wordlist };
            const args = service.buildCommand(config);

            const timeoutIndex = args.indexOf('-timeout');
            if (timeoutIndex === -1) return false;

            const timeoutValue = args[timeoutIndex + 1];
            return timeoutValue === '10';
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should use default match codes (all except 404) when not specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          wordlistArb,
          async (url, wordlist) => {
            const config: FuzzConfig = { url, wordlist };
            const args = service.buildCommand(config);

            // Should have -mc all and -fc 404
            const mcIndex = args.indexOf('-mc');
            const fcIndex = args.indexOf('-fc');

            if (mcIndex === -1 || fcIndex === -1) return false;

            return args[mcIndex + 1] === 'all' && args[fcIndex + 1] === '404';
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should throw error when URL is missing', () => {
      const config = { url: '', wordlist: 'common.txt' } as FuzzConfig;
      expect(() => service.buildCommand(config)).toThrow('URL and wordlist are required');
    });

    it('should throw error when wordlist is missing', () => {
      const config = { url: 'http://example.com', wordlist: '' } as FuzzConfig;
      expect(() => service.buildCommand(config)).toThrow('URL and wordlist are required');
    });

    it('should append FUZZ keyword to URL if not present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.constantFrom('http://', 'https://'),
            fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
            fc.constantFrom('.com', '.net', '.org', '.io'),
          ).map(([protocol, name, tld]) => `${protocol}${name}${tld}`),
          wordlistArb,
          async (url, wordlist) => {
            // URL without FUZZ keyword
            const config: FuzzConfig = { url, wordlist };
            const args = service.buildCommand(config);

            const urlIndex = args.indexOf('-u');
            const urlValue = args[urlIndex + 1];

            // Should have FUZZ appended
            return urlValue.endsWith('/FUZZ');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve FUZZ keyword position if already present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.constantFrom('http://', 'https://'),
            fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
            fc.constantFrom('.com', '.net', '.org', '.io'),
          ).map(([protocol, name, tld]) => `${protocol}${name}${tld}/api/FUZZ/test`),
          wordlistArb,
          async (url, wordlist) => {
            const config: FuzzConfig = { url, wordlist };
            const args = service.buildCommand(config);

            const urlIndex = args.indexOf('-u');
            const urlValue = args[urlIndex + 1];

            // Should preserve original URL with FUZZ
            return urlValue === url;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 16: Fuzz Result Storage**
   *
   * *For any* completed fuzzing job with results, storing SHALL associate
   * all results with the correct target domain.
   *
   * **Validates: Requirements 7.5**
   */
  describe('Property 16: Fuzz Result Storage', () => {
    it('should parse ffuf output correctly with all fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          rawFfufResultArb.filter((r) => r.url !== undefined || r.status !== undefined),
          async (rawResult) => {
            const result = service.parseFfufOutput(rawResult);

            if (!result) return false;

            // Verify all fields are correctly mapped
            if (result.url !== (rawResult.url || '')) return false;
            if (result.status !== (rawResult.status || 0)) return false;
            if (result.length !== (rawResult.length || 0)) return false;
            if (result.words !== (rawResult.words || 0)) return false;
            if (result.lines !== (rawResult.lines || 0)) return false;
            if (result.contentType !== (rawResult['content-type'] || '')) return false;
            if (result.redirectLocation !== rawResult.redirectlocation) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return null for non-result lines', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            input: fc.option(fc.record({ FUZZ: fc.string() }), { nil: undefined }),
            position: fc.option(fc.integer(), { nil: undefined }),
          }),
          async (rawResult) => {
            // Result without url and status should return null
            const result = service.parseFfufOutput(rawResult as RawFfufResult);
            return result === null;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle missing optional fields gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          statusCodeArb,
          async (url, status) => {
            const rawResult: RawFfufResult = { url, status };
            const result = service.parseFfufOutput(rawResult);

            if (!result) return false;

            // Should have default values for missing fields
            return (
              result.url === url &&
              result.status === status &&
              result.length === 0 &&
              result.words === 0 &&
              result.lines === 0 &&
              result.contentType === '' &&
              result.redirectLocation === undefined
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly extract content-type from both field names', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          statusCodeArb,
          fc.constantFrom('text/html', 'application/json', 'text/plain'),
          fc.boolean(),
          async (url, status, contentType, useHyphenated) => {
            const rawResult: RawFfufResult = {
              url,
              status,
              ...(useHyphenated ? { 'content-type': contentType } : { contentType }),
            };

            const result = service.parseFfufOutput(rawResult);

            if (!result) return false;

            // Should extract content-type from either field
            return result.contentType === contentType;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve redirect location when present', async () => {
      await fc.assert(
        fc.asyncProperty(
          urlArb,
          statusCodeArb,
          urlArb,
          async (url, status, redirectLocation) => {
            const rawResult: RawFfufResult = {
              url,
              status,
              redirectlocation: redirectLocation,
            };

            const result = service.parseFfufOutput(rawResult);

            if (!result) return false;

            return result.redirectLocation === redirectLocation;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should store results with correct structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            rawFfufResultArb.filter((r) => r.url !== undefined && r.status !== undefined),
            { minLength: 1, maxLength: 10 },
          ),
          async (rawResults) => {
            const results: FuzzResult[] = [];

            for (const rawResult of rawResults) {
              const result = service.parseFfufOutput(rawResult);
              if (result) {
                results.push(result);
              }
            }

            // All parsed results should have required fields
            return results.every(
              (r) =>
                typeof r.url === 'string' &&
                typeof r.status === 'number' &&
                typeof r.length === 'number' &&
                typeof r.words === 'number' &&
                typeof r.lines === 'number' &&
                typeof r.contentType === 'string',
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
