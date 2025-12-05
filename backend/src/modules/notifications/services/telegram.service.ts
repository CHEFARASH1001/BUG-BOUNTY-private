import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private botToken: string;
  private chatId: string;
  private apiUrl: string;

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID') || '';
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  isConfigured(): boolean {
    return !!(this.botToken && this.chatId);
  }

  async send(title: string, message: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const text = `*${this.escapeMarkdown(title)}*\n\n${this.escapeMarkdown(message)}`;

      await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: this.chatId,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }, {
        timeout: 10000,
      });

      return true;
    } catch (error) {
      console.error('Telegram notification error:', error);
      return false;
    }
  }

  async sendVulnerabilityAlert(vulnerabilities: any[], target: string): Promise<boolean> {
    if (!this.isConfigured() || vulnerabilities.length === 0) {
      return false;
    }

    const criticalCount = vulnerabilities.filter((v) => v.info?.severity === 'critical').length;
    const highCount = vulnerabilities.filter((v) => v.info?.severity === 'high').length;

    const emoji = criticalCount > 0 ? '🔴' : highCount > 0 ? '🟠' : '🟡';

    let text = `${emoji} *Vulnerability Alert*\n\n`;
    text += `Target: \`${this.escapeMarkdown(target)}\`\n`;
    text += `Found: ${vulnerabilities.length} vulnerabilities\n\n`;
    text += `🔴 Critical: ${criticalCount}\n`;
    text += `🟠 High: ${highCount}\n\n`;

    // Add top vulnerabilities
    text += '*Top Findings:*\n';
    for (const vuln of vulnerabilities.slice(0, 5)) {
      text += `\\- ${this.escapeMarkdown(vuln.info?.name || vuln.templateID)}\n`;
    }

    return this.send('', text);
  }

  async sendScanComplete(target: string, results: any): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    let text = `✅ *Scan Complete*\n\n`;
    text += `Target: \`${this.escapeMarkdown(target)}\`\n\n`;
    text += `📊 *Results:*\n`;
    text += `\\- Subdomains: ${results.subdomainsFound || 0}\n`;
    text += `\\- Alive Hosts: ${results.aliveHosts || 0}\n`;
    text += `\\- Vulnerabilities: ${results.vulnerabilitiesFound || 0}\n`;

    return this.send('', text);
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }
}

