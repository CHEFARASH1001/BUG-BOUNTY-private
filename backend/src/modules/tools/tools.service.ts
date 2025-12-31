import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tool, ToolDocument, ToolCategory } from '../../schemas/tool.schema';
import { ToolExecution, ToolExecutionDocument } from '../../schemas/tool-execution.schema';
import { ValidationService } from './validation.service';
import { ExecutorService } from './executor.service';
import { PREDEFINED_TOOLS, PredefinedTool } from './data/predefined-tools';

/**
 * Result of a bulk import operation
 * Requirements: 7.3
 */
export interface BulkImportResult {
  successCount: number;
  failureCount: number;
  totalCount: number;
  failures: Array<{ name: string; reason: string }>;
}

/**
 * DTO for creating a new tool
 */
export interface CreateToolDto {
  name: string;
  displayName: string;
  description: string;
  githubUrl: string;
  categories: ToolCategory[];
  binaryName: string;
  configOptions?: Array<{
    name: string;
    flag: string;
    type: 'string' | 'number' | 'boolean' | 'file';
    description: string;
    required: boolean;
    default?: any;
  }>;
}

/**
 * DTO for updating a tool
 */
export interface UpdateToolDto {
  displayName?: string;
  description?: string;
  categories?: ToolCategory[];
  configOptions?: Array<{
    name: string;
    flag: string;
    type: 'string' | 'number' | 'boolean' | 'file';
    description: string;
    required: boolean;
    default?: any;
  }>;
  userConfig?: Record<string, any>;
  isActive?: boolean;
}

/**
 * DTO for querying tools
 */
export interface ToolQueryDto {
  search?: string;
  category?: ToolCategory;
  installedOnly?: boolean;
}

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    @InjectModel(Tool.name) private toolModel: Model<ToolDocument>,
    @InjectModel(ToolExecution.name) private toolExecutionModel: Model<ToolExecutionDocument>,
    private validationService: ValidationService,
    private executorService: ExecutorService,
  ) {}

  /**
   * Creates a new tool with GitHub validation.
   * Validates the GitHub URL and repository metrics before saving.
   * 
   * Requirements: 2.1, 2.4, 2.5
   * 
   * @param dto - Tool creation data
   * @returns Created tool document
   * @throws BadRequestException if validation fails
   * @throws ConflictException if tool name already exists
   */
  async create(dto: CreateToolDto): Promise<ToolDocument> {
    // Check for duplicate name
    const existingTool = await this.toolModel.findOne({ name: dto.name.toLowerCase() });
    if (existingTool) {
      throw new ConflictException(`Tool with name '${dto.name}' already exists`);
    }

    // Validate GitHub URL and repository metrics
    const validationResult = await this.validationService.validateGitHubRepo(dto.githubUrl);
    
    if (!validationResult.valid) {
      throw new BadRequestException(validationResult.reason);
    }

    // Create tool with validation results
    const tool = new this.toolModel({
      name: dto.name.toLowerCase(),
      displayName: dto.displayName,
      description: dto.description,
      githubUrl: dto.githubUrl,
      categories: dto.categories,
      configOptions: dto.configOptions || [],
      userConfig: {},
      isActive: true,
      validation: {
        isValid: true,
        lastChecked: new Date(),
        stars: validationResult.metrics!.stars,
        lastCommit: validationResult.metrics!.lastCommitDate,
      },
      installation: {
        isInstalled: false,
        binaryName: dto.binaryName,
        lastChecked: new Date(),
      },
    });

    return tool.save();
  }

  /**
   * Retrieves all tools with optional filtering.
   * 
   * Requirements: 1.1, 1.2, 1.3
   * 
   * @param query - Optional filters for category, search, and installation status
   * @returns Array of matching tools
   */
  async findAll(query?: ToolQueryDto): Promise<ToolDocument[]> {
    const filter: Record<string, any> = {};

    // Category filter (Requirement 1.2)
    if (query?.category) {
      filter.categories = query.category;
    }

    // Search filter - case-insensitive name search (Requirement 1.3)
    if (query?.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    // Installation status filter
    if (query?.installedOnly) {
      filter['installation.isInstalled'] = true;
    }

    return this.toolModel.find(filter).exec();
  }

  /**
   * Retrieves a single tool by ID.
   * 
   * Requirements: 1.1
   * 
   * @param id - Tool document ID
   * @returns Tool document
   * @throws NotFoundException if tool not found
   */
  async findById(id: string): Promise<ToolDocument> {
    const tool = await this.toolModel.findById(id).exec();
    if (!tool) {
      throw new NotFoundException(`Tool with ID '${id}' not found`);
    }
    return tool;
  }

  /**
   * Retrieves a tool by name.
   * 
   * @param name - Tool name (case-insensitive)
   * @returns Tool document or null
   */
  async findByName(name: string): Promise<ToolDocument | null> {
    return this.toolModel.findOne({ name: name.toLowerCase() }).exec();
  }

  /**
   * Updates a tool's metadata and configuration.
   * 
   * Requirements: 6.1, 6.2
   * 
   * @param id - Tool document ID
   * @param dto - Update data
   * @returns Updated tool document
   * @throws NotFoundException if tool not found
   */
  async update(id: string, dto: UpdateToolDto): Promise<ToolDocument> {
    const tool = await this.toolModel.findById(id).exec();
    if (!tool) {
      throw new NotFoundException(`Tool with ID '${id}' not found`);
    }

    // Update allowed fields
    if (dto.displayName !== undefined) {
      tool.displayName = dto.displayName;
    }
    if (dto.description !== undefined) {
      tool.description = dto.description;
    }
    if (dto.categories !== undefined) {
      tool.categories = dto.categories;
    }
    if (dto.configOptions !== undefined) {
      tool.configOptions = dto.configOptions;
    }
    if (dto.userConfig !== undefined) {
      tool.userConfig = dto.userConfig;
    }
    if (dto.isActive !== undefined) {
      tool.isActive = dto.isActive;
    }

    return tool.save();
  }

  /**
   * Deletes a tool from the registry.
   * 
   * Requirements: 6.1, 6.2
   * 
   * @param id - Tool document ID
   * @throws NotFoundException if tool not found
   */
  async delete(id: string): Promise<void> {
    const result = await this.toolModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Tool with ID '${id}' not found`);
    }
  }

  /**
   * Bulk imports predefined security tools into the registry.
   * Processes each tool sequentially, validating before adding.
   * 
   * Requirements: 7.1, 7.2, 7.3
   * 
   * @returns BulkImportResult with success/failure counts and details
   */
  async bulkImport(): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      successCount: 0,
      failureCount: 0,
      totalCount: PREDEFINED_TOOLS.length,
      failures: [],
    };

    for (const predefinedTool of PREDEFINED_TOOLS) {
      try {
        await this.importSingleTool(predefinedTool);
        result.successCount++;
        this.logger.log(`Successfully imported tool: ${predefinedTool.name}`);
      } catch (error) {
        result.failureCount++;
        const reason = error instanceof Error ? error.message : 'Unknown error';
        result.failures.push({ name: predefinedTool.name, reason });
        this.logger.warn(`Failed to import tool ${predefinedTool.name}: ${reason}`);
      }
    }

    this.logger.log(
      `Bulk import completed: ${result.successCount} succeeded, ${result.failureCount} failed out of ${result.totalCount} tools`,
    );

    return result;
  }

  /**
   * Imports a single predefined tool with validation.
   * Skips tools that already exist in the registry.
   * 
   * @param tool - Predefined tool data
   * @returns Created tool document
   * @throws Error if validation fails
   */
  private async importSingleTool(tool: PredefinedTool): Promise<ToolDocument> {
    // Check if tool already exists
    const existingTool = await this.toolModel.findOne({ name: tool.name.toLowerCase() });
    if (existingTool) {
      throw new Error(`Tool '${tool.name}' already exists in registry`);
    }

    // Validate GitHub URL and repository metrics
    const validationResult = await this.validationService.validateGitHubRepo(tool.githubUrl);
    
    if (!validationResult.valid) {
      throw new Error(validationResult.reason || 'Validation failed');
    }

    // Create tool with validation results
    const newTool = new this.toolModel({
      name: tool.name.toLowerCase(),
      displayName: tool.displayName,
      description: tool.description,
      githubUrl: tool.githubUrl,
      categories: tool.categories,
      configOptions: [],
      userConfig: {},
      isActive: true,
      validation: {
        isValid: true,
        lastChecked: new Date(),
        stars: validationResult.metrics!.stars,
        lastCommit: validationResult.metrics!.lastCommitDate,
      },
      installation: {
        isInstalled: false,
        binaryName: tool.binaryName,
        lastChecked: new Date(),
        installCommands: tool.installCommands || [],
        containerName: tool.containerName,
      },
    });

    return newTool.save();
  }

  /**
   * Gets the predefined tools list for testing purposes.
   * 
   * @returns Array of predefined tools
   */
  getPredefinedTools(): PredefinedTool[] {
    return PREDEFINED_TOOLS;
  }

  /**
   * Re-validates a tool's GitHub repository metrics.
   * Updates the tool's validation data with fresh metrics from GitHub.
   * 
   * Requirements: 3.2
   * 
   * @param id - Tool document ID
   * @returns Updated tool document with fresh validation data
   * @throws NotFoundException if tool not found
   * @throws BadRequestException if validation fails
   */
  async revalidate(id: string): Promise<ToolDocument> {
    const tool = await this.toolModel.findById(id).exec();
    if (!tool) {
      throw new NotFoundException(`Tool with ID '${id}' not found`);
    }

    // Re-validate GitHub URL and repository metrics
    const validationResult = await this.validationService.validateGitHubRepo(tool.githubUrl);
    
    // Update validation data regardless of result
    tool.validation = {
      isValid: validationResult.valid,
      lastChecked: new Date(),
      stars: validationResult.metrics?.stars || 0,
      lastCommit: validationResult.metrics?.lastCommitDate || new Date(),
      reason: validationResult.reason,
    };

    return tool.save();
  }

  /**
   * Syncs existing tools with the latest predefined tool data.
   * Updates install commands and other metadata for tools that already exist.
   * 
   * @returns Object with counts of updated and skipped tools
   */
  async syncPredefinedTools(): Promise<{ updated: number; skipped: number; errors: string[] }> {
    const result = { updated: 0, skipped: 0, errors: [] as string[] };

    for (const predefinedTool of PREDEFINED_TOOLS) {
      try {
        const existingTool = await this.toolModel.findOne({ name: predefinedTool.name.toLowerCase() });
        
        if (existingTool) {
          // Update the tool with latest predefined data (especially installCommands and containerName)
          existingTool.installation = {
            ...existingTool.installation,
            binaryName: predefinedTool.binaryName,
            installCommands: predefinedTool.installCommands || [],
            containerName: predefinedTool.containerName,
            lastChecked: existingTool.installation?.lastChecked || new Date(),
            isInstalled: existingTool.installation?.isInstalled || false,
          };
          
          await existingTool.save();
          result.updated++;
          this.logger.log(`Synced tool: ${predefinedTool.name}`);
        } else {
          result.skipped++;
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${predefinedTool.name}: ${reason}`);
        this.logger.warn(`Failed to sync tool ${predefinedTool.name}: ${reason}`);
      }
    }

    this.logger.log(`Sync completed: ${result.updated} updated, ${result.skipped} skipped`);
    return result;
  }

  /**
   * Refreshes the installation status of all tools by checking which binaries are available.
   * 
   * @returns Object with counts of installed and not installed tools
   */
  async refreshInstallationStatus(): Promise<{ installed: number; notInstalled: number; tools: Array<{ name: string; isInstalled: boolean; version?: string }> }> {
    const tools = await this.toolModel.find().exec();
    const result = { installed: 0, notInstalled: 0, tools: [] as Array<{ name: string; isInstalled: boolean; version?: string }> };

    for (const tool of tools) {
      try {
        const binaryName = tool.installation?.binaryName || tool.name;
        const containerName = tool.installation?.containerName;
        const isInstalled = await this.executorService.isInstalled(tool.name, binaryName, containerName);
        let version: string | undefined;

        if (isInstalled) {
          version = await this.executorService.getVersion(tool.name, binaryName, containerName) || undefined;
          result.installed++;
        } else {
          result.notInstalled++;
        }

        // Update tool installation status
        tool.installation = {
          ...tool.installation!,
          isInstalled,
          version,
          lastChecked: new Date(),
        };
        await tool.save();

        result.tools.push({ name: tool.displayName, isInstalled, version });
        this.logger.log(`Checked ${tool.name}: ${isInstalled ? 'installed' : 'not installed'}${version ? ` (v${version})` : ''}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Failed to check tool ${tool.name}: ${reason}`);
        result.tools.push({ name: tool.displayName, isInstalled: false });
        result.notInstalled++;
      }
    }

    this.logger.log(`Refresh completed: ${result.installed} installed, ${result.notInstalled} not installed`);
    return result;
  }
}
