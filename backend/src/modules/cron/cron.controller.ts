import { Controller, Get, Post, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CronService } from './cron.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CronConfig } from './schemas/cron-config.schema';

import { IsString, IsBoolean, IsOptional, IsObject } from 'class-validator';

class UpdateCronConfigDto {
  @IsOptional()
  @IsString()
  schedule?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  options?: {
    timeout?: number;
    retries?: number;
    concurrency?: number;
  };
}

@ApiTags('Cron Jobs')
@Controller('cron')
export class CronController {
  constructor(private cronService: CronService) {}

  @Get('configs')
  @Public()
  @ApiOperation({ summary: 'Get all cron job configurations' })
  @ApiResponse({ status: 200, description: 'List of cron configurations' })
  async getConfigs() {
    return this.cronService.getConfigs();
  }

  @Get('configs/:jobName')
  @Public()
  @ApiOperation({ summary: 'Get a specific cron job configuration' })
  @ApiResponse({ status: 200, description: 'Cron configuration' })
  async getConfig(@Param('jobName') jobName: string) {
    return this.cronService.getConfig(jobName);
  }

  @Put('configs/:jobName')
  @Public() // Allow config updates without auth for dev mode
  @ApiOperation({ summary: 'Update a cron job configuration' })
  @ApiResponse({ status: 200, description: 'Updated configuration' })
  async updateConfig(
    @Param('jobName') jobName: string,
    @Body() updates: UpdateCronConfigDto,
  ) {
    return this.cronService.updateConfig(jobName, updates);
  }

  @Post('trigger/:jobName')
  @Public() // Allow manual trigger without auth for dev mode
  @ApiOperation({ summary: 'Manually trigger a cron job' })
  @ApiResponse({ status: 200, description: 'Job execution started' })
  async triggerJob(@Param('jobName') jobName: string) {
    const execution = await this.cronService.triggerJob(jobName);
    return {
      message: `Job ${jobName} started`,
      executionId: execution._id,
    };
  }

  @Get('executions')
  @Public()
  @ApiOperation({ summary: 'Get job execution history' })
  @ApiQuery({ name: 'jobName', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of job executions' })
  async getExecutions(
    @Query('jobName') jobName?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cronService.getExecutions(
      jobName,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('running')
  @Public()
  @ApiOperation({ summary: 'Get currently running jobs' })
  @ApiResponse({ status: 200, description: 'List of running jobs' })
  async getRunningJobs() {
    return this.cronService.getRunningJobs();
  }

  @Get('executions/:executionId/logs')
  @Public()
  @ApiOperation({ summary: 'Get logs for a specific job execution' })
  @ApiResponse({ status: 200, description: 'Execution logs' })
  async getExecutionLogs(@Param('executionId') executionId: string) {
    return this.cronService.getExecutionLogs(executionId);
  }
}
