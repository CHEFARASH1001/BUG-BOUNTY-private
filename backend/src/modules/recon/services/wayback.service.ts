import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface WaybackResult {
  domain: string;
  urls: string[];
  extractedDomains: string[];
  extractedEndpoints: Endpoint[];
  timestamp: Date;
}

export interface Endpoint {
  url: string;
  path: string;
  method: string;
  parameters: { name: string; type: string }[];
  hasParams: boolean;
}

@Injectable()
export class WaybackService {
  /**
   * Fetch historical URLs from Wayback Machine using waybackurls CLI
   */
  async fetchUrls(domain: string): Promise<WaybackResult> {
    const urls = await this.executeWaybackurls(domain);
    const extractedDomains = this.extractDomains(urls);
    const extractedEndpoints = this.extractEndpoints(urls);

    return {
      domain,
      urls,
      extractedDomains,
      extractedEndpoints,
      timestamp: new Date(),
    };
  }

  /**
   * Execute waybackurls CLI tool
   */
  private async executeWaybackurls(domain: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`waybackurls ${domain}`, {
        timeout: 300000, // 5 minute timeout
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
      });

      return stdout
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
    } catch (error) {
      console.error('Waybackurls execution error:', error);
      return [];
    }
  }

  /**
   * Extract unique domains from a list of URLs using unfurl-like logic
   * Returns unique, valid domain names with no duplicates
   */
  extractDomains(urls: string[]): string[] {
    const domains = new Set<string>();

    for (const url of urls) {
      try {
        const domain = this.extractDomainFromUrl(url);
        if (domain && this.isValidDomain(domain)) {
          domains.add(domain.toLowerCase());
        }
      } catch {
        // Skip invalid URLs
      }
    }

    return Array.from(domains).sort();
  }

  /**
   * Extract domain from a URL string
   */
  private extractDomainFromUrl(url: string): string | null {
    try {
      // Handle URLs without protocol
      let normalizedUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        normalizedUrl = `https://${url}`;
      }

      const parsed = new URL(normalizedUrl);
      return parsed.hostname;
    } catch {
      return null;
    }
  }

  /**
   * Validate domain format
   */
  private isValidDomain(domain: string): boolean {
    if (!domain || domain.length === 0 || domain.length > 253) {
      return false;
    }

    // Check for valid domain characters
    const validPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
    return validPattern.test(domain);
  }

  /**
   * Extract endpoints from URLs for URL path extraction
   */
  extractEndpoints(urls: string[]): Endpoint[] {
    const endpointMap = new Map<string, Endpoint>();

    for (const url of urls) {
      try {
        const endpoint = this.parseUrlToEndpoint(url);
        if (endpoint) {
          // Use URL without query params as key to deduplicate
          const key = `${endpoint.url}`;
          if (!endpointMap.has(key)) {
            endpointMap.set(key, endpoint);
          } else {
            // Merge parameters from duplicate URLs
            const existing = endpointMap.get(key)!;
            for (const param of endpoint.parameters) {
              if (!existing.parameters.some((p) => p.name === param.name)) {
                existing.parameters.push(param);
              }
            }
            existing.hasParams = existing.parameters.length > 0;
          }
        }
      } catch {
        // Skip invalid URLs
      }
    }

    return Array.from(endpointMap.values());
  }

  /**
   * Parse a URL string into an Endpoint object
   */
  private parseUrlToEndpoint(url: string): Endpoint | null {
    try {
      // Handle URLs without protocol
      let normalizedUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        normalizedUrl = `https://${url}`;
      }

      const parsed = new URL(normalizedUrl);
      const parameters: { name: string; type: string }[] = [];

      // Extract query parameters
      parsed.searchParams.forEach((_value, name) => {
        parameters.push({ name, type: 'query' });
      });

      // Build clean URL without query string
      const cleanUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;

      return {
        url: cleanUrl,
        path: parsed.pathname,
        method: 'GET', // Default method for discovered URLs
        parameters,
        hasParams: parameters.length > 0,
      };
    } catch {
      return null;
    }
  }
}
