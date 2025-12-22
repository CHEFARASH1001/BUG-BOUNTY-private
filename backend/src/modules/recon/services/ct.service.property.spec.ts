import * as fc from 'fast-check';
import { CTService, CTCertificate, SubdomainRecord } from './ct.service';

/**
 * Property-Based Tests for CTService
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

const baseDomainArb = fc.tuple(domainLabelArb, tldArb)
  .map(([name, tld]) => `${name}.${tld}`);

const subdomainPrefixArb = fc.array(domainLabelArb, { minLength: 1, maxLength: 3 })
  .map((parts) => parts.join('.'));

// Generate a valid subdomain for a given base domain
const subdomainForBaseArb = (baseDomain: string) =>
  subdomainPrefixArb.map((prefix) => `${prefix}.${baseDomain}`);

// Generate a hex string for serial numbers
const hexStringArb = fc.array(
  fc.integer({ min: 0, max: 15 }).map((n) => n.toString(16)),
  { minLength: 8, maxLength: 32 },
).map((chars) => chars.join(''));

// Generate a certificate-like object as returned by crt.sh
const certArb = (baseDomain: string) =>
  fc.record({
    name_value: fc.array(
      fc.oneof(
        // Valid subdomains
        subdomainForBaseArb(baseDomain),
        // Wildcard subdomains
        subdomainForBaseArb(baseDomain).map((s) => `*.${s.split('.').slice(1).join('.')}`),
        // The base domain itself
        fc.constant(baseDomain),
      ),
      { minLength: 1, maxLength: 5 },
    ).map((names) => names.join('\n')),
    common_name: fc.oneof(
      subdomainForBaseArb(baseDomain),
      fc.constant(baseDomain),
      subdomainForBaseArb(baseDomain).map((s) => `*.${s.split('.').slice(1).join('.')}`),
    ),
    serial_number: hexStringArb,
    issuer_name: fc.constantFrom('DigiCert', 'Let\'s Encrypt', 'Comodo', 'GlobalSign'),
    not_before: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-01-01') }).map((d) => d.toISOString()),
    not_after: fc.date({ min: new Date('2024-01-01'), max: new Date('2030-01-01') }).map((d) => d.toISOString()),
  });

// Generate an invalid domain that doesn't match the base domain
const invalidDomainArb = fc.tuple(domainLabelArb, tldArb)
  .map(([name, tld]) => `other-${name}.${tld}`);

describe('CTService Property-Based Tests', () => {
  let service: CTService;

  beforeEach(() => {
    service = new CTService();
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 9: Certificate SAN Extraction**
   *
   * *For any* certificate with Subject Alternative Names, extraction SHALL return
   * all valid subdomains from the SAN field.
   *
   * **Validates: Requirements 4.2**
   */
  describe('Property 9: Certificate SAN Extraction', () => {
    it('should extract all valid subdomains from name_value field', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          async (baseDomain) => {
            // Generate subdomains for this base domain
            const subdomains = await fc.sample(subdomainForBaseArb(baseDomain), 3);
            const cert = {
              name_value: subdomains.join('\n'),
              common_name: baseDomain,
              serial_number: 'abc123',
            };

            const extractedSANs = service.extractSANsFromCert(cert, baseDomain);

            // All generated subdomains should be extracted
            return subdomains.every((sub) =>
              extractedSANs.includes(sub.toLowerCase()),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract subdomain from common_name field', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          subdomainPrefixArb,
          async (baseDomain, prefix) => {
            const subdomain = `${prefix}.${baseDomain}`;
            const cert = {
              name_value: '',
              common_name: subdomain,
              serial_number: 'abc123',
            };

            const extractedSANs = service.extractSANsFromCert(cert, baseDomain);

            return extractedSANs.includes(subdomain.toLowerCase());
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should remove wildcard prefix from domain names', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          subdomainPrefixArb,
          async (baseDomain, prefix) => {
            const wildcardDomain = `*.${prefix}.${baseDomain}`;
            const expectedDomain = `${prefix}.${baseDomain}`.toLowerCase();
            const cert = {
              name_value: wildcardDomain,
              common_name: '',
              serial_number: 'abc123',
            };

            const extractedSANs = service.extractSANsFromCert(cert, baseDomain);

            return extractedSANs.includes(expectedDomain);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return unique subdomains with no duplicates', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          subdomainPrefixArb,
          async (baseDomain, prefix) => {
            const subdomain = `${prefix}.${baseDomain}`;
            // Include the same subdomain multiple times
            const cert = {
              name_value: `${subdomain}\n${subdomain}\n*.${subdomain}`,
              common_name: subdomain,
              serial_number: 'abc123',
            };

            const extractedSANs = service.extractSANsFromCert(cert, baseDomain);

            // Check for uniqueness
            const uniqueSANs = new Set(extractedSANs);
            return extractedSANs.length === uniqueSANs.size;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should only return subdomains that end with the base domain', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          invalidDomainArb,
          subdomainPrefixArb,
          async (baseDomain, invalidDomain, prefix) => {
            // Ensure the invalid domain is actually different
            fc.pre(!invalidDomain.endsWith(baseDomain));

            const validSubdomain = `${prefix}.${baseDomain}`;
            const cert = {
              name_value: `${validSubdomain}\n${invalidDomain}`,
              common_name: invalidDomain,
              serial_number: 'abc123',
            };

            const extractedSANs = service.extractSANsFromCert(cert, baseDomain);

            // Should only contain the valid subdomain
            return extractedSANs.every((san) => san.endsWith(baseDomain));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return lowercase domain names', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          subdomainPrefixArb,
          async (baseDomain, prefix) => {
            const subdomain = `${prefix.toUpperCase()}.${baseDomain.toUpperCase()}`;
            const cert = {
              name_value: subdomain,
              common_name: '',
              serial_number: 'abc123',
            };

            const extractedSANs = service.extractSANsFromCert(cert, baseDomain);

            return extractedSANs.every((san) => san === san.toLowerCase());
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle empty certificate fields gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          async (baseDomain) => {
            const cert = {
              name_value: '',
              common_name: '',
              serial_number: 'abc123',
            };

            const extractedSANs = service.extractSANsFromCert(cert, baseDomain);

            // Should return empty array, not throw
            return Array.isArray(extractedSANs) && extractedSANs.length === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle undefined certificate fields gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          async (baseDomain) => {
            const cert = {
              serial_number: 'abc123',
            };

            const extractedSANs = service.extractSANsFromCert(cert, baseDomain);

            // Should return empty array, not throw
            return Array.isArray(extractedSANs) && extractedSANs.length === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject domains with invalid characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          async (baseDomain) => {
            const invalidSubdomain = `invalid_subdomain!@#.${baseDomain}`;
            const cert = {
              name_value: invalidSubdomain,
              common_name: '',
              serial_number: 'abc123',
            };

            const extractedSANs = service.extractSANsFromCert(cert, baseDomain);

            // Should not include invalid subdomain
            return !extractedSANs.includes(invalidSubdomain.toLowerCase());
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 10: CT Discovery Attribution**
   *
   * *For any* subdomain discovered via Certificate Transparency, storing it
   * SHALL set the source field to "cert_trans".
   *
   * **Validates: Requirements 4.3**
   */
  describe('Property 10: CT Discovery Attribution', () => {
    it('should create subdomain records with cert_trans source', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          fc.array(subdomainPrefixArb, { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (baseDomain, prefixes, domainId) => {
            const subdomains = prefixes.map((prefix) => `${prefix}.${baseDomain}`);

            const records = service.createSubdomainRecords(subdomains, domainId);

            // All records should have source set to 'cert_trans'
            return records.every((record) => record.source === 'cert_trans');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create records with correct domainId association', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          fc.array(subdomainPrefixArb, { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (baseDomain, prefixes, domainId) => {
            const subdomains = prefixes.map((prefix) => `${prefix}.${baseDomain}`);

            const records = service.createSubdomainRecords(subdomains, domainId);

            // All records should have the correct domainId
            return records.every((record) => record.domainId === domainId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create records with correct subdomain values', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          fc.array(subdomainPrefixArb, { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (baseDomain, prefixes, domainId) => {
            const subdomains = prefixes.map((prefix) => `${prefix}.${baseDomain}`);

            const records = service.createSubdomainRecords(subdomains, domainId);

            // Each record should have the correct subdomain
            return records.every((record, index) => record.subdomain === subdomains[index]);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create records with firstSeen and lastSeen timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          fc.array(subdomainPrefixArb, { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          async (baseDomain, prefixes, domainId) => {
            const subdomains = prefixes.map((prefix) => `${prefix}.${baseDomain}`);
            const beforeCreation = new Date();

            const records = service.createSubdomainRecords(subdomains, domainId);

            const afterCreation = new Date();

            // All records should have valid timestamps
            return records.every((record) => {
              const firstSeen = record.firstSeen;
              const lastSeen = record.lastSeen;

              return (
                firstSeen instanceof Date &&
                lastSeen instanceof Date &&
                firstSeen >= beforeCreation &&
                firstSeen <= afterCreation &&
                lastSeen >= beforeCreation &&
                lastSeen <= afterCreation
              );
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should create one record per subdomain', async () => {
      await fc.assert(
        fc.asyncProperty(
          baseDomainArb,
          fc.array(subdomainPrefixArb, { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (baseDomain, prefixes, domainId) => {
            const subdomains = prefixes.map((prefix) => `${prefix}.${baseDomain}`);

            const records = service.createSubdomainRecords(subdomains, domainId);

            // Number of records should match number of subdomains
            return records.length === subdomains.length;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle empty subdomain list', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (domainId) => {
            const records = service.createSubdomainRecords([], domainId);

            // Should return empty array
            return Array.isArray(records) && records.length === 0;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Watch Domain Management', () => {
    it('should track watched domains correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(baseDomainArb, { minLength: 1, maxLength: 10 }),
          async (domains) => {
            // Start fresh
            const freshService = new CTService();

            // Watch all domains
            for (const domain of domains) {
              freshService.watchDomain(domain);
            }

            // All domains should be watched
            return domains.every((domain) => freshService.isWatching(domain));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should stop watching domains correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(baseDomainArb, { minLength: 2, maxLength: 10 }),
          async (domains) => {
            // Get unique domains to avoid duplicate issues
            const uniqueDomains = [...new Set(domains.map((d) => d.toLowerCase()))];
            fc.pre(uniqueDomains.length >= 2);

            const freshService = new CTService();

            // Watch all unique domains
            for (const domain of uniqueDomains) {
              freshService.watchDomain(domain);
            }

            // Stop watching the first domain
            freshService.stopWatching(uniqueDomains[0]);

            // First domain should not be watched, others should be
            return (
              !freshService.isWatching(uniqueDomains[0]) &&
              uniqueDomains.slice(1).every((domain) => freshService.isWatching(domain))
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return list of watched domains', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(baseDomainArb, { minLength: 1, maxLength: 10 }),
          async (domains) => {
            const freshService = new CTService();
            const uniqueDomains = [...new Set(domains.map((d) => d.toLowerCase()))];

            // Watch all domains
            for (const domain of domains) {
              freshService.watchDomain(domain);
            }

            const watchedDomains = freshService.getWatchedDomains();

            // Should contain all unique domains
            return uniqueDomains.every((domain) => watchedDomains.includes(domain));
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
