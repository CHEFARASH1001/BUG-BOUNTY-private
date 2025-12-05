import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SlackService {
  private webhookUrl: string;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL') || '';
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  async send(title: string, message: string, data?: any): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const severity = data?.severity || 'info';
      const color = this.getSeverityColor(severity);

      const payload = {
        attachments: [
          {
            color,
            title,
            text: message,
            fields: this.buildFields(data),
            footer: 'Bug Bounty Automation',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      await axios.post(this.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      return true;
    } catch (error) {
      console.error('Slack notification error:', error);
      return false;
    }
  }

  async sendVulnerabilityReport(vulnerabilities: any[]): Promise<boolean> {
    if (!this.isConfigured() || vulnerabilities.length === 0) {
      return false;
    }

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔴 Vulnerability Report',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Found *${vulnerabilities.length}* vulnerabilities`,
        },
      },
      { type: 'divider' },
    ];

    // Add top vulnerabilities
    for (const vuln of vulnerabilities.slice(0, 5)) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${vuln.info?.name || vuln.templateID}*\n` +
            `Severity: ${vuln.info?.severity || 'unknown'}\n` +
            `Target: ${vuln.host || vuln.matched}`,
        },
      } as any);
    }

    try {
      await axios.post(this.webhookUrl, { blocks }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      return true;
    } catch (error) {
      console.error('Slack report error:', error);
      return false;
    }
  }

  private getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745',
      info: '#17a2b8',
      error: '#dc3545',
    };
    return colors[severity.toLowerCase()] || colors.info;
  }

  private buildFields(data: any): any[] {
    if (!data) return [];

    const fields: any[] = [];

    if (data.target) {
      fields.push({ title: 'Target', value: data.target, short: true });
    }
    if (data.severity) {
      fields.push({ title: 'Severity', value: data.severity, short: true });
    }
    if (data.type) {
      fields.push({ title: 'Type', value: data.type, short: true });
    }
    if (data.scanId) {
      fields.push({ title: 'Scan ID', value: data.scanId, short: true });
    }

    return fields;
  }
}

