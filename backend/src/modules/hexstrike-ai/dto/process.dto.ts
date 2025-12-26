import { IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProcessStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TERMINATED = 'terminated',
}

export class ProcessDto {
  @ApiProperty({ description: 'Process ID' })
  @IsNumber()
  pid: number;

  @ApiProperty({ description: 'Process status' })
  @IsEnum(ProcessStatus)
  status: ProcessStatus;

  @ApiProperty({ description: 'Command being executed' })
  @IsString()
  command: string;

  @ApiPropertyOptional({ description: 'Tool name' })
  @IsOptional()
  @IsString()
  tool?: string;

  @ApiPropertyOptional({ description: 'Target' })
  @IsOptional()
  @IsString()
  target?: string;

  @ApiProperty({ description: 'Start time' })
  startTime: Date;

  @ApiPropertyOptional({ description: 'End time' })
  @IsOptional()
  endTime?: Date;

  @ApiPropertyOptional({ description: 'Duration in seconds' })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({ description: 'Process output' })
  @IsOptional()
  @IsString()
  output?: string;
}

export class TerminateProcessResponseDto {
  @ApiProperty({ description: 'Whether termination was successful' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;
}
