import { Injectable } from '@nestjs/common';
import { ShodanService } from './services/shodan.service';
import { SecurityTrailsService } from './services/securitytrails.service';
import { VirusTotalService } from './services/virustotal.service';
import { CensysService } from './services/censys.service';
import { HunterService } from './services/hunter.service';
import { AlienVaultService } from './services/alienvault.service';
import { HackerTargetService } from './services/hackertarget.service';
import { CrtShService } from './services/crtsh.service';
import { UrlScanService } from './services/urlscan.service';
import { AbuseIPDBService } from './services/abuseipdb.service';

@Injectable()
export class ExternalApisService {
  constructor(
    public readonly shodan: ShodanService,
    public readonly securityTrails: SecurityTrailsService,
    public readonly virusTotal: VirusTotalService,
    public readonly censys: CensysService,
    public readonly hunter: HunterService,
    public readonly alienVault: AlienVaultService,
    public readonly hackerTarget: HackerTargetService,
    public readonly crtsh: CrtShService,
    public readonly urlscan: UrlScanService,
    public readonly abuseIPDB: AbuseIPDBService,
  ) {}

  /**
   * Get comprehensive host intelligence
   */
  async getHostIntelligence(host: string): Promise<{
    shodan: any;
    virusTotal: any;
    censys: any;
    alienVault: any;
  }> {
    const [shodan, virusTotal, censys, alienVault] = await Promise.allSettled([
      this.shodan.hostLookup(host),
      this.virusTotal.getIpInfo(host),
      this.censys.searchHosts(host),
      this.alienVault.getIndicator(host, 'IPv4'),
    ]);

    return {
      shodan: shodan.status === 'fulfilled' ? shodan.value : null,
      virusTotal: virusTotal.status === 'fulfilled' ? virusTotal.value : null,
      censys: censys.status === 'fulfilled' ? censys.value : null,
      alienVault: alienVault.status === 'fulfilled' ? alienVault.value : null,
    };
  }

  /**
   * Get comprehensive domain intelligence
   */
  async getDomainIntelligence(domain: string): Promise<{
    securityTrails: any;
    virusTotal: any;
    hunter: any;
    urlscan: any;
  }> {
    const [securityTrails, virusTotal, hunter, urlscan] = await Promise.allSettled([
      this.securityTrails.getDomainInfo(domain),
      this.virusTotal.getDomainInfo(domain),
      this.hunter.domainSearch(domain),
      this.urlscan.search(domain),
    ]);

    return {
      securityTrails: securityTrails.status === 'fulfilled' ? securityTrails.value : null,
      virusTotal: virusTotal.status === 'fulfilled' ? virusTotal.value : null,
      hunter: hunter.status === 'fulfilled' ? hunter.value : null,
      urlscan: urlscan.status === 'fulfilled' ? urlscan.value : null,
    };
  }

  /**
   * Check if services are configured
   */
  getConfiguredServices(): {
    name: string;
    configured: boolean;
  }[] {
    return [
      { name: 'Shodan', configured: this.shodan.isConfigured() },
      { name: 'SecurityTrails', configured: this.securityTrails.isConfigured() },
      { name: 'VirusTotal', configured: this.virusTotal.isConfigured() },
      { name: 'Censys', configured: this.censys.isConfigured() },
      { name: 'Hunter.io', configured: this.hunter.isConfigured() },
      { name: 'AlienVault', configured: this.alienVault.isConfigured() },
      { name: 'HackerTarget', configured: true }, // Free service
      { name: 'crt.sh', configured: true }, // Free service
      { name: 'URLScan', configured: this.urlscan.isConfigured() },
      { name: 'AbuseIPDB', configured: this.abuseIPDB.isConfigured() },
    ];
  }
}

