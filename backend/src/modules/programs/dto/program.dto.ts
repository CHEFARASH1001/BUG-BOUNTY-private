import { IsString, IsOptional, IsArray, IsEnum, IsObject, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateProgramDto {
  @ApiProperty({ example: 'Example Corp Bug Bounty' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Bug bounty program for Example Corp' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ['hackerone', 'bugcrowd', 'intigriti', 'synack', 'custom', 'other'] })
  @IsEnum(['hackerone', 'bugcrowd', 'intigriti', 'synack', 'custom', 'other'])
  @IsOptional()
  platform?: string;

  @ApiPropertyOptional({ example: 'https://hackerone.com/example' })
  @IsString()
  @IsOptional()
  platformUrl?: string;

  @ApiProperty({ example: ['*.example.com', 'api.example.com'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  scope: string[];

  @ApiPropertyOptional({ example: ['test.example.com'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  outOfScope?: string[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  rewards?: {
    critical?: string;
    high?: string;
    medium?: string;
    low?: string;
  };

  @ApiPropertyOptional({ enum: ['active', 'paused', 'archived'] })
  @IsEnum(['active', 'paused', 'archived'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  settings?: {
    autoScan?: boolean;
    scanFrequency?: string;
    notifyOnNew?: boolean;
    maxConcurrentScans?: number;
  };
}

export class UpdateProgramDto extends PartialType(CreateProgramDto) {}

export class ProgramSettingsDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  autoScan?: boolean;

  @ApiPropertyOptional({ enum: ['daily', 'weekly', 'monthly'] })
  @IsString()
  @IsOptional()
  scanFrequency?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  notifyOnNew?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  maxConcurrentScans?: number;
}

