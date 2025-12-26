import * as fc from 'fast-check';
import {
  WorkflowType,
  WorkflowStatus,
  SeverityLevel,
  Finding,
  WorkflowExecution,
  WorkflowReport,
  calculateDuration,
  formatDuration,
  generateRecommendations,
  generateSummary,
  generateWorkflowReport,
  validateWorkflowReport,
  getSeverityColor,
  countFindingsBySeverity,
} from './WorkflowReportUtils';

/**
 * Property-Based Tests for Workflow Report Generation
 * 
 * **Feature: hexstrike-ai-integration, Property 7: Workflow Report Generation**
 * 
 * *For any* completed AI_Agent workflow, the Frontend_UI shall generate and display
 * a report containing: workflow type, execution duration, steps completed, findings
 * discovered, and recommendations.
 * 
 * **Validates: Requirements 5.5**
 * 
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

const workflowTypeArb = fc.constantFrom<WorkflowType>(
  'bugbounty', 'ctf', 'reconnaissance', 'vulnerability-hunting', 'osint'
);

const workflowStatusArb = fc.constantFrom<WorkflowStatus>(
  'pending', 'running', 'completed', 'failed', 'paused', 'cancelled'
);

const severityLevelArb = fc.constantFrom<SeverityLevel>(
  'critical', 'high', 'medium', 'low', 'info'
);

const toolNameArb = fc.constantFrom(
  'nmap', 'nuclei', 'sqlmap', 'ffuf', 'nikto', 'gobuster', 'amass', 'subfinder'
);


const findingArb: fc.Arbitrary<Finding> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  severity: severityLevelArb,
  description: fc.string({ minLength: 1, maxLength: 500 }),
  tool: toolNameArb,
  evidence: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  remediation: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
});

// Generate valid ISO date strings using integer timestamps
const isoDateArb = fc.integer({ 
  min: new Date('2020-01-01').getTime(), 
  max: new Date('2025-12-31').getTime() 
}).map(ts => new Date(ts).toISOString());

// Generate a pair of dates where end >= start
const dateRangeArb = fc.tuple(
  fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-06-01').getTime() }),
  fc.integer({ min: 0, max: 86400 }) // 0 to 24 hours in seconds
).map(([startTs, durationSec]) => {
  const start = new Date(startTs);
  const end = new Date(startTs + durationSec * 1000);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
});

// Generate workflow execution with valid step counts
const workflowExecutionArb: fc.Arbitrary<WorkflowExecution> = fc.record({
  id: fc.uuid(),
  type: workflowTypeArb,
  target: fc.oneof(fc.domain(), fc.ipV4()),
  status: workflowStatusArb,
  currentStep: fc.integer({ min: 0, max: 20 }),
  totalSteps: fc.integer({ min: 1, max: 20 }),
  startTime: isoDateArb,
  endTime: fc.option(isoDateArb, { nil: undefined }),
  findings: fc.array(findingArb, { minLength: 0, maxLength: 10 }),
}).map(exec => ({
  ...exec,
  // Ensure currentStep <= totalSteps
  currentStep: Math.min(exec.currentStep, exec.totalSteps),
}));

// Generate completed workflow execution (for report generation)
const completedExecutionArb: fc.Arbitrary<WorkflowExecution> = fc.record({
  id: fc.uuid(),
  type: workflowTypeArb,
  target: fc.oneof(fc.domain(), fc.ipV4()),
  status: fc.constant<WorkflowStatus>('completed'),
  currentStep: fc.integer({ min: 1, max: 20 }),
  totalSteps: fc.integer({ min: 1, max: 20 }),
  startTime: isoDateArb,
  endTime: isoDateArb,
  findings: fc.array(findingArb, { minLength: 0, maxLength: 10 }),
}).map(exec => ({
  ...exec,
  currentStep: exec.totalSteps, // Completed means all steps done
}));


// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Workflow Report Generation Property Tests', () => {
  /**
   * **Feature: hexstrike-ai-integration, Property 7: Workflow Report Generation**
   * 
   * Tests that workflow reports are correctly generated for completed workflows
   * and contain all required fields.
   * 
   * **Validates: Requirements 5.5**
   */
  describe('Property 7: Workflow Report Generation', () => {

    describe('Duration Calculation', () => {
      it('should calculate non-negative duration for valid date ranges', () => {
        fc.assert(
          fc.property(dateRangeArb, ({ startTime, endTime }) => {
            const duration = calculateDuration(startTime, endTime);
            expect(duration).toBeGreaterThanOrEqual(0);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return 0 for same start and end time', () => {
        fc.assert(
          fc.property(isoDateArb, (dateStr) => {
            const duration = calculateDuration(dateStr, dateStr);
            expect(duration).toBe(0);
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Duration Formatting', () => {
      it('should format all durations as non-empty strings', () => {
        fc.assert(
          fc.property(fc.integer({ min: 0, max: 86400 }), (seconds) => {
            const formatted = formatDuration(seconds);
            expect(typeof formatted).toBe('string');
            expect(formatted.length).toBeGreaterThan(0);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should format seconds correctly for values < 60', () => {
        fc.assert(
          fc.property(fc.integer({ min: 0, max: 59 }), (seconds) => {
            const formatted = formatDuration(seconds);
            expect(formatted).toMatch(/^\d+s$/);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should format minutes correctly for values 60-3599', () => {
        fc.assert(
          fc.property(fc.integer({ min: 60, max: 3599 }), (seconds) => {
            const formatted = formatDuration(seconds);
            expect(formatted).toMatch(/^\d+m \d+s$/);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should format hours correctly for values >= 3600', () => {
        fc.assert(
          fc.property(fc.integer({ min: 3600, max: 86400 }), (seconds) => {
            const formatted = formatDuration(seconds);
            expect(formatted).toMatch(/^\d+h \d+m$/);
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });


    describe('Recommendations Generation', () => {
      it('should return an array of recommendations for any findings', () => {
        fc.assert(
          fc.property(fc.array(findingArb, { minLength: 0, maxLength: 10 }), (findings) => {
            const recommendations = generateRecommendations(findings);
            expect(Array.isArray(recommendations)).toBe(true);
            recommendations.forEach(rec => {
              expect(typeof rec).toBe('string');
              expect(rec.length).toBeGreaterThan(0);
            });
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should include critical recommendation when critical findings exist', () => {
        fc.assert(
          fc.property(
            fc.array(findingArb.filter(f => f.severity === 'critical'), { minLength: 1, maxLength: 5 }),
            (criticalFindings) => {
              const recommendations = generateRecommendations(criticalFindings);
              const hasCriticalRec = recommendations.some(r => 
                r.toLowerCase().includes('critical')
              );
              expect(hasCriticalRec).toBe(true);
              return true;
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should include high severity recommendation when high findings exist', () => {
        fc.assert(
          fc.property(
            fc.array(findingArb.filter(f => f.severity === 'high'), { minLength: 1, maxLength: 5 }),
            (highFindings) => {
              const recommendations = generateRecommendations(highFindings);
              const hasHighRec = recommendations.some(r => 
                r.toLowerCase().includes('high')
              );
              expect(hasHighRec).toBe(true);
              return true;
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Summary Generation', () => {
      it('should generate non-empty summary for any workflow', () => {
        fc.assert(
          fc.property(
            workflowTypeArb,
            fc.domain(),
            fc.integer({ min: 0, max: 20 }),
            fc.integer({ min: 1, max: 20 }),
            fc.array(findingArb, { minLength: 0, maxLength: 10 }),
            (type, target, steps, total, findings) => {
              const summary = generateSummary(type, target, Math.min(steps, total), total, findings);
              expect(typeof summary).toBe('string');
              expect(summary.length).toBeGreaterThan(0);
              return true;
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should include workflow type in summary', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const summary = generateSummary(
              execution.type,
              execution.target,
              execution.currentStep,
              execution.totalSteps,
              execution.findings
            );
            expect(summary).toContain(execution.type);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should include target in summary', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const summary = generateSummary(
              execution.type,
              execution.target,
              execution.currentStep,
              execution.totalSteps,
              execution.findings
            );
            expect(summary).toContain(execution.target);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should include findings count in summary', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const summary = generateSummary(
              execution.type,
              execution.target,
              execution.currentStep,
              execution.totalSteps,
              execution.findings
            );
            expect(summary).toContain(String(execution.findings.length));
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });


    describe('Report Generation', () => {
      it('should generate valid report for completed workflows', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const report = generateWorkflowReport(execution);
            
            // Should return a report for completed workflows
            expect(report).not.toBeNull();
            if (report) {
              expect(validateWorkflowReport(report)).toBe(true);
            }
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return null for non-completed workflows', () => {
        fc.assert(
          fc.property(
            workflowExecutionArb.filter(e => e.status !== 'completed'),
            (execution) => {
              const report = generateWorkflowReport(execution);
              expect(report).toBeNull();
              return true;
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should include workflow type in report', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const report = generateWorkflowReport(execution);
            expect(report).not.toBeNull();
            expect(report!.workflowType).toBe(execution.type);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should include target in report', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const report = generateWorkflowReport(execution);
            expect(report).not.toBeNull();
            expect(report!.target).toBe(execution.target);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should include non-negative execution duration', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const report = generateWorkflowReport(execution);
            expect(report).not.toBeNull();
            expect(report!.executionDuration).toBeGreaterThanOrEqual(0);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should include steps completed and total steps', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const report = generateWorkflowReport(execution);
            expect(report).not.toBeNull();
            expect(report!.stepsCompleted).toBe(execution.currentStep);
            expect(report!.totalSteps).toBe(execution.totalSteps);
            expect(report!.stepsCompleted).toBeLessThanOrEqual(report!.totalSteps);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should include all findings from execution', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const report = generateWorkflowReport(execution);
            expect(report).not.toBeNull();
            expect(report!.findings).toEqual(execution.findings);
            expect(report!.findings.length).toBe(execution.findings.length);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should include recommendations array', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const report = generateWorkflowReport(execution);
            expect(report).not.toBeNull();
            expect(Array.isArray(report!.recommendations)).toBe(true);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should include non-empty summary', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const report = generateWorkflowReport(execution);
            expect(report).not.toBeNull();
            expect(typeof report!.summary).toBe('string');
            expect(report!.summary.length).toBeGreaterThan(0);
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });


    describe('Severity Color Mapping', () => {
      it('should return valid color objects for all severity levels', () => {
        fc.assert(
          fc.property(severityLevelArb, (severity) => {
            const colors = getSeverityColor(severity);
            expect(colors).toHaveProperty('bg');
            expect(colors).toHaveProperty('text');
            expect(colors).toHaveProperty('border');
            expect(typeof colors.bg).toBe('string');
            expect(typeof colors.text).toBe('string');
            expect(typeof colors.border).toBe('string');
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should map critical to red colors', () => {
        const colors = getSeverityColor('critical');
        expect(colors.text).toContain('red');
        expect(colors.bg).toContain('red');
        expect(colors.border).toContain('red');
      });

      it('should map high to orange colors', () => {
        const colors = getSeverityColor('high');
        expect(colors.text).toContain('orange');
        expect(colors.bg).toContain('orange');
        expect(colors.border).toContain('orange');
      });

      it('should map medium to yellow colors', () => {
        const colors = getSeverityColor('medium');
        expect(colors.text).toContain('yellow');
        expect(colors.bg).toContain('yellow');
        expect(colors.border).toContain('yellow');
      });

      it('should map low to blue colors', () => {
        const colors = getSeverityColor('low');
        expect(colors.text).toContain('blue');
        expect(colors.bg).toContain('blue');
        expect(colors.border).toContain('blue');
      });

      it('should map info to gray colors', () => {
        const colors = getSeverityColor('info');
        expect(colors.text).toContain('gray');
        expect(colors.bg).toContain('gray');
        expect(colors.border).toContain('gray');
      });
    });

    describe('Findings Count by Severity', () => {
      it('should count all severity levels correctly', () => {
        fc.assert(
          fc.property(fc.array(findingArb, { minLength: 0, maxLength: 20 }), (findings) => {
            const counts = countFindingsBySeverity(findings);
            
            // Should have all severity levels
            expect(counts).toHaveProperty('critical');
            expect(counts).toHaveProperty('high');
            expect(counts).toHaveProperty('medium');
            expect(counts).toHaveProperty('low');
            expect(counts).toHaveProperty('info');
            
            // Sum should equal total findings
            const total = counts.critical + counts.high + counts.medium + counts.low + counts.info;
            expect(total).toBe(findings.length);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return zero counts for empty findings', () => {
        const counts = countFindingsBySeverity([]);
        expect(counts.critical).toBe(0);
        expect(counts.high).toBe(0);
        expect(counts.medium).toBe(0);
        expect(counts.low).toBe(0);
        expect(counts.info).toBe(0);
      });
    });

    describe('Report Validation', () => {
      it('should validate correctly generated reports', () => {
        fc.assert(
          fc.property(completedExecutionArb, (execution) => {
            const report = generateWorkflowReport(execution);
            expect(report).not.toBeNull();
            expect(validateWorkflowReport(report!)).toBe(true);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should reject reports with missing workflow type', () => {
        const invalidReport = {
          workflowType: '',
          target: 'example.com',
          executionDuration: 100,
          stepsCompleted: 5,
          totalSteps: 5,
          findings: [],
          recommendations: [],
          summary: 'Test summary',
        };
        expect(validateWorkflowReport(invalidReport)).toBe(false);
      });

      it('should reject reports with negative duration', () => {
        const invalidReport = {
          workflowType: 'reconnaissance',
          target: 'example.com',
          executionDuration: -1,
          stepsCompleted: 5,
          totalSteps: 5,
          findings: [],
          recommendations: [],
          summary: 'Test summary',
        };
        expect(validateWorkflowReport(invalidReport)).toBe(false);
      });

      it('should reject reports where stepsCompleted > totalSteps', () => {
        const invalidReport = {
          workflowType: 'reconnaissance',
          target: 'example.com',
          executionDuration: 100,
          stepsCompleted: 10,
          totalSteps: 5,
          findings: [],
          recommendations: [],
          summary: 'Test summary',
        };
        expect(validateWorkflowReport(invalidReport)).toBe(false);
      });
    });
  });
});
