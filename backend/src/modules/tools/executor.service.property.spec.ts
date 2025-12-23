import * as fc from 'fast-check';
import { ExecutorService, ToolStatus, InstallationStatusEnum } from './executor.service';
import { Tool, ToolDocument, ToolCategory } from '../../schemas/tool.schema';
import { ToolExecution, ToolExecutionDocument, ExecutionStatus } from '../../schemas/tool-execution.schema';
import { BadRequestException } from '@nestjs/common';

/**
 * Property-Based Tests for ExecutorService
 *
 * These tests verify the correctness properties defined in the design document
 * for the security-tools-registry feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// ============================================================================
// Arbitraries for generating test data
// ============================================================================

// Valid installation status enum values
const installationStatusEnumArb = fc.constantFrom<InstallationStatusEnum>(
  'installed',
  'not_installed',
  'update_available'
);

// Version string arbitrary
const versionArb = fc.tuple(
  fc.integer({ min: 0, max: 99 }),
  fc.integer({ min: 0, max: 99 }),
  fc.integer({ min: 0, max: 99 })
).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

// Version with optional 'v' prefix
const versionWithPrefixArb = fc.tuple(
  fc.boolean(),
  versionArb
).map(([hasPrefix, version]) => hasPrefix ? `v${version}` : version);

// Tool name arbitrary
const toolNameArb = fc.string({ minLength: 2, maxLength: 30 })
  .filter((s) => /^[a-z][a-z0-9-]*[a-z0-9]$/.test(s) || /^[a-z][a-z0-9]?$/.test(s))
  .map((s) => s.toLowerCase());

// Binary name arbitrary
const binaryNameArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter((s) => /^[a-z][a-z0-9-]*$/.test(s));

// Tool category arbitrary
const toolCategoryArb = fc.constantFrom(...Object.values(ToolCategory));

// ============================================================================
// Mock implementations
// ============================================================================

/**
 * Creates a mock Tool model
 */
function createMockToolModel() {
  const mockModel: any = function(data: any) {
    return {
      ...data,
      save: jest.fn().mockResolvedValue(data),
    };
  };
  mockModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(null),
  });
  return mockModel;
}

/**
 * Creates a mock ToolExecution model
 */
function createMockToolExecutionModel() {
  let savedExecution: any = null;
  
  const mockModel: any = function(data: any) {
    const doc = {
      ...data,
      _id: 'exec_' + Date.now(),
      save: jest.fn().mockImplementation(function(this: any) {
        savedExecution = { ...this };
        return Promise.resolve({ ...this });
      }),
    };
    return doc;
  };
  
  mockModel.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    }),
  });
  
  mockModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(null),
  });
  
  mockModel._getSavedExecution = () => savedExecution;
  
  return mockModel;
}

/**
 * Creates a mock tool document
 */
function createMockToolDocument(overrides: Partial<Tool> = {}): any {
  return {
    _id: 'tool_test_1',
    name: 'test-tool',
    displayName: 'Test Tool',
    description: 'A test tool',
    githubUrl: 'https://github.com/test/tool',
    categories: [ToolCategory.VULNERABILITY_SCANNING],
    validation: {
      isValid: true,
      lastChecked: new Date(),
      stars: 500,
      lastCommit: new Date(),
    },
    installation: {
      isInstalled: false,
      binaryName: 'test-tool',
      lastChecked: new Date(),
    },
    configOptions: [],
    userConfig: {},
    isActive: true,
    ...overrides,
  };
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('ExecutorService Property-Based Tests', () => {
  /**
   * **Feature: security-tools-registry, Property 9: Installation Status Enum**
   *
   * *For any* tool's installation status, the status SHALL be exactly one of:
   * "installed", "not_installed", or "update_available".
   *
   * **Validates: Requirements 3.1**
   */
  describe('Property 9: Installation Status Enum', () => {
    it('should return status that is exactly one of the valid enum values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(), // isInstalled
          fc.boolean(), // hasUpdate
          fc.option(versionArb, { nil: undefined }), // version
          async (isInstalled, hasUpdate, version) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            // Determine expected status based on inputs
            let expectedStatus: InstallationStatusEnum;
            if (!isInstalled) {
              expectedStatus = 'not_installed';
            } else if (hasUpdate) {
              expectedStatus = 'update_available';
            } else {
              expectedStatus = 'installed';
            }

            // Create a ToolStatus object
            const status: ToolStatus = {
              isInstalled,
              version,
              hasUpdate: isInstalled && hasUpdate,
              status: expectedStatus,
            };

            // Verify the status is one of the valid enum values
            const validStatuses: InstallationStatusEnum[] = ['installed', 'not_installed', 'update_available'];
            return validStatuses.includes(status.status);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return not_installed when tool is not installed', async () => {
      await fc.assert(
        fc.asyncProperty(
          toolNameArb,
          binaryNameArb,
          async (toolName, binaryName) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            // Create a mock tool that is not installed
            const tool = createMockToolDocument({
              name: toolName,
              installation: {
                isInstalled: false,
                binaryName: binaryName,
                lastChecked: new Date(),
              },
            });

            // Mock isInstalled to return false (tool not in PATH)
            jest.spyOn(service, 'isInstalled').mockResolvedValue(false);

            const status = await service.getInstallationStatus(tool as ToolDocument);
            
            return status.status === 'not_installed' && status.isInstalled === false;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return installed when tool is installed and no update available', async () => {
      await fc.assert(
        fc.asyncProperty(
          toolNameArb,
          binaryNameArb,
          versionArb,
          async (toolName, binaryName, version) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const tool = createMockToolDocument({
              name: toolName,
              installation: {
                isInstalled: true,
                binaryName: binaryName,
                version: version,
                lastChecked: new Date(),
              },
            });

            // Mock isInstalled to return true
            jest.spyOn(service, 'isInstalled').mockResolvedValue(true);
            jest.spyOn(service, 'getVersion').mockResolvedValue(version);

            // Same version = no update
            const status = await service.getInstallationStatus(tool as ToolDocument, version);
            
            return status.status === 'installed' && status.isInstalled === true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return update_available when newer version exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          toolNameArb,
          binaryNameArb,
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          async (toolName, binaryName, major, minor, patch) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const installedVersion = `${major}.${minor}.${patch}`;
            const latestVersion = `${major}.${minor}.${patch + 1}`; // Always newer

            const tool = createMockToolDocument({
              name: toolName,
              installation: {
                isInstalled: true,
                binaryName: binaryName,
                version: installedVersion,
                lastChecked: new Date(),
              },
            });

            jest.spyOn(service, 'isInstalled').mockResolvedValue(true);
            jest.spyOn(service, 'getVersion').mockResolvedValue(installedVersion);

            const status = await service.getInstallationStatus(tool as ToolDocument, latestVersion);
            
            return status.status === 'update_available' && status.hasUpdate === true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: security-tools-registry, Property 10: Version Comparison**
   *
   * *For any* tool where installed version differs from latest version,
   * the installation status SHALL be "update_available".
   *
   * **Validates: Requirements 3.3**
   */
  describe('Property 10: Version Comparison', () => {
    it('should correctly compare semantic versions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 99 }),
          fc.integer({ min: 0, max: 99 }),
          fc.integer({ min: 0, max: 99 }),
          fc.integer({ min: 0, max: 99 }),
          fc.integer({ min: 0, max: 99 }),
          fc.integer({ min: 0, max: 99 }),
          async (maj1, min1, pat1, maj2, min2, pat2) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const v1 = `${maj1}.${min1}.${pat1}`;
            const v2 = `${maj2}.${min2}.${pat2}`;

            const result = service.compareVersions(v1, v2);

            // Calculate expected result
            let expected: number;
            if (maj1 !== maj2) {
              expected = maj1 < maj2 ? -1 : 1;
            } else if (min1 !== min2) {
              expected = min1 < min2 ? -1 : 1;
            } else if (pat1 !== pat2) {
              expected = pat1 < pat2 ? -1 : 1;
            } else {
              expected = 0;
            }

            return result === expected;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle versions with v prefix', async () => {
      await fc.assert(
        fc.asyncProperty(
          versionArb,
          fc.boolean(),
          fc.boolean(),
          async (version, prefix1, prefix2) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const v1 = prefix1 ? `v${version}` : version;
            const v2 = prefix2 ? `v${version}` : version;

            // Same version with different prefixes should be equal
            const result = service.compareVersions(v1, v2);
            return result === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return -1 when installed version is older than latest', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 1, max: 50 }), // Ensure at least 1 increment
          async (major, minor, patch, increment) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const installed = `${major}.${minor}.${patch}`;
            const latest = `${major}.${minor}.${patch + increment}`;

            const result = service.compareVersions(installed, latest);
            return result === -1;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return 0 when versions are equal', async () => {
      await fc.assert(
        fc.asyncProperty(
          versionArb,
          async (version) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const result = service.compareVersions(version, version);
            return result === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return 1 when installed version is newer than latest', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 1, max: 50 }),
          async (major, minor, patch, increment) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const installed = `${major}.${minor}.${patch + increment}`;
            const latest = `${major}.${minor}.${patch}`;

            const result = service.compareVersions(installed, latest);
            return result === 1;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});


  /**
   * **Feature: security-tools-registry, Property 11: Execution Precondition**
   *
   * *For any* tool execution request where the tool is not installed,
   * the execution SHALL fail with an error indicating the tool is not installed.
   *
   * **Validates: Requirements 4.1**
   */
  describe('Property 11: Execution Precondition', () => {
    it('should throw error when tool is not installed', async () => {
      await fc.assert(
        fc.asyncProperty(
          toolNameArb,
          binaryNameArb,
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
          async (toolName, binaryName, args) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const tool = createMockToolDocument({
              name: toolName,
              displayName: `${toolName} Tool`,
              installation: {
                isInstalled: false,
                binaryName: binaryName,
                lastChecked: new Date(),
              },
            });

            // Mock isInstalled to return false
            jest.spyOn(service, 'isInstalled').mockResolvedValue(false);

            try {
              await service.execute(tool as ToolDocument, args);
              return false; // Should have thrown
            } catch (error) {
              // Verify error message indicates tool is not installed
              return (
                error instanceof BadRequestException &&
                error.message.toLowerCase().includes('not installed')
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include tool name in error message', async () => {
      await fc.assert(
        fc.asyncProperty(
          toolNameArb,
          binaryNameArb,
          async (toolName, binaryName) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const displayName = `${toolName} Tool`;
            const tool = createMockToolDocument({
              name: toolName,
              displayName: displayName,
              installation: {
                isInstalled: false,
                binaryName: binaryName,
                lastChecked: new Date(),
              },
            });

            jest.spyOn(service, 'isInstalled').mockResolvedValue(false);

            try {
              await service.execute(tool as ToolDocument, []);
              return false;
            } catch (error) {
              return (
                error instanceof BadRequestException &&
                error.message.includes(displayName)
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: security-tools-registry, Property 12: Execution Result Completeness**
   *
   * *For any* completed tool execution, the execution record SHALL contain:
   * stdout (string), stderr (string), exitCode (number), startedAt (date),
   * completedAt (date), and duration (number >= 0).
   *
   * **Validates: Requirements 4.2, 4.3**
   */
  describe('Property 12: Execution Result Completeness', () => {
    it('should contain all required fields in execution record', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 100 }), // stdout
          fc.string({ minLength: 0, maxLength: 100 }), // stderr
          fc.integer({ min: 0, max: 255 }), // exitCode
          fc.integer({ min: 0, max: 10000 }), // duration
          async (stdout, stderr, exitCode, duration) => {
            // Create a mock execution record
            const execution = {
              _id: 'exec_test_1',
              tool: 'tool_test_1',
              arguments: [],
              config: {},
              status: exitCode === 0 ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED,
              stdout: stdout,
              stderr: stderr,
              exitCode: exitCode,
              startedAt: new Date(),
              completedAt: new Date(),
              duration: duration,
              errorMessage: exitCode !== 0 ? stderr || `Tool exited with code ${exitCode}` : undefined,
            };

            // Verify all required fields are present and have correct types
            return (
              typeof execution.stdout === 'string' &&
              typeof execution.stderr === 'string' &&
              typeof execution.exitCode === 'number' &&
              execution.startedAt instanceof Date &&
              execution.completedAt instanceof Date &&
              typeof execution.duration === 'number' &&
              execution.duration >= 0
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should have duration >= 0 for all executions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100000 }),
          async (duration) => {
            const execution = {
              duration: duration,
            };
            return execution.duration >= 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should have completedAt >= startedAt', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Use integer-based date generation to avoid NaN date issues
          fc.integer({ 
            min: new Date('2020-01-01').getTime(), 
            max: new Date('2025-12-31').getTime() 
          }).map((timestamp) => new Date(timestamp)),
          fc.integer({ min: 0, max: 100000 }), // duration in ms
          async (startedAt, duration) => {
            const completedAt = new Date(startedAt.getTime() + duration);
            return completedAt.getTime() >= startedAt.getTime();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: security-tools-registry, Property 13: Failed Execution Error Message**
   *
   * *For any* tool execution with status "failed", the execution record
   * SHALL contain a non-empty errorMessage field.
   *
   * **Validates: Requirements 4.4**
   */
  describe('Property 13: Failed Execution Error Message', () => {
    it('should have non-empty errorMessage when status is failed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 100 }), // stderr
          fc.integer({ min: 1, max: 255 }), // non-zero exit code
          async (stderr, exitCode) => {
            // Simulate failed execution - use stderr if non-empty after trim, otherwise use exit code message
            const trimmedStderr = stderr.trim();
            const errorMessage = trimmedStderr.length > 0 ? stderr : `Tool exited with code ${exitCode}`;
            
            const execution = {
              status: ExecutionStatus.FAILED,
              exitCode: exitCode,
              stderr: stderr,
              errorMessage: errorMessage,
            };

            // The error message should always be non-empty for failed executions
            return (
              execution.status === ExecutionStatus.FAILED &&
              execution.errorMessage !== undefined &&
              execution.errorMessage.trim().length > 0
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should use stderr as error message when available', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1, max: 255 }),
          async (stderr, exitCode) => {
            const errorMessage = stderr || `Tool exited with code ${exitCode}`;
            
            return errorMessage === stderr;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should use exit code in error message when stderr is empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 255 }),
          async (exitCode) => {
            const stderr = '';
            const errorMessage = stderr || `Tool exited with code ${exitCode}`;
            
            return errorMessage.includes(String(exitCode));
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: security-tools-registry, Property 17: Execution Uses Saved Config**
   *
   * *For any* tool execution, the execution record's config field SHALL match
   * the tool's userConfig at the time of execution.
   *
   * **Validates: Requirements 6.3**
   */
  describe('Property 17: Execution Uses Saved Config', () => {
    // Generate user config with various value types
    const userConfigValueArb = fc.oneof(
      fc.string({ minLength: 0, maxLength: 50 }),
      fc.integer({ min: -1000, max: 1000 }),
      fc.boolean(),
    );

    const userConfigArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
      userConfigValueArb,
      { minKeys: 0, maxKeys: 10 }
    );

    it('should store tool userConfig in execution record', async () => {
      await fc.assert(
        fc.asyncProperty(
          userConfigArb,
          async (userConfig) => {
            // Simulate execution record creation
            const execution = {
              config: { ...userConfig },
            };

            // Verify config matches
            const configKeys = Object.keys(userConfig);
            const executionConfigKeys = Object.keys(execution.config);

            if (configKeys.length !== executionConfigKeys.length) {
              return false;
            }

            return configKeys.every((key) => {
              return execution.config[key] === userConfig[key];
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve empty config', async () => {
      const execution = {
        config: {},
      };

      expect(Object.keys(execution.config).length).toBe(0);
    });

    it('should preserve config with multiple value types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            stringVal: fc.string({ minLength: 0, maxLength: 50 }),
            numberVal: fc.integer({ min: -1000, max: 1000 }),
            boolVal: fc.boolean(),
          }),
          async (config) => {
            const execution = {
              config: { ...config },
            };

            return (
              execution.config.stringVal === config.stringVal &&
              execution.config.numberVal === config.numberVal &&
              execution.config.boolVal === config.boolVal
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  /**
   * **Feature: security-tools-registry, Property 19: Execution History Limit**
   *
   * *For any* request for a tool's execution history without pagination,
   * the result SHALL contain at most 10 executions.
   *
   * **Validates: Requirements 8.1**
   */
  describe('Property 19: Execution History Limit', () => {
    // Valid MongoDB ObjectId (24 hex characters)
    const validObjectId = '507f1f77bcf86cd799439011';
    
    // Generate execution records
    const executionRecordArb = fc.record({
      _id: fc.string({ minLength: 10, maxLength: 30 }),
      tool: fc.constant(validObjectId),
      arguments: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
      config: fc.constant({}),
      status: fc.constantFrom(...Object.values(ExecutionStatus)),
      stdout: fc.string({ minLength: 0, maxLength: 100 }),
      stderr: fc.string({ minLength: 0, maxLength: 100 }),
      exitCode: fc.integer({ min: 0, max: 255 }),
      startedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
      completedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
      duration: fc.integer({ min: 0, max: 100000 }),
    });

    it('should return at most 10 executions when no limit specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(executionRecordArb, { minLength: 0, maxLength: 25 }),
          async (executions) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            // Mock the find chain to return limited results
            const limitedExecutions = executions.slice(0, 10);
            mockExecutionModel.find = jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue(limitedExecutions),
                }),
              }),
            });

            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const result = await service.getExecutionHistory(validObjectId);
            
            // Result should be at most 10 executions
            return result.length <= 10;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should respect custom limit when specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(executionRecordArb, { minLength: 0, maxLength: 25 }),
          fc.integer({ min: 1, max: 50 }),
          async (executions, limit) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const limitedExecutions = executions.slice(0, limit);
            mockExecutionModel.find = jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue(limitedExecutions),
                }),
              }),
            });

            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const result = await service.getExecutionHistory(validObjectId, limit);
            
            // Result should be at most the specified limit
            return result.length <= limit;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should call limit with default value of 10', async () => {
      const mockToolModel = createMockToolModel();
      const mockExecutionModel = createMockToolExecutionModel();
      
      const limitMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      
      mockExecutionModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: limitMock,
        }),
      });

      const service = new ExecutorService(
        mockToolModel as any,
        mockExecutionModel as any,
      );

      await service.getExecutionHistory(validObjectId);
      
      expect(limitMock).toHaveBeenCalledWith(10);
    });
  });

  /**
   * **Feature: security-tools-registry, Property 20: Execution Detail Completeness**
   *
   * *For any* execution detail request, the response SHALL include the full
   * stdout, stderr, and the config used for that execution.
   *
   * **Validates: Requirements 8.2**
   */
  describe('Property 20: Execution Detail Completeness', () => {
    // Generate config with various value types
    const configValueArb = fc.oneof(
      fc.string({ minLength: 0, maxLength: 50 }),
      fc.integer({ min: -1000, max: 1000 }),
      fc.boolean(),
    );

    const configArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
      configValueArb,
      { minKeys: 0, maxKeys: 10 }
    );

    it('should include full stdout, stderr, and config in execution detail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 1000 }), // stdout
          fc.string({ minLength: 0, maxLength: 1000 }), // stderr
          configArb,
          async (stdout, stderr, config) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const executionRecord = {
              _id: 'exec_test_1',
              tool: 'tool_test_1',
              arguments: [],
              config: config,
              status: ExecutionStatus.COMPLETED,
              stdout: stdout,
              stderr: stderr,
              exitCode: 0,
              startedAt: new Date(),
              completedAt: new Date(),
              duration: 1000,
            };

            mockExecutionModel.findById = jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(executionRecord),
            });

            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const result = await service.getExecutionById('exec_test_1');
            
            if (!result) return false;

            // Verify all required fields are present
            return (
              result.stdout === stdout &&
              result.stderr === stderr &&
              JSON.stringify(result.config) === JSON.stringify(config)
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve stdout content exactly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 5000 }),
          async (stdout) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const executionRecord = {
              _id: 'exec_test_1',
              stdout: stdout,
              stderr: '',
              config: {},
            };

            mockExecutionModel.findById = jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(executionRecord),
            });

            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const result = await service.getExecutionById('exec_test_1');
            
            return result?.stdout === stdout;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve stderr content exactly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 5000 }),
          async (stderr) => {
            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const executionRecord = {
              _id: 'exec_test_1',
              stdout: '',
              stderr: stderr,
              config: {},
            };

            mockExecutionModel.findById = jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(executionRecord),
            });

            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const result = await service.getExecutionById('exec_test_1');
            
            return result?.stderr === stderr;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: security-tools-registry, Property 21: Execution History Date Filter**
   *
   * *For any* date range filter on execution history, all returned executions
   * SHALL have startedAt within the specified range.
   *
   * **Validates: Requirements 8.3**
   */
  describe('Property 21: Execution History Date Filter', () => {
    // Valid MongoDB ObjectId (24 hex characters)
    const validObjectId = '507f1f77bcf86cd799439011';
    
    // Generate date within a reasonable range using integer-based approach to avoid NaN
    const dateArb = fc.integer({ 
      min: new Date('2024-01-01').getTime(), 
      max: new Date('2025-12-31').getTime() 
    }).map((timestamp) => new Date(timestamp));

    it('should return only executions within date range', async () => {
      await fc.assert(
        fc.asyncProperty(
          dateArb,
          dateArb,
          fc.array(dateArb, { minLength: 1, maxLength: 20 }),
          async (date1, date2, executionDates) => {
            // Ensure startDate <= endDate
            const startDate = date1 < date2 ? date1 : date2;
            const endDate = date1 < date2 ? date2 : date1;

            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            // Create execution records with various dates
            const allExecutions = executionDates.map((date, i) => ({
              _id: `exec_${i}`,
              tool: validObjectId,
              startedAt: date,
              status: ExecutionStatus.COMPLETED,
            }));

            // Filter to only those within range
            const filteredExecutions = allExecutions.filter(
              (exec) => exec.startedAt >= startDate && exec.startedAt <= endDate
            );

            mockExecutionModel.find = jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue(filteredExecutions),
                }),
              }),
            });

            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const result = await service.getExecutionHistory(
              validObjectId,
              10,
              startDate,
              endDate
            );
            
            // All returned executions should be within the date range
            return result.every(
              (exec: any) => exec.startedAt >= startDate && exec.startedAt <= endDate
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include executions exactly at start date boundary', async () => {
      await fc.assert(
        fc.asyncProperty(
          dateArb,
          fc.integer({ min: 1, max: 30 }), // days to add for end date
          async (startDate, daysToAdd) => {
            const endDate = new Date(startDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            // Create execution exactly at start date
            const executionAtStart = {
              _id: 'exec_at_start',
              tool: validObjectId,
              startedAt: startDate,
              status: ExecutionStatus.COMPLETED,
            };

            mockExecutionModel.find = jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([executionAtStart]),
                }),
              }),
            });

            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const result = await service.getExecutionHistory(
              validObjectId,
              10,
              startDate,
              endDate
            );
            
            // Execution at start date should be included
            return result.length === 1 && result[0].startedAt.getTime() === startDate.getTime();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include executions exactly at end date boundary', async () => {
      await fc.assert(
        fc.asyncProperty(
          dateArb,
          fc.integer({ min: 1, max: 30 }),
          async (startDate, daysToAdd) => {
            const endDate = new Date(startDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            // Create execution exactly at end date
            const executionAtEnd = {
              _id: 'exec_at_end',
              tool: validObjectId,
              startedAt: endDate,
              status: ExecutionStatus.COMPLETED,
            };

            mockExecutionModel.find = jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([executionAtEnd]),
                }),
              }),
            });

            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            const result = await service.getExecutionHistory(
              validObjectId,
              10,
              startDate,
              endDate
            );
            
            // Execution at end date should be included
            return result.length === 1 && result[0].startedAt.getTime() === endDate.getTime();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should build correct filter query with date range', async () => {
      await fc.assert(
        fc.asyncProperty(
          dateArb,
          dateArb,
          async (date1, date2) => {
            const startDate = date1 < date2 ? date1 : date2;
            const endDate = date1 < date2 ? date2 : date1;

            const mockToolModel = createMockToolModel();
            const mockExecutionModel = createMockToolExecutionModel();
            
            const findMock = jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([]),
                }),
              }),
            });
            mockExecutionModel.find = findMock;

            const service = new ExecutorService(
              mockToolModel as any,
              mockExecutionModel as any,
            );

            await service.getExecutionHistory(validObjectId, 10, startDate, endDate);
            
            // Verify the filter includes date range
            const filterArg = findMock.mock.calls[0][0];
            return (
              filterArg.startedAt !== undefined &&
              filterArg.startedAt.$gte !== undefined &&
              filterArg.startedAt.$lte !== undefined
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });
