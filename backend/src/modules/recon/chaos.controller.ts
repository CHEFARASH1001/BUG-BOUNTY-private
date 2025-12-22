import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsArray } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChaosService, ChaosProgram, ChaosSyncResult } from './services/chaos.service';

class SyncChaosDto {
  @IsString()
  programName: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  existingSubdomains?: string[];
}

class WatchChaosDto {
  @IsBoolean()
  enabled: boolean;
}

interface ChaosSyncJob {
  id: string;
  programName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: ChaosSyncResult;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

// In-memory job storage (in production, this would be in a database)
const chaosSyncJobs = new Map<string, ChaosSyncJob>();

@ApiTags('chaos')
@Controller('chaos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChaosController {
  constructor(private readonly chaosService: ChaosService) {}

  /**
   * List available Chaos programs
   * GET /api/v1/chaos/programs - List available Chaos programs
   * Implements Requirement 14.1: Fetch the Chaos index from chaos-data.projectdiscovery.io
   */
  @Get('programs')
  @ApiOperation({ summary: 'List available Chaos programs from ProjectDiscovery' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search query to filter programs' })
  async listPrograms(@Query('search') search?: string): Promise<ChaosProgram[]> {
    try {
      if (search) {
        return this.chaosService.findMatchingPrograms(search);
      }
      return this.chaosService.fetchIndex();
    } catch (error) {
      throw new HttpException(
        'Failed to fetch Chaos programs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Sync a program from Chaos
   * POST /api/v1/chaos/sync - Sync a program
   * Implements Requirement 14.2: Download and extract ZIP files for matching programs
   */
  @Post('sync')
  @ApiOperation({ summary: 'Start syncing a Chaos program' })
  @ApiBody({
    description: 'Chaos sync configuration',
    schema: {
      type: 'object',
      required: ['programName'],
      properties: {
        programName: { type: 'string', description: 'Name of the Chaos program to sync' },
        existingSubdomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of existing subdomains to compare against',
        },
      },
    },
  })
  async syncProgram(@Body() syncDto: SyncChaosDto) {
    if (!syncDto.programName) {
      throw new HttpException('Program name is required', HttpStatus.BAD_REQUEST);
    }

    // Generate job ID
    const jobId = this.generateJobId();

    // Create job record
    const job: ChaosSyncJob = {
      id: jobId,
      programName: syncDto.programName,
      status: 'pending',
      startedAt: new Date(),
    };

    chaosSyncJobs.set(jobId, job);

    // Start sync asynchronously
    this.runChaosSync(jobId, syncDto);

    return {
      id: jobId,
      programName: syncDto.programName,
      status: 'pending',
      message: 'Chaos sync started',
    };
  }

  /**
   * Get sync status
   * GET /api/v1/chaos/sync/:id - Get sync status
   * Implements Requirement 14.4: Report the count of new subdomains discovered
   */
  @Get('sync/:id')
  @ApiOperation({ summary: 'Get Chaos sync job status and results' })
  @ApiParam({ name: 'id', description: 'Chaos sync job ID' })
  async getSyncStatus(@Param('id') id: string) {
    const job = chaosSyncJobs.get(id);

    if (!job) {
      // Try to get from database by program name (id might be program name)
      const syncRecord = await this.chaosService.getSyncStatus(id);
      if (syncRecord) {
        return {
          id: (syncRecord as any)._id,
          programName: syncRecord.programName,
          status: 'completed',
          result: {
            program: syncRecord.programName,
            subdomainsImported: syncRecord.subdomainsImported,
            newSubdomains: syncRecord.newSubdomains,
            timestamp: syncRecord.syncedAt,
          },
          watchEnabled: syncRecord.watchEnabled,
        };
      }
      throw new HttpException('Sync job not found', HttpStatus.NOT_FOUND);
    }

    return job;
  }

  /**
   * Enable/disable watching for a program
   * PUT /api/v1/chaos/watch/:programId - Enable/disable watching
   * Implements Requirement 14.5: Enable/disable Chaos watching for a program
   */
  @Put('watch/:programId')
  @ApiOperation({ summary: 'Enable or disable Chaos watching for a program' })
  @ApiParam({ name: 'programId', description: 'Program name or ID to watch/unwatch' })
  @ApiBody({
    description: 'Watch configuration',
    schema: {
      type: 'object',
      required: ['enabled'],
      properties: {
        enabled: { type: 'boolean', description: 'Whether to enable watching' },
      },
    },
  })
  async setWatch(@Param('programId') programId: string, @Body() watchDto: WatchChaosDto) {
    if (typeof watchDto.enabled !== 'boolean') {
      throw new HttpException('enabled field must be a boolean', HttpStatus.BAD_REQUEST);
    }

    const result = await this.chaosService.setWatchEnabled(programId, watchDto.enabled);

    if (!result) {
      // Program not synced yet, need to sync first
      throw new HttpException(
        'Program not found. Please sync the program first.',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      programName: result.programName,
      watchEnabled: result.watchEnabled,
      message: watchDto.enabled
        ? 'Watching enabled for program'
        : 'Watching disabled for program',
    };
  }

  /**
   * Get all watched programs
   */
  @Get('watched')
  @ApiOperation({ summary: 'Get all programs with watching enabled' })
  async getWatchedPrograms() {
    return this.chaosService.getWatchedPrograms();
  }

  /**
   * Run Chaos sync asynchronously
   */
  private async runChaosSync(jobId: string, config: SyncChaosDto): Promise<void> {
    const job = chaosSyncJobs.get(jobId);
    if (!job) return;

    try {
      // Update status to running
      job.status = 'running';
      chaosSyncJobs.set(jobId, job);

      // Execute Chaos sync
      const result = await this.chaosService.syncProgram(
        config.programName,
        config.existingSubdomains || [],
      );

      // Update job with results
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();
      chaosSyncJobs.set(jobId, job);
    } catch (error) {
      // Update job with error
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();
      chaosSyncJobs.set(jobId, job);
    }
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `chaos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
