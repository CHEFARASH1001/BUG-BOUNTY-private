import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FuzzService, FuzzConfig } from './services/fuzz.service';

class CreateFuzzJobDto {
  url: string;
  wordlist: string;
  extensions?: string[];
  matchCodes?: number[];
  filterWords?: number;
  filterLines?: number;
  filterSize?: number;
  threads?: number;
  timeout?: number;
  programId?: string;
}

@ApiTags('fuzz')
@Controller('fuzz')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FuzzController {
  constructor(private readonly fuzzService: FuzzService) {}

  @Post()
  @ApiOperation({ summary: 'Start a new fuzzing job' })
  @ApiBody({
    description: 'Fuzzing job configuration',
    schema: {
      type: 'object',
      required: ['url', 'wordlist'],
      properties: {
        url: { type: 'string', description: 'Target URL (use FUZZ as placeholder)' },
        wordlist: { type: 'string', description: 'Wordlist filename' },
        extensions: { type: 'array', items: { type: 'string' }, description: 'File extensions to append' },
        matchCodes: { type: 'array', items: { type: 'number' }, description: 'HTTP status codes to match' },
        filterWords: { type: 'number', description: 'Filter responses by word count' },
        filterLines: { type: 'number', description: 'Filter responses by line count' },
        filterSize: { type: 'number', description: 'Filter responses by size' },
        threads: { type: 'number', description: 'Number of concurrent threads' },
        timeout: { type: 'number', description: 'Request timeout in seconds' },
        programId: { type: 'string', description: 'Associated program ID' },
      },
    },
  })
  async startFuzz(@Body() createFuzzJobDto: CreateFuzzJobDto, @Request() req: any) {
    if (!createFuzzJobDto.url || !createFuzzJobDto.wordlist) {
      throw new HttpException('URL and wordlist are required', HttpStatus.BAD_REQUEST);
    }

    const config: FuzzConfig = {
      url: createFuzzJobDto.url,
      wordlist: createFuzzJobDto.wordlist,
      extensions: createFuzzJobDto.extensions,
      matchCodes: createFuzzJobDto.matchCodes,
      filterWords: createFuzzJobDto.filterWords,
      filterLines: createFuzzJobDto.filterLines,
      filterSize: createFuzzJobDto.filterSize,
      threads: createFuzzJobDto.threads,
      timeout: createFuzzJobDto.timeout,
    };

    return this.fuzzService.startFuzz(config, req.user.sub, createFuzzJobDto.programId);
  }

  @Get()
  @ApiOperation({ summary: 'List user fuzzing jobs' })
  async getJobs(@Request() req: any) {
    return this.fuzzService.getJobsByUser(req.user.sub);
  }

  @Get('wordlists')
  @ApiOperation({ summary: 'List available wordlists' })
  async getWordlists() {
    const wordlists = await this.fuzzService.getAvailableWordlists();
    return { wordlists };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get fuzzing job status and results' })
  @ApiParam({ name: 'id', description: 'Fuzzing job ID' })
  async getJob(@Param('id') id: string) {
    const job = await this.fuzzService.getJob(id);
    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return job;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a running fuzzing job' })
  @ApiParam({ name: 'id', description: 'Fuzzing job ID' })
  async cancelJob(@Param('id') id: string) {
    const job = await this.fuzzService.stopFuzz(id);
    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return job;
  }
}
