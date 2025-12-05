import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ScansService } from './scans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateScanDto } from './dto/scan.dto';

@ApiTags('scans')
@Controller('scans')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  @ApiOperation({ summary: 'Create and queue a new scan' })
  create(@Body() createScanDto: CreateScanDto, @Request() req: any) {
    return this.scansService.create(createScanDto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Get all scans' })
  @ApiQuery({ name: 'targetId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('targetId') targetId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ) {
    return this.scansService.findAll({ targetId, type, status, limit });
  }

  @Get('queue/stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  getQueueStats() {
    return this.scansService.getQueueStats();
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent scans' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecentScans(@Query('limit') limit?: number) {
    return this.scansService.getRecentScans(limit);
  }

  @Get('running')
  @ApiOperation({ summary: 'Get currently running scans' })
  getRunningScans() {
    return this.scansService.getRunningScans();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scan by ID' })
  findOne(@Param('id') id: string) {
    return this.scansService.findById(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a scan' })
  cancel(@Param('id') id: string) {
    return this.scansService.cancel(id);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed scan' })
  retry(@Param('id') id: string) {
    return this.scansService.retry(id);
  }
}

