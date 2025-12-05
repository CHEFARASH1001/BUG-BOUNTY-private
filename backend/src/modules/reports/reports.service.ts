import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as PDFDocument from 'pdfkit';
import { Vulnerability, VulnerabilityDocument } from '../../schemas/vulnerability.schema';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { Subdomain, SubdomainDocument } from '../../schemas/subdomain.schema';
import { Program, ProgramDocument } from '../../schemas/program.schema';
import { Scan, ScanDocument } from '../../schemas/scan.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Vulnerability.name) private vulnModel: Model<VulnerabilityDocument>,
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    @InjectModel(Subdomain.name) private subdomainModel: Model<SubdomainDocument>,
    @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
    @InjectModel(Scan.name) private scanModel: Model<ScanDocument>,
  ) {}

  /**
   * Generate JSON report
   */
  async generateJsonReport(options: {
    programId?: string;
    domainId?: string;
    includeVulnerabilities?: boolean;
    includeSubdomains?: boolean;
    includeScans?: boolean;
  }): Promise<any> {
    const report: any = {
      generatedAt: new Date().toISOString(),
      filters: options,
    };

    const match: any = {};
    if (options.programId) {
      match.programId = new Types.ObjectId(options.programId);
      const program = await this.programModel.findById(options.programId);
      report.program = program;
    }
    if (options.domainId) {
      match.domainId = new Types.ObjectId(options.domainId);
      const domain = await this.domainModel.findById(options.domainId);
      report.domain = domain;
    }

    if (options.includeVulnerabilities !== false) {
      const vulnMatch: any = {};
      if (options.programId) vulnMatch.programId = match.programId;
      if (options.domainId) vulnMatch.targetId = match.domainId;

      report.vulnerabilities = await this.vulnModel.find(vulnMatch).sort({ severity: 1 }).exec();
      report.vulnerabilitySummary = await this.getVulnerabilitySummary(vulnMatch);
    }

    if (options.includeSubdomains !== false) {
      const subMatch: any = {};
      if (options.domainId) subMatch.domainId = match.domainId;

      report.subdomains = await this.subdomainModel.find(subMatch).sort({ subdomain: 1 }).exec();
      report.subdomainSummary = {
        total: report.subdomains.length,
        alive: report.subdomains.filter((s: any) => s.isAlive).length,
      };
    }

    if (options.includeScans !== false) {
      const scanMatch: any = {};
      if (options.domainId) scanMatch.targetId = match.domainId;

      report.scans = await this.scanModel.find(scanMatch).sort({ createdAt: -1 }).limit(50).exec();
    }

    return report;
  }

  /**
   * Generate CSV report
   */
  async generateCsvReport(type: 'vulnerabilities' | 'subdomains' | 'endpoints', filters?: {
    programId?: string;
    domainId?: string;
  }): Promise<string> {
    const match: any = {};
    if (filters?.programId) match.programId = new Types.ObjectId(filters.programId);
    if (filters?.domainId) match.domainId = new Types.ObjectId(filters.domainId);

    if (type === 'vulnerabilities') {
      const vulns = await this.vulnModel.find(match).sort({ severity: 1 }).exec();
      return this.vulnerabilitiesToCsv(vulns);
    }

    if (type === 'subdomains') {
      const subs = await this.subdomainModel.find(match).sort({ subdomain: 1 }).exec();
      return this.subdomainsToCsv(subs);
    }

    return '';
  }

  /**
   * Generate PDF report
   */
  async generatePdfReport(options: {
    programId?: string;
    domainId?: string;
  }): Promise<Buffer> {
    const data = await this.generateJsonReport({
      ...options,
      includeVulnerabilities: true,
      includeSubdomains: true,
    });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(24).text('Bug Bounty Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(18).text('Executive Summary');
      doc.moveDown();

      if (data.vulnerabilitySummary) {
        doc.fontSize(12);
        doc.text(`Total Vulnerabilities: ${data.vulnerabilitySummary.total}`);
        doc.text(`Critical: ${data.vulnerabilitySummary.critical || 0}`);
        doc.text(`High: ${data.vulnerabilitySummary.high || 0}`);
        doc.text(`Medium: ${data.vulnerabilitySummary.medium || 0}`);
        doc.text(`Low: ${data.vulnerabilitySummary.low || 0}`);
        doc.moveDown();
      }

      if (data.subdomainSummary) {
        doc.text(`Total Subdomains: ${data.subdomainSummary.total}`);
        doc.text(`Alive: ${data.subdomainSummary.alive}`);
        doc.moveDown(2);
      }

      // Vulnerabilities
      if (data.vulnerabilities?.length > 0) {
        doc.addPage();
        doc.fontSize(18).text('Vulnerabilities');
        doc.moveDown();

        for (const vuln of data.vulnerabilities.slice(0, 50)) {
          doc.fontSize(14).fillColor(this.getSeverityColor(vuln.severity)).text(vuln.title);
          doc.fillColor('black').fontSize(10);
          doc.text(`Severity: ${vuln.severity}`);
          doc.text(`Target: ${vuln.target}`);
          doc.text(`Type: ${vuln.type || 'Unknown'}`);
          if (vuln.description) {
            doc.text(`Description: ${vuln.description.substring(0, 200)}`);
          }
          doc.moveDown();
        }
      }

      // Subdomains
      if (data.subdomains?.length > 0) {
        doc.addPage();
        doc.fontSize(18).fillColor('black').text('Subdomains');
        doc.moveDown();
        doc.fontSize(10);

        for (const sub of data.subdomains.slice(0, 100)) {
          doc.text(`${sub.subdomain} - ${sub.isAlive ? 'Alive' : 'Dead'} ${sub.httpStatus ? `(${sub.httpStatus})` : ''}`);
        }
      }

      doc.end();
    });
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<any> {
    const [
      programCount,
      domainCount,
      subdomainCount,
      vulnerabilityStats,
      recentScans,
      topVulnerableTargets,
    ] = await Promise.all([
      this.programModel.countDocuments({ status: 'active' }),
      this.domainModel.countDocuments(),
      this.subdomainModel.countDocuments(),
      this.getVulnerabilitySummary({}),
      this.scanModel.find().sort({ createdAt: -1 }).limit(10).exec(),
      this.vulnModel.aggregate([
        { $group: { _id: '$target', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    return {
      programs: programCount,
      domains: domainCount,
      subdomains: subdomainCount,
      vulnerabilities: vulnerabilityStats,
      recentScans,
      topVulnerableTargets,
    };
  }

  private async getVulnerabilitySummary(match: any): Promise<any> {
    const stats = await this.vulnModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 },
        },
      },
    ]);

    const result: any = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const stat of stats) {
      result[stat._id] = stat.count;
      result.total += stat.count;
    }
    return result;
  }

  private vulnerabilitiesToCsv(vulns: VulnerabilityDocument[]): string {
    const headers = ['Title', 'Severity', 'Type', 'Target', 'Status', 'CVSS', 'CWE', 'Created'];
    const rows = vulns.map((v) => [
      `"${v.title?.replace(/"/g, '""') || ''}"`,
      v.severity,
      v.type || '',
      `"${v.target?.replace(/"/g, '""') || ''}"`,
      v.status,
      v.cvss?.toString() || '',
      v.cwe || '',
      (v as any).createdAt?.toISOString() || '',
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  private subdomainsToCsv(subs: SubdomainDocument[]): string {
    const headers = ['Subdomain', 'IP', 'Alive', 'HTTP Status', 'Title', 'Technologies', 'First Seen'];
    const rows = subs.map((s) => [
      s.subdomain,
      `"${s.ip?.join(', ') || ''}"`,
      s.isAlive ? 'Yes' : 'No',
      s.httpStatus?.toString() || '',
      `"${s.title?.replace(/"/g, '""') || ''}"`,
      `"${s.technologies?.join(', ') || ''}"`,
      s.firstSeen?.toISOString() || '',
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  private getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745',
      info: '#17a2b8',
    };
    return colors[severity] || '#000000';
  }
}

