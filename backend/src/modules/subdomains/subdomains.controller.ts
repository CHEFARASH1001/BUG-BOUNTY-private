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
  @ApiOperation({ summary: 'Get all subdomains' })
  @ApiQuery({ name: 'domainId', required: false })
  @ApiQuery({ name: 'isAlive', required: false, type: Boolean })
  @ApiQuery({ name: 'hasVulnerabilities', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('domainId') domainId?: string,
    @Query('isAlive') isAlive?: boolean,
    @Query('hasVulnerabilities') hasVulnerabilities?: boolean,
    @Query('search') search?: string,
  ) {
    return this.subdomainsService.findAll({
      domainId,
      isAlive,
      hasVulnerabilities,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subdomain by ID' })
  findOne(@Param('id') id: string) {
    return this.subdomainsService.findById(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get subdomain statistics' })
  getStats(@Param('id') id: string) {
    return this.subdomainsService.getStats(id);
  }

  @Get(':id/endpoints')
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

