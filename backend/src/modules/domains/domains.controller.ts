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
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DomainsService } from './domains.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CreateDomainDto, UpdateDomainDto } from './dto/domain.dto';

@ApiTags('domains')
@Controller('domains')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new domain to scan' })
  create(@Body() createDomainDto: CreateDomainDto) {
    return this.domainsService.create(createDomainDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all domains with pagination' })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field (default: createdAt)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order (default: desc)' })
  @ApiQuery({ name: 'hasSubdomains', required: false, type: Boolean, description: 'Filter domains with subdomains' })
  findAll(
    @Query('programId') programId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('hasSubdomains') hasSubdomains?: string,
  ) {
    return this.domainsService.findAll({
      programId,
      status,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
      hasSubdomains: hasSubdomains === 'true',
    });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get domain by ID' })
  findOne(@Param('id') id: string) {
    return this.domainsService.findById(id);
  }

  @Get(':id/stats')
  @Public()
  @ApiOperation({ summary: 'Get domain statistics' })
  getStats(@Param('id') id: string) {
    return this.domainsService.getStats(id);
  }

  @Get(':id/subdomains')
  @Public()
  @ApiOperation({ summary: 'Get subdomains for a domain' })
  getSubdomains(@Param('id') id: string) {
    return this.domainsService.getSubdomains(id);
  }

  @Post(':id/scan')
  @ApiOperation({ summary: 'Start a full scan on the domain' })
  startScan(@Param('id') id: string, @Request() req: any) {
    return this.domainsService.startFullScan(id, req.user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update domain' })
  update(@Param('id') id: string, @Body() updateDomainDto: UpdateDomainDto) {
    return this.domainsService.update(id, updateDomainDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete domain' })
  remove(@Param('id') id: string) {
    return this.domainsService.delete(id);
  }
}

