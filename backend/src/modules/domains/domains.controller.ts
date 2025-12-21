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
  @ApiOperation({ summary: 'Get all domains' })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('programId') programId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.domainsService.findAll({ programId, status, search });
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

