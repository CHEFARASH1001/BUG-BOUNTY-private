import * as fc from 'fast-check';
import {
  getSeverityColors,
  getStatusConfig,
  isVulnerability,
  extractVulnerabilities,
  getVulnerabilityName,
  hasVulnerabilities,
  countBySeverity,
  formatResults,
  isTerminalStatus,
  isInProgress,
  VulnerabilitySeverity,
  ExecutionStatus,
  Vulnerability,
  SeverityColorConfig,
} from './ToolResultsDisplay';

/**
 * Property-Based Tests for Tool Results UI Rendering
 * 
 * **Feature: hexstrike-ai-integration, Property 5: Tool Results UI Rendering**
 * 
 * *For any* completed tool execution with results, the Frontend_UI shall render
 * the results in a structured format appropriate to the tool type, with all
 * output data accessible to the user.
 * 
 * **Validates: Requirements 4.4**
 * 
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

// Arbitrary for generating valid severity levels
const severityArb = fc.constantFrom<VulnerabilitySeverity>(
  'critical',
  'high',
  'medium',
  'low',
  'info'
);

// Arbitrary for generating valid execution statuses
const executionStatusArb = fc.constantFrom<ExecutionStatus>(
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

// Arbitrary for generating vulnerability names
const vulnerabilityNameArb = fc.oneof(
  fc.constantFrom(
    'SQL Injection',
    'Cross-Site Scripting (XSS)',
    'Remote Code Execution',
    'Path Traversal',
    'SSRF',
    'Open Redirect',
    'Information Disclosure',
    'Authentication Bypass'
  ),
  fc.string({ minLength: 1, maxLength: 100 })
);

// Arbitrary for generating CVE identifiers
const cveArb = fc.tuple(
  fc.integer({ min: 1999, max: 2025 }),
  fc.integer({ min: 1, max: 99999 })
).map(([year, id]) => `CVE-${year}-${id.toString().padStart(4, '0')}`);

// Arbitrary for generating CVSS scores (0.0 - 10.0)
const cvssArb = fc.float({ min: 0, max: 10, noNaN: true }).map(n => Math.round(n * 10) / 10);

// Arbitrary for generating a valid Vulnerability object
const vulnerabilityArb: fc.Arbitrary<Vulnerability> = fc.record({
  name: fc.option(vulnerabilityNameArb, { nil: undefined }),
  title: fc.option(vulnerabilityNameArb, { nil: undefined }),
  severity: fc.option(severityArb, { nil: undefined }),
  description: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined }),
  evidence: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  remediation: fc.option(fc.string({ minLength: 10, maxLength: 300 }), { nil: undefined }),
  cvss: fc.option(cvssArb, { nil: undefined }),
  cve: fc.option(cveArb, { nil: undefined }),
});

// Arbitrary for generating a vulnerability with required severity (for testing)
const vulnerabilityWithSeverityArb: fc.Arbitrary<Vulnerability> = fc.record({
  name: vulnerabilityNameArb,
  severity: severityArb,
  description: fc.option(fc.string({ minLength: 10, maxLength: 500 }), { nil: undefined }),
  evidence: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  remediation: fc.option(fc.string({ minLength: 10, maxLength: 300 }), { nil: undefined }),
  cvss: fc.option(cvssArb, { nil: undefined }),
  cve: fc.option(cveArb, { nil: undefined }),
});

// Arbitrary for generating non-vulnerability objects
const nonVulnerabilityArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.record({
    message: fc.string(),
    data: fc.array(fc.string()),
  }),
  fc.record({
    host: fc.domain(),
    port: fc.integer({ min: 1, max: 65535 }),
    service: fc.constantFrom('http', 'https', 'ssh', 'ftp'),
  })
);

// Arbitrary for generating mixed results (vulnerabilities and non-vulnerabilities)
const mixedResultsArb = fc.array(
  fc.oneof(vulnerabilityWithSeverityArb, nonVulnerabilityArb),
  { minLength: 0, maxLength: 20 }
);

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Tool Results UI Rendering Property Tests', () => {
  /**
   * **Feature: hexstrike-ai-integration, Property 5: Tool Results UI Rendering**
   * 
   * Tests that the UI helper functions correctly process all tool execution results
   * for rendering purposes.
   * 
   * **Validates: Requirements 4.4**
   */
  describe('Property 5: Tool Results UI Rendering', () => {
    
    describe('Severity Color Mapping', () => {
      it('should return valid color classes for all severity levels', () => {
        fc.assert(
          fc.property(severityArb, (severity) => {
            const colors = getSeverityColors(severity);
            
            // Should return an object with text, bg, and border properties
            expect(colors).toHaveProperty('text');
            expect(colors).toHaveProperty('bg');
            expect(colors).toHaveProperty('border');
            
            // All properties should be non-empty strings
            expect(typeof colors.text).toBe('string');
            expect(typeof colors.bg).toBe('string');
            expect(typeof colors.border).toBe('string');
            expect(colors.text.length).toBeGreaterThan(0);
            expect(colors.bg.length).toBeGreaterThan(0);
            expect(colors.border.length).toBeGreaterThan(0);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should map critical to red colors', () => {
        const colors = getSeverityColors('critical');
        expect(colors.text).toContain('red');
        expect(colors.bg).toContain('red');
        expect(colors.border).toContain('red');
      });

      it('should map high to orange colors', () => {
        const colors = getSeverityColors('high');
        expect(colors.text).toContain('orange');
        expect(colors.bg).toContain('orange');
        expect(colors.border).toContain('orange');
      });

      it('should map medium to yellow colors', () => {
        const colors = getSeverityColors('medium');
        expect(colors.text).toContain('yellow');
        expect(colors.bg).toContain('yellow');
        expect(colors.border).toContain('yellow');
      });

      it('should map low to blue colors', () => {
        const colors = getSeverityColors('low');
        expect(colors.text).toContain('blue');
        expect(colors.bg).toContain('blue');
        expect(colors.border).toContain('blue');
      });

      it('should map info to gray colors', () => {
        const colors = getSeverityColors('info');
        expect(colors.text).toContain('gray');
        expect(colors.bg).toContain('gray');
        expect(colors.border).toContain('gray');
      });

      it('should handle case-insensitive severity input', () => {
        fc.assert(
          fc.property(severityArb, (severity) => {
            const upperColors = getSeverityColors(severity.toUpperCase() as any);
            const lowerColors = getSeverityColors(severity.toLowerCase() as any);
            const mixedColors = getSeverityColors(severity as any);
            
            // All should produce the same result
            expect(upperColors).toEqual(lowerColors);
            expect(lowerColors).toEqual(mixedColors);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return default colors for unknown severity', () => {
        const colors = getSeverityColors('unknown' as any);
        expect(colors.text).toContain('gray');
        expect(colors.bg).toContain('gray');
        expect(colors.border).toContain('gray');
      });
    });

    describe('Status Configuration', () => {
      it('should return valid status config for all execution statuses', () => {
        fc.assert(
          fc.property(executionStatusArb, (status) => {
            const config = getStatusConfig(status);
            
            // Should return an object with icon, color, and bg properties
            expect(config).toHaveProperty('icon');
            expect(config).toHaveProperty('color');
            expect(config).toHaveProperty('bg');
            
            // Icon should be defined
            expect(config.icon).toBeDefined();
            
            // Color and bg should be non-empty strings
            expect(typeof config.color).toBe('string');
            expect(typeof config.bg).toBe('string');
            expect(config.color.length).toBeGreaterThan(0);
            expect(config.bg.length).toBeGreaterThan(0);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return consistent config for same status', () => {
        fc.assert(
          fc.property(executionStatusArb, (status) => {
            const config1 = getStatusConfig(status);
            const config2 = getStatusConfig(status);
            
            expect(config1.icon).toBe(config2.icon);
            expect(config1.color).toBe(config2.color);
            expect(config1.bg).toBe(config2.bg);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Vulnerability Detection', () => {
      it('should correctly identify vulnerability objects', () => {
        fc.assert(
          fc.property(vulnerabilityWithSeverityArb, (vuln) => {
            expect(isVulnerability(vuln)).toBe(true);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should reject non-vulnerability objects', () => {
        fc.assert(
          fc.property(fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.constant(undefined)), (item) => {
            expect(isVulnerability(item)).toBe(false);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should identify objects with severity field as vulnerabilities', () => {
        fc.assert(
          fc.property(severityArb, (severity) => {
            const obj = { severity, someOtherField: 'value' };
            expect(isVulnerability(obj)).toBe(true);
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Vulnerability Extraction', () => {
      it('should extract vulnerabilities from array results', () => {
        fc.assert(
          fc.property(fc.array(vulnerabilityWithSeverityArb, { minLength: 1, maxLength: 10 }), (vulns) => {
            const extracted = extractVulnerabilities(vulns);
            
            // Should extract all vulnerabilities
            expect(extracted.length).toBe(vulns.length);
            
            // Each extracted item should be a vulnerability
            extracted.forEach(v => {
              expect(isVulnerability(v)).toBe(true);
            });
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should extract vulnerabilities from object with vulnerabilities field', () => {
        fc.assert(
          fc.property(fc.array(vulnerabilityWithSeverityArb, { minLength: 1, maxLength: 10 }), (vulns) => {
            const results = { vulnerabilities: vulns, otherData: 'ignored' };
            const extracted = extractVulnerabilities(results);
            
            expect(extracted.length).toBe(vulns.length);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return empty array for null/undefined results', () => {
        expect(extractVulnerabilities(null)).toEqual([]);
        expect(extractVulnerabilities(undefined)).toEqual([]);
      });

      it('should filter out non-vulnerability items from mixed results', () => {
        fc.assert(
          fc.property(mixedResultsArb, (results) => {
            const extracted = extractVulnerabilities(results);
            
            // All extracted items should be vulnerabilities
            extracted.forEach(v => {
              expect(isVulnerability(v)).toBe(true);
            });
            
            // Count should be <= original length
            expect(extracted.length).toBeLessThanOrEqual(results.length);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Vulnerability Name Extraction', () => {
      it('should return name if present', () => {
        fc.assert(
          fc.property(vulnerabilityNameArb, (name) => {
            const vuln: Vulnerability = { name };
            expect(getVulnerabilityName(vuln)).toBe(name);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return title if name is not present', () => {
        fc.assert(
          fc.property(vulnerabilityNameArb, (title) => {
            const vuln: Vulnerability = { title };
            expect(getVulnerabilityName(vuln)).toBe(title);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return default if neither name nor title is present', () => {
        const vuln: Vulnerability = { severity: 'high' };
        expect(getVulnerabilityName(vuln)).toBe('Vulnerability');
      });

      it('should prefer name over title', () => {
        fc.assert(
          fc.property(vulnerabilityNameArb, vulnerabilityNameArb, (name, title) => {
            const vuln: Vulnerability = { name, title };
            expect(getVulnerabilityName(vuln)).toBe(name);
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Has Vulnerabilities Check', () => {
      it('should return true when vulnerabilities exist', () => {
        fc.assert(
          fc.property(fc.array(vulnerabilityWithSeverityArb, { minLength: 1, maxLength: 10 }), (vulns) => {
            expect(hasVulnerabilities(vulns)).toBe(true);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return false for empty results', () => {
        expect(hasVulnerabilities([])).toBe(false);
        expect(hasVulnerabilities(null)).toBe(false);
        expect(hasVulnerabilities(undefined)).toBe(false);
      });

      it('should return false for non-vulnerability results', () => {
        fc.assert(
          fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 10 }), (results) => {
            expect(hasVulnerabilities(results)).toBe(false);
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Count By Severity', () => {
      it('should correctly count vulnerabilities by severity', () => {
        fc.assert(
          fc.property(fc.array(vulnerabilityWithSeverityArb, { minLength: 0, maxLength: 20 }), (vulns) => {
            const counts = countBySeverity(vulns);
            
            // Should have all severity keys
            expect(counts).toHaveProperty('critical');
            expect(counts).toHaveProperty('high');
            expect(counts).toHaveProperty('medium');
            expect(counts).toHaveProperty('low');
            expect(counts).toHaveProperty('info');
            
            // Total count should equal input length
            const total = counts.critical + counts.high + counts.medium + counts.low + counts.info;
            expect(total).toBe(vulns.length);
            
            // All counts should be non-negative
            Object.values(counts).forEach(count => {
              expect(count).toBeGreaterThanOrEqual(0);
            });
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return zero counts for empty array', () => {
        const counts = countBySeverity([]);
        expect(counts.critical).toBe(0);
        expect(counts.high).toBe(0);
        expect(counts.medium).toBe(0);
        expect(counts.low).toBe(0);
        expect(counts.info).toBe(0);
      });
    });

    describe('Format Results', () => {
      it('should return empty string for null/undefined', () => {
        expect(formatResults(null)).toBe('');
        expect(formatResults(undefined)).toBe('');
      });

      it('should return string as-is', () => {
        fc.assert(
          fc.property(fc.string(), (str) => {
            expect(formatResults(str)).toBe(str);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should JSON stringify objects', () => {
        fc.assert(
          fc.property(fc.object(), (obj) => {
            const formatted = formatResults(obj);
            expect(typeof formatted).toBe('string');
            // Should be valid JSON
            expect(() => JSON.parse(formatted)).not.toThrow();
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should JSON stringify arrays', () => {
        fc.assert(
          fc.property(fc.array(fc.anything()), (arr) => {
            const formatted = formatResults(arr);
            expect(typeof formatted).toBe('string');
            // Should be valid JSON
            expect(() => JSON.parse(formatted)).not.toThrow();
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Terminal Status Check', () => {
      it('should return true for terminal statuses', () => {
        expect(isTerminalStatus('completed')).toBe(true);
        expect(isTerminalStatus('failed')).toBe(true);
        expect(isTerminalStatus('cancelled')).toBe(true);
      });

      it('should return false for non-terminal statuses', () => {
        expect(isTerminalStatus('pending')).toBe(false);
        expect(isTerminalStatus('running')).toBe(false);
      });

      it('should be mutually exclusive with isInProgress', () => {
        fc.assert(
          fc.property(executionStatusArb, (status) => {
            const terminal = isTerminalStatus(status);
            const inProgress = isInProgress(status);
            
            // Should be mutually exclusive
            expect(terminal !== inProgress).toBe(true);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('In Progress Check', () => {
      it('should return true for in-progress statuses', () => {
        expect(isInProgress('pending')).toBe(true);
        expect(isInProgress('running')).toBe(true);
      });

      it('should return false for terminal statuses', () => {
        expect(isInProgress('completed')).toBe(false);
        expect(isInProgress('failed')).toBe(false);
        expect(isInProgress('cancelled')).toBe(false);
      });
    });

    describe('Rendering Consistency', () => {
      it('should produce consistent severity colors for same severity', () => {
        fc.assert(
          fc.property(severityArb, (severity) => {
            const colors1 = getSeverityColors(severity);
            const colors2 = getSeverityColors(severity);
            
            expect(colors1.text).toBe(colors2.text);
            expect(colors1.bg).toBe(colors2.bg);
            expect(colors1.border).toBe(colors2.border);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should produce different colors for different severities', () => {
        const severities: VulnerabilitySeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
        const colorSets = new Set<string>();
        
        severities.forEach(severity => {
          const colors = getSeverityColors(severity);
          colorSets.add(colors.text);
        });
        
        // Should have 5 different text colors
        expect(colorSets.size).toBe(5);
      });
    });
  });
});
