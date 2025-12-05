import { IsString, IsOptional, IsEnum, IsMongoId, IsNumber, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScanType } from '../../../schemas/scan.schema';

export class CreateScanDto {
  @ApiProperty({ enum: ScanType })
  @IsEnum(ScanType)
  type: ScanType;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  targetId: string;

  @ApiProperty({ enum: ['domain', 'subdomain', 'program'] })
  @IsEnum(['domain', 'subdomain', 'program'])
  targetType: string;

  @ApiProperty({ example: 'example.com' })
  @IsString()
  target: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  config?: {
    templates?: string[];
    ports?: string;
    threads?: number;
    timeout?: number;
    rateLimit?: number;
    includeSubdomains?: boolean;
    includePorts?: boolean;
    includeNuclei?: boolean;
    includeScreenshots?: boolean;
    includeTechnologies?: boolean;
  };

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  priority?: number;
}

export class ScanProgressDto {
  @ApiProperty()
  scanId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  progress: number;

  @ApiPropertyOptional()
  currentStep?: string;

  @ApiPropertyOptional()
  error?: string;
}

