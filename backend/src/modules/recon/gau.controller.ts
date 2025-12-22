import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GAUService, GAUConfig, GAUResult } from './services/gau.service';

class CreateGAUJobDto {
  domain: string;
  providers?: ('wayback' | 'commoncrawl' | 'otx' | 'urlscan')[];
  blacklist?: string[];
  threads?: number;
}

interface GAUJob {
  id: string;
  domain: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: GAUResult;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

// In-memory job storage (in production, this would be in a database)
const gauJobs = new Map<string, GAUJob>();

@ApiTags('gau')
@Controller('gau')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GAUController {
  constructor(private readonly gauService: GAUService) {}

  /**
   * Start GAU enumeration
   * POST /api/v1/gau - Start GAU enumeration
   * Implements Requirement 13.1: Execute gau with all providers enabled
   */
  @Post()
  @ApiOperation({ summary: 'Start GAU URL enumeration for a domain' })
  @ApiBody({
    description: 'GAU enumeration configuration',
    schema: {
      type: 'object',
      required: ['domain'],
      properties: {
        domain: { type: 'string', description: 'Target domain for URL enumeration' },
        providers: {
          type: 'array',
          items: { type: 'string', enum: ['wayback', 'commoncrawl', 'otx', 'urlscan'] },
          description: 'URL sources to query (default: all)',
        },
        blacklist: {
          type: 'array',
          items: { type: 'string' },
          description: 'Extensions to exclude from results',
        },
        threads: { type: 'number', description: 'Number of concurrent threads' },
      },
    },
  })
  async startGAU(@Body() createJobDto: CreateGAUJobDto, @Request() req: any) {
    if (!createJobDto.domain) {
      throw new HttpException('Domain is required', HttpStatus.BAD_REQUEST);
    }

    // Validate domain format
    if (!this.isValidDomain(createJobDto.domain)) {
      throw new HttpException('Invalid domain format', HttpStatus.BAD_REQUEST);
    }

    // Generate job ID
    const jobId = this.generateJobId();

    // Create job record
    const job: GAUJob = {
      id: jobId,
      domain: createJobDto.domain,
      status: 'pending',
      startedAt: new Date(),
    };

    gauJobs.set(jobId, job);

    // Start enumeration asynchronously
    this.runGAUEnumeration(jobId, createJobDto);

    return {
      id: jobId,
      domain: createJobDto.domain,
      status: 'pending',
      message: 'GAU enumeration started',
    };
  }

  /**
   * Get GAU enumeration results
   * GET /api/v1/gau/:id - Get enumeration results
   * Implements Requirement 13.2: Return extracted domains and endpoints
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get GAU enumeration job status and results' })
  @ApiParam({ name: 'id', description: 'GAU job ID' })
  async getJob(@Param('id') id: string) {
    const job = gauJobs.get(id);

    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }

    return job;
  }

  /**
   * Run GAU enumeration asynchronously
   */
  private async runGAUEnumeration(jobId: string, config: CreateGAUJobDto): Promise<void> {
    const job = gauJobs.get(jobId);
    if (!job) return;

    try {
      // Update status to running
      job.status = 'running';
      gauJobs.set(jobId, job);

      // Build GAU config
      const gauConfig: GAUConfig = {
        domain: config.domain,
        providers: config.providers,
        blacklist: config.blacklist,
        threads: config.threads,
      };

      // Execute GAU enumeration
      const result = await this.gauService.fetchUrls(gauConfig);

      // Update job with results
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();
      gauJobs.set(jobId, job);
    } catch (error) {
      // Update job with error
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date();
      gauJobs.set(jobId, job);
    }
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `gau_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Validate domain format
   */
  private isValidDomain(domain: string): boolean {
    if (!domain || domain.length === 0 || domain.length > 253) {
      return false;
    }

    const validPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
    return validPattern.test(domain);
  }
}
