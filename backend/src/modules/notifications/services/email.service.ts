import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.fromAddress = this.configService.get<string>('SMTP_FROM') || 'bugbounty@localhost';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: port || 587,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  isConfigured(): boolean {
    return !!this.transporter;
  }

  async send(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      await this.transporter!.sendMail({
        from: this.fromAddress,
        to,
        subject: `[Bug Bounty] ${subject}`,
        text,
        html: html || this.textToHtml(text),
      });
      return true;
    } catch (error) {
      console.error('Email notification error:', error);
      return false;
    }
  }

  async sendVulnerabilityReport(
    to: string,
    vulnerabilities: any[],
    target: string,
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    const criticalCount = vulnerabilities.filter((v) => v.info?.severity === 'critical').length;
    const highCount = vulnerabilities.filter((v) => v.info?.severity === 'high').length;
    const mediumCount = vulnerabilities.filter((v) => v.info?.severity === 'medium').length;

    const subject = `Vulnerability Report - ${target}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #1a1a2e; color: white; padding: 20px; }
          .content { padding: 20px; }
          .stats { display: flex; gap: 20px; margin: 20px 0; }
          .stat { padding: 15px; border-radius: 8px; text-align: center; }
          .critical { background: #dc3545; color: white; }
          .high { background: #fd7e14; color: white; }
          .medium { background: #ffc107; }
          .vuln-list { list-style: none; padding: 0; }
          .vuln-item { padding: 15px; border: 1px solid #ddd; margin: 10px 0; border-radius: 8px; }
          .severity-badge { padding: 3px 8px; border-radius: 4px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔒 Bug Bounty Vulnerability Report</h1>
          <p>Target: ${target}</p>
        </div>
        <div class="content">
          <h2>Summary</h2>
          <p>Found <strong>${vulnerabilities.length}</strong> vulnerabilities:</p>
          <div class="stats">
            <div class="stat critical">
              <h3>${criticalCount}</h3>
              <p>Critical</p>
            </div>
            <div class="stat high">
              <h3>${highCount}</h3>
              <p>High</p>
            </div>
            <div class="stat medium">
              <h3>${mediumCount}</h3>
              <p>Medium</p>
            </div>
          </div>
          
          <h2>Vulnerabilities</h2>
          <ul class="vuln-list">
            ${vulnerabilities.slice(0, 20).map((v) => `
              <li class="vuln-item">
                <strong>${v.info?.name || v.templateID}</strong>
                <span class="severity-badge ${v.info?.severity}">${v.info?.severity || 'unknown'}</span>
                <p>Target: ${v.host || v.matched}</p>
                <p>Type: ${v.type || 'Unknown'}</p>
              </li>
            `).join('')}
          </ul>
          
          <p style="color: #666; font-size: 12px;">
            This is an automated report from Bug Bounty Automation Platform.
          </p>
        </div>
      </body>
      </html>
    `;

    return this.send(to, subject, `Found ${vulnerabilities.length} vulnerabilities on ${target}`, html);
  }

  private textToHtml(text: string): string {
    return `<pre style="font-family: monospace; white-space: pre-wrap;">${text}</pre>`;
  }
}

