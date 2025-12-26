import { IsString, IsNotEmpty, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WorkflowType {
  BUGBOUNTY = 'bugbounty',
  CTF = 'ctf',
  RECONNAISSANCE = 'reconnaissance',
  VULNERABILITY_HUNTING = 'vulnerability-hunting',
  OSINT = 'osint',
}

export class StartWorkflowDto {
  @ApiProperty({
    description: 'Target for the workflow',
    example: 'example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'Target is required' })
  target: string;

  @ApiPropertyOptional({
    description: 'Additional options for the workflow',
    example: { depth: 'deep', includeSubdomains: true },
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, any>;
}

export class WorkflowResponseDto {
  @ApiProperty({ description: 'Workflow execution ID' })
  id: string;

  @ApiProperty({ description: 'Workflow type' })
  type: WorkflowType;

  @ApiProperty({ description: 'Target' })
  target: string;

  @ApiProperty({ description: 'Workflow status' })
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';

  @ApiPropertyOptional({ description: 'Current step in the workflow' })
  currentStep?: number;

  @ApiPropertyOptional({ description: 'Total steps in the workflow' })
  totalSteps?: number;

  @ApiPropertyOptional({ description: 'Workflow findings' })
  findings?: any[];

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;
}
