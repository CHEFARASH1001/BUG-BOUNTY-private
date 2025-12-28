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
import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, IsMongoId } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { XssService, XssScanConfig } from './services/xss.service';

class CreateXssScanDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tools?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customPayloads?: string[];

  @IsOptional()
  @IsBoolean()
  crawl?: boolean;

  @IsOptional()
  @IsNumber()
  depth?: number;

  @IsOptional()
  @IsNumber()
  threads?: number;

  @IsOptional()
  @IsNumber()
  timeout?: number;

  @IsOptional()
  @IsBoolean()
  wafBypass?: boolean;

  @IsOptional()
  @IsString()
  blindXss?: string;

  @IsOptional()
  headers?: Record<string, string>;

  @IsOptional()
  @IsString()
  cookies?: string;

  @IsOptional()
  @IsMongoId()
  programId?: string;
}

@ApiTags('xss')
@Controller('xss')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class XssController {
  constructor(private readonly xssService: XssService) {}

  @Post()
  @ApiOperation({ summary: 'Start a new XSS scan' })
  @ApiBody({
    description: 'XSS scan configuration',
    schema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', description: 'Target URL to scan' },
        tools: { 
          type: 'array', 
          items: { type: 'string' }, 
          description: 'Tools to use: builtin, dalfox, kxss, xsstrike' 
        },
        customPayloads: { 
          type: 'array', 
          items: { type: 'string' }, 
          description: 'Custom XSS payloads to test' 
        },
        crawl: { type: 'boolean', description: 'Enable crawling' },
        depth: { type: 'number', description: 'Crawl depth' },
        threads: { type: 'number', description: 'Number of concurrent threads' },
        timeout: { type: 'number', description: 'Request timeout in seconds' },
        wafBypass: { type: 'boolean', description: 'Enable WAF bypass payloads' },
        blindXss: { type: 'string', description: 'Blind XSS callback URL' },
        headers: { type: 'object', description: 'Custom HTTP headers' },
        cookies: { type: 'string', description: 'Cookies to include' },
        programId: { type: 'string', description: 'Associated program ID' },
      },
    },
  })
  async startScan(@Body() dto: CreateXssScanDto, @Request() req: any) {
    if (!dto.url) {
      throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
    }

    try {
      new URL(dto.url);
    } catch {
      throw new HttpException('Invalid URL format', HttpStatus.BAD_REQUEST);
    }

    const config: XssScanConfig = {
      url: dto.url,
      tools: dto.tools,
      customPayloads: dto.customPayloads,
      crawl: dto.crawl,
      depth: dto.depth,
      threads: dto.threads,
      timeout: dto.timeout,
      wafBypass: dto.wafBypass,
      blindXss: dto.blindXss,
      headers: dto.headers,
      cookies: dto.cookies,
    };

    return this.xssService.startScan(config, req.user.sub, dto.programId);
  }

  @Get()
  @ApiOperation({ summary: 'List user XSS scans' })
  async getScans(@Request() req: any) {
    return this.xssService.getScansByUser(req.user.sub);
  }

  @Get('tools')
  @ApiOperation({ summary: 'List available XSS scanning tools' })
  async getTools() {
    return this.xssService.getAvailableTools();
  }

  @Get('payloads')
  @ApiOperation({ summary: 'Get XSS payload list' })
  @ApiQuery({ name: 'type', required: false, enum: ['basic', 'waf-bypass', 'all'] })
  async getPayloads(@Query('type') type?: 'basic' | 'waf-bypass' | 'all') {
    return { payloads: this.xssService.getPayloads(type || 'all') };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get XSS scan status and results' })
  @ApiParam({ name: 'id', description: 'Scan ID' })
  async getScan(@Param('id') id: string) {
    const scan = await this.xssService.getScan(id);
    if (!scan) {
      throw new HttpException('Scan not found', HttpStatus.NOT_FOUND);
    }
    return scan;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a running XSS scan' })
  @ApiParam({ name: 'id', description: 'Scan ID' })
  async cancelScan(@Param('id') id: string) {
    const scan = await this.xssService.cancelScan(id);
    if (!scan) {
      throw new HttpException('Scan not found', HttpStatus.NOT_FOUND);
    }
    return scan;
  }
}
