import * as fc from 'fast-check';
import { WaybackService, Endpoint } from './wayback.service';

/**
 * Property-Based Tests for WaybackService
 *
 * These tests verify the correctness properties defined in the design document
 * for the advanced-recon-monitoring feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// Arbitraries for generating test data
const domainLabelArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));

const tldArb = fc.constantFrom('com', 'net', 'org', 'io', 'co', 'dev', 'app');

const domainArb = fc.tuple(domainLabelArb, tldArb)
  .map(([name, tld]) => `${name}.${tld}`);

const subdomainArb = fc.tuple(
  fc.array(domainLabelArb, { minLength: 0, maxLength: 3 }),
  domainLabelArb,
  tldArb,
).map(([subs, name, tld]) => {
  if (subs.length === 0) {
    return `${name}.${tld}`;
  }
  return `${subs.join('.')}.${name}.${tld}`;
});

const protocolArb = fc.constantFrom('http://', 'https://');

const pathSegmentArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter((s) => /^[a-z0-9_-]+$/.test(s));

const pathArb = fc.array(pathSegmentArb, { minLength: 0, maxLength: 5 })
  .map((segments) => '/' + segments.join('/'));

const queryParamArb = fc.tuple(
  fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9_]+$/.test(s)),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9_-]+$/.test(s)),
).map(([key, value]) => `${key}=${value}`);

const queryStringArb = fc.array(queryParamArb, { minLength: 0, maxLength: 5 })
  .map((params) => params.length > 0 ? '?' + params.join('&') : '');

const urlArb = fc.tuple(protocolArb, subdomainArb, pathArb, queryStringArb)
  .map(([protocol, domain, path, query]) => `${protocol}${domain}${path}${query}`);

const urlWithoutProtocolArb = fc.tuple(subdomainArb, pathArb, queryStringArb)
  .map(([domain, path, query]) => `${domain}${path}${query}`);

describe('WaybackService Property-Based Tests', () => {
  let service: WaybackService;

  beforeEach(() => {
    service = new WaybackService();
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 4: Domain Extraction from URLs**
   *
   * *For any* list of URLs, extracting domains SHALL return a set of unique,
   * valid domain names with no duplicates.
   *
   * **Validates: Requirements 2.2**
   */
  describe('Property 4: Domain Extraction from URLs', () => {
    it('should return unique domains with no duplicates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(urlArb, { minLength: 1, maxLength: 50 }),
          async (urls) => {
            const domains = service.extractDomains(urls);

            // Check for uniqueness - no duplicates
            const uniqueDomains = new Set(domains);
            return domains.length === uniqueDomains.size;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return valid domain names', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(urlArb, { minLength: 1, maxLength: 50 }),
          async (urls) => {
            const domains = service.extractDomains(urls);

            // All domains should be valid
            const validPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
            return domains.every((domain) => validPattern.test(domain));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract domains from URLs with different protocols', async () => {
      await fc.assert(
        fc.asyncProperty(
          subdomainArb,
          async (domain) => {
            const httpUrl = `http://${domain}/path`;
            const httpsUrl = `https://${domain}/path`;

            const domains = service.extractDomains([httpUrl, httpsUrl]);

            // Should extract the same domain from both URLs (deduplicated)
            return domains.length === 1 && domains[0] === domain.toLowerCase();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle URLs without protocol', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(urlWithoutProtocolArb, { minLength: 1, maxLength: 20 }),
          async (urls) => {
            const domains = service.extractDomains(urls);

            // Should still extract valid domains
            const validPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
            return domains.every((domain) => validPattern.test(domain));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return domains in lowercase', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(urlArb, { minLength: 1, maxLength: 20 }),
          async (urls) => {
            const domains = service.extractDomains(urls);

            // All domains should be lowercase
            return domains.every((domain) => domain === domain.toLowerCase());
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return sorted domains', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(urlArb, { minLength: 2, maxLength: 30 }),
          async (urls) => {
            const domains = service.extractDomains(urls);

            // Domains should be sorted
            const sorted = [...domains].sort();
            return domains.every((domain, i) => domain === sorted[i]);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle empty URL list', async () => {
      const domains = service.extractDomains([]);
      return domains.length === 0;
    });

    it('should handle invalid URLs gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 20 }),
          async (randomStrings) => {
            // Should not throw, even with invalid URLs
            const domains = service.extractDomains(randomStrings);

            // Result should be an array (possibly empty)
            return Array.isArray(domains);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 5: Wayback Discovery Storage**
   *
   * *For any* domains or endpoints discovered from Waybackurls, storing them
   * SHALL create records with source attribution set to "waybackurls" and
   * correct parent domain association.
   *
   * Note: This property test validates the endpoint extraction logic.
   * The actual storage with source attribution is handled by the calling service.
   *
   * **Validates: Requirements 2.3, 2.4**
   */
  describe('Property 5: Wayback Discovery Storage', () => {
    it('should extract endpoints with correct URL structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(urlArb, { minLength: 1, maxLength: 30 }),
          async (urls) => {
            const endpoints = service.extractEndpoints(urls);

            // All endpoints should have valid URL structure
            return endpoints.every((endpoint) => {
              try {
                new URL(endpoint.url);
                return true;
              } catch {
                return false;
              }
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract endpoints with correct path', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(urlArb, { minLength: 1, maxLength: 30 }),
          async (urls) => {
            const endpoints = service.extractEndpoints(urls);

            // All endpoints should have a path starting with /
            return endpoints.every((endpoint) => endpoint.path.startsWith('/'));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract query parameters correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(protocolArb, subdomainArb, pathArb),
          fc.array(queryParamArb, { minLength: 1, maxLength: 5 }),
          async ([protocol, domain, path], params) => {
            const queryString = '?' + params.join('&');
            const url = `${protocol}${domain}${path}${queryString}`;

            const endpoints = service.extractEndpoints([url]);

            if (endpoints.length !== 1) return false;

            const endpoint = endpoints[0];

            // Should have hasParams set to true
            if (!endpoint.hasParams) return false;

            // Should have extracted all parameter names
            const expectedParamNames = params.map((p) => p.split('=')[0]);
            const actualParamNames = endpoint.parameters.map((p) => p.name);

            return expectedParamNames.every((name) => actualParamNames.includes(name));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should set hasParams to false for URLs without query parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(protocolArb, subdomainArb, pathArb),
          async ([protocol, domain, path]) => {
            const url = `${protocol}${domain}${path}`;

            const endpoints = service.extractEndpoints([url]);

            if (endpoints.length !== 1) return false;

            return !endpoints[0].hasParams && endpoints[0].parameters.length === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should deduplicate endpoints by URL (without query string)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(protocolArb, subdomainArb, pathArb),
          fc.array(queryParamArb, { minLength: 1, maxLength: 3 }),
          fc.array(queryParamArb, { minLength: 1, maxLength: 3 }),
          async ([protocol, domain, path], params1, params2) => {
            const url1 = `${protocol}${domain}${path}?${params1.join('&')}`;
            const url2 = `${protocol}${domain}${path}?${params2.join('&')}`;

            const endpoints = service.extractEndpoints([url1, url2]);

            // Should deduplicate to single endpoint
            return endpoints.length === 1;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should merge parameters from duplicate URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(protocolArb, subdomainArb, pathArb),
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9_]+$/.test(s)),
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9_]+$/.test(s)),
          async ([protocol, domain, path], param1, param2) => {
            // Ensure different parameter names
            fc.pre(param1 !== param2);

            const url1 = `${protocol}${domain}${path}?${param1}=value1`;
            const url2 = `${protocol}${domain}${path}?${param2}=value2`;

            const endpoints = service.extractEndpoints([url1, url2]);

            if (endpoints.length !== 1) return false;

            const paramNames = endpoints[0].parameters.map((p) => p.name);

            // Should have both parameters merged
            return paramNames.includes(param1) && paramNames.includes(param2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should set default method to GET', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(urlArb, { minLength: 1, maxLength: 20 }),
          async (urls) => {
            const endpoints = service.extractEndpoints(urls);

            // All endpoints should have GET as default method
            return endpoints.every((endpoint) => endpoint.method === 'GET');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should set parameter type to query for URL parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(protocolArb, subdomainArb, pathArb),
          fc.array(queryParamArb, { minLength: 1, maxLength: 5 }),
          async ([protocol, domain, path], params) => {
            const queryString = '?' + params.join('&');
            const url = `${protocol}${domain}${path}${queryString}`;

            const endpoints = service.extractEndpoints([url]);

            if (endpoints.length !== 1) return false;

            // All parameters should have type 'query'
            return endpoints[0].parameters.every((p) => p.type === 'query');
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
