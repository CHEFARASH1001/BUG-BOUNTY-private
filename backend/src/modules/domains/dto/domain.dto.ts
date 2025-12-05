import { IsString, IsOptional, IsArray, IsBoolean, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateDomainDto {
  @ApiProperty({ example: 'example.com' })
  @IsString()
  domain: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  programId: string;

  @ApiPropertyOptional({ example: ['web', 'api'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ example: 'Main website domain' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  autoScan?: boolean;
}

export class UpdateDomainDto extends PartialType(CreateDomainDto) {
  @ApiPropertyOptional({ enum: ['pending', 'scanning', 'completed', 'failed'] })
  @IsString()
  @IsOptional()
  status?: string;
}

export class BulkCreateDomainsDto {
  @ApiProperty({ example: ['example.com', 'test.com'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  domains: string[];

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  programId: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  autoScan?: boolean;
}

