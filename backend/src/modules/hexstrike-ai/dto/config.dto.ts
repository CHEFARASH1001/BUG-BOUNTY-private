import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConfigDto {
  @ApiPropertyOptional({
    description: 'Number of threads for parallel operations',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  threads?: number;

  @ApiPropertyOptional({
    description: 'Default timeout in seconds',
    example: 300,
    minimum: 30,
    maximum: 3600,
  })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(3600)
  timeout?: number;

  @ApiPropertyOptional({
    description: 'Rate limit (requests per second)',
    example: 10,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  rateLimit?: number;

  @ApiPropertyOptional({
    description: 'Default scan depth',
    example: 3,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  scanDepth?: number;

  @ApiPropertyOptional({
    description: 'Output directory for results',
    example: '/app/results',
  })
  @IsOptional()
  @IsString()
  outputDir?: string;
}
