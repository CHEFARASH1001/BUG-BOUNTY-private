import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class DiscordService {
  private webhookUrl: string;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL') || '';
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

      const embed = {
        title,
        description: message,
        color,
        fields: this.buildFields(data),
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Bug Bounty Automation',
        },
      };

      await axios.post(this.webhookUrl, {
        embeds: [embed],
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      return true;
    } catch (error) {
      console.error('Discord notification error:', error);
      return false;
    }
  }

  async sendVulnerabilityReport(vulnerabilities: any[]): Promise<boolean> {
    if (!this.isConfigured() || vulnerabilities.length === 0) {
      return false;
    }

    const criticalCount = vulnerabilities.filter((v) => v.info?.severity === 'critical').length;
    const highCount = vulnerabilities.filter((v) => v.info?.severity === 'high').length;
    const mediumCount = vulnerabilities.filter((v) => v.info?.severity === 'medium').length;

    const embeds = [
      {
        title: '🔴 Vulnerability Report',
        description: `Found **${vulnerabilities.length}** vulnerabilities`,
        color: criticalCount > 0 ? 0xdc3545 : highCount > 0 ? 0xfd7e14 : 0xffc107,
        fields: [
          { name: 'Critical', value: criticalCount.toString(), inline: true },
          { name: 'High', value: highCount.toString(), inline: true },
          { name: 'Medium', value: mediumCount.toString(), inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ];

    // Add individual vulnerability embeds (max 10)
    for (const vuln of vulnerabilities.slice(0, 9)) {
      embeds.push({
        title: vuln.info?.name || vuln.templateID,
        description: `**Target:** ${vuln.host || vuln.matched}\n**Type:** ${vuln.type || 'Unknown'}`,
        color: this.getSeverityColor(vuln.info?.severity || 'info'),
        fields: [] as any[],
        timestamp: new Date().toISOString(),
      });
    }

    try {
      await axios.post(this.webhookUrl, {
        embeds,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      return true;
    } catch (error) {
      console.error('Discord report error:', error);
      return false;
    }
  }

  private getSeverityColor(severity: string): number {
    const colors: Record<string, number> = {
      critical: 0xdc3545,
      high: 0xfd7e14,
      medium: 0xffc107,
      low: 0x28a745,
      info: 0x17a2b8,
      error: 0xdc3545,
    };
    return colors[severity.toLowerCase()] || colors.info;
  }

  private buildFields(data: any): any[] {
    if (!data) return [];

    const fields: any[] = [];

    if (data.target) {
      fields.push({ name: 'Target', value: data.target, inline: true });
    }
    if (data.severity) {
      fields.push({ name: 'Severity', value: data.severity, inline: true });
    }
    if (data.type) {
      fields.push({ name: 'Type', value: data.type, inline: true });
    }
    if (data.subdomains?.length) {
      fields.push({
        name: 'New Subdomains',
        value: data.subdomains.slice(0, 5).join('\n'),
        inline: false,
      });
    }

    return fields;
  }
}

