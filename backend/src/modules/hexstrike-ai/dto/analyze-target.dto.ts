import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyzeTargetDto {
  @ApiProperty({
    description: 'Target to analyze (domain, IP, URL, or file path)',
    example: 'example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'Target is required' })
  target: string;

  @ApiPropertyOptional({
    description: 'Optional scan depth (1-5)',
    example: 3,
  })
  @IsOptional()
  depth?: number;

  @ApiPropertyOptional({
    description: 'Optional scan mode',
    example: 'passive',
  })
  @IsOptional()
  @IsString()
  mode?: 'passive' | 'active' | 'aggressive';
}
