import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ExternalApisService } from '../../external-apis/external-apis.service';

const execAsync = promisify(exec);

@Injectable()
export class SubdomainEnumerator {
  private resultsDir = '/app/results';

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => ExternalApisService))
    private externalApis: ExternalApisService,
  ) {}

  /**
   * Enumerate subdomains using multiple sources
   */
  async enumerate(domain: string): Promise<string[]> {
    const allSubdomains = new Set<string>();

    // Run all enumeration methods in parallel
    const results = await Promise.allSettled([
      this.runSubfinder(domain),
      this.querySecurityTrails(domain),
      this.queryCertificateTransparency(domain),
      this.queryVirusTotal(domain),
      this.queryAlienVault(domain),
      this.queryHackerTarget(domain),
      this.queryCrtSh(domain),
      this.bruteforce(domain),
    ]);

    // Collect all results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        result.value.forEach((sub) => allSubdomains.add(sub.toLowerCase()));
      }
    }

    // Filter and clean results
    return Array.from(allSubdomains)
      .filter((sub) => this.isValidSubdomain(sub, domain))
      .sort();
  }

  /**
   * Run Subfinder tool
   */
  private async runSubfinder(domain: string): Promise<string[]> {
    try {
      const outputFile = path.join(this.resultsDir, `subfinder-${uuidv4()}.txt`);

      await execAsync(
        `docker exec bb-subfinder subfinder -d ${domain} -silent -o /results/${path.basename(outputFile)}`,
        { timeout: 300000 }, // 5 minute timeout
      );

      const content = await fs.readFile(outputFile, 'utf-8');
      await fs.unlink(outputFile).catch(() => {});

      return content
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } catch (error) {
      console.error('Subfinder error:', error);
      return [];
    }
  }

  /**
   * Query SecurityTrails API
   */
  private async querySecurityTrails(domain: string): Promise<string[]> {
    try {
      const result = await this.externalApis.securityTrails.getSubdomains(domain);
      return result.subdomains?.map((s: string) => `${s}.${domain}`) || [];
    } catch (error) {
      console.error('SecurityTrails error:', error);
      return [];
    }
  }

  /**
   * Query Certificate Transparency logs
   */
  private async queryCertificateTransparency(domain: string): Promise<string[]> {
    try {
      const result = await this.externalApis.censys.searchCertificates(domain);
      const subdomains: string[] = [];

      for (const cert of result.results || []) {
        const names = cert.parsed?.names || [];
        subdomains.push(...names.filter((n: string) => n.endsWith(domain)));
      }

      return subdomains;
    } catch (error) {
      console.error('CT logs error:', error);
      return [];
    }
  }

  /**
   * Query VirusTotal
   */
  private async queryVirusTotal(domain: string): Promise<string[]> {
    try {
      const result = await this.externalApis.virusTotal.getDomainInfo(domain);
      return result.subdomains || [];
    } catch (error) {
      console.error('VirusTotal error:', error);
      return [];
    }
  }

  /**
   * Query AlienVault OTX
   */
  private async queryAlienVault(domain: string): Promise<string[]> {
    try {
      const result = await this.externalApis.alienVault.getPassiveDns(domain);
      return result.passive_dns?.map((r: any) => r.hostname).filter(Boolean) || [];
    } catch (error) {
      console.error('AlienVault error:', error);
      return [];
    }
  }

  /**
   * Query HackerTarget
   */
  private async queryHackerTarget(domain: string): Promise<string[]> {
    try {
      const result = await this.externalApis.hackerTarget.hostsearch(domain);
      return result
        .split('\n')
        .map((line: string) => line.split(',')[0]?.trim())
        .filter(Boolean);
    } catch (error) {
      console.error('HackerTarget error:', error);
      return [];
    }
  }

  /**
   * Query crt.sh for certificate transparency
   */
  private async queryCrtSh(domain: string): Promise<string[]> {
    try {
      const result = await this.externalApis.crtsh.search(domain);
      const subdomains = new Set<string>();

      for (const cert of result) {
        const names = cert.name_value?.split('\n') || [];
        names.forEach((name: string) => {
          const clean = name.replace('*.', '').trim();
          if (clean.endsWith(domain)) {
            subdomains.add(clean);
          }
        });
      }

      return Array.from(subdomains);
    } catch (error) {
      console.error('crt.sh error:', error);
      return [];
    }
  }

  /**
   * DNS bruteforce with common subdomain wordlist
   */
  private async bruteforce(domain: string): Promise<string[]> {
    const commonSubdomains = [
      'www', 'mail', 'ftp', 'localhost', 'webmail', 'smtp', 'pop', 'ns1', 'ns2',
      'ns3', 'ns4', 'dns', 'dns1', 'dns2', 'mx', 'mx1', 'mx2', 'proxy', 'vpn',
      'admin', 'administrator', 'dev', 'development', 'staging', 'test', 'testing',
      'api', 'api1', 'api2', 'app', 'apps', 'beta', 'demo', 'docs', 'git', 'gitlab',
      'github', 'jenkins', 'jira', 'login', 'auth', 'sso', 'portal', 'dashboard',
      'cdn', 'static', 'assets', 'img', 'images', 'media', 'files', 'download',
      'upload', 'blog', 'forum', 'shop', 'store', 'cart', 'pay', 'payment',
      'secure', 'ssl', 'web', 'www2', 'www3', 'old', 'new', 'legacy', 'backup',
      'db', 'database', 'mysql', 'postgres', 'mongo', 'redis', 'elastic', 'es',
      'kibana', 'grafana', 'prometheus', 'monitoring', 'logs', 'status', 'health',
      'internal', 'private', 'public', 'external', 'partner', 'vendor', 'client',
      'customer', 'support', 'help', 'helpdesk', 'ticket', 'crm', 'erp', 'hr',
      'intranet', 'extranet', 'corp', 'corporate', 'office', 'o365', 'exchange',
      'autodiscover', 'owa', 'remote', 'rdp', 'citrix', 'webex', 'zoom', 'meet',
      'calendar', 'contacts', 'directory', 'ldap', 'ad', 'dc', 'fs', 'file',
      'share', 'nas', 'san', 'storage', 'archive', 'bak', 'tmp', 'temp',
      'v1', 'v2', 'v3', 'mobile', 'm', 'wap', 'app1', 'app2', 'ws', 'websocket',
      'socket', 'stream', 'video', 'audio', 'live', 'rtmp', 'hls', 'vod',
      'sandbox', 'uat', 'qa', 'prod', 'production', 'preprod', 'pre-prod',
    ];

    const resolved: string[] = [];
    const dns = require('dns').promises;

    const chunks = this.chunkArray(commonSubdomains, 50);

    for (const chunk of chunks) {
      const promises = chunk.map(async (sub) => {
        const subdomain = `${sub}.${domain}`;
        try {
          await dns.resolve(subdomain);
          return subdomain;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(promises);
      resolved.push(...results.filter(Boolean) as string[]);
    }

    return resolved;
  }

  /**
   * Validate subdomain format
   */
  private isValidSubdomain(subdomain: string, parentDomain: string): boolean {
    if (!subdomain || !subdomain.endsWith(parentDomain)) {
      return false;
    }

    // Check for valid characters
    const validPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
    if (!validPattern.test(subdomain)) {
      return false;
    }

    // Check for reasonable length
    if (subdomain.length > 255) {
      return false;
    }

    return true;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

