import { Controller, Get, Param, Query, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { LivesService, LivesFilter } from './lives.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Lives')
@Controller('api/lives')
export class LivesController {
  constructor(private livesService: LivesService) {}

  @Get('all')
  @Public()
  @ApiOperation({ summary: 'Get all live hosts' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'isCdn', required: false, type: Boolean })
  @ApiQuery({ name: 'provider', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'count', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of live hosts' })
  async findAll(
    @Query('domain') domain?: string,
    @Query('programId') programId?: string,
    @Query('isCdn') isCdn?: string,
    @Query('provider') provider?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('count') count?: string,
  ) {
    const filter: LivesFilter = {
      domain,
      programId,
      isCdn: isCdn !== undefined ? isCdn === 'true' : undefined,
      provider,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };

    if (count === 'true') {
      const total = await this.livesService.count(filter);
      return { count: total };
    }

    return this.livesService.findAll(filter);
  }

  @Get('fresh')
  @Public()
  @ApiOperation({ summary: 'Get fresh (new) live hosts' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of fresh live hosts' })
  async findFresh(
    @Query('domain') domain?: string,
    @Query('limit') limit?: string,
  ) {
    return this.livesService.findFresh({
      domain,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('scope/:scope')
  @Public()
  @ApiOperation({ summary: 'Get live hosts by scope' })
  @ApiQuery({ name: 'isCdn', required: false, type: Boolean })
  @ApiQuery({ name: 'count', required: false, type: Boolean })
  @ApiQuery({ name: 'all', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of live hosts in scope' })
  async findByScope(
    @Param('scope') scope: string,
    @Query('isCdn') isCdn?: string,
    @Query('count') count?: string,
    @Query('all') all?: string,
    @Query('limit') limit?: string,
  ) {
    const filter: LivesFilter = {
      scope,
      isCdn: isCdn !== undefined ? isCdn === 'true' : undefined,
      limit: all === 'true' ? undefined : (limit ? parseInt(limit, 10) : 100),
    };

    if (count === 'true') {
      const total = await this.livesService.count(filter);
      return { count: total };
    }

    return this.livesService.findByScope(scope, filter);
  }

  @Get('provider/:provider')
  @Public()
  @ApiOperation({ summary: 'Get live hosts by provider' })
  @ApiResponse({ status: 200, description: 'List of live hosts by provider' })
  async findByProvider(
    @Param('provider') provider: string,
    @Query('limit') limit?: string,
  ) {
    return this.livesService.findByProvider(provider, {
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('subdomain/:subdomain')
  @Public()
  @ApiOperation({ summary: 'Get single live host details' })
  @ApiResponse({ status: 200, description: 'Live host details' })
  @ApiResponse({ status: 404, description: 'Live host not found' })
  async findOne(@Param('subdomain') subdomain: string) {
    return this.livesService.findOne(subdomain);
  }

  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Get live hosts statistics' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiResponse({ status: 200, description: 'Live hosts statistics' })
  async getStats(
    @Query('domain') domain?: string,
    @Query('programId') programId?: string,
  ) {
    return this.livesService.getStats({ domain, programId });
  }

  @Get('output')
  @Public()
  @ApiOperation({ summary: 'Get live subdomains as plain text list' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'scope', required: false })
  @ApiQuery({ name: 'fresh', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Plain text list of subdomains' })
  async getOutput(
    @Query('domain') domain?: string,
    @Query('scope') scope?: string,
    @Query('fresh') fresh?: string,
  ) {
    const filter: LivesFilter = {
      domain,
      scope,
      isFresh: fresh === 'true' ? true : undefined,
    };
    
    const subdomains = await this.livesService.getSubdomainsForOutput(filter);
    return subdomains.join('\n');
  }

  @Delete(':subdomain')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a live host' })
  @ApiResponse({ status: 200, description: 'Live host deleted' })
  async delete(@Param('subdomain') subdomain: string) {
    await this.livesService.delete(subdomain);
    return { message: 'Deleted successfully' };
  }
}

