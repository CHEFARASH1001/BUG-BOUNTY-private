import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional, IsNumber, IsObject, ValidateNested, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DNSBruteService, DNSBruteConfig } from './services/dns-brute.service';
import { DNSBruteMode, WordlistConfig } from '../../schemas/dns-brute-job.schema';

class CrunchConfigDto {
  @IsOptional()
  @IsNumber()
  minLength?: number;

  @IsOptional()
  @IsNumber()
  maxLength?: number;

  @IsOptional()
  @IsString()
  charset?: string;
}

class WordlistSourcesDto {
  @IsOptional()
  @IsBoolean()
  bestDns?: boolean;

  @IsOptional()
  @IsBoolean()
  twoMillionSubdomains?: boolean;

  @IsOptional()
  @IsBoolean()
  crunch?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  custom?: string[];
}

class WordlistConfigDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => WordlistSourcesDto)
  sources?: WordlistSourcesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CrunchConfigDto)
  crunchConfig?: CrunchConfigDto;
}

class CreateDNSBruteJobDto {
  @IsString()
  domain: string;

  @IsString()
  @IsIn(['static', 'dynamic'])
  mode: 'static' | 'dynamic';

  @IsOptional()
  @ValidateNested()
  @Type(() => WordlistConfigDto)
  wordlistConfig?: WordlistConfigDto;

  @IsOptional()
  @IsNumber()
  threads?: number;

  @IsOptional()
  @IsString()
  resolvers?: string;

  @IsOptional()
  @IsString()
  programId?: string;
}

@ApiTags('dns-brute')
@Controller('dns-brute')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DNSBruteController {
  constructor(private readonly dnsBruteService: DNSBruteService) {}

  @Post()
  @ApiOperation({ summary: 'Start a new DNS brute forcing job' })
  @ApiBody({
    description: 'DNS brute job configuration',
    schema: {
      type: 'object',
      required: ['domain', 'mode'],
      properties: {
        domain: { type: 'string', description: 'Target domain for DNS brute forcing' },
        mode: { type: 'string', enum: ['static', 'dynamic'], description: 'Brute forcing mode' },
        wordlistConfig: {
          type: 'object',
          description: 'Wordlist configuration for static mode',
          properties: {
            sources: {
              type: 'object',
              properties: {
                bestDns: { type: 'boolean', description: 'Use best-dns-wordlist from Assetnote' },
                twoMillionSubdomains: { type: 'boolean', description: 'Use 2m-subdomains from Assetnote' },
                crunch: { type: 'boolean', description: 'Generate character combinations using crunch' },
                custom: { type: 'array', items: { type: 'string' }, description: 'Custom wordlist paths' },
              },
            },
            crunchConfig: {
              type: 'object',
              properties: {
                minLength: { type: 'number', description: 'Minimum character length' },
                maxLength: { type: 'number', description: 'Maximum character length' },
                charset: { type: 'string', description: 'Character set for generation' },
              },
            },
          },
        },
        threads: { type: 'number', description: 'Number of concurrent threads (default: 200)' },
        resolvers: { type: 'string', description: 'Path to custom resolvers file' },
        programId: { type: 'string', description: 'Associated program ID' },
      },
    },
  })
  async startDNSBrute(@Body() createJobDto: CreateDNSBruteJobDto, @Request() req: any) {
    if (!createJobDto.domain) {
      throw new HttpException('Domain is required', HttpStatus.BAD_REQUEST);
    }

    if (!createJobDto.mode || !['static', 'dynamic'].includes(createJobDto.mode)) {
      throw new HttpException('Mode must be either "static" or "dynamic"', HttpStatus.BAD_REQUEST);
    }

    // Default wordlist config for static mode
    const defaultCrunchConfig = {
      minLength: 1,
      maxLength: 4,
      charset: 'abcdefghijklmnopqrstuvwxyz0123456789',
    };

    const defaultWordlistConfig: WordlistConfig = {
      sources: {
        bestDns: true,
        twoMillionSubdomains: false,
        crunch: true,
      },
      crunchConfig: defaultCrunchConfig,
    };

    // Merge provided wordlistConfig with defaults to ensure all required fields are present
    const wordlistConfig: WordlistConfig = {
      sources: {
        bestDns: createJobDto.wordlistConfig?.sources?.bestDns ?? defaultWordlistConfig.sources.bestDns,
        twoMillionSubdomains: createJobDto.wordlistConfig?.sources?.twoMillionSubdomains ?? defaultWordlistConfig.sources.twoMillionSubdomains,
        crunch: createJobDto.wordlistConfig?.sources?.crunch ?? defaultWordlistConfig.sources.crunch,
        custom: createJobDto.wordlistConfig?.sources?.custom,
      },
      crunchConfig: createJobDto.wordlistConfig?.crunchConfig ? {
        minLength: createJobDto.wordlistConfig.crunchConfig.minLength ?? defaultCrunchConfig.minLength,
        maxLength: createJobDto.wordlistConfig.crunchConfig.maxLength ?? defaultCrunchConfig.maxLength,
        charset: createJobDto.wordlistConfig.crunchConfig.charset ?? defaultCrunchConfig.charset,
      } : defaultCrunchConfig,
    };

    const config: DNSBruteConfig = {
      domain: createJobDto.domain,
      mode: createJobDto.mode,
      wordlistConfig,
      threads: createJobDto.threads || 200,
      resolvers: createJobDto.resolvers,
    };

    return this.dnsBruteService.startJob(config, req.user.sub, createJobDto.programId);
  }

  @Get('history')
  @ApiOperation({ summary: 'List past DNS brute jobs for the current user' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of jobs to return' })
  async getHistory(@Request() req: any, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.dnsBruteService.getJobHistory(req.user.sub, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get DNS brute job status and results' })
  @ApiParam({ name: 'id', description: 'DNS brute job ID' })
  async getJob(@Param('id') id: string) {
    const job = await this.dnsBruteService.getJobStatus(id);
    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return job;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a running DNS brute job' })
  @ApiParam({ name: 'id', description: 'DNS brute job ID' })
  async cancelJob(@Param('id') id: string) {
    const job = await this.dnsBruteService.cancelJob(id);
    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return job;
  }
}
