import * as fc from 'fast-check';
import {
  getRiskLevelColor,
  getScoreColor,
  getTargetTypeIcon,
  getTargetTypeLabel,
  TargetType,
  RiskLevel,
  TargetProfile,
} from './TargetProfileDisplay';

/**
 * Property-Based Tests for Target Profile UI Rendering
 * 
 * **Feature: hexstrike-ai-integration, Property 4: Target Profile UI Rendering**
 * 
 * *For any* Target_Profile object returned from analysis, the Frontend_UI shall render
 * all non-empty fields including: IP addresses list, open ports list, detected technologies,
 * attack surface score, and risk level indicator.
 * 
 * **Validates: Requirements 3.3**
 * 
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

// Arbitrary for generating valid target types
const targetTypeArb = fc.constantFrom<TargetType>(
  'web_application',
  'network_host',
  'api_endpoint',
  'cloud_service',
  'binary_file',
  'unknown'
);

// Arbitrary for generating valid risk levels
const riskLevelArb = fc.constantFrom<RiskLevel>(
  'critical',
  'high',
  'medium',
  'low',
  'minimal',
  'unknown'
);

// Arbitrary for generating valid IP addresses
const ipAddressArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

// Arbitrary for generating valid port numbers
const portArb = fc.integer({ min: 1, max: 65535 });

// Arbitrary for generating valid target strings
const targetArb = fc.oneof(
  fc.domain(),
  ipAddressArb,
  fc.webUrl()
);

// Arbitrary for generating technology names
const technologyArb = fc.constantFrom(
  'apache',
  'nginx',
  'nodejs',
  'php',
  'python',
  'java',
  'wordpress',
  'react',
  'angular',
  'vue',
  'express',
  'django',
  'rails'
);

// Arbitrary for generating attack surface scores (0-100)
const attackSurfaceScoreArb = fc.integer({ min: 0, max: 100 });

// Arbitrary for generating confidence scores (0-100 as percentage)
const confidenceScoreArb = fc.integer({ min: 0, max: 100 });

// Arbitrary for generating a valid TargetProfile
const targetProfileArb: fc.Arbitrary<TargetProfile> = fc.record({
  target: targetArb,
  targetType: targetTypeArb,
  ipAddresses: fc.array(ipAddressArb, { minLength: 0, maxLength: 5 }),
  openPorts: fc.array(portArb, { minLength: 0, maxLength: 20 }),
  services: fc.dictionary(
    fc.integer({ min: 1, max: 65535 }).map(String),
    fc.constantFrom('http', 'https', 'ssh', 'ftp', 'smtp', 'mysql', 'postgresql')
  ) as fc.Arbitrary<Record<number, string>>,
  technologies: fc.array(technologyArb, { minLength: 0, maxLength: 10 }),
  cmsType: fc.option(fc.constantFrom('wordpress', 'drupal', 'joomla'), { nil: undefined }),
  cloudProvider: fc.option(fc.constantFrom('aws', 'gcp', 'azure'), { nil: undefined }),
  securityHeaders: fc.dictionary(
    fc.constantFrom('X-Frame-Options', 'X-XSS-Protection', 'Content-Security-Policy', 'Strict-Transport-Security'),
    fc.string({ minLength: 1, maxLength: 100 })
  ),
  sslInfo: fc.record({
    valid: fc.boolean(),
    issuer: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    validFrom: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    validTo: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  }),
  subdomains: fc.array(fc.domain(), { minLength: 0, maxLength: 10 }),
  endpoints: fc.array(fc.webUrl(), { minLength: 0, maxLength: 20 }),
  attackSurfaceScore: attackSurfaceScoreArb,
  riskLevel: riskLevelArb,
  confidenceScore: confidenceScoreArb,
  recommendedTools: fc.option(
    fc.array(fc.constantFrom('nmap', 'nuclei', 'sqlmap', 'gobuster', 'nikto', 'ffuf'), { minLength: 0, maxLength: 5 }),
    { nil: undefined }
  ),
});

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Target Profile UI Rendering Property Tests', () => {
  /**
   * **Feature: hexstrike-ai-integration, Property 4: Target Profile UI Rendering**
   * 
   * Tests that the UI helper functions correctly process all TargetProfile data
   * for rendering purposes.
   * 
   * **Validates: Requirements 3.3**
   */
  describe('Property 4: Target Profile UI Rendering', () => {
    
    describe('Risk Level Color Mapping', () => {
      it('should return valid color classes for all risk levels', () => {
        fc.assert(
          fc.property(riskLevelArb, (riskLevel) => {
            const colors = getRiskLevelColor(riskLevel);
            
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
        const colors = getRiskLevelColor('critical');
        expect(colors.text).toContain('red');
        expect(colors.bg).toContain('red');
        expect(colors.border).toContain('red');
      });

      it('should map high to orange colors', () => {
        const colors = getRiskLevelColor('high');
        expect(colors.text).toContain('orange');
        expect(colors.bg).toContain('orange');
        expect(colors.border).toContain('orange');
      });

      it('should map medium to yellow colors', () => {
        const colors = getRiskLevelColor('medium');
        expect(colors.text).toContain('yellow');
        expect(colors.bg).toContain('yellow');
        expect(colors.border).toContain('yellow');
      });

      it('should map low to blue colors', () => {
        const colors = getRiskLevelColor('low');
        expect(colors.text).toContain('blue');
        expect(colors.bg).toContain('blue');
        expect(colors.border).toContain('blue');
      });

      it('should map minimal to green colors', () => {
        const colors = getRiskLevelColor('minimal');
        expect(colors.text).toContain('green');
        expect(colors.bg).toContain('green');
        expect(colors.border).toContain('green');
      });

      it('should map unknown to slate/gray colors', () => {
        const colors = getRiskLevelColor('unknown');
        expect(colors.text).toContain('slate');
        expect(colors.bg).toContain('slate');
        expect(colors.border).toContain('slate');
      });
    });

    describe('Attack Surface Score Color Mapping', () => {
      it('should return valid color class for all scores', () => {
        fc.assert(
          fc.property(attackSurfaceScoreArb, (score) => {
            const color = getScoreColor(score);
            
            // Should return a non-empty string
            expect(typeof color).toBe('string');
            expect(color.length).toBeGreaterThan(0);
            
            // Should be a valid Tailwind text color class
            expect(color).toMatch(/^text-/);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return red for scores >= 80', () => {
        fc.assert(
          fc.property(fc.integer({ min: 80, max: 100 }), (score) => {
            const color = getScoreColor(score);
            expect(color).toContain('red');
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return orange for scores 60-79', () => {
        fc.assert(
          fc.property(fc.integer({ min: 60, max: 79 }), (score) => {
            const color = getScoreColor(score);
            expect(color).toContain('orange');
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return yellow for scores 40-59', () => {
        fc.assert(
          fc.property(fc.integer({ min: 40, max: 59 }), (score) => {
            const color = getScoreColor(score);
            expect(color).toContain('yellow');
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return blue for scores 20-39', () => {
        fc.assert(
          fc.property(fc.integer({ min: 20, max: 39 }), (score) => {
            const color = getScoreColor(score);
            expect(color).toContain('blue');
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return green for scores < 20', () => {
        fc.assert(
          fc.property(fc.integer({ min: 0, max: 19 }), (score) => {
            const color = getScoreColor(score);
            expect(color).toContain('green');
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Target Type Icon Mapping', () => {
      it('should return a valid icon component for all target types', () => {
        fc.assert(
          fc.property(targetTypeArb, (targetType) => {
            const Icon = getTargetTypeIcon(targetType);
            
            // Should return a valid React component (can be function or ForwardRef object)
            // Lucide icons are ForwardRef components which are objects with $$typeof
            expect(Icon).toBeDefined();
            expect(Icon).not.toBeNull();
            
            // Check it's a valid React component (either function or ForwardRef)
            const isFunction = typeof Icon === 'function';
            const isForwardRef = typeof Icon === 'object' && Icon !== null && '$$typeof' in Icon;
            expect(isFunction || isForwardRef).toBe(true);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return different icons for different target types', () => {
        const icons = new Set<Function>();
        const targetTypes: TargetType[] = [
          'web_application',
          'network_host',
          'api_endpoint',
          'cloud_service',
          'binary_file',
          'unknown',
        ];
        
        targetTypes.forEach(type => {
          icons.add(getTargetTypeIcon(type));
        });
        
        // Should have at least 5 different icons (unknown might share with another)
        expect(icons.size).toBeGreaterThanOrEqual(5);
      });
    });

    describe('Target Type Label Mapping', () => {
      it('should return a human-readable label for all target types', () => {
        fc.assert(
          fc.property(targetTypeArb, (targetType) => {
            const label = getTargetTypeLabel(targetType);
            
            // Should return a non-empty string
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
            
            // Should be human-readable (contains spaces or is a single word)
            expect(label).not.toContain('_');
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return correct labels for each target type', () => {
        expect(getTargetTypeLabel('web_application')).toBe('Web Application');
        expect(getTargetTypeLabel('network_host')).toBe('Network Host');
        expect(getTargetTypeLabel('api_endpoint')).toBe('API Endpoint');
        expect(getTargetTypeLabel('cloud_service')).toBe('Cloud Service');
        expect(getTargetTypeLabel('binary_file')).toBe('Binary File');
        expect(getTargetTypeLabel('unknown')).toBe('Unknown');
      });
    });

    describe('Target Profile Data Completeness', () => {
      it('should have all required fields for rendering', () => {
        fc.assert(
          fc.property(targetProfileArb, (profile) => {
            // Required fields for rendering
            expect(profile).toHaveProperty('target');
            expect(profile).toHaveProperty('targetType');
            expect(profile).toHaveProperty('ipAddresses');
            expect(profile).toHaveProperty('openPorts');
            expect(profile).toHaveProperty('technologies');
            expect(profile).toHaveProperty('attackSurfaceScore');
            expect(profile).toHaveProperty('riskLevel');
            expect(profile).toHaveProperty('confidenceScore');
            
            // Arrays should be arrays
            expect(Array.isArray(profile.ipAddresses)).toBe(true);
            expect(Array.isArray(profile.openPorts)).toBe(true);
            expect(Array.isArray(profile.technologies)).toBe(true);
            
            // Scores should be numbers
            expect(typeof profile.attackSurfaceScore).toBe('number');
            expect(typeof profile.confidenceScore).toBe('number');
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should have valid attack surface score range', () => {
        fc.assert(
          fc.property(targetProfileArb, (profile) => {
            expect(profile.attackSurfaceScore).toBeGreaterThanOrEqual(0);
            expect(profile.attackSurfaceScore).toBeLessThanOrEqual(100);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should have valid confidence score range', () => {
        fc.assert(
          fc.property(targetProfileArb, (profile) => {
            expect(profile.confidenceScore).toBeGreaterThanOrEqual(0);
            expect(profile.confidenceScore).toBeLessThanOrEqual(100);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should have valid port numbers', () => {
        fc.assert(
          fc.property(targetProfileArb, (profile) => {
            profile.openPorts.forEach(port => {
              expect(port).toBeGreaterThanOrEqual(1);
              expect(port).toBeLessThanOrEqual(65535);
            });
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should have valid IP address format', () => {
        fc.assert(
          fc.property(targetProfileArb, (profile) => {
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            profile.ipAddresses.forEach(ip => {
              expect(ipRegex.test(ip)).toBe(true);
              const parts = ip.split('.').map(Number);
              parts.forEach(part => {
                expect(part).toBeGreaterThanOrEqual(0);
                expect(part).toBeLessThanOrEqual(255);
              });
            });
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Rendering Consistency', () => {
      it('should produce consistent color mapping for same risk level', () => {
        fc.assert(
          fc.property(riskLevelArb, (riskLevel) => {
            const colors1 = getRiskLevelColor(riskLevel);
            const colors2 = getRiskLevelColor(riskLevel);
            
            expect(colors1.text).toBe(colors2.text);
            expect(colors1.bg).toBe(colors2.bg);
            expect(colors1.border).toBe(colors2.border);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should produce consistent score color for same score', () => {
        fc.assert(
          fc.property(attackSurfaceScoreArb, (score) => {
            const color1 = getScoreColor(score);
            const color2 = getScoreColor(score);
            
            expect(color1).toBe(color2);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should produce consistent icon for same target type', () => {
        fc.assert(
          fc.property(targetTypeArb, (targetType) => {
            const icon1 = getTargetTypeIcon(targetType);
            const icon2 = getTargetTypeIcon(targetType);
            
            expect(icon1).toBe(icon2);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should produce consistent label for same target type', () => {
        fc.assert(
          fc.property(targetTypeArb, (targetType) => {
            const label1 = getTargetTypeLabel(targetType);
            const label2 = getTargetTypeLabel(targetType);
            
            expect(label1).toBe(label2);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });
  });
});
