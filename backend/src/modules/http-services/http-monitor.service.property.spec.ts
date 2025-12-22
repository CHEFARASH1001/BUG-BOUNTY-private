import * as fc from 'fast-check';
import { HttpMonitorService, PreviousScanData, HTTPChangeEvent } from './http-monitor.service';
import { HttpProbeResult } from '../recon/services/http-prober.service';

/**
 * Property-Based Tests for HttpMonitorService
 *
 * These tests verify the correctness properties defined in the design document
 * for the advanced-recon-monitoring feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// Arbitraries for generating test data
const statusCodeArb = fc.integer({ min: 100, max: 599 });

const titleArb = fc.string({ minLength: 0, maxLength: 100 })
  .filter(s => !s.includes('\n') && !s.includes('\r'));

const technologyArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z0-9._-]+$/.test(s));

const technologiesArb = fc.array(technologyArb, { minLength: 0, maxLength: 10 })
  .map(arr => [...new Set(arr)]); // Ensure unique

// Generate hex strings for hashes
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

const responseTimeArb = fc.integer({ min: 0, max: 30000 });

const httpProbeResultArb: fc.Arbitrary<HttpProbeResult> = fc.record({
  subdomain: subdomainArb,
  url: urlArb,
  statusCode: statusCodeArb,
  title: titleArb,
  contentLength: contentLengthArb,
  contentType: fc.constantFrom('text/html', 'application/json', 'text/plain'),
  webServer: fc.constantFrom('nginx', 'Apache', 'cloudflare', ''),
  technologies: technologiesArb,
  responseTime: responseTimeArb,
  faviconHash: fc.option(hashArb, { nil: undefined }),
  bodyHash: fc.option(hashArb, { nil: undefined }),
});

const previousScanDataArb: fc.Arbitrary<PreviousScanData> = fc.record({
  statusCode: fc.option(statusCodeArb, { nil: undefined }),
  title: fc.option(titleArb, { nil: undefined }),
  technologies: fc.option(technologiesArb, { nil: undefined }),
  contentLength: fc.option(contentLengthArb, { nil: undefined }),
  bodyHash: fc.option(hashArb, { nil: undefined }),
  faviconHash: fc.option(hashArb, { nil: undefined }),
  scannedAt: fc.option(fc.date(), { nil: undefined }),
});

// Create a mock service for testing pure functions
const createMockService = (): HttpMonitorService => {
  // We only need to test the pure functions, so we can create a minimal mock
  const service = Object.create(HttpMonitorService.prototype);
  return service;
};

describe('HttpMonitorService Property-Based Tests', () => {
  let service: HttpMonitorService;

  beforeEach(() => {
    service = createMockService();
  });


  /**
   * **Feature: advanced-recon-monitoring, Property 17: HTTP Change Detection**
   *
   * *For any* pair of HTTP scan results (previous and current) for the same URL,
   * change detection SHALL correctly identify differences in statusCode, title,
   * technologies, and faviconHash, setting appropriate change flags.
   *
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
   */
  describe('Property 17: HTTP Change Detection', () => {
    it('should detect status code changes correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpProbeResultArb,
          statusCodeArb,
          statusCodeArb,
          async (current, prevStatus, currStatus) => {
            // Ensure different status codes
            fc.pre(prevStatus !== currStatus);

            const currentResult = { ...current, statusCode: currStatus };
            const previous: PreviousScanData = { statusCode: prevStatus };

            const changes = service.detectChanges(currentResult, previous);

            // Should detect status code change
            const statusChange = changes.find(c => c.changeType === 'status_code');
            if (!statusChange) return false;
            if (statusChange.previousValue !== prevStatus) return false;
            if (statusChange.currentValue !== currStatus) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should detect title changes correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpProbeResultArb,
          titleArb,
          titleArb,
          async (current, prevTitle, currTitle) => {
            // Ensure different titles
            fc.pre(prevTitle !== currTitle);

            const currentResult = { ...current, title: currTitle };
            const previous: PreviousScanData = { title: prevTitle };

            const changes = service.detectChanges(currentResult, previous);

            // Should detect title change
            const titleChange = changes.find(c => c.changeType === 'title');
            if (!titleChange) return false;
            if (titleChange.previousValue !== prevTitle) return false;
            if (titleChange.currentValue !== currTitle) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should detect technology changes correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpProbeResultArb,
          technologiesArb,
          technologiesArb,
          async (current, prevTech, currTech) => {
            // Ensure different technologies (sorted comparison)
            const prevSorted = [...prevTech].sort().join(',');
            const currSorted = [...currTech].sort().join(',');
            fc.pre(prevSorted !== currSorted);

            const currentResult = { ...current, technologies: currTech };
            const previous: PreviousScanData = { technologies: prevTech };

            const changes = service.detectChanges(currentResult, previous);

            // Should detect technology change
            const techChange = changes.find(c => c.changeType === 'technology');
            if (!techChange) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should detect favicon hash changes correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpProbeResultArb,
          hashArb,
          hashArb,
          async (current, prevHash: string, currHash: string) => {
            // Ensure different hashes
            fc.pre(prevHash !== currHash);

            const currentResult: HttpProbeResult = { ...current, faviconHash: currHash };
            const previous: PreviousScanData = { faviconHash: prevHash };

            const changes = service.detectChanges(currentResult, previous);

            // Should detect favicon change
            const faviconChange = changes.find(c => c.changeType === 'favicon');
            if (!faviconChange) return false;
            if (faviconChange.previousValue !== prevHash) return false;
            if (faviconChange.currentValue !== currHash) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not detect changes when values are the same', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpProbeResultArb,
          async (current) => {
            // Create previous with same values
            const previous: PreviousScanData = {
              statusCode: current.statusCode,
              title: current.title,
              technologies: current.technologies ? [...current.technologies] : [],
              faviconHash: current.faviconHash,
              bodyHash: current.bodyHash,
            };

            const changes = service.detectChanges(current, previous);

            // Should not detect any changes
            return changes.length === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return empty changes for null previous data (first scan)', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpProbeResultArb,
          async (current) => {
            const changes = service.detectChanges(current, null);
            return changes.length === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return empty changes for undefined previous data', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpProbeResultArb,
          async (current) => {
            const changes = service.detectChanges(current, undefined);
            return changes.length === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should set correct change flags based on detected changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpProbeResultArb,
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          async (current, changeStatus, changeTitle, changeTech) => {
            const previous: PreviousScanData = {
              statusCode: changeStatus ? current.statusCode + 1 : current.statusCode,
              title: changeTitle ? current.title + '_changed' : current.title,
              technologies: changeTech 
                ? [...(current.technologies || []), 'NewTech'] 
                : current.technologies,
            };

            const changes = service.detectChanges(current, previous);
            const flags = service.getChangeFlags(changes);

            // Verify flags match expected changes
            if (flags.statusCodeChanged !== changeStatus) return false;
            if (flags.titleChanged !== changeTitle) return false;
            if (flags.techChanged !== changeTech) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include URL and timestamp in all change events', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpProbeResultArb,
          statusCodeArb,
          async (current, prevStatus) => {
            fc.pre(prevStatus !== current.statusCode);

            const previous: PreviousScanData = { statusCode: prevStatus };
            const changes = service.detectChanges(current, previous);

            // All changes should have URL and detectedAt
            return changes.every(change => 
              change.url === current.url && 
              change.detectedAt instanceof Date
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 18: Previous Scan Preservation**
   *
   * *For any* HTTP service update with new scan data, the previous scan data
   * SHALL be preserved in the previousScan field before updating current values.
   *
   * **Validates: Requirements 8.6**
   */
  describe('Property 18: Previous Scan Preservation', () => {
    it('should preserve all previous scan fields correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          statusCodeArb,
          titleArb,
          technologiesArb,
          contentLengthArb,
          hashArb,
          hashArb,
          fc.date(),
          async (statusCode, title, technologies, contentLength, bodyHash, faviconHash, scannedAt) => {
            // Create a mock existing document
            const existing = {
              statusCode,
              title,
              technologies: [...technologies],
              contentLength,
              bodyHash,
              faviconHash,
              scannedAt,
            } as any;

            const preserved = service.preservePreviousScan(existing);

            // Verify all fields are preserved
            if (preserved.statusCode !== statusCode) return false;
            if (preserved.title !== title) return false;
            if (preserved.contentLength !== contentLength) return false;
            if (preserved.bodyHash !== bodyHash) return false;
            if (preserved.faviconHash !== faviconHash) return false;
            if (preserved.scannedAt !== scannedAt) return false;

            // Verify technologies array is copied (not same reference)
            if (preserved.technologies === existing.technologies) return false;
            if (JSON.stringify(preserved.technologies) !== JSON.stringify(technologies)) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle empty technologies array', async () => {
      await fc.assert(
        fc.asyncProperty(
          statusCodeArb,
          titleArb,
          async (statusCode, title) => {
            const existing = {
              statusCode,
              title,
              technologies: [],
              contentLength: 0,
            } as any;

            const preserved = service.preservePreviousScan(existing);

            // Should preserve empty array
            if (!Array.isArray(preserved.technologies)) return false;
            if (preserved.technologies.length !== 0) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle undefined technologies', async () => {
      await fc.assert(
        fc.asyncProperty(
          statusCodeArb,
          titleArb,
          async (statusCode, title) => {
            const existing = {
              statusCode,
              title,
              technologies: undefined,
              contentLength: 0,
            } as any;

            const preserved = service.preservePreviousScan(existing);

            // Should preserve as empty array when undefined
            if (!Array.isArray(preserved.technologies)) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create independent copy of technologies array', async () => {
      await fc.assert(
        fc.asyncProperty(
          technologiesArb,
          async (technologies) => {
            fc.pre(technologies.length > 0);

            const existing = {
              statusCode: 200,
              title: 'Test',
              technologies: [...technologies],
              contentLength: 0,
            } as any;

            const preserved = service.preservePreviousScan(existing);

            // Modify original array
            existing.technologies.push('ModifiedTech');

            // Preserved should not be affected
            if (preserved.technologies!.length !== technologies.length) return false;
            if (preserved.technologies!.includes('ModifiedTech')) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve undefined optional fields as undefined', async () => {
      await fc.assert(
        fc.asyncProperty(
          statusCodeArb,
          titleArb,
          async (statusCode, title) => {
            const existing = {
              statusCode,
              title,
              technologies: [],
              // contentLength, bodyHash, faviconHash, scannedAt are undefined
            } as any;

            const preserved = service.preservePreviousScan(existing);

            // Optional fields should be undefined
            if (preserved.contentLength !== undefined) return false;
            if (preserved.bodyHash !== undefined) return false;
            if (preserved.faviconHash !== undefined) return false;
            if (preserved.scannedAt !== undefined) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});