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
  // Enhanced fields for monitoring
  faviconHash?: string;
  faviconUrl?: string;
  headers?: Record<string, string>;
  redirectChain?: string[];
  finalUrl?: string;
  bodyHash?: string;
}

export interface HttpProbeOptions {
  favicon?: boolean;
  headers?: boolean;
  techDetect?: boolean;
  followRedirects?: boolean;
  includeChain?: boolean;
  timeout?: number;
  retries?: number;
}

export const DEFAULT_PROBE_OPTIONS: HttpProbeOptions = {
  favicon: true,
  headers: true,
  techDetect: true,
  followRedirects: true,
  includeChain: true,
  timeout: 5,
  retries: 3,
};

@Injectable()
export class HttpProber {
  private resultsDir = '/app/results';

  /**
   * Build httpx command with specified options
   * @param inputPath Path to input file
   * @param outputPath Path to output file
   * @param options Probe options
   * @returns Command string
   */
  buildHttpxCommand(inputPath: string, outputPath: string, options: HttpProbeOptions = {}): string {
    const opts = { ...DEFAULT_PROBE_OPTIONS, ...options };
    
    const args: string[] = [
      'docker exec bb-httpx httpx',
      `-l /results/${path.basename(inputPath)}`,
      `-json`,
      `-o /results/${path.basename(outputPath)}`,
      `-status-code`,
      `-title`,
      `-content-length`,
      `-content-type`,
      `-web-server`,
      `-silent`,
    ];

    // Add enhanced options
    if (opts.favicon) {
      args.push('-favicon');
    }

    if (opts.headers) {
      args.push('-include-response-header');
    }

    if (opts.techDetect) {
      args.push('-tech-detect');
    }

    if (opts.followRedirects) {
      args.push('-follow-redirects');
    }

    if (opts.includeChain) {
      args.push('-include-chain');
    }

    // Timeout in seconds (default 5)
    args.push(`-timeout ${opts.timeout || 5}`);

    // Retries (default 3)
    args.push(`-retries ${opts.retries || 3}`);

    return args.join(' ');
  }

  /**
   * Parse httpx JSON output line into HttpProbeResult
   * @param jsonLine JSON string from httpx output
   * @returns Parsed HttpProbeResult
   */
  parseHttpxJsonLine(jsonLine: string): HttpProbeResult | null {
    try {
      const data = JSON.parse(jsonLine);
      return this.parseHttpxData(data);
    } catch {
      return null;
    }
  }

  /**
   * Parse httpx data object into HttpProbeResult
   * @param data Parsed JSON object from httpx
   * @returns HttpProbeResult
   */
  parseHttpxData(data: any): HttpProbeResult {
    // Parse headers from response
    const headers: Record<string, string> = {};
    if (data.header) {
      // httpx returns headers as an object
      Object.assign(headers, data.header);
    } else if (data.headers) {
      Object.assign(headers, data.headers);
    }

    // Parse redirect chain
    const redirectChain: string[] = [];
    if (data.chain) {
      if (Array.isArray(data.chain)) {
        redirectChain.push(...data.chain.map((c: any) => c.url || c));
      }
    } else if (data['chain-status-codes']) {
      // Alternative format
      redirectChain.push(...(data['chain'] || []));
    }

    return {
      subdomain: this.extractHostname(data.url || data.input),
      url: data.url || data.input,
      statusCode: data['status-code'] || data.status_code || data['status_code'] || 0,
      title: data.title || '',
      contentLength: data['content-length'] || data.content_length || data['content_length'] || 0,
      contentType: data['content-type'] || data.content_type || data['content_type'] || '',
      webServer: data['web-server'] || data.webserver || data['webserver'] || '',
      technologies: data.tech || data.technologies || [],
      redirectUrl: data.location || data['final-url'] || data.final_url,
      responseTime: data['response-time'] || data.response_time || 0,
      tls: data.tls,
      // Enhanced fields
      faviconHash: data['favicon-hash'] || data.favicon_hash || data.favicon?.hash,
      faviconUrl: data['favicon-url'] || data.favicon_url || data.favicon?.url,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      redirectChain: redirectChain.length > 0 ? redirectChain : undefined,
      finalUrl: data['final-url'] || data.final_url || data.location,
      bodyHash: data['body-sha256'] || data.body_sha256 || data['body-hash'] || data.body_hash,
    };
  }

  /**
   * Probe HTTP services on given hosts
   * @param hosts List of hosts to probe
   * @param options Probe options
   */
  async probe(hosts: string[], options: HttpProbeOptions = {}): Promise<HttpProbeResult[]> {
    if (hosts.length === 0) {
      return [];
    }

    const opts = { ...DEFAULT_PROBE_OPTIONS, ...options };

    try {
      // Use httpx for efficient HTTP probing
      const inputFile = path.join(this.resultsDir, `probe-input-${uuidv4()}.txt`);
      const outputFile = path.join(this.resultsDir, `probe-output-${uuidv4()}.json`);

      // Write hosts to file
      await fs.writeFile(inputFile, hosts.join('\n'));

      // Build and run httpx command
      const command = this.buildHttpxCommand(inputFile, outputFile, opts);
      
      // Calculate timeout based on options and number of hosts
      const commandTimeout = Math.max(
        600000, // minimum 10 minutes
        hosts.length * (opts.timeout || 5) * (opts.retries || 3) * 1000 + 60000
      );

      await execAsync(command, { timeout: commandTimeout });

      // Parse results
      const content = await fs.readFile(outputFile, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      const results: HttpProbeResult[] = [];

      for (const line of lines) {
        const result = this.parseHttpxJsonLine(line);
        if (result) {
          results.push(result);
        }
      }

      // Cleanup
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});

      return results;
    } catch (error) {
      console.error('HTTPx error:', error);

      // Fallback to Node.js-based probing
      return this.probeWithNode(hosts, opts);
    }
  }

  /**
   * Probe a single URL with enhanced options
   * @param url URL to probe
   * @param options Probe options
   */
  async probeSingle(url: string, options: HttpProbeOptions = {}): Promise<HttpProbeResult | null> {
    const opts = { ...DEFAULT_PROBE_OPTIONS, ...options };
    const results = await this.probeWithNode([url], opts);
    return results[0] || null;
  }

  /**
   * Fallback Node.js-based HTTP prober with enhanced options
   * @param hosts List of hosts to probe
   * @param options Probe options
   */
  private async probeWithNode(hosts: string[], options: HttpProbeOptions = {}): Promise<HttpProbeResult[]> {
    const opts = { ...DEFAULT_PROBE_OPTIONS, ...options };
    const results: HttpProbeResult[] = [];
    const timeout = (opts.timeout || 5) * 1000;
    const maxRetries = opts.retries || 3;

    const probePromises = hosts.map(async (host) => {
      // Try HTTPS first, then HTTP
      for (const protocol of ['https', 'http']) {
        const url = host.startsWith('http') ? host : `${protocol}://${host}`;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const startTime = Date.now();
            const response = await axios.get(url, {
              timeout,
              maxRedirects: opts.followRedirects ? 5 : 0,
              validateStatus: () => true,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });
            const responseTime = Date.now() - startTime;

            const title = this.extractTitle(response.data);
            const contentLength = parseInt(response.headers['content-length'] || '0', 10) ||
              (typeof response.data === 'string' ? response.data.length : 0);

            // Extract headers if requested
            const headers: Record<string, string> = {};
            if (opts.headers) {
              for (const [key, value] of Object.entries(response.headers)) {
                if (typeof value === 'string') {
                  headers[key] = value;
                } else if (Array.isArray(value)) {
                  headers[key] = value.join(', ');
                }
              }
            }

            // Extract favicon hash if requested
            let faviconHash: string | undefined;
            let faviconUrl: string | undefined;
            if (opts.favicon) {
              const faviconData = await this.extractFavicon(url, response.data);
              faviconHash = faviconData.hash;
              faviconUrl = faviconData.url;
            }

            // Calculate body hash
            const bodyHash = typeof response.data === 'string' 
              ? this.hashString(response.data)
              : undefined;

            results.push({
              subdomain: this.extractHostname(url),
              url: response.request?.res?.responseUrl || url,
              statusCode: response.status,
              title,
              contentLength,
              contentType: response.headers['content-type'] || '',
              webServer: response.headers['server'] || '',
              technologies: opts.techDetect ? this.detectBasicTechnologies(response) : [],
              responseTime,
              headers: opts.headers ? headers : undefined,
              faviconHash,
              faviconUrl,
              finalUrl: response.request?.res?.responseUrl,
              bodyHash,
            });

            return; // Success, don't try the other protocol
          } catch {
            // Retry on failure
            if (attempt === maxRetries - 1) {
              continue; // Try next protocol
            }
          }
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

  /**
   * Extract favicon URL and compute hash
   * @param baseUrl Base URL of the page
   * @param html HTML content
   */
  private async extractFavicon(baseUrl: string, html: string): Promise<{ hash?: string; url?: string }> {
    try {
      // Try to find favicon link in HTML
      let faviconUrl: string | undefined;
      
      if (typeof html === 'string') {
        const linkMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
        if (linkMatch) {
          faviconUrl = linkMatch[1];
        }
      }

      // Default to /favicon.ico if not found
      if (!faviconUrl) {
        faviconUrl = '/favicon.ico';
      }

      // Resolve relative URL
      const parsedBase = new URL(baseUrl);
      const resolvedUrl = new URL(faviconUrl, parsedBase.origin).href;

      // Fetch favicon and compute hash
      try {
        const response = await axios.get(resolvedUrl, {
          timeout: 3000,
          responseType: 'arraybuffer',
          validateStatus: (status) => status === 200,
        });

        const hash = this.hashBuffer(Buffer.from(response.data));
        return { hash, url: resolvedUrl };
      } catch {
        return { url: resolvedUrl };
      }
    } catch {
      return {};
    }
  }

  /**
   * Compute hash of a string
   * @param str String to hash
   */
  private hashString(str: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Compute hash of a buffer (for favicon)
   * @param buffer Buffer to hash
   */
  private hashBuffer(buffer: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(buffer).digest('hex');
  }
}

