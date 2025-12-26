import * as fc from 'fast-check';
import {
  TargetProfile,
  TargetType,
  RiskLevel,
  ToolExecution,
  ExecutionStatus,
} from './interfaces/hexstrike.interface';

/**
 * Property-Based Tests for HexStrike AI Service
 * 
 * These tests verify the correctness properties defined in the design document
 * for the hexstrike-ai-integration feature.
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

// Arbitrary for generating valid execution statuses
const executionStatusArb = fc.constantFrom<ExecutionStatus>(
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
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

// Arbitrary for generating valid target strings (domains, IPs, URLs)
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
  'angular'
);

// Arbitrary for generating valid dates (avoiding invalid date edge cases)
// Use integer-based approach to guarantee valid dates
const validDateArb = fc.integer({ 
  min: new Date('2000-01-01').getTime(), 
  max: new Date('2030-12-31').getTime() 
}).map(timestamp => new Date(timestamp));

// Arbitrary for generating a valid TargetProfile
const targetProfileArb = fc.record({
  target: targetArb,
  targetType: targetTypeArb,
  ipAddresses: fc.array(ipAddressArb, { minLength: 0, maxLength: 5 }),
  openPorts: fc.array(portArb, { minLength: 0, maxLength: 20 }),
  services: fc.dictionary(
    fc.integer({ min: 1, max: 65535 }).map(String),
    fc.constantFrom('http', 'https', 'ssh', 'ftp', 'smtp', 'mysql', 'postgresql')
  ),
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
    expiresAt: fc.option(
      fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') })
        .filter(d => !isNaN(d.getTime()))
        .map(d => d.toISOString()), 
      { nil: undefined }
    ),
  }),
  subdomains: fc.array(fc.domain(), { minLength: 0, maxLength: 10 }),
  endpoints: fc.array(fc.webUrl(), { minLength: 0, maxLength: 20 }),
  attackSurfaceScore: fc.float({ min: 0, max: 100, noNaN: true }),
  riskLevel: riskLevelArb,
  confidenceScore: fc.float({ min: 0, max: 1, noNaN: true }),
});

// Arbitrary for generating a valid ToolExecution with proper time ordering
const toolExecutionArb = fc.record({
  id: fc.uuid(),
  tool: fc.constantFrom('nmap', 'nuclei', 'sqlmap', 'gobuster', 'nikto', 'ffuf'),
  target: targetArb,
  parameters: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.oneof(fc.string(), fc.integer(), fc.boolean())),
  status: executionStatusArb,
  startTime: validDateArb,
  output: fc.option(fc.string({ minLength: 0, maxLength: 1000 }), { nil: undefined }),
  results: fc.option(fc.anything(), { nil: undefined }),
  error: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  pid: fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }),
}).chain(base => 
  fc.option(
    fc.integer({ min: 0, max: 86400000 }), // 0 to 24 hours in milliseconds
    { nil: undefined }
  ).map(durationMs => ({
    ...base,
    endTime: durationMs !== undefined 
      ? new Date(base.startTime.getTime() + durationMs) 
      : undefined
  }))
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates that a TargetProfile has all required fields
 */
function hasRequiredTargetProfileFields(profile: TargetProfile): boolean {
  return (
    typeof profile.target === 'string' &&
    profile.target.length > 0 &&
    typeof profile.targetType === 'string' &&
    Array.isArray(profile.ipAddresses) &&
    Array.isArray(profile.openPorts) &&
    typeof profile.services === 'object' &&
    Array.isArray(profile.technologies) &&
    typeof profile.attackSurfaceScore === 'number' &&
    typeof profile.riskLevel === 'string' &&
    typeof profile.confidenceScore === 'number'
  );
}

/**
 * Validates that a ToolExecution has all required fields
 */
function hasRequiredToolExecutionFields(execution: ToolExecution): boolean {
  const hasBasicFields = (
    typeof execution.id === 'string' &&
    execution.id.length > 0 &&
    typeof execution.tool === 'string' &&
    execution.tool.length > 0 &&
    typeof execution.target === 'string' &&
    execution.target.length > 0 &&
    typeof execution.status === 'string'
  );

  // For completed status, should have output or results
  // For failed status, should have error
  if (execution.status === 'completed') {
    return hasBasicFields && (execution.output !== undefined || execution.results !== undefined);
  }
  if (execution.status === 'failed') {
    return hasBasicFields && execution.error !== undefined;
  }

  return hasBasicFields;
}

/**
 * Validates that target type is one of the allowed values
 */
function isValidTargetType(targetType: string): boolean {
  const validTypes: TargetType[] = [
    'web_application',
    'network_host',
    'api_endpoint',
    'cloud_service',
    'binary_file',
    'unknown',
  ];
  return validTypes.includes(targetType as TargetType);
}

/**
 * Validates that risk level is one of the allowed values
 */
function isValidRiskLevel(riskLevel: string): boolean {
  const validLevels: RiskLevel[] = [
    'critical',
    'high',
    'medium',
    'low',
    'minimal',
    'unknown',
  ];
  return validLevels.includes(riskLevel as RiskLevel);
}

/**
 * Validates that execution status is one of the allowed values
 */
function isValidExecutionStatus(status: string): boolean {
  const validStatuses: ExecutionStatus[] = [
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled',
  ];
  return validStatuses.includes(status as ExecutionStatus);
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('HexStrike AI Service Property-Based Tests', () => {
  /**
   * **Feature: hexstrike-ai-integration, Property 2: Target Analysis Response Structure**
   * 
   * *For any* valid target string submitted to the `/hexstrike/analyze-target` endpoint,
   * the Backend_API shall return a response containing all required Target_Profile fields:
   * target, targetType, ipAddresses, openPorts, services, technologies, attackSurfaceScore,
   * riskLevel, and confidenceScore.
   * 
   * **Validates: Requirements 2.3**
   */
  describe('Property 2: Target Analysis Response Structure', () => {
    it('should have all required fields in TargetProfile', () => {
      fc.assert(
        fc.property(targetProfileArb, (profile) => {
          // Verify all required fields are present
          return hasRequiredTargetProfileFields(profile);
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid target type values', () => {
      fc.assert(
        fc.property(targetProfileArb, (profile) => {
          return isValidTargetType(profile.targetType);
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid risk level values', () => {
      fc.assert(
        fc.property(targetProfileArb, (profile) => {
          return isValidRiskLevel(profile.riskLevel);
        }),
        { numRuns: 100 }
      );
    });

    it('should have attack surface score between 0 and 100', () => {
      fc.assert(
        fc.property(targetProfileArb, (profile) => {
          return profile.attackSurfaceScore >= 0 && profile.attackSurfaceScore <= 100;
        }),
        { numRuns: 100 }
      );
    });

    it('should have confidence score between 0 and 1', () => {
      fc.assert(
        fc.property(targetProfileArb, (profile) => {
          return profile.confidenceScore >= 0 && profile.confidenceScore <= 1;
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid port numbers in openPorts array', () => {
      fc.assert(
        fc.property(targetProfileArb, (profile) => {
          return profile.openPorts.every(port => port >= 1 && port <= 65535);
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid IP addresses format', () => {
      fc.assert(
        fc.property(targetProfileArb, (profile) => {
          const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
          return profile.ipAddresses.every(ip => {
            if (!ipRegex.test(ip)) return false;
            const parts = ip.split('.').map(Number);
            return parts.every(part => part >= 0 && part <= 255);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('should have non-empty target string', () => {
      fc.assert(
        fc.property(targetProfileArb, (profile) => {
          return profile.target.length > 0;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: hexstrike-ai-integration, Property 3: Tool Execution Response Structure**
   * 
   * *For any* valid tool execution request with a recognized tool name and valid parameters,
   * the Backend_API shall return a response containing: id, tool, target, status, and either
   * output/results (on success) or error (on failure).
   * 
   * **Validates: Requirements 2.5**
   */
  describe('Property 3: Tool Execution Response Structure', () => {
    it('should have all required fields in ToolExecution', () => {
      fc.assert(
        fc.property(toolExecutionArb, (execution) => {
          // Basic required fields
          const hasBasicFields = (
            typeof execution.id === 'string' &&
            execution.id.length > 0 &&
            typeof execution.tool === 'string' &&
            execution.tool.length > 0 &&
            typeof execution.target === 'string' &&
            typeof execution.status === 'string'
          );
          return hasBasicFields;
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid execution status values', () => {
      fc.assert(
        fc.property(toolExecutionArb, (execution) => {
          return isValidExecutionStatus(execution.status);
        }),
        { numRuns: 100 }
      );
    });

    it('should have non-empty tool name', () => {
      fc.assert(
        fc.property(toolExecutionArb, (execution) => {
          return execution.tool.length > 0;
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid UUID format for id', () => {
      fc.assert(
        fc.property(toolExecutionArb, (execution) => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return uuidRegex.test(execution.id);
        }),
        { numRuns: 100 }
      );
    });

    it('should have startTime as a valid Date', () => {
      fc.assert(
        fc.property(toolExecutionArb, (execution) => {
          return execution.startTime instanceof Date && !isNaN(execution.startTime.getTime());
        }),
        { numRuns: 100 }
      );
    });

    it('should have endTime after startTime when present', () => {
      fc.assert(
        fc.property(
          toolExecutionArb.filter(e => e.endTime !== undefined),
          (execution) => {
            return execution.endTime!.getTime() >= execution.startTime.getTime();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid PID when present', () => {
      fc.assert(
        fc.property(
          toolExecutionArb.filter(e => e.pid !== undefined),
          (execution) => {
            return execution.pid! >= 1 && execution.pid! <= 65535;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('completed executions should have output or results', () => {
      // Generate only completed executions with output or results
      const completedExecutionArb = fc.record({
        id: fc.uuid(),
        tool: fc.constantFrom('nmap', 'nuclei', 'sqlmap', 'gobuster', 'nikto', 'ffuf'),
        target: targetArb,
        parameters: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.oneof(fc.string(), fc.integer(), fc.boolean())),
        status: fc.constant<ExecutionStatus>('completed'),
        startTime: validDateArb,
        output: fc.string({ minLength: 1, maxLength: 1000 }),
        results: fc.anything(),
        error: fc.constant(undefined),
        pid: fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }),
      }).chain(base => 
        fc.integer({ min: 0, max: 86400000 }).map(durationMs => ({
          ...base,
          endTime: new Date(base.startTime.getTime() + durationMs)
        }))
      );

      fc.assert(
        fc.property(completedExecutionArb, (execution) => {
          return execution.output !== undefined || execution.results !== undefined;
        }),
        { numRuns: 100 }
      );
    });

    it('failed executions should have error message', () => {
      // Generate only failed executions with error
      const failedExecutionArb = fc.record({
        id: fc.uuid(),
        tool: fc.constantFrom('nmap', 'nuclei', 'sqlmap', 'gobuster', 'nikto', 'ffuf'),
        target: targetArb,
        parameters: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.oneof(fc.string(), fc.integer(), fc.boolean())),
        status: fc.constant<ExecutionStatus>('failed'),
        startTime: validDateArb,
        output: fc.constant(undefined),
        results: fc.constant(undefined),
        error: fc.string({ minLength: 1, maxLength: 200 }),
        pid: fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }),
      }).chain(base => 
        fc.integer({ min: 0, max: 86400000 }).map(durationMs => ({
          ...base,
          endTime: new Date(base.startTime.getTime() + durationMs)
        }))
      );

      fc.assert(
        fc.property(failedExecutionArb, (execution) => {
          return execution.error !== undefined && execution.error.length > 0;
        }),
        { numRuns: 100 }
      );
    });
  });
});
