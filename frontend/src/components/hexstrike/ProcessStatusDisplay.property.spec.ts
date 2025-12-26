import * as fc from 'fast-check';
import {
  getStatusColors,
  getStatusLabel,
  formatDuration,
  calculateDuration,
  canTerminate,
  isTerminalState,
  hasRequiredDisplayFields,
  getProcessDisplaySummary,
  ProcessStatus,
  HexStrikeProcess,
  StatusColors,
} from './ProcessStatusDisplay';

/**
 * Property-Based Tests for Process Status Display
 * 
 * **Feature: hexstrike-ai-integration, Property 8: Process Status Display Completeness**
 * 
 * *For any* running process in the HexStrike AI system, the Frontend_UI dashboard shall display:
 * process ID, status (running/completed/failed), command being executed, and elapsed duration.
 * 
 * **Validates: Requirements 6.2**
 * 
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

// Arbitrary for generating valid process statuses
const processStatusArb = fc.constantFrom<ProcessStatus>(
  'running',
  'completed',
  'failed',
  'cancelled',
  'pending'
);

// Arbitrary for generating valid PIDs (positive integers)
const pidArb = fc.integer({ min: 1, max: 999999 });

// Arbitrary for generating valid commands
const commandArb = fc.array(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    ' ', '-', '_', '.', '/'
  ),
  { minLength: 1, maxLength: 200 }
).map(chars => chars.join(''));

// Arbitrary for generating valid ISO date strings
const isoDateArb = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime(),
}).map(timestamp => new Date(timestamp).toISOString());

// Arbitrary for generating valid durations in milliseconds
const durationArb = fc.integer({ min: 0, max: 86400000 }); // 0 to 24 hours

// Arbitrary for generating tool names
const toolArb = fc.option(
  fc.constantFrom('nmap', 'nuclei', 'sqlmap', 'gobuster', 'nikto', 'ffuf', 'subfinder', 'httpx'),
  { nil: undefined }
);

// Arbitrary for generating target strings
const targetArb = fc.option(
  fc.oneof(
    fc.domain(),
    fc.tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 })
    ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)
  ),
  { nil: undefined }
);

// Arbitrary for generating a valid HexStrikeProcess
const hexStrikeProcessArb: fc.Arbitrary<HexStrikeProcess> = fc.record({
  pid: pidArb,
  command: commandArb,
  status: processStatusArb,
  startTime: isoDateArb,
  endTime: fc.option(isoDateArb, { nil: undefined }),
  duration: fc.option(durationArb, { nil: undefined }),
  output: fc.option(fc.string({ minLength: 0, maxLength: 1000 }), { nil: undefined }),
  error: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: undefined }),
  tool: toolArb,
  target: targetArb,
});

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Process Status Display Property Tests', () => {
  /**
   * **Feature: hexstrike-ai-integration, Property 8: Process Status Display Completeness**
   * 
   * Tests that the UI helper functions correctly process all HexStrikeProcess data
   * for rendering purposes, ensuring process ID, status, command, and duration
   * are always displayable.
   * 
   * **Validates: Requirements 6.2**
   */
  describe('Property 8: Process Status Display Completeness', () => {
    
    describe('Status Color Mapping', () => {
      it('should return valid color classes for all process statuses', () => {
        fc.assert(
          fc.property(processStatusArb, (status) => {
            const colors = getStatusColors(status);
            
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

      it('should map running to blue colors', () => {
        const colors = getStatusColors('running');
        expect(colors.text).toContain('blue');
        expect(colors.bg).toContain('blue');
        expect(colors.border).toContain('blue');
      });

      it('should map completed to green colors', () => {
        const colors = getStatusColors('completed');
        expect(colors.text).toContain('green');
        expect(colors.bg).toContain('green');
        expect(colors.border).toContain('green');
      });

      it('should map failed to red colors', () => {
        const colors = getStatusColors('failed');
        expect(colors.text).toContain('red');
        expect(colors.bg).toContain('red');
        expect(colors.border).toContain('red');
      });

      it('should map cancelled to yellow colors', () => {
        const colors = getStatusColors('cancelled');
        expect(colors.text).toContain('yellow');
        expect(colors.bg).toContain('yellow');
        expect(colors.border).toContain('yellow');
      });

      it('should map pending to slate/gray colors', () => {
        const colors = getStatusColors('pending');
        expect(colors.text).toContain('slate');
        expect(colors.bg).toContain('slate');
        expect(colors.border).toContain('slate');
      });
    });

    describe('Status Label Mapping', () => {
      it('should return human-readable labels for all statuses', () => {
        fc.assert(
          fc.property(processStatusArb, (status) => {
            const label = getStatusLabel(status);
            
            // Should return a non-empty string
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
            
            // Should be capitalized (first letter uppercase)
            expect(label[0]).toBe(label[0].toUpperCase());
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return correct labels for each status', () => {
        expect(getStatusLabel('running')).toBe('Running');
        expect(getStatusLabel('completed')).toBe('Completed');
        expect(getStatusLabel('failed')).toBe('Failed');
        expect(getStatusLabel('cancelled')).toBe('Cancelled');
        expect(getStatusLabel('pending')).toBe('Pending');
      });
    });

    describe('Duration Formatting', () => {
      it('should return valid formatted string for all durations', () => {
        fc.assert(
          fc.property(durationArb, (duration) => {
            const formatted = formatDuration(duration);
            
            // Should return a non-empty string
            expect(typeof formatted).toBe('string');
            expect(formatted.length).toBeGreaterThan(0);
            
            // Should contain a unit suffix (ms, s, m, or h)
            expect(formatted).toMatch(/(\d+ms|\d+\.?\d*[smh])/);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return milliseconds for durations < 1000ms', () => {
        fc.assert(
          fc.property(fc.integer({ min: 0, max: 999 }), (duration) => {
            const formatted = formatDuration(duration);
            expect(formatted).toMatch(/^\d+ms$/);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return seconds for durations 1s to 59.9s', () => {
        fc.assert(
          fc.property(fc.integer({ min: 1000, max: 59999 }), (duration) => {
            const formatted = formatDuration(duration);
            expect(formatted).toMatch(/^\d+\.?\d*s$/);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return minutes for durations 1m to 59.9m', () => {
        fc.assert(
          fc.property(fc.integer({ min: 60000, max: 3599999 }), (duration) => {
            const formatted = formatDuration(duration);
            expect(formatted).toMatch(/^\d+\.?\d*m$/);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return hours for durations >= 1h', () => {
        fc.assert(
          fc.property(fc.integer({ min: 3600000, max: 86400000 }), (duration) => {
            const formatted = formatDuration(duration);
            expect(formatted).toMatch(/^\d+\.?\d*h$/);
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should return "-" for undefined or negative durations', () => {
        expect(formatDuration(undefined)).toBe('-');
        expect(formatDuration(-1)).toBe('-');
        expect(formatDuration(-1000)).toBe('-');
      });
    });

    describe('Duration Calculation', () => {
      it('should calculate positive duration for valid date ranges', () => {
        fc.assert(
          fc.property(
            fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
            fc.integer({ min: 1000, max: 86400000 }),
            (startDate, durationMs) => {
              const startTime = startDate.toISOString();
              const endDate = new Date(startDate.getTime() + durationMs);
              const endTime = endDate.toISOString();
              
              const calculated = calculateDuration(startTime, endTime);
              
              // Should be approximately equal to the duration (within 1ms tolerance)
              expect(Math.abs(calculated - durationMs)).toBeLessThanOrEqual(1);
              
              return true;
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should return non-negative duration', () => {
        fc.assert(
          fc.property(isoDateArb, fc.option(isoDateArb, { nil: undefined }), (startTime, endTime) => {
            const duration = calculateDuration(startTime, endTime);
            expect(duration).toBeGreaterThanOrEqual(0);
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Termination Logic', () => {
      it('should correctly identify terminable statuses', () => {
        fc.assert(
          fc.property(processStatusArb, (status) => {
            const terminable = canTerminate(status);
            
            // Only running and pending should be terminable
            if (status === 'running' || status === 'pending') {
              expect(terminable).toBe(true);
            } else {
              expect(terminable).toBe(false);
            }
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should correctly identify terminal states', () => {
        fc.assert(
          fc.property(processStatusArb, (status) => {
            const terminal = isTerminalState(status);
            
            // completed, failed, and cancelled are terminal states
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
              expect(terminal).toBe(true);
            } else {
              expect(terminal).toBe(false);
            }
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should have mutually exclusive terminable and terminal states', () => {
        fc.assert(
          fc.property(processStatusArb, (status) => {
            const terminable = canTerminate(status);
            const terminal = isTerminalState(status);
            
            // A status cannot be both terminable and terminal
            // (except pending which is terminable but not terminal)
            if (terminal) {
              expect(terminable).toBe(false);
            }
            
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Required Display Fields Validation', () => {
      it('should validate processes with all required fields', () => {
        fc.assert(
          fc.property(hexStrikeProcessArb, (process) => {
            const hasRequired = hasRequiredDisplayFields(process);
            
            // Our generator always produces valid processes
            expect(hasRequired).toBe(true);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should reject processes with invalid PID', () => {
        const invalidProcess: HexStrikeProcess = {
          pid: 0, // Invalid: must be > 0
          command: 'test',
          status: 'running',
          startTime: new Date().toISOString(),
        };
        expect(hasRequiredDisplayFields(invalidProcess)).toBe(false);
        
        const negativePid: HexStrikeProcess = {
          pid: -1,
          command: 'test',
          status: 'running',
          startTime: new Date().toISOString(),
        };
        expect(hasRequiredDisplayFields(negativePid)).toBe(false);
      });

      it('should reject processes with empty command', () => {
        const invalidProcess: HexStrikeProcess = {
          pid: 1,
          command: '', // Invalid: must be non-empty
          status: 'running',
          startTime: new Date().toISOString(),
        };
        expect(hasRequiredDisplayFields(invalidProcess)).toBe(false);
      });

      it('should reject processes with invalid status', () => {
        const invalidProcess = {
          pid: 1,
          command: 'test',
          status: 'invalid_status' as ProcessStatus, // Invalid status
          startTime: new Date().toISOString(),
        };
        expect(hasRequiredDisplayFields(invalidProcess)).toBe(false);
      });

      it('should reject processes with invalid startTime', () => {
        const invalidProcess: HexStrikeProcess = {
          pid: 1,
          command: 'test',
          status: 'running',
          startTime: 'not-a-date', // Invalid date
        };
        expect(hasRequiredDisplayFields(invalidProcess)).toBe(false);
      });
    });

    describe('Process Display Summary', () => {
      it('should generate complete display summary for all processes', () => {
        fc.assert(
          fc.property(hexStrikeProcessArb, (process) => {
            const summary = getProcessDisplaySummary(process);
            
            // Should have all required display fields
            expect(summary).toHaveProperty('pid');
            expect(summary).toHaveProperty('command');
            expect(summary).toHaveProperty('status');
            expect(summary).toHaveProperty('statusLabel');
            expect(summary).toHaveProperty('statusColors');
            expect(summary).toHaveProperty('startTime');
            expect(summary).toHaveProperty('formattedStartTime');
            expect(summary).toHaveProperty('duration');
            expect(summary).toHaveProperty('formattedDuration');
            expect(summary).toHaveProperty('canTerminate');
            expect(summary).toHaveProperty('isTerminal');
            
            // PID should match
            expect(summary.pid).toBe(process.pid);
            
            // Command should match
            expect(summary.command).toBe(process.command);
            
            // Status should match
            expect(summary.status).toBe(process.status);
            
            // Status label should be non-empty
            expect(summary.statusLabel.length).toBeGreaterThan(0);
            
            // Status colors should be valid
            expect(summary.statusColors.text.length).toBeGreaterThan(0);
            expect(summary.statusColors.bg.length).toBeGreaterThan(0);
            expect(summary.statusColors.border.length).toBeGreaterThan(0);
            
            // Duration should be non-negative
            expect(summary.duration).toBeGreaterThanOrEqual(0);
            
            // Formatted duration should be non-empty
            expect(summary.formattedDuration.length).toBeGreaterThan(0);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve optional fields when present', () => {
        fc.assert(
          fc.property(hexStrikeProcessArb, (process) => {
            const summary = getProcessDisplaySummary(process);
            
            // Tool should be preserved if present
            if (process.tool) {
              expect(summary.tool).toBe(process.tool);
            }
            
            // Target should be preserved if present
            if (process.target) {
              expect(summary.target).toBe(process.target);
            }
            
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Rendering Consistency', () => {
      it('should produce consistent color mapping for same status', () => {
        fc.assert(
          fc.property(processStatusArb, (status) => {
            const colors1 = getStatusColors(status);
            const colors2 = getStatusColors(status);
            
            expect(colors1.text).toBe(colors2.text);
            expect(colors1.bg).toBe(colors2.bg);
            expect(colors1.border).toBe(colors2.border);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should produce consistent label for same status', () => {
        fc.assert(
          fc.property(processStatusArb, (status) => {
            const label1 = getStatusLabel(status);
            const label2 = getStatusLabel(status);
            
            expect(label1).toBe(label2);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should produce consistent duration format for same duration', () => {
        fc.assert(
          fc.property(durationArb, (duration) => {
            const formatted1 = formatDuration(duration);
            const formatted2 = formatDuration(duration);
            
            expect(formatted1).toBe(formatted2);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });

      it('should produce consistent summary for same process', () => {
        fc.assert(
          fc.property(hexStrikeProcessArb, (process) => {
            const summary1 = getProcessDisplaySummary(process);
            const summary2 = getProcessDisplaySummary(process);
            
            expect(summary1.pid).toBe(summary2.pid);
            expect(summary1.command).toBe(summary2.command);
            expect(summary1.status).toBe(summary2.status);
            expect(summary1.statusLabel).toBe(summary2.statusLabel);
            expect(summary1.statusColors.text).toBe(summary2.statusColors.text);
            expect(summary1.formattedDuration).toBe(summary2.formattedDuration);
            
            return true;
          }),
          { numRuns: 100 }
        );
      });
    });
  });
});
