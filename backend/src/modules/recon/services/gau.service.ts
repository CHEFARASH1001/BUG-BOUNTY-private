import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GAUConfig {
  domain: string;
  providers?: ('wayback' | 'commoncrawl' | 'otx' | 'urlscan')[];
  blacklist?: string[];
  threads?: number;
}

export interface GAUResult {
  domain: string;
  urls: string[];
  extractedDomains: string[];
  extractedEndpoints: GAUEndpoint[];
  providers: string[];
  timestamp: Date;
}

export interface GAUEndpoint {
  url: string;
  path: string;
  method: string;
  parameters: { name: string; type: string }[];
  hasParams: boolean;
  source: string;
}

@Injectable()
export class GAUService {
  private readonly defaultProviders: string[] = ['wayback', 'commoncrawl', 'otx', 'urlscan'];

  /**
   * Fetch URLs from multiple sources using gau CLI
   * Implements Requirement 13.1: Execute gau with all providers enabled
   */
  async fetchUrls(config: GAUConfig): Promise<GAUResult> {
    const providers = config.providers || this.defaultProviders;
    const urls = await this.executeGau(config);
    const extractedDomains = this.extractDomains(urls);
    const extractedEndpoints = this.extractEndpoints(urls);

    return {
      domain: config.domain,
      urls,
      extractedDomains,
      extractedEndpoints,
      providers,
      timestamp: new Date(),
    };
  }

  /**
   * Execute gau CLI tool with specified configuration
   * Constructs command with all provider flags as per Requirement 13.1
   */
  private async executeGau(config: GAUConfig): Promise<string[]> {
    try {
      const command = this.buildGauCommand(config);
      const { stdout } = await execAsync(command, {
        timeout: 600000, // 10 minute timeout
        maxBuffer: 100 * 1024 * 1024, // 100MB buffer for large outputs
      });

      return stdout
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
    } catch (error) {
      console.error('GAU execution error:', error);
      return [];
    }
  }

  /**
   * Build gau command with all specified parameters
   * Property 31: GAU Command Construction
   */
  buildGauCommand(config: GAUConfig): string {
    const parts: string[] = ['gau'];

    // Add provider flags
    const providers = config.providers || this.defaultProviders;
    for (const provider of providers) {
      parts.push(`--providers ${provider}`);
    }

    // Add blacklist if specified
    if (config.blacklist && config.blacklist.length > 0) {
      parts.push(`--blacklist ${config.blacklist.join(',')}`);
    }

    // Add threads if specified
    if (config.threads && config.threads > 0) {
      parts.push(`--threads ${config.threads}`);
    }

    // Add the domain at the end
    parts.push(config.domain);

    return parts.join(' ');
  }

  /**
   * Extract unique domains from a list of URLs
   * Implements Requirement 13.2: Extract unique domains
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
   * Extract endpoints from URLs for endpoint extraction
   * Implements Requirement 13.2, 13.4: Extract endpoints with source attribution
   * Property 32: GAU Source Attribution - source set to "gau"
   */
  extractEndpoints(urls: string[]): GAUEndpoint[] {
    const endpointMap = new Map<string, GAUEndpoint>();

    for (const url of urls) {
      try {
        const endpoint = this.parseUrlToEndpoint(url);
        if (endpoint) {
          // Use URL without query params as key to deduplicate
          const key = endpoint.url;
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
   * Parse a URL string into a GAUEndpoint object
   * Sets source to "gau" as per Requirement 13.3, 13.4
   */
  private parseUrlToEndpoint(url: string): GAUEndpoint | null {
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
        source: 'gau', // Source attribution as per Requirement 13.3
      };
    } catch {
      return null;
    }
  }
}
