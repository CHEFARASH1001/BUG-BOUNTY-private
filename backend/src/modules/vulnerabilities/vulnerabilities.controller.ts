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
import { VulnerabilitiesService } from './vulnerabilities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateVulnerabilityDto, UpdateVulnerabilityDto, BulkStatusUpdateDto } from './dto/vulnerability.dto';
import { VulnStatus } from '../../schemas/vulnerability.schema';

@ApiTags('vulnerabilities')
@Controller('vulnerabilities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VulnerabilitiesController {
  constructor(private readonly vulnService: VulnerabilitiesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new vulnerability' })
  create(@Body() createVulnDto: CreateVulnerabilityDto) {
    return this.vulnService.create(createVulnDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all vulnerabilities' })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'targetId', required: false })
  @ApiQuery({ name: 'isNew', required: false, type: Boolean })
  @ApiQuery({ name: 'sourceTool', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('programId') programId?: string,
    @Query('targetId') targetId?: string,
    @Query('isNew') isNew?: boolean,
    @Query('sourceTool') sourceTool?: string,
    @Query('search') search?: string,
  ) {
    return this.vulnService.findAll({
      severity,
      status,
      type,
      programId,
      targetId,
      isNew,
      sourceTool,
      search,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get vulnerability statistics' })
  @ApiQuery({ name: 'programId', required: false })
  getStats(@Query('programId') programId?: string) {
    return this.vulnService.getStats(programId);
  }

  @Get('source-tools')
  @ApiOperation({ summary: 'Get list of unique source tools' })
  getSourceTools() {
    return this.vulnService.getSourceTools();
  }

  @Get('duplicates')
  @ApiOperation({ summary: 'Get potential duplicate vulnerabilities' })
  getDuplicates() {
    return this.vulnService.getDuplicates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vulnerability by ID' })
  findOne(@Param('id') id: string) {
    return this.vulnService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update vulnerability' })
  update(@Param('id') id: string, @Body() updateVulnDto: UpdateVulnerabilityDto) {
    return this.vulnService.update(id, updateVulnDto);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update vulnerability status' })
  updateStatus(@Param('id') id: string, @Body('status') status: VulnStatus) {
    return this.vulnService.updateStatus(id, status);
  }

  @Post('bulk/status')
  @ApiOperation({ summary: 'Bulk update vulnerability status' })
  bulkUpdateStatus(@Body() dto: BulkStatusUpdateDto) {
    return this.vulnService.bulkUpdateStatus(dto.ids, dto.status);
  }

  @Post('mark-viewed')
  @ApiOperation({ summary: 'Mark vulnerabilities as viewed' })
  markAsViewed(@Body('ids') ids: string[]) {
    return this.vulnService.markAsViewed(ids);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete vulnerability' })
  remove(@Param('id') id: string) {
    return this.vulnService.delete(id);
  }
}

