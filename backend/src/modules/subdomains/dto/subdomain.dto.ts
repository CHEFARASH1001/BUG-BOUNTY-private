import { IsString, IsOptional, IsArray, IsBoolean, IsMongoId, IsNumber, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateSubdomainDto {
  @ApiProperty({ example: 'api.example.com' })
  @IsString()
  subdomain: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  domainId: string;

  @ApiPropertyOptional({ example: ['192.168.1.1'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ip?: string[];

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isAlive?: boolean;

  @ApiPropertyOptional({ example: 200 })
  @IsNumber()
  @IsOptional()
  httpStatus?: number;

  @ApiPropertyOptional({ example: ['React', 'nginx'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  technologies?: string[];

  @ApiPropertyOptional({ type: [Object] })
  @IsArray()
  @IsOptional()
  ports?: {
    port: number;
    protocol: string;
    service: string;
    version?: string;
    banner?: string;
  }[];

  @ApiPropertyOptional({ example: 'API Documentation' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: ['subfinder', 'amass'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sources?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateSubdomainDto extends PartialType(CreateSubdomainDto) {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  screenshot?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  webServer?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  ssl?: {
    issuer?: string;
    validFrom?: Date;
    validTo?: Date;
    isExpired?: boolean;
    isValid?: boolean;
  };
}

