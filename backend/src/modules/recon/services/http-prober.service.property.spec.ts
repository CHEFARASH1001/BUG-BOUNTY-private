import * as fc from 'fast-check';
import { HttpProber, HttpProbeOptions, HttpProbeResult, DEFAULT_PROBE_OPTIONS } from './http-prober.service';

/**
 * Property-Based Tests for HttpProber
 *
 * These tests verify the correctness properties defined in the design document
 * for the advanced-recon-monitoring feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// Arbitraries for generating test data
const timeoutArb = fc.integer({ min: 1, max: 60 });
const retriesArb = fc.integer({ min: 1, max: 10 });

// Arbitraries for HTTPx JSON parsing tests
const statusCodeArb = fc.integer({ min: 100, max: 599 });

const titleArb = fc.string({ minLength: 0, maxLength: 100 })
  .filter(s => !s.includes('\n') && !s.includes('\r'));

const contentLengthArb = fc.integer({ min: 0, max: 10000000 });

const contentTypeArb = fc.constantFrom(
  'text/html',
  'text/html; charset=utf-8',
  'application/json',
  'text/plain',
  'text/css',
  'application/javascript',
);

const webServerArb = fc.constantFrom('nginx', 'Apache', 'cloudflare', 'Microsoft-IIS/10.0', '');

const technologyArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z0-9._-]+$/.test(s));

const technologiesArb = fc.array(technologyArb, { minLength: 0, maxLength: 10 })
  .map(arr => [...new Set(arr)]);

const domainLabelArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));

const tldArb = fc.constantFrom('com', 'net', 'org', 'io', 'co');

const hostnameArb = fc.tuple(
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

const urlArb = fc.tuple(protocolArb, hostnameArb)
  .map(([protocol, domain]) => `${protocol}${domain}`);

const hexCharArb = fc.constantFrom(
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'a', 'b', 'c', 'd', 'e', 'f'
);

const md5HashArb = fc.array(hexCharArb, { minLength: 32, maxLength: 32 })
  .map(chars => chars.join(''));

const sha256HashArb = fc.array(hexCharArb, { minLength: 64, maxLength: 64 })
  .map(chars => chars.join(''));

const headerKeyArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z0-9-]+$/.test(s));

const headerValueArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => !s.includes('\n') && !s.includes('\r'));

const headersArb = fc.dictionary(headerKeyArb, headerValueArb, { minKeys: 0, maxKeys: 10 });

const responseTimeArb = fc.integer({ min: 0, max: 30000 });

// HTTPx JSON output format arbitrary (simulates httpx JSON output)
const httpxJsonDataArb = fc.record({
  url: urlArb,
  input: urlArb,
  'status-code': statusCodeArb,
  title: titleArb,
  'content-length': contentLengthArb,
  'content-type': contentTypeArb,
  'web-server': webServerArb,
  tech: technologiesArb,
  'response-time': responseTimeArb,
  header: headersArb,
  'favicon-hash': fc.option(md5HashArb, { nil: undefined }),
  'favicon-url': fc.option(urlArb, { nil: undefined }),
  'body-sha256': fc.option(sha256HashArb, { nil: undefined }),
  'final-url': fc.option(urlArb, { nil: undefined }),
  chain: fc.option(fc.array(fc.record({ url: urlArb }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
});

// Alternative HTTPx JSON format (snake_case)
const httpxJsonDataSnakeCaseArb = fc.record({
  url: urlArb,
  input: urlArb,
  status_code: statusCodeArb,
  title: titleArb,
  content_length: contentLengthArb,
  content_type: contentTypeArb,
  webserver: webServerArb,
  technologies: technologiesArb,
  response_time: responseTimeArb,
  headers: headersArb,
  favicon_hash: fc.option(md5HashArb, { nil: undefined }),
  favicon_url: fc.option(urlArb, { nil: undefined }),
  body_hash: fc.option(sha256HashArb, { nil: undefined }),
  final_url: fc.option(urlArb, { nil: undefined }),
});

const httpProbeOptionsArb: fc.Arbitrary<HttpProbeOptions> = fc.record({
  favicon: fc.boolean(),
  headers: fc.boolean(),
  techDetect: fc.boolean(),
  followRedirects: fc.boolean(),
  includeChain: fc.boolean(),
  timeout: timeoutArb,
  retries: retriesArb,
});

const partialHttpProbeOptionsArb: fc.Arbitrary<Partial<HttpProbeOptions>> = fc.record({
  favicon: fc.option(fc.boolean(), { nil: undefined }),
  headers: fc.option(fc.boolean(), { nil: undefined }),
  techDetect: fc.option(fc.boolean(), { nil: undefined }),
  followRedirects: fc.option(fc.boolean(), { nil: undefined }),
  includeChain: fc.option(fc.boolean(), { nil: undefined }),
  timeout: fc.option(timeoutArb, { nil: undefined }),
  retries: fc.option(retriesArb, { nil: undefined }),
}).map(obj => {
  // Remove undefined values
  const result: Partial<HttpProbeOptions> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as any)[key] = value;
    }
  }
  return result;
});

const filePathArb = fc.string({ minLength: 5, maxLength: 50 })
  .filter(s => /^[a-zA-Z0-9_\-./]+$/.test(s))
  .map(s => `/results/${s}.txt`);

describe('HttpProber Property-Based Tests', () => {
  let prober: HttpProber;

  beforeEach(() => {
    prober = new HttpProber();
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 12: HTTPx Command Options**
   *
   * *For any* single domain probe request, the constructed httpx command SHALL
   * include favicon, tech-detect, headers, redirect chain, timeout=5, and retries=3 flags.
   *
   * **Validates: Requirements 6.1, 6.4**
   */
  describe('Property 12: HTTPx Command Options', () => {
    it('should include all required flags with default options', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          filePathArb,
          async (inputPath, outputPath) => {
            const command = prober.buildHttpxCommand(inputPath, outputPath);

            // Should include favicon flag
            if (!command.includes('-favicon')) return false;

            // Should include headers flag
            if (!command.includes('-include-response-header')) return false;

            // Should include tech-detect flag
            if (!command.includes('-tech-detect')) return false;

            // Should include follow-redirects flag
            if (!command.includes('-follow-redirects')) return false;

            // Should include redirect chain flag
            if (!command.includes('-include-chain')) return false;

            // Should include default timeout of 5 seconds
            if (!command.includes('-timeout 5')) return false;

            // Should include default retries of 3
            if (!command.includes('-retries 3')) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include custom timeout and retries when specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          filePathArb,
          timeoutArb,
          retriesArb,
          async (inputPath, outputPath, timeout, retries) => {
            const options: HttpProbeOptions = { timeout, retries };
            const command = prober.buildHttpxCommand(inputPath, outputPath, options);

            // Should include specified timeout
            if (!command.includes(`-timeout ${timeout}`)) return false;

            // Should include specified retries
            if (!command.includes(`-retries ${retries}`)) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should exclude optional flags when disabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          filePathArb,
          async (inputPath, outputPath) => {
            const options: HttpProbeOptions = {
              favicon: false,
              headers: false,
              techDetect: false,
              followRedirects: false,
              includeChain: false,
            };
            const command = prober.buildHttpxCommand(inputPath, outputPath, options);

            // Should NOT include favicon flag
            if (command.includes('-favicon')) return false;

            // Should NOT include headers flag
            if (command.includes('-include-response-header')) return false;

            // Should NOT include tech-detect flag
            if (command.includes('-tech-detect')) return false;

            // Should NOT include follow-redirects flag
            if (command.includes('-follow-redirects')) return false;

            // Should NOT include redirect chain flag
            if (command.includes('-include-chain')) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should always include base required flags', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          filePathArb,
          partialHttpProbeOptionsArb,
          async (inputPath, outputPath, options) => {
            const command = prober.buildHttpxCommand(inputPath, outputPath, options);

            // Should always include json output
            if (!command.includes('-json')) return false;

            // Should always include status-code
            if (!command.includes('-status-code')) return false;

            // Should always include title
            if (!command.includes('-title')) return false;

            // Should always include content-length
            if (!command.includes('-content-length')) return false;

            // Should always include content-type
            if (!command.includes('-content-type')) return false;

            // Should always include web-server
            if (!command.includes('-web-server')) return false;

            // Should always include silent
            if (!command.includes('-silent')) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include input and output file paths', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          filePathArb,
          partialHttpProbeOptionsArb,
          async (inputPath, outputPath, options) => {
            const command = prober.buildHttpxCommand(inputPath, outputPath, options);

            // Should include input file with -l flag
            const inputBasename = inputPath.split('/').pop();
            if (!command.includes(`-l /results/${inputBasename}`)) return false;

            // Should include output file with -o flag
            const outputBasename = outputPath.split('/').pop();
            if (!command.includes(`-o /results/${outputBasename}`)) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should use default options when not specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          filePathArb,
          filePathArb,
          async (inputPath, outputPath) => {
            // Call with empty options
            const command = prober.buildHttpxCommand(inputPath, outputPath, {});

            // Should use default timeout (5)
            if (!command.includes('-timeout 5')) return false;

            // Should use default retries (3)
            if (!command.includes('-retries 3')) return false;

            // Should include all default enabled flags
            if (!command.includes('-favicon')) return false;
            if (!command.includes('-include-response-header')) return false;
            if (!command.includes('-tech-detect')) return false;
            if (!command.includes('-follow-redirects')) return false;
            if (!command.includes('-include-chain')) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 14: HTTPx JSON Parsing**
   *
   * *For any* valid httpx JSON output line, parsing SHALL produce a structured
   * HttpProbeResult with all fields correctly mapped.
   *
   * **Validates: Requirements 6.3**
   */
  describe('Property 14: HTTPx JSON Parsing', () => {
    it('should correctly parse httpx JSON with kebab-case fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpxJsonDataArb,
          async (httpxData) => {
            const jsonLine = JSON.stringify(httpxData);
            const result = prober.parseHttpxJsonLine(jsonLine);

            // Should successfully parse
            if (!result) return false;

            // URL should be extracted
            if (result.url !== httpxData.url) return false;

            // Status code should be mapped correctly
            if (result.statusCode !== httpxData['status-code']) return false;

            // Title should be mapped correctly
            if (result.title !== httpxData.title) return false;

            // Content length should be mapped correctly
            if (result.contentLength !== httpxData['content-length']) return false;

            // Content type should be mapped correctly
            if (result.contentType !== httpxData['content-type']) return false;

            // Web server should be mapped correctly
            if (result.webServer !== httpxData['web-server']) return false;

            // Technologies should be mapped correctly
            if (JSON.stringify(result.technologies) !== JSON.stringify(httpxData.tech)) return false;

            // Response time should be mapped correctly
            if (result.responseTime !== httpxData['response-time']) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly parse httpx JSON with snake_case fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpxJsonDataSnakeCaseArb,
          async (httpxData) => {
            const jsonLine = JSON.stringify(httpxData);
            const result = prober.parseHttpxJsonLine(jsonLine);

            // Should successfully parse
            if (!result) return false;

            // URL should be extracted
            if (result.url !== httpxData.url) return false;

            // Status code should be mapped correctly
            if (result.statusCode !== httpxData.status_code) return false;

            // Title should be mapped correctly
            if (result.title !== httpxData.title) return false;

            // Content length should be mapped correctly
            if (result.contentLength !== httpxData.content_length) return false;

            // Content type should be mapped correctly
            if (result.contentType !== httpxData.content_type) return false;

            // Web server should be mapped correctly
            if (result.webServer !== httpxData.webserver) return false;

            // Technologies should be mapped correctly
            if (JSON.stringify(result.technologies) !== JSON.stringify(httpxData.technologies)) return false;

            // Response time should be mapped correctly
            if (result.responseTime !== httpxData.response_time) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly extract subdomain from URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpxJsonDataArb,
          async (httpxData) => {
            const jsonLine = JSON.stringify(httpxData);
            const result = prober.parseHttpxJsonLine(jsonLine);

            if (!result) return false;

            // Subdomain should be extracted from URL
            try {
              const expectedHostname = new URL(httpxData.url).hostname;
              if (result.subdomain !== expectedHostname) return false;
            } catch {
              // If URL parsing fails, subdomain extraction should still work
              const expectedHostname = httpxData.url.replace(/^https?:\/\//, '').split('/')[0];
              if (result.subdomain !== expectedHostname) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly parse optional favicon fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpxJsonDataArb,
          async (httpxData) => {
            const jsonLine = JSON.stringify(httpxData);
            const result = prober.parseHttpxJsonLine(jsonLine);

            if (!result) return false;

            // Favicon hash should be mapped if present
            if (httpxData['favicon-hash'] !== undefined) {
              if (result.faviconHash !== httpxData['favicon-hash']) return false;
            }

            // Favicon URL should be mapped if present
            if (httpxData['favicon-url'] !== undefined) {
              if (result.faviconUrl !== httpxData['favicon-url']) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly parse body hash field', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpxJsonDataArb,
          async (httpxData) => {
            const jsonLine = JSON.stringify(httpxData);
            const result = prober.parseHttpxJsonLine(jsonLine);

            if (!result) return false;

            // Body hash should be mapped if present
            if (httpxData['body-sha256'] !== undefined) {
              if (result.bodyHash !== httpxData['body-sha256']) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly parse headers object', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpxJsonDataArb,
          async (httpxData) => {
            const jsonLine = JSON.stringify(httpxData);
            const result = prober.parseHttpxJsonLine(jsonLine);

            if (!result) return false;

            // Headers should be mapped if present
            if (httpxData.header && Object.keys(httpxData.header).length > 0) {
              if (!result.headers) return false;
              
              // All headers should be present
              for (const [key, value] of Object.entries(httpxData.header)) {
                if (result.headers[key] !== value) return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly parse redirect chain', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpxJsonDataArb,
          async (httpxData) => {
            const jsonLine = JSON.stringify(httpxData);
            const result = prober.parseHttpxJsonLine(jsonLine);

            if (!result) return false;

            // Redirect chain should be mapped if present
            if (httpxData.chain && httpxData.chain.length > 0) {
              if (!result.redirectChain) return false;
              
              // All chain URLs should be present
              for (let i = 0; i < httpxData.chain.length; i++) {
                const expectedUrl = httpxData.chain[i].url;
                if (result.redirectChain[i] !== expectedUrl) return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly parse final URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpxJsonDataArb,
          async (httpxData) => {
            const jsonLine = JSON.stringify(httpxData);
            const result = prober.parseHttpxJsonLine(jsonLine);

            if (!result) return false;

            // Final URL should be mapped if present
            if (httpxData['final-url'] !== undefined) {
              if (result.finalUrl !== httpxData['final-url']) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return null for invalid JSON', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => {
            try {
              JSON.parse(s);
              return false; // Valid JSON, filter out
            } catch {
              return true; // Invalid JSON, keep
            }
          }),
          async (invalidJson) => {
            const result = prober.parseHttpxJsonLine(invalidJson);
            
            // Should return null for invalid JSON
            return result === null;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle missing optional fields gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: urlArb,
            'status-code': statusCodeArb,
          }),
          async (minimalData) => {
            const jsonLine = JSON.stringify(minimalData);
            const result = prober.parseHttpxJsonLine(jsonLine);

            if (!result) return false;

            // Required fields should be present
            if (result.url !== minimalData.url) return false;
            if (result.statusCode !== minimalData['status-code']) return false;

            // Optional fields should have defaults
            if (result.title !== '') return false;
            if (result.contentLength !== 0) return false;
            if (result.contentType !== '') return false;
            if (result.webServer !== '') return false;
            if (!Array.isArray(result.technologies)) return false;
            if (result.responseTime !== 0) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
