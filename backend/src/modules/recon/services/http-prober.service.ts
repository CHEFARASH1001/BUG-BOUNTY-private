import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export interface HttpProbeResult {
  subdomain: string;
  url: string;
  statusCode: number;
  title: string;
  contentLength: number;
  contentType: string;
  webServer: string;
  technologies: string[];
  redirectUrl?: string;
  responseTime: number;
  tls?: {
    cipher: string;
    version: string;
  };
}

@Injectable()
export class HttpProber {
  private resultsDir = '/app/results';

  /**
   * Probe HTTP services on given hosts
   */
  async probe(hosts: string[]): Promise<HttpProbeResult[]> {
    if (hosts.length === 0) {
      return [];
    }

    try {
      // Use httpx for efficient HTTP probing
      const inputFile = path.join(this.resultsDir, `probe-input-${uuidv4()}.txt`);
      const outputFile = path.join(this.resultsDir, `probe-output-${uuidv4()}.json`);

      // Write hosts to file
      await fs.writeFile(inputFile, hosts.join('\n'));

      // Run httpx
      await execAsync(
        `docker exec bb-httpx httpx -l /results/${path.basename(inputFile)} ` +
        `-json -o /results/${path.basename(outputFile)} ` +
        `-status-code -title -content-length -content-type -web-server ` +
        `-tech-detect -follow-redirects -timeout 10 -silent`,
        { timeout: 600000 }, // 10 minute timeout
      );

      // Parse results
      const content = await fs.readFile(outputFile, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      const results: HttpProbeResult[] = [];

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          results.push({
            subdomain: this.extractHostname(data.url || data.input),
            url: data.url || data.input,
            statusCode: data['status-code'] || data.status_code || 0,
            title: data.title || '',
            contentLength: data['content-length'] || data.content_length || 0,
            contentType: data['content-type'] || data.content_type || '',
            webServer: data['web-server'] || data.webserver || '',
            technologies: data.tech || data.technologies || [],
            redirectUrl: data.location,
            responseTime: data['response-time'] || 0,
            tls: data.tls,
          });
        } catch {
          continue;
        }
      }

      // Cleanup
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});

      return results;
    } catch (error) {
      console.error('HTTPx error:', error);

      // Fallback to Node.js-based probing
      return this.probeWithNode(hosts);
    }
  }

  /**
   * Probe a single URL
   */
  async probeSingle(url: string): Promise<HttpProbeResult | null> {
    const results = await this.probeWithNode([url]);
    return results[0] || null;
  }

  /**
   * Fallback Node.js-based HTTP prober
   */
  private async probeWithNode(hosts: string[]): Promise<HttpProbeResult[]> {
    const results: HttpProbeResult[] = [];

    const probePromises = hosts.map(async (host) => {
      // Try HTTPS first, then HTTP
      for (const protocol of ['https', 'http']) {
        const url = host.startsWith('http') ? host : `${protocol}://${host}`;

        try {
          const startTime = Date.now();
          const response = await axios.get(url, {
            timeout: 10000,
            maxRedirects: 5,
            validateStatus: () => true,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          const responseTime = Date.now() - startTime;

          const title = this.extractTitle(response.data);
          const contentLength = parseInt(response.headers['content-length'] || '0', 10) ||
            (typeof response.data === 'string' ? response.data.length : 0);

          results.push({
            subdomain: this.extractHostname(url),
            url: response.request?.res?.responseUrl || url,
            statusCode: response.status,
            title,
            contentLength,
            contentType: response.headers['content-type'] || '',
            webServer: response.headers['server'] || '',
            technologies: this.detectBasicTechnologies(response),
            responseTime,
          });

          return; // Success, don't try the other protocol
        } catch {
          continue;
        }
      }
    });

    await Promise.all(probePromises);
    return results;
  }

  /**
   * Extract title from HTML
   */
  private extractTitle(html: string): string {
    if (typeof html !== 'string') {
      return '';
    }

    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : '';
  }

  /**
   * Extract hostname from URL
   */
  private extractHostname(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0];
    }
  }

  /**
   * Basic technology detection from response
   */
  private detectBasicTechnologies(response: any): string[] {
    const technologies: string[] = [];
    const headers = response.headers || {};
    const html = typeof response.data === 'string' ? response.data : '';

    // Server header
    if (headers.server) {
      technologies.push(headers.server.split('/')[0]);
    }

    // X-Powered-By
    if (headers['x-powered-by']) {
      technologies.push(headers['x-powered-by']);
    }

    // Framework detection from HTML
    const frameworks: Record<string, RegExp> = {
      'React': /react|__NEXT_DATA__|_next/i,
      'Vue.js': /vue\.js|v-cloak|__vue/i,
      'Angular': /ng-app|angular\.js|ng-version/i,
      'jQuery': /jquery/i,
      'Bootstrap': /bootstrap\.css|bootstrap\.min/i,
      'WordPress': /wp-content|wp-includes/i,
      'Drupal': /drupal\.js|Drupal\./i,
      'Joomla': /joomla/i,
      'Laravel': /laravel/i,
      'Express': /express/i,
    };

    for (const [name, pattern] of Object.entries(frameworks)) {
      if (pattern.test(html)) {
        technologies.push(name);
      }
    }

    return [...new Set(technologies)];
  }
}

