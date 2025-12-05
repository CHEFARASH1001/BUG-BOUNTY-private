import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

@Injectable()
export class EndpointDiscoveryService {
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  /**
   * Discover endpoints from multiple sources
   */
  async discover(
    url: string,
    options: { wayback?: boolean; js?: boolean; crawl?: boolean } = {},
  ): Promise<string[]> {
    const endpoints = new Set<string>();
    const baseUrl = new URL(url);

    const promises: Promise<string[]>[] = [];

    if (options.wayback !== false) {
      promises.push(this.fromWayback(baseUrl.hostname));
    }

    if (options.js !== false) {
      promises.push(this.fromJavascript(url));
    }

    if (options.crawl !== false) {
      promises.push(this.crawl(url, 2));
    }

    // Common API endpoints
    promises.push(this.checkCommonEndpoints(url));

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        result.value.forEach((ep) => endpoints.add(ep));
      }
    }

    return Array.from(endpoints).sort();
  }

  /**
   * Get URLs from Wayback Machine
   */
  async fromWayback(domain: string): Promise<string[]> {
    const urls: string[] = [];

    try {
      const response = await axios.get(
        `https://web.archive.org/cdx/search/cdx`,
        {
          params: {
            url: `*.${domain}/*`,
            output: 'json',
            fl: 'original',
            collapse: 'urlkey',
            limit: 10000,
          },
          timeout: 60000,
        },
      );

      if (Array.isArray(response.data)) {
        // Skip header row
        for (let i = 1; i < response.data.length; i++) {
          const url = response.data[i][0];
          if (this.isInterestingUrl(url)) {
            urls.push(url);
          }
        }
      }
    } catch (error) {
      console.error('Wayback error:', error);
    }

    return urls;
  }

  /**
   * Extract endpoints from JavaScript files
   */
  async fromJavascript(url: string): Promise<string[]> {
    const endpoints: string[] = [];

    try {
      // First, get the main page and find JS files
      const response = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': this.userAgent },
      });

      const $ = cheerio.load(response.data);
      const jsUrls: string[] = [];

      // Get all script sources
      $('script[src]').each((_: number, el: Element) => {
        const src = $(el).attr('src');
        if (src) {
          jsUrls.push(this.resolveUrl(url, src));
        }
      });

      // Also extract from inline scripts
      $('script:not([src])').each((_: number, el: Element) => {
        const content = $(el).html();
        if (content) {
          const extracted = this.extractEndpointsFromJs(content);
          endpoints.push(...extracted);
        }
      });

      // Fetch and analyze external JS files
      const jsPromises = jsUrls.slice(0, 20).map(async (jsUrl) => {
        try {
          const jsResponse = await axios.get(jsUrl, {
            timeout: 10000,
            headers: { 'User-Agent': this.userAgent },
          });
          return this.extractEndpointsFromJs(jsResponse.data);
        } catch {
          return [];
        }
      });

      const jsResults = await Promise.all(jsPromises);
      jsResults.forEach((result) => endpoints.push(...result));
    } catch (error) {
      console.error('JS extraction error:', error);
    }

    return endpoints.filter((ep) => this.isValidEndpoint(ep));
  }

  /**
   * Crawl website for links
   */
  async crawl(startUrl: string, depth: number): Promise<string[]> {
    const visited = new Set<string>();
    const endpoints: string[] = [];
    const baseUrl = new URL(startUrl);
    const toVisit = [startUrl];

    let currentDepth = 0;

    while (toVisit.length > 0 && currentDepth < depth) {
      const batch = toVisit.splice(0, 10);
      currentDepth++;

      const promises = batch.map(async (url) => {
        if (visited.has(url)) return [];
        visited.add(url);

        try {
          const response = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': this.userAgent },
            maxRedirects: 3,
          });

          const $ = cheerio.load(response.data);
          const links: string[] = [];

          // Get all links
          $('a[href]').each((_: number, el: Element) => {
            const href = $(el).attr('href');
            if (href) {
              const resolved = this.resolveUrl(url, href);
              if (this.isSameDomain(resolved, baseUrl.hostname)) {
                links.push(resolved);
              }
            }
          });

          // Get form actions
          $('form[action]').each((_: number, el: Element) => {
            const action = $(el).attr('action');
            if (action) {
              const resolved = this.resolveUrl(url, action);
              if (this.isSameDomain(resolved, baseUrl.hostname)) {
                links.push(resolved);
              }
            }
          });

          return links;
        } catch {
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach((links) => {
        links.forEach((link) => {
          endpoints.push(link);
          if (!visited.has(link)) {
            toVisit.push(link);
          }
        });
      });
    }

    return Array.from(new Set(endpoints));
  }

  /**
   * Check common API endpoints
   */
  async checkCommonEndpoints(baseUrl: string): Promise<string[]> {
    const commonPaths = [
      '/api',
      '/api/v1',
      '/api/v2',
      '/api/v3',
      '/graphql',
      '/graphiql',
      '/swagger',
      '/swagger-ui',
      '/swagger-ui.html',
      '/api-docs',
      '/docs',
      '/redoc',
      '/openapi',
      '/openapi.json',
      '/swagger.json',
      '/health',
      '/status',
      '/metrics',
      '/debug',
      '/admin',
      '/administrator',
      '/login',
      '/signin',
      '/signup',
      '/register',
      '/auth',
      '/oauth',
      '/callback',
      '/webhook',
      '/ws',
      '/socket.io',
      '/.well-known',
      '/robots.txt',
      '/sitemap.xml',
    ];

    const found: string[] = [];
    const parsedUrl = new URL(baseUrl);
    const base = `${parsedUrl.protocol}//${parsedUrl.host}`;

    const checkPromises = commonPaths.map(async (path) => {
      try {
        const url = `${base}${path}`;
        const response = await axios.get(url, {
          timeout: 5000,
          validateStatus: () => true,
          headers: { 'User-Agent': this.userAgent },
        });

        if (response.status < 400 || response.status === 401 || response.status === 403) {
          return url;
        }
      } catch {
        // Ignore errors
      }
      return null;
    });

    const results = await Promise.all(checkPromises);
    return results.filter(Boolean) as string[];
  }

  /**
   * Extract endpoints from JavaScript content
   */
  private extractEndpointsFromJs(content: string): string[] {
    const endpoints: string[] = [];

    // Match API paths
    const patterns = [
      /["'`](\/?api\/[^"'`\s]+)["'`]/gi,
      /["'`](\/v\d+\/[^"'`\s]+)["'`]/gi,
      /["'`](\/[a-z][a-z0-9-]*\/[^"'`\s]+)["'`]/gi,
      /["'`](https?:\/\/[^"'`\s]+)["'`]/gi,
      /fetch\s*\(\s*["'`]([^"'`]+)["'`]/gi,
      /axios\.[a-z]+\s*\(\s*["'`]([^"'`]+)["'`]/gi,
      /\.ajax\s*\(\s*\{[^}]*url\s*:\s*["'`]([^"'`]+)["'`]/gi,
      /XMLHttpRequest[^;]*\.open\s*\([^,]+,\s*["'`]([^"'`]+)["'`]/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          endpoints.push(match[1]);
        }
      }
    }

    return endpoints;
  }

  /**
   * Check if URL is interesting (not static asset, etc.)
   */
  private isInterestingUrl(url: string): boolean {
    const staticExtensions = [
      '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
      '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.pdf',
    ];

    const lowerUrl = url.toLowerCase();
    return !staticExtensions.some((ext) => lowerUrl.endsWith(ext));
  }

  /**
   * Check if endpoint is valid
   */
  private isValidEndpoint(endpoint: string): boolean {
    if (!endpoint || endpoint.length < 2) return false;
    if (endpoint.startsWith('#')) return false;
    if (endpoint.startsWith('javascript:')) return false;
    if (endpoint.startsWith('mailto:')) return false;
    if (endpoint.startsWith('tel:')) return false;
    return true;
  }

  /**
   * Resolve relative URL
   */
  private resolveUrl(base: string, relative: string): string {
    try {
      return new URL(relative, base).href;
    } catch {
      return relative;
    }
  }

  /**
   * Check if URL is same domain
   */
  private isSameDomain(url: string, domain: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`);
    } catch {
      return false;
    }
  }
}

