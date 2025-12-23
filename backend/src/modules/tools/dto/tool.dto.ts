import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsObject,
  IsBoolean,
  IsNumber,
  IsUrl,
  Matches,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ToolCategory } from '../../../schemas/tool.schema';
import { ExecutionStatus } from '../../../schemas/tool-execution.schema';

/**
 * Configuration option DTO for tool config options
 */
export class ConfigOptionDto {
  @ApiProperty({ example: 'threads' })
  @IsString()
  name: string;

  @ApiProperty({ example: '-t' })
  @IsString()
  flag: string;

  @ApiProperty({ enum: ['string', 'number', 'boolean', 'file'] })
  @IsEnum(['string', 'number', 'boolean', 'file'])
  type: 'string' | 'number' | 'boolean' | 'file';

  @ApiProperty({ example: 'Number of concurrent threads' })
  @IsString()
  description: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  default?: any;
}

/**
 * DTO for creating a new tool
 * Requirements: 2.1
 */
export class CreateToolDto {
  @ApiProperty({ example: 'subfinder', description: 'Unique tool identifier' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Subfinder', description: 'Display name for the tool' })
  @IsString()
  displayName: string;

  @ApiProperty({ example: 'Fast passive subdomain enumeration tool', description: 'Tool description' })
  @IsString()
  description: string;

  @ApiProperty({
    example: 'https://github.com/projectdiscovery/subfinder',
    description: 'GitHub repository URL (must be valid GitHub URL)',
  })
  @IsUrl()
  @Matches(/^https:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/, {
    message: 'GitHub URL must match pattern: https://github.com/{owner}/{repo}',
  })
  githubUrl: string;

  @ApiProperty({
    example: ['subdomain_enumeration'],
    enum: ToolCategory,
    isArray: true,
    description: 'Tool categories',
  })
  @IsArray()
  @IsEnum(ToolCategory, { each: true })
  categories: ToolCategory[];

  @ApiProperty({ example: 'subfinder', description: 'Binary name for execution' })
  @IsString()
  binaryName: string;

  @ApiPropertyOptional({ type: [ConfigOptionDto], description: 'Configuration options for the tool' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigOptionDto)
  configOptions?: ConfigOptionDto[];
}


/**
 * DTO for updating a tool
 * Requirements: 6.1, 6.2
 */
export class UpdateToolDto extends PartialType(CreateToolDto) {
  @ApiPropertyOptional({ type: Object, description: 'User-specific configuration values' })
  @IsOptional()
  @IsObject()
  userConfig?: Record<string, any>;

  @ApiPropertyOptional({ example: true, description: 'Whether the tool is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO for querying tools
 * Requirements: 1.2, 1.3
 */
export class ToolQueryDto {
  @ApiPropertyOptional({ example: 'subfinder', description: 'Search term for tool name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ToolCategory, description: 'Filter by category' })
  @IsOptional()
  @IsEnum(ToolCategory)
  category?: ToolCategory;

  @ApiPropertyOptional({ example: false, description: 'Filter to only installed tools' })
  @IsOptional()
  @IsBoolean()
  installedOnly?: boolean;
}

/**
 * DTO for executing a tool
 * Requirements: 4.1
 */
export class ExecuteToolDto {
  @ApiProperty({
    example: ['-d', 'example.com', '-silent'],
    type: [String],
    description: 'Command line arguments for the tool',
  })
  @IsArray()
  @IsString({ each: true })
  arguments: string[];

  @ApiPropertyOptional({ type: Object, description: 'Configuration overrides for this execution' })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ example: 60000, description: 'Execution timeout in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  timeout?: number;
}

/**
 * DTO for querying execution history
 * Requirements: 8.1, 8.3
 */
export class ExecutionQueryDto {
  @ApiPropertyOptional({ example: 10, description: 'Maximum number of executions to return' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter executions from this date' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter executions until this date' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ enum: ExecutionStatus, description: 'Filter by execution status' })
  @IsOptional()
  @IsEnum(ExecutionStatus)
  status?: ExecutionStatus;
}

/**
 * DTO for bulk import result
 * Requirements: 7.3
 */
export class BulkImportResultDto {
  @ApiProperty({ example: 25, description: 'Number of tools successfully imported' })
  successCount: number;

  @ApiProperty({ example: 4, description: 'Number of tools that failed to import' })
  failureCount: number;

  @ApiProperty({ example: 29, description: 'Total number of tools processed' })
  totalCount: number;

  @ApiProperty({
    type: [Object],
    description: 'Details of failed imports',
    example: [{ name: 'tool-name', reason: 'Validation failed' }],
  })
  failures: Array<{ name: string; reason: string }>;
}
