import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ToolsService } from './tools.service';
import { ExecutorService, ToolStatus, InstallResult } from './executor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import {
  CreateToolDto,
  UpdateToolDto,
  ToolQueryDto,
  ExecuteToolDto,
  ExecutionQueryDto,
  BulkImportResultDto,
} from './dto/tool.dto';
import { ToolDocument, ToolCategory, InstallMethod } from '../../schemas/tool.schema';
import { ToolExecutionDocument, ExecutionStatus } from '../../schemas/tool-execution.schema';
import { BulkImportResult } from './tools.service';

@ApiTags('tools')
@Controller('tools')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ToolsController {
  constructor(
    private readonly toolsService: ToolsService,
    private readonly executorService: ExecutorService,
  ) {}

  /**
   * GET /api/tools - List all tools with optional filters
   * Requirements: 1.1, 1.2, 1.3
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'List all tools with optional filters' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for tool name' })
  @ApiQuery({ name: 'category', required: false, enum: ToolCategory, description: 'Filter by category' })
  @ApiQuery({ name: 'installedOnly', required: false, type: Boolean, description: 'Filter to only installed tools' })
  @ApiResponse({ status: 200, description: 'List of tools' })
  async getAll(@Query() query: ToolQueryDto): Promise<ToolDocument[]> {
    return this.toolsService.findAll(query);
  }

  /**
   * GET /api/tools/:id - Get single tool details
   * Requirements: 1.1, 1.4
   */
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a single tool by ID' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  @ApiResponse({ status: 200, description: 'Tool details' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  async getById(@Param('id') id: string): Promise<ToolDocument> {
    return this.toolsService.findById(id);
  }


  /**
   * POST /api/tools - Create a new tool with validation
   * Requirements: 2.1
   */
  @Post()
  @ApiOperation({ summary: 'Create a new tool with GitHub validation' })
  @ApiResponse({ status: 201, description: 'Tool created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Tool with this name already exists' })
  async create(@Body() dto: CreateToolDto): Promise<ToolDocument> {
    return this.toolsService.create(dto);
  }

  /**
   * POST /api/tools/bulk-import - Bulk import predefined security tools
   * Requirements: 7.1, 7.2, 7.3
   */
  @Post('bulk-import')
  @Public()
  @ApiOperation({ summary: 'Bulk import predefined security tools' })
  @ApiResponse({
    status: 201,
    description: 'Bulk import completed',
    type: BulkImportResultDto,
  })
  async bulkImport(): Promise<BulkImportResult> {
    return this.toolsService.bulkImport();
  }

  /**
   * POST /api/tools/sync - Sync existing tools with latest predefined data
   */
  @Post('sync')
  @Public()
  @ApiOperation({ summary: 'Sync existing tools with latest predefined tool data (updates install commands)' })
  @ApiResponse({ status: 200, description: 'Sync completed' })
  async syncTools(): Promise<{ updated: number; skipped: number; errors: string[] }> {
    return this.toolsService.syncPredefinedTools();
  }

  /**
   * PUT /api/tools/:id - Update a tool
   * Requirements: 6.1, 6.2
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a tool' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  @ApiResponse({ status: 200, description: 'Tool updated successfully' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateToolDto,
  ): Promise<ToolDocument> {
    return this.toolsService.update(id, dto);
  }

  /**
   * DELETE /api/tools/:id - Delete a tool
   * Requirements: 6.1, 6.2
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tool' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  @ApiResponse({ status: 204, description: 'Tool deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.toolsService.delete(id);
  }

  /**
   * POST /api/tools/:id/execute - Execute a tool
   * Requirements: 4.1
   */
  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a tool with arguments' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  @ApiResponse({ status: 201, description: 'Tool execution started' })
  @ApiResponse({ status: 400, description: 'Tool not installed or invalid arguments' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  async execute(
    @Param('id') id: string,
    @Body() dto: ExecuteToolDto,
  ): Promise<ToolExecutionDocument> {
    const tool = await this.toolsService.findById(id);
    return this.executorService.execute(tool, dto.arguments, {
      timeout: dto.timeout,
    });
  }

  /**
   * GET /api/tools/:id/executions - Get execution history
   * Requirements: 8.1
   */
  @Get(':id/executions')
  @ApiOperation({ summary: 'Get execution history for a tool' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of executions (default 10)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter from date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter until date (ISO string)' })
  @ApiQuery({ name: 'status', required: false, enum: ExecutionStatus, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'List of executions' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  async getExecutions(
    @Param('id') id: string,
    @Query() query: ExecutionQueryDto,
  ): Promise<ToolExecutionDocument[]> {
    // Verify tool exists
    await this.toolsService.findById(id);
    
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;
    
    return this.executorService.getExecutionHistory(
      id,
      query.limit || 10,
      startDate,
      endDate,
      query.status,
    );
  }

  /**
   * GET /api/tools/:id/status - Check installation status
   * Requirements: 3.1
   */
  @Get(':id/status')
  @Public()
  @ApiOperation({ summary: 'Check tool installation status' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  @ApiResponse({ status: 200, description: 'Tool installation status' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  async checkStatus(@Param('id') id: string): Promise<ToolStatus> {
    const tool = await this.toolsService.findById(id);
    return this.executorService.getInstallationStatus(tool);
  }

  /**
   * POST /api/tools/:id/validate - Re-validate tool's GitHub metrics
   * Requirements: 3.2
   */
  @Post(':id/validate')
  @ApiOperation({ summary: 'Re-validate tool GitHub repository metrics' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  @ApiResponse({ status: 200, description: 'Tool re-validated successfully' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  async validate(@Param('id') id: string): Promise<ToolDocument> {
    return this.toolsService.revalidate(id);
  }

  /**
   * POST /api/tools/:id/install - Install a tool
   */
  @Post(':id/install')
  @Public()
  @ApiOperation({ summary: 'Install a tool using available package manager' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  @ApiQuery({ name: 'method', required: false, description: 'Preferred installation method (go, pip, apt, brew, cargo, npm, git)' })
  @ApiResponse({ status: 200, description: 'Tool installation result' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  async install(
    @Param('id') id: string,
    @Query('method') method?: InstallMethod,
  ): Promise<InstallResult> {
    const tool = await this.toolsService.findById(id);
    return this.executorService.installTool(tool, method);
  }

  /**
   * POST /api/tools/install-all - Install all tools that are not installed
   */
  @Post('install-all')
  @Public()
  @ApiOperation({ summary: 'Install all tools that are not currently installed' })
  @ApiResponse({ status: 200, description: 'Installation results for all tools' })
  async installAll(): Promise<{ results: Array<{ name: string; success: boolean; method?: string; error?: string }> }> {
    const tools = await this.toolsService.findAll();
    const results: Array<{ name: string; success: boolean; method?: string; error?: string }> = [];

    for (const tool of tools) {
      // Skip already installed tools
      if (tool.installation?.isInstalled) {
        results.push({ name: tool.displayName, success: true, method: 'already_installed' });
        continue;
      }

      try {
        const result = await this.executorService.installTool(tool);
        results.push({
          name: tool.displayName,
          success: result.success,
          method: result.method,
          error: result.error,
        });
      } catch (err: any) {
        results.push({
          name: tool.displayName,
          success: false,
          error: err.message || 'Unknown error',
        });
      }
    }

    return { results };
  }

  /**
   * GET /api/tools/:id/install-methods - Get available installation methods
   */
  @Get(':id/install-methods')
  @Public()
  @ApiOperation({ summary: 'Get available installation methods for a tool' })
  @ApiParam({ name: 'id', description: 'Tool ID' })
  @ApiResponse({ status: 200, description: 'Available installation methods' })
  @ApiResponse({ status: 404, description: 'Tool not found' })
  async getInstallMethods(@Param('id') id: string): Promise<{ method: InstallMethod; command: string; available: boolean }[]> {
    const tool = await this.toolsService.findById(id);
    return this.executorService.getAvailableInstallMethods(tool);
  }

  /**
   * POST /api/tools/refresh-status - Refresh installation status of all tools
   */
  @Post('refresh-status')
  @Public()
  @ApiOperation({ summary: 'Refresh installation status of all tools by checking available binaries' })
  @ApiResponse({ status: 200, description: 'Installation status refreshed' })
  async refreshStatus(): Promise<{ installed: number; notInstalled: number; tools: Array<{ name: string; isInstalled: boolean; version?: string }> }> {
    return this.toolsService.refreshInstallationStatus();
  }
}
