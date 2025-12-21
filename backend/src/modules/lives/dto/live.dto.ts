import { IsString, IsOptional, IsBoolean, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLiveDto {
  @ApiProperty({ description: 'Subdomain' })
  @IsString()
  subdomain: string;

  @ApiProperty({ description: 'Root domain' })
  @IsString()
  domain: string;

  @ApiPropertyOptional({ description: 'Program ID' })
  @IsString()
  @IsOptional()
  programId?: string;

  @ApiPropertyOptional({ description: 'IP addresses' })
  @IsArray()
  @IsOptional()
  ip?: string[];

  @ApiPropertyOptional({ description: 'CNAME records' })
  @IsArray()
  @IsOptional()
  cname?: string[];

  @ApiPropertyOptional({ description: 'Is CDN' })
  @IsBoolean()
  @IsOptional()
  isCdn?: boolean;

  @ApiPropertyOptional({ description: 'CDN provider' })
  @IsArray()
  @IsOptional()
  cdnProvider?: string[];

  @ApiPropertyOptional({ description: 'Discovery provider' })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ description: 'DNS records' })
  @IsObject()
  @IsOptional()
  dnsRecords?: Record<string, any>;
}

export class UpdateLiveDto {
  @ApiPropertyOptional({ description: 'IP addresses' })
  @IsArray()
  @IsOptional()
  ip?: string[];

  @ApiPropertyOptional({ description: 'CNAME records' })
  @IsArray()
  @IsOptional()
  cname?: string[];

  @ApiPropertyOptional({ description: 'Is CDN' })
  @IsBoolean()
  @IsOptional()
  isCdn?: boolean;

  @ApiPropertyOptional({ description: 'CDN provider' })
  @IsArray()
  @IsOptional()
  cdnProvider?: string[];

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Tags' })
  @IsArray()
  @IsOptional()
  tags?: string[];
}

