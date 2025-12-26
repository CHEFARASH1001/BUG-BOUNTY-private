import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExecuteToolDto {
  @ApiProperty({
    description: 'Target for the tool execution',
    example: 'example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'Target is required' })
  target: string;

  @ApiPropertyOptional({
    description: 'Additional parameters for the tool',
    example: { ports: '1-1000', threads: 10 },
  })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;
}

export class ToolExecutionResponseDto {
  @ApiProperty({ description: 'Execution ID' })
  id: string;

  @ApiProperty({ description: 'Tool name' })
  tool: string;

  @ApiProperty({ description: 'Target' })
  target: string;

  @ApiProperty({ description: 'Execution status' })
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  @ApiPropertyOptional({ description: 'Process ID' })
  pid?: number;

  @ApiPropertyOptional({ description: 'Execution output' })
  output?: string;

  @ApiPropertyOptional({ description: 'Execution results' })
  results?: any;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;
}
