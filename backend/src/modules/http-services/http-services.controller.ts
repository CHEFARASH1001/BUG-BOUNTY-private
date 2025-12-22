import { Controller, Get, Param, Query, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { HttpServicesService, HttpServicesFilter } from './http-services.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('HTTP Services')
@Controller('http')
export class HttpServicesController {
  constructor(private httpServicesService: HttpServicesService) {}

  @Get('all')
  @Public()
  @ApiOperation({ summary: 'Get all HTTP services' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'tech', required: false, description: 'Filter by technology' })
  @ApiQuery({ name: 'title', required: false, description: 'Filter by title keyword' })
  @ApiQuery({ name: 'statusCode', required: false, type: Number })
  @ApiQuery({ name: 'provider', required: false })
  @ApiQuery({ name: 'isCdn', required: false, type: Boolean })
  @ApiQuery({ name: 'isFresh', required: false, type: Boolean, description: 'Filter by fresh services' })
  @ApiQuery({ name: 'statusCodeChanged', required: false, type: Boolean, description: 'Filter by status code changed' })
  @ApiQuery({ name: 'titleChanged', required: false, type: Boolean, description: 'Filter by title changed' })
  @ApiQuery({ name: 'techChanged', required: false, type: Boolean, description: 'Filter by technology changed' })
  @ApiQuery({ name: 'headerRegex', required: false, description: 'Regex pattern to match header values' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'compare', required: false, description: 'Return comparison data' })
  @ApiResponse({ status: 200, description: 'List of HTTP services' })
  async findAll(
    @Query('domain') domain?: string,
    @Query('programId') programId?: string,
    @Query('tech') tech?: string,
    @Query('title') title?: string,
    @Query('statusCode') statusCode?: string,
    @Query('provider') provider?: string,
    @Query('isCdn') isCdn?: string,
    @Query('isFresh') isFresh?: string,
    @Query('statusCodeChanged') statusCodeChanged?: string,
    @Query('titleChanged') titleChanged?: string,
    @Query('techChanged') techChanged?: string,
    @Query('headerRegex') headerRegex?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('compare') compare?: string,
  ) {
    const filter: HttpServicesFilter = {
      domain,
      programId,
      tech,
      title,
      statusCode: statusCode ? parseInt(statusCode, 10) : undefined,
      provider,
      isCdn: isCdn !== undefined ? isCdn === 'true' : undefined,
      isFresh: isFresh !== undefined ? isFresh === 'true' : undefined,
      statusCodeChanged: statusCodeChanged !== undefined ? statusCodeChanged === 'true' : undefined,
      titleChanged: titleChanged !== undefined ? titleChanged === 'true' : undefined,
      techChanged: techChanged !== undefined ? techChanged === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };

    if (compare === 'list') {
      return this.httpServicesService.getChanges(filter);
    }

    // If headerRegex is provided, use the specialized method
    if (headerRegex) {
      return this.httpServicesService.findByHeaderRegex(headerRegex, filter);
    }

    return this.httpServicesService.findAll(filter);
  }

  @Get('fresh')
  @Public()
  @ApiOperation({ summary: 'Get fresh (new) HTTP services' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of fresh HTTP services' })
  async findFresh(
    @Query('domain') domain?: string,
    @Query('limit') limit?: string,
  ) {
    return this.httpServicesService.findFresh({
      domain,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('single/:domain')
  @Public()
  @ApiOperation({ summary: 'Get single HTTP service by domain/subdomain' })
  @ApiResponse({ status: 200, description: 'HTTP service details' })
  @ApiResponse({ status: 404, description: 'HTTP service not found' })
  async findOne(@Param('domain') domain: string) {
    return this.httpServicesService.findOne(domain);
  }

  @Get('changes')
  @Public()
  @ApiOperation({ summary: 'Get HTTP services with changes' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'statusCode', required: false, type: Boolean })
  @ApiQuery({ name: 'title', required: false, type: Boolean })
  @ApiQuery({ name: 'tech', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of changed HTTP services' })
  async getChanges(
    @Query('domain') domain?: string,
    @Query('statusCode') statusCode?: string,
    @Query('title') title?: string,
    @Query('tech') tech?: string,
  ) {
    const filter: HttpServicesFilter = {
      domain,
      statusCodeChanged: statusCode === 'true' ? true : undefined,
      titleChanged: title === 'true' ? true : undefined,
      techChanged: tech === 'true' ? true : undefined,
    };

    return this.httpServicesService.getChanges(filter);
  }

  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Get HTTP services statistics' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiResponse({ status: 200, description: 'HTTP services statistics' })
  async getStats(
    @Query('domain') domain?: string,
    @Query('programId') programId?: string,
  ) {
    return this.httpServicesService.getStats({ domain, programId });
  }

  @Get('output')
  @Public()
  @ApiOperation({ summary: 'Get URLs as plain text list' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'fresh', required: false, type: Boolean })
  @ApiQuery({ name: 'tech', required: false })
  @ApiResponse({ status: 200, description: 'Plain text list of URLs' })
  async getOutput(
    @Query('domain') domain?: string,
    @Query('fresh') fresh?: string,
    @Query('tech') tech?: string,
  ) {
    const filter: HttpServicesFilter = {
      domain,
      isFresh: fresh === 'true' ? true : undefined,
      tech,
    };
    
    const urls = await this.httpServicesService.getUrlsForOutput(filter);
    return urls.join('\n');
  }

  @Delete(':url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an HTTP service' })
  @ApiResponse({ status: 200, description: 'HTTP service deleted' })
  async delete(@Param('url') url: string) {
    await this.httpServicesService.delete(decodeURIComponent(url));
    return { message: 'Deleted successfully' };
  }
}

