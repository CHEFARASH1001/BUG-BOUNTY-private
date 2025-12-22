import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { DocType } from '../../../schemas/documentation.schema';

export class CreateDocumentationDto {
  @ApiProperty({ example: 'SQL Injection Techniques' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Detailed notes on SQL injection attack vectors...' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ enum: DocType, default: DocType.NOTE })
  @IsEnum(DocType)
  @IsOptional()
  type?: DocType;

  @ApiPropertyOptional({ example: ['sqli', 'injection', 'database'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ example: ['web-security', 'owasp-top-10'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];

  @ApiPropertyOptional({ example: ['example.com', 'api.example.com'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targets?: string[];

  @ApiPropertyOptional({ example: ['MySQL', 'PostgreSQL'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  technologies?: string[];

  @ApiPropertyOptional({ example: ['SQL Injection', 'Blind SQLi'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  vulnerabilityTypes?: string[];

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Array of related document IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  relatedDocs?: string[];
}

export class UpdateDocumentationDto extends PartialType(CreateDocumentationDto) {}

export class DocumentationFilterDto {
  @ApiPropertyOptional({ enum: DocType })
  @IsEnum(DocType)
  @IsOptional()
  type?: DocType;

  @ApiPropertyOptional({ description: 'Filter by tag' })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by target' })
  @IsString()
  @IsOptional()
  target?: string;

  @ApiPropertyOptional({ description: 'Filter by technology' })
  @IsString()
  @IsOptional()
  technology?: string;

  @ApiPropertyOptional({ description: 'Filter by pinned status' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isPinned?: boolean;

  @ApiPropertyOptional({ description: 'Maximum number of results', default: 20 })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of results to skip', default: 0 })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  offset?: number;

  @ApiPropertyOptional({ description: 'Sort field and direction (e.g., "-createdAt")' })
  @IsString()
  @IsOptional()
  sort?: string;
}
