import * as fc from 'fast-check';
import { NucleiService, NucleiCommandOptions, RawNucleiOutput, NucleiSeverity } from './nuclei.service';

/**
 * Property-Based Tests for NucleiService
 *
 * These tests verify the correctness properties defined in the design document
 * for the advanced-recon-monitoring feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// Arbitraries for generating test data
const targetArb = fc.tuple(
  fc.constantFrom('http://', 'https://'),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
  fc.constantFrom('.com', '.net', '.org', '.io'),
).map(([protocol, name, tld]) => `${protocol}${name}${tld}`);

const templateArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter((s) => /^[a-z0-9/_-]+$/.test(s));

const severityArb: fc.Arbitrary<NucleiSeverity> = fc.constantFrom('info', 'low', 'medium', 'high', 'critical');

const nucleiCommandOptionsArb: fc.Arbitrary<NucleiCommandOptions> = fc.record({
  targets: fc.array(targetArb, { minLength: 1, maxLength: 10 }),
  templates: fc.option(fc.array(templateArb, { minLength: 1, maxLength: 5 }), { nil: undefined }),
  severities: fc.option(fc.array(severityArb, { minLength: 1, maxLength: 5 }), { nil: undefined }),
  rateLimit: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
  bulkSize: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
  concurrency: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
  timeout: fc.option(fc.integer({ min: 1, max: 60 }), { nil: undefined }),
  retries: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
  tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9_-]+$/.test(s)), { minLength: 1, maxLength: 5 }), { nil: undefined }),
});

const rawNucleiOutputArb: fc.Arbitrary<RawNucleiOutput> = fc.record({
  'template-id': fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-z0-9_-]+$/.test(s)), { nil: undefined }),
  templateID: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-z0-9_-]+$/.test(s)), { nil: undefined }),
  info: fc.option(fc.record({
    name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    author: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    severity: fc.option(fc.constantFrom('info', 'low', 'medium', 'high', 'critical', 'INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'), { nil: undefined }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
    reference: fc.option(fc.array(fc.webUrl(), { minLength: 0, maxLength: 3 }), { nil: undefined }),
    tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
  }), { nil: undefined }),
  type: fc.option(fc.constantFrom('http', 'dns', 'file', 'network'), { nil: undefined }),
  host: fc.option(targetArb, { nil: undefined }),
  matched: fc.option(targetArb, { nil: undefined }),
  'matched-at': fc.option(targetArb, { nil: undefined }),
  'matcher-name': fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  matcherName: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  'extracted-results': fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
  extractedResults: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
  timestamp: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).filter((d) => !isNaN(d.getTime())).map((d) => d.toISOString()), { nil: undefined }),
  'curl-command': fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  curlCommand: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
});

describe('NucleiService Property-Based Tests', () => {
  let service: NucleiService;

  beforeEach(() => {
    service = new NucleiService();
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 6: Nuclei Command Construction**
   *
   * *For any* target list and template selection, the constructed Nuclei command
   * SHALL include all specified targets and templates with correct syntax.
   *
   * **Validates: Requirements 3.1**
   */
  describe('Property 6: Nuclei Command Construction', () => {
    it('should include all targets in the command via input file reference', async () => {
      await fc.assert(
        fc.asyncProperty(
          nucleiCommandOptionsArb,
          async (options) => {
            const inputFile = '/app/results/nuclei-input-test.txt';
            const outputFile = '/app/results/nuclei-output-test.json';

            const command = service.buildCommand(options, inputFile, outputFile);

            // Command should reference the input file
            return command.includes('-l /results/nuclei-input-test.txt');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include all specified templates in the command', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(targetArb, { minLength: 1, maxLength: 5 }),
          fc.array(templateArb, { minLength: 1, maxLength: 5 }),
          async (targets, templates) => {
            const options: NucleiCommandOptions = { targets, templates };
            const inputFile = '/app/results/nuclei-input-test.txt';
            const outputFile = '/app/results/nuclei-output-test.json';

            const command = service.buildCommand(options, inputFile, outputFile);

            // Command should include -t flag with all templates
            const expectedTemplates = `-t ${templates.join(',')}`;
            return command.includes(expectedTemplates);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include severity filter when specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(targetArb, { minLength: 1, maxLength: 5 }),
          fc.array(severityArb, { minLength: 1, maxLength: 5 }),
          async (targets, severities) => {
            const options: NucleiCommandOptions = { targets, severities };
            const inputFile = '/app/results/nuclei-input-test.txt';
            const outputFile = '/app/results/nuclei-output-test.json';

            const command = service.buildCommand(options, inputFile, outputFile);

            // Command should include -severity flag with all severities
            const expectedSeverities = `-severity ${severities.join(',')}`;
            return command.includes(expectedSeverities);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include JSON output flag', async () => {
      await fc.assert(
        fc.asyncProperty(
          nucleiCommandOptionsArb,
          async (options) => {
            const inputFile = '/app/results/nuclei-input-test.txt';
            const outputFile = '/app/results/nuclei-output-test.json';

            const command = service.buildCommand(options, inputFile, outputFile);

            // Command should include -json flag
            return command.includes('-json');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include output file reference', async () => {
      await fc.assert(
        fc.asyncProperty(
          nucleiCommandOptionsArb,
          async (options) => {
            const inputFile = '/app/results/nuclei-input-test.txt';
            const outputFile = '/app/results/nuclei-output-test.json';

            const command = service.buildCommand(options, inputFile, outputFile);

            // Command should reference the output file
            return command.includes('-o /results/nuclei-output-test.json');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include rate limiting parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(targetArb, { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1, max: 1000 }),
          async (targets, rateLimit) => {
            const options: NucleiCommandOptions = { targets, rateLimit };
            const inputFile = '/app/results/nuclei-input-test.txt';
            const outputFile = '/app/results/nuclei-output-test.json';

            const command = service.buildCommand(options, inputFile, outputFile);

            // Command should include rate-limit flag
            return command.includes(`-rate-limit ${rateLimit}`);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should use default values when options are not specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(targetArb, { minLength: 1, maxLength: 5 }),
          async (targets) => {
            const options: NucleiCommandOptions = { targets };
            const inputFile = '/app/results/nuclei-input-test.txt';
            const outputFile = '/app/results/nuclei-output-test.json';

            const command = service.buildCommand(options, inputFile, outputFile);

            // Should use default rate-limit of 100
            if (!command.includes('-rate-limit 100')) return false;

            // Should use default bulk-size of 25
            if (!command.includes('-bulk-size 25')) return false;

            // Should use default concurrency of 25
            if (!command.includes('-concurrency 25')) return false;

            // Should use default timeout of 10
            if (!command.includes('-timeout 10')) return false;

            // Should use default retries of 2
            if (!command.includes('-retries 2')) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should throw error when targets array is empty', async () => {
      const options: NucleiCommandOptions = { targets: [] };
      const inputFile = '/app/results/nuclei-input-test.txt';
      const outputFile = '/app/results/nuclei-output-test.json';

      expect(() => service.buildCommand(options, inputFile, outputFile)).toThrow('At least one target is required');
    });

    it('should use tags when templates are not specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(targetArb, { minLength: 1, maxLength: 5 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9_-]+$/.test(s)), { minLength: 1, maxLength: 5 }),
          async (targets, tags) => {
            const options: NucleiCommandOptions = { targets, tags };
            const inputFile = '/app/results/nuclei-input-test.txt';
            const outputFile = '/app/results/nuclei-output-test.json';

            const command = service.buildCommand(options, inputFile, outputFile);

            // Command should include -tags flag with all tags
            const expectedTags = `-tags ${tags.join(',')}`;
            return command.includes(expectedTags);
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  /**
   * **Feature: advanced-recon-monitoring, Property 7: Nuclei Result Parsing**
   *
   * *For any* valid Nuclei JSON output, parsing SHALL extract severity, templateId,
   * host, and matchedAt fields correctly for each finding.
   *
   * **Validates: Requirements 3.2**
   */
  describe('Property 7: Nuclei Result Parsing', () => {
    it('should extract templateId correctly from template-id field', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-z0-9_-]+$/.test(s)),
          async (templateId) => {
            const rawOutput: RawNucleiOutput = {
              'template-id': templateId,
              info: { severity: 'high' },
            };

            const result = service.parseNucleiOutput(rawOutput);

            return result.templateId === templateId;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract templateId correctly from templateID field when template-id is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-z0-9_-]+$/.test(s)),
          async (templateId) => {
            const rawOutput: RawNucleiOutput = {
              templateID: templateId,
              info: { severity: 'medium' },
            };

            const result = service.parseNucleiOutput(rawOutput);

            return result.templateId === templateId;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract severity correctly and normalize to lowercase', async () => {
      await fc.assert(
        fc.asyncProperty(
          severityArb,
          async (severity) => {
            const rawOutput: RawNucleiOutput = {
              'template-id': 'test-template',
              info: { severity: severity.toUpperCase() },
            };

            const result = service.parseNucleiOutput(rawOutput);

            return result.severity === severity.toLowerCase();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should default severity to info when not provided', async () => {
      const rawOutput: RawNucleiOutput = {
        'template-id': 'test-template',
      };

      const result = service.parseNucleiOutput(rawOutput);

      expect(result.severity).toBe('info');
    });

    it('should extract host correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          targetArb,
          async (host) => {
            const rawOutput: RawNucleiOutput = {
              'template-id': 'test-template',
              host,
              info: { severity: 'low' },
            };

            const result = service.parseNucleiOutput(rawOutput);

            return result.host === host;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract matchedAt from matched field', async () => {
      await fc.assert(
        fc.asyncProperty(
          targetArb,
          async (matchedAt) => {
            const rawOutput: RawNucleiOutput = {
              'template-id': 'test-template',
              matched: matchedAt,
              info: { severity: 'critical' },
            };

            const result = service.parseNucleiOutput(rawOutput);

            return result.matchedAt === matchedAt;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract matchedAt from matched-at field when matched is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          targetArb,
          async (matchedAt) => {
            const rawOutput: RawNucleiOutput = {
              'template-id': 'test-template',
              'matched-at': matchedAt,
              info: { severity: 'high' },
            };

            const result = service.parseNucleiOutput(rawOutput);

            return result.matchedAt === matchedAt;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract extractedResults correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
          async (extractedResults) => {
            const rawOutput: RawNucleiOutput = {
              'template-id': 'test-template',
              'extracted-results': extractedResults,
              info: { severity: 'medium' },
            };

            const result = service.parseNucleiOutput(rawOutput);

            if (result.extractedResults.length !== extractedResults.length) return false;
            return extractedResults.every((r, i) => result.extractedResults[i] === r);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should parse timestamp correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
            .filter((d) => !isNaN(d.getTime())),
          async (date) => {
            const timestamp = date.toISOString();
            const rawOutput: RawNucleiOutput = {
              'template-id': 'test-template',
              timestamp,
              info: { severity: 'info' },
            };

            const result = service.parseNucleiOutput(rawOutput);

            return result.timestamp instanceof Date &&
              result.timestamp.getTime() === new Date(timestamp).getTime();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract curl command correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }),
          async (curlCommand) => {
            const rawOutput: RawNucleiOutput = {
              'template-id': 'test-template',
              'curl-command': curlCommand,
              info: { severity: 'low' },
            };

            const result = service.parseNucleiOutput(rawOutput);

            return result.curl === curlCommand;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract matcher name correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          async (matcherName) => {
            const rawOutput: RawNucleiOutput = {
              'template-id': 'test-template',
              'matcher-name': matcherName,
              info: { severity: 'medium' },
            };

            const result = service.parseNucleiOutput(rawOutput);

            return result.matcher === matcherName;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle all fields being present', async () => {
      await fc.assert(
        fc.asyncProperty(
          rawNucleiOutputArb,
          async (rawOutput) => {
            // Ensure at least one template ID is present
            if (!rawOutput['template-id'] && !rawOutput.templateID) {
              rawOutput['template-id'] = 'test-template';
            }

            const result = service.parseNucleiOutput(rawOutput);

            // Result should have all required fields
            if (typeof result.templateId !== 'string') return false;
            if (typeof result.severity !== 'string') return false;
            if (typeof result.host !== 'string') return false;
            if (typeof result.matchedAt !== 'string') return false;
            if (!Array.isArray(result.extractedResults)) return false;
            if (!(result.timestamp instanceof Date)) return false;
            if (typeof result.curl !== 'string') return false;
            if (typeof result.matcher !== 'string') return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: advanced-recon-monitoring, Property 8: Severity-Based Alerting**
   *
   * *For any* vulnerability finding, an immediate alert SHALL be triggered
   * if and only if severity equals "critical" or "high".
   *
   * **Validates: Requirements 3.3**
   */
  describe('Property 8: Severity-Based Alerting', () => {
    it('should return true for critical severity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant('critical' as NucleiSeverity),
          async (severity) => {
            return service.shouldTriggerAlert(severity) === true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return true for high severity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant('high' as NucleiSeverity),
          async (severity) => {
            return service.shouldTriggerAlert(severity) === true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return false for medium severity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant('medium' as NucleiSeverity),
          async (severity) => {
            return service.shouldTriggerAlert(severity) === false;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return false for low severity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant('low' as NucleiSeverity),
          async (severity) => {
            return service.shouldTriggerAlert(severity) === false;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return false for info severity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant('info' as NucleiSeverity),
          async (severity) => {
            return service.shouldTriggerAlert(severity) === false;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should trigger alert if and only if severity is critical or high', async () => {
      await fc.assert(
        fc.asyncProperty(
          severityArb,
          async (severity) => {
            const shouldAlert = service.shouldTriggerAlert(severity);
            const expected = severity === 'critical' || severity === 'high';
            return shouldAlert === expected;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly determine alerting for parsed results', async () => {
      await fc.assert(
        fc.asyncProperty(
          severityArb,
          async (severity) => {
            const rawOutput: RawNucleiOutput = {
              'template-id': 'test-template',
              info: { severity },
            };

            const result = service.parseNucleiOutput(rawOutput);
            const shouldAlert = service.shouldTriggerAlert(result.severity);
            const expected = severity === 'critical' || severity === 'high';

            return shouldAlert === expected;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
