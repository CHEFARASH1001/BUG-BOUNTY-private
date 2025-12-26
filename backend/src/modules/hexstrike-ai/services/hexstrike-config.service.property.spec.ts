import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HexStrikeConfigService } from './hexstrike-config.service';
import { HexStrikeConfig } from '../schemas/hexstrike-config.schema';
import { HexStrikeConfig as HexStrikeConfigInterface } from '../interfaces/hexstrike.interface';

/**
 * Property-Based Tests for HexStrike Configuration Service
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

// Arbitrary for generating valid thread counts (1-100)
const threadsArb = fc.integer({ min: 1, max: 100 });

// Arbitrary for generating valid timeout values (30-3600 seconds)
const timeoutArb = fc.integer({ min: 30, max: 3600 });

// Arbitrary for generating valid rate limits (1-1000)
const rateLimitArb = fc.integer({ min: 1, max: 1000 });

// Arbitrary for generating valid scan depths (1-5)
const scanDepthArb = fc.integer({ min: 1, max: 5 });

// Arbitrary for generating valid output directories
const outputDirArb = fc.constantFrom(
  '/app/results',
  '/data/output',
  '/tmp/scans',
  '/var/hexstrike',
  '/home/user/results'
);

// Arbitrary for generating valid version strings
const versionArb: fc.Arbitrary<string | undefined> = fc.option(
  fc.tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 })
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
  { nil: undefined }
);

// Arbitrary for generating complete valid configuration objects
const configArb: fc.Arbitrary<HexStrikeConfigInterface> = fc.record({
  threads: threadsArb,
  timeout: timeoutArb,
  rateLimit: rateLimitArb,
  scanDepth: scanDepthArb,
  outputDir: outputDirArb,
  version: versionArb,
}) as fc.Arbitrary<HexStrikeConfigInterface>;

// Arbitrary for generating partial configuration updates
const partialConfigArb: fc.Arbitrary<Partial<HexStrikeConfigInterface>> = fc.record({
  threads: fc.option(threadsArb, { nil: undefined }),
  timeout: fc.option(timeoutArb, { nil: undefined }),
  rateLimit: fc.option(rateLimitArb, { nil: undefined }),
  scanDepth: fc.option(scanDepthArb, { nil: undefined }),
  outputDir: fc.option(outputDirArb, { nil: undefined }),
  version: versionArb,
}).map(config => {
  const result: Partial<HexStrikeConfigInterface> = {};
  if (config.threads !== undefined) result.threads = config.threads;
  if (config.timeout !== undefined) result.timeout = config.timeout;
  if (config.rateLimit !== undefined) result.rateLimit = config.rateLimit;
  if (config.scanDepth !== undefined) result.scanDepth = config.scanDepth;
  if (config.outputDir !== undefined) result.outputDir = config.outputDir;
  if (config.version !== undefined) result.version = config.version;
  return result;
});

// ============================================================================
// MOCK SETUP
// ============================================================================

/**
 * Creates a mock Mongoose model for testing
 */
function createMockModel() {
  const storage = new Map<string, any>();

  const createDocument = (data: any) => {
    const doc = {
      configName: data.configName || 'default',
      threads: data.threads,
      timeout: data.timeout,
      rateLimit: data.rateLimit,
      scanDepth: data.scanDepth,
      outputDir: data.outputDir,
      version: data.version,
      isActive: data.isActive !== undefined ? data.isActive : true,
      save: async function() {
        storage.set(this.configName, {
          configName: this.configName,
          threads: this.threads,
          timeout: this.timeout,
          rateLimit: this.rateLimit,
          scanDepth: this.scanDepth,
          outputDir: this.outputDir,
          version: this.version,
          isActive: this.isActive,
        });
        return this;
      },
    };
    return doc;
  };

  const MockModel = function(data: any) {
    return createDocument(data);
  } as any;

  MockModel.findOne = async (query: any) => {
    const key = query.configName || 'default';
    const storedData = storage.get(key);
    if (!storedData) return null;
    
    // Check isActive filter if present
    if (query.isActive !== undefined && storedData.isActive !== query.isActive) {
      return null;
    }
    
    return createDocument(storedData);
  };

  MockModel.deleteOne = async (query: any) => {
    const key = query.configName || 'default';
    storage.delete(key);
    return { deletedCount: 1 };
  };

  MockModel.reset = () => {
    storage.clear();
  };

  return MockModel;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function hasAllRequiredFields(config: HexStrikeConfigInterface): boolean {
  return (
    typeof config.threads === 'number' &&
    typeof config.timeout === 'number' &&
    typeof config.rateLimit === 'number' &&
    typeof config.scanDepth === 'number' &&
    typeof config.outputDir === 'string'
  );
}

function hasValidRanges(config: HexStrikeConfigInterface): boolean {
  return (
    config.threads >= 1 && config.threads <= 100 &&
    config.timeout >= 30 && config.timeout <= 3600 &&
    config.rateLimit >= 1 && config.rateLimit <= 1000 &&
    config.scanDepth >= 1 && config.scanDepth <= 5 &&
    config.outputDir.length > 0
  );
}

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('HexStrike Configuration Service Property-Based Tests', () => {
  let service: HexStrikeConfigService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HexStrikeConfigService,
        {
          provide: getModelToken(HexStrikeConfig.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<HexStrikeConfigService>(HexStrikeConfigService);
  });

  afterEach(() => {
    mockModel.reset();
  });

  /**
   * **Feature: hexstrike-ai-integration, Property 10: Configuration Persistence Round-Trip**
   * 
   * *For any* HexStrike AI configuration object saved through the settings API,
   * retrieving the configuration shall return an equivalent object with all fields preserved.
   * 
   * **Validates: Requirements 8.3**
   */
  describe('Property 10: Configuration Persistence Round-Trip', () => {
    it('should preserve all fields when saving and retrieving configuration', async () => {
      await fc.assert(
        fc.asyncProperty(configArb, async (config) => {
          // Reset storage before each iteration to ensure clean state
          mockModel.reset();
          
          // Update configuration with all fields
          await service.updateConfig(config);
          
          // Retrieve configuration
          const retrievedConfig = await service.getConfig();
          
          // Verify all fields are preserved
          return (
            retrievedConfig.threads === config.threads &&
            retrievedConfig.timeout === config.timeout &&
            retrievedConfig.rateLimit === config.rateLimit &&
            retrievedConfig.scanDepth === config.scanDepth &&
            retrievedConfig.outputDir === config.outputDir &&
            retrievedConfig.version === config.version
          );
        }),
        { numRuns: 100 }
      );
    });

    it('should return configuration with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(configArb, async (config) => {
          mockModel.reset();
          await service.updateConfig(config);
          const retrievedConfig = await service.getConfig();
          return hasAllRequiredFields(retrievedConfig);
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain valid ranges for all configuration values', async () => {
      await fc.assert(
        fc.asyncProperty(configArb, async (config) => {
          await service.updateConfig(config);
          const retrievedConfig = await service.getConfig();
          return hasValidRanges(retrievedConfig);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle partial configuration updates correctly', async () => {
      await fc.assert(
        fc.asyncProperty(partialConfigArb, async (partialConfig) => {
          // Apply partial update
          const updatedConfig = await service.updateConfig(partialConfig);
          
          // Verify updated fields match the partial config
          let allUpdatedFieldsMatch = true;
          if (partialConfig.threads !== undefined) {
            allUpdatedFieldsMatch = allUpdatedFieldsMatch && updatedConfig.threads === partialConfig.threads;
          }
          if (partialConfig.timeout !== undefined) {
            allUpdatedFieldsMatch = allUpdatedFieldsMatch && updatedConfig.timeout === partialConfig.timeout;
          }
          if (partialConfig.rateLimit !== undefined) {
            allUpdatedFieldsMatch = allUpdatedFieldsMatch && updatedConfig.rateLimit === partialConfig.rateLimit;
          }
          if (partialConfig.scanDepth !== undefined) {
            allUpdatedFieldsMatch = allUpdatedFieldsMatch && updatedConfig.scanDepth === partialConfig.scanDepth;
          }
          if (partialConfig.outputDir !== undefined) {
            allUpdatedFieldsMatch = allUpdatedFieldsMatch && updatedConfig.outputDir === partialConfig.outputDir;
          }
          
          return allUpdatedFieldsMatch;
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve threads value through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(threadsArb, async (threads) => {
          await service.updateConfig({ threads });
          const config = await service.getConfig();
          return config.threads === threads;
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve timeout value through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(timeoutArb, async (timeout) => {
          await service.updateConfig({ timeout });
          const config = await service.getConfig();
          return config.timeout === timeout;
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve rateLimit value through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(rateLimitArb, async (rateLimit) => {
          await service.updateConfig({ rateLimit });
          const config = await service.getConfig();
          return config.rateLimit === rateLimit;
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve scanDepth value through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(scanDepthArb, async (scanDepth) => {
          await service.updateConfig({ scanDepth });
          const config = await service.getConfig();
          return config.scanDepth === scanDepth;
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve outputDir value through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(outputDirArb, async (outputDir) => {
          await service.updateConfig({ outputDir });
          const config = await service.getConfig();
          return config.outputDir === outputDir;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle multiple sequential updates correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(partialConfigArb, { minLength: 1, maxLength: 5 }),
          async (updates) => {
            for (const update of updates) {
              await service.updateConfig(update);
            }
            
            const finalConfig = await service.getConfig();
            return hasAllRequiredFields(finalConfig);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return default configuration when no config exists', async () => {
      const config = await service.getConfig();
      return hasAllRequiredFields(config) && hasValidRanges(config);
    });

    it('should reset configuration to defaults correctly', async () => {
      await fc.assert(
        fc.asyncProperty(configArb, async (config) => {
          // First update with custom config
          await service.updateConfig(config);
          
          // Reset to defaults
          const resetConfig = await service.resetConfig();
          
          // Verify reset config has default values
          return (
            resetConfig.threads === 10 &&
            resetConfig.timeout === 300 &&
            resetConfig.rateLimit === 10 &&
            resetConfig.scanDepth === 3 &&
            resetConfig.outputDir === '/app/results'
          );
        }),
        { numRuns: 100 }
      );
    });
  });
});
