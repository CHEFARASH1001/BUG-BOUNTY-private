import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SubdomainsService } from './subdomains.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CreateSubdomainDto, UpdateSubdomainDto } from './dto/subdomain.dto';

@ApiTags('subdomains')
@Controller('subdomains')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubdomainsController {
  constructor(private readonly subdomainsService: SubdomainsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new subdomain' })
  create(@Body() createSubdomainDto: CreateSubdomainDto) {
    return this.subdomainsService.create(createSubdomainDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all subdomains with pagination' })
  @ApiQuery({ name: 'domainId', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'isAlive', required: false, type: Boolean })
  @ApiQuery({ name: 'hasVulnerabilities', required: false, type: Boolean })
  @ApiQuery({ name: 'httpStatus', required: false })
  @ApiQuery({ name: 'hasCdn', required: false, type: Boolean })
  @ApiQuery({ name: 'cdn', required: false })
  @ApiQuery({ name: 'technology', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'isNew', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  findAll(
    @Query('domainId') domainId?: string,
    @Query('programId') programId?: string,
    @Query('isAlive') isAlive?: string,
    @Query('hasVulnerabilities') hasVulnerabilities?: string,
    @Query('httpStatus') httpStatus?: string,
    @Query('hasCdn') hasCdn?: string,
    @Query('cdn') cdn?: string,
    @Query('technology') technology?: string,
    @Query('source') source?: string,
    @Query('isNew') isNew?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.subdomainsService.findAll({
      domainId,
      programId,
      isAlive: isAlive === undefined ? undefined : isAlive === 'true',
      hasVulnerabilities: hasVulnerabilities === 'true',
      httpStatus,
      hasCdn: hasCdn === undefined ? undefined : hasCdn === 'true',
      cdn,
      technology,
      source,
      isNew: isNew === undefined ? undefined : isNew === 'true',
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get('stats/overview')
  @Public()
  @ApiOperation({ summary: 'Get subdomain statistics overview' })
  async getOverviewStats() {
    return this.subdomainsService.getOverviewStats();
  }

  @Get('filters/options')
  @Public()
  @ApiOperation({ summary: 'Get available filter options' })
  async getFilterOptions() {
    return this.subdomainsService.getFilterOptions();
  }

  @Get('technologies')
  @Public()
  @ApiOperation({ summary: 'Get all detected technologies with counts' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTechnologies(
    @Query('domain') domain?: string,
    @Query('programId') programId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.subdomainsService.getTechnologies({
      domain,
      programId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get subdomain by ID' })
  findOne(@Param('id') id: string) {
    return this.subdomainsService.findById(id);
  }

  @Get(':id/stats')
  @Public()
  @ApiOperation({ summary: 'Get subdomain statistics' })
  getStats(@Param('id') id: string) {
    return this.subdomainsService.getStats(id);
  }

  @Get(':id/endpoints')
  @Public()
  @ApiOperation({ summary: 'Get endpoints for a subdomain' })
  getEndpoints(@Param('id') id: string) {
    return this.subdomainsService.getEndpoints(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update subdomain' })
  update(@Param('id') id: string, @Body() updateSubdomainDto: UpdateSubdomainDto) {
    return this.subdomainsService.update(id, updateSubdomainDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subdomain' })
  remove(@Param('id') id: string) {
    return this.subdomainsService.delete(id);
  }
}

