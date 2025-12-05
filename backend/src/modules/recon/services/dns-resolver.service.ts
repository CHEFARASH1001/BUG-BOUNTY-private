import { Injectable } from '@nestjs/common';
import * as dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const resolveCname = promisify(dns.resolveCname);
const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const resolveNs = promisify(dns.resolveNs);
const resolveSoa = promisify(dns.resolveSoa);

export interface DnsRecords {
  a: string[];
  aaaa: string[];
  cname: string[];
  mx: { priority: number; exchange: string }[];
  txt: string[];
  ns: string[];
  soa: dns.SoaRecord | null;
}

@Injectable()
export class DnsResolver {
  /**
   * Resolve all DNS record types for a domain
   */
  async resolveAll(domain: string): Promise<DnsRecords> {
    const [a, aaaa, cname, mx, txt, ns, soa] = await Promise.allSettled([
      this.resolveA(domain),
      this.resolveAAAA(domain),
      this.resolveCNAME(domain),
      this.resolveMX(domain),
      this.resolveTXT(domain),
      this.resolveNS(domain),
      this.resolveSOA(domain),
    ]);

    return {
      a: a.status === 'fulfilled' ? a.value : [],
      aaaa: aaaa.status === 'fulfilled' ? aaaa.value : [],
      cname: cname.status === 'fulfilled' ? cname.value : [],
      mx: mx.status === 'fulfilled' ? mx.value : [],
      txt: txt.status === 'fulfilled' ? txt.value : [],
      ns: ns.status === 'fulfilled' ? ns.value : [],
      soa: soa.status === 'fulfilled' ? soa.value : null,
    };
  }

  async resolveA(domain: string): Promise<string[]> {
    try {
      return await resolve4(domain);
    } catch {
      return [];
    }
  }

  async resolveAAAA(domain: string): Promise<string[]> {
    try {
      return await resolve6(domain);
    } catch {
      return [];
    }
  }

  async resolveCNAME(domain: string): Promise<string[]> {
    try {
      return await resolveCname(domain);
    } catch {
      return [];
    }
  }

  async resolveMX(domain: string): Promise<{ priority: number; exchange: string }[]> {
    try {
      return await resolveMx(domain);
    } catch {
      return [];
    }
  }

  async resolveTXT(domain: string): Promise<string[]> {
    try {
      const records = await resolveTxt(domain);
      return records.map((r) => r.join(''));
    } catch {
      return [];
    }
  }

  async resolveNS(domain: string): Promise<string[]> {
    try {
      return await resolveNs(domain);
    } catch {
      return [];
    }
  }

  async resolveSOA(domain: string): Promise<dns.SoaRecord | null> {
    try {
      return await resolveSoa(domain);
    } catch {
      return null;
    }
  }

  /**
   * Check for potential subdomain takeover
   */
  async checkSubdomainTakeover(subdomain: string): Promise<{
    vulnerable: boolean;
    service: string | null;
    cname: string | null;
  }> {
    const takeoverSignatures: Record<string, string[]> = {
      'github': ['github.io', 'githubusercontent.com'],
      'heroku': ['herokudns.com', 'herokuapp.com'],
      'aws-s3': ['s3.amazonaws.com', 's3-website'],
      'aws-eb': ['elasticbeanstalk.com'],
      'azure': ['azurewebsites.net', 'cloudapp.azure.com', 'trafficmanager.net'],
      'shopify': ['myshopify.com'],
      'fastly': ['fastly.net'],
      'pantheon': ['pantheonsite.io'],
      'zendesk': ['zendesk.com'],
      'ghost': ['ghost.io'],
      'tumblr': ['tumblr.com'],
      'wordpress': ['wordpress.com'],
      'surge': ['surge.sh'],
      'bitbucket': ['bitbucket.io'],
      'intercom': ['custom.intercom.help'],
      'helpscout': ['helpscoutdocs.com'],
      'cargo': ['cargocollective.com'],
      'statuspage': ['statuspage.io'],
      'uservoice': ['uservoice.com'],
      'smugmug': ['smugmug.com'],
      'teamwork': ['teamwork.com'],
      'unbounce': ['unbouncepages.com'],
    };

    try {
      const cnames = await this.resolveCNAME(subdomain);
      if (cnames.length === 0) {
        return { vulnerable: false, service: null, cname: null };
      }

      const cname = cnames[0].toLowerCase();

      for (const [service, patterns] of Object.entries(takeoverSignatures)) {
        if (patterns.some((pattern) => cname.includes(pattern))) {
          // Try to resolve the CNAME target
          try {
            await resolve4(cname);
            return { vulnerable: false, service, cname };
          } catch {
            // CNAME doesn't resolve - potential takeover
            return { vulnerable: true, service, cname };
          }
        }
      }

      return { vulnerable: false, service: null, cname };
    } catch {
      return { vulnerable: false, service: null, cname: null };
    }
  }

  /**
   * Check for DNS zone transfer
   */
  async checkZoneTransfer(domain: string): Promise<{
    vulnerable: boolean;
    nameservers: string[];
    records: string[];
  }> {
    const result = {
      vulnerable: false,
      nameservers: [] as string[],
      records: [] as string[],
    };

    try {
      const nameservers = await this.resolveNS(domain);
      result.nameservers = nameservers;

      // Try zone transfer with each nameserver (using dig)
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      for (const ns of nameservers) {
        try {
          const { stdout } = await execAsync(
            `dig @${ns} ${domain} AXFR +short`,
            { timeout: 10000 },
          );

          if (stdout && stdout.trim().length > 0) {
            result.vulnerable = true;
            result.records = stdout.trim().split('\n');
            break;
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Ignore errors
    }

    return result;
  }
}

