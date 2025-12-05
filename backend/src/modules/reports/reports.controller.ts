import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }

  @Get('json')
  @ApiOperation({ summary: 'Generate JSON report' })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'domainId', required: false })
  @ApiQuery({ name: 'includeVulnerabilities', required: false, type: Boolean })
  @ApiQuery({ name: 'includeSubdomains', required: false, type: Boolean })
  @ApiQuery({ name: 'includeScans', required: false, type: Boolean })
  getJsonReport(
    @Query('programId') programId?: string,
    @Query('domainId') domainId?: string,
    @Query('includeVulnerabilities') includeVulnerabilities?: boolean,
    @Query('includeSubdomains') includeSubdomains?: boolean,
    @Query('includeScans') includeScans?: boolean,
  ) {
    return this.reportsService.generateJsonReport({
      programId,
      domainId,
      includeVulnerabilities,
      includeSubdomains,
      includeScans,
    });
  }

  @Get('csv/vulnerabilities')
  @ApiOperation({ summary: 'Export vulnerabilities as CSV' })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'domainId', required: false })
  async getCsvVulnerabilities(
    @Res() res: Response,
    @Query('programId') programId?: string,
    @Query('domainId') domainId?: string,
  ) {
    const csv = await this.reportsService.generateCsvReport('vulnerabilities', {
      programId,
      domainId,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=vulnerabilities-${Date.now()}.csv`);
    res.send(csv);
  }

  @Get('csv/subdomains')
  @ApiOperation({ summary: 'Export subdomains as CSV' })
  @ApiQuery({ name: 'domainId', required: false })
  async getCsvSubdomains(
    @Res() res: Response,
    @Query('domainId') domainId?: string,
  ) {
    const csv = await this.reportsService.generateCsvReport('subdomains', { domainId });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=subdomains-${Date.now()}.csv`);
    res.send(csv);
  }

  @Get('pdf')
  @ApiOperation({ summary: 'Generate PDF report' })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'domainId', required: false })
  async getPdfReport(
    @Res() res: Response,
    @Query('programId') programId?: string,
    @Query('domainId') domainId?: string,
  ) {
    const pdf = await this.reportsService.generatePdfReport({ programId, domainId });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-${Date.now()}.pdf`);
    res.send(pdf);
  }
}

