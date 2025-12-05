import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { SubdomainEnumerator } from './services/subdomain-enumerator.service';
import { DnsResolver } from './services/dns-resolver.service';
import { PortScanner, PortResult } from './services/port-scanner.service';
import { HttpProber, HttpProbeResult } from './services/http-prober.service';
import { TechnologyDetector } from './services/technology-detector.service';
import { WafDetector } from './services/waf-detector.service';
import { SslAnalyzer, SslInfo } from './services/ssl-analyzer.service';

@Injectable()
export class ReconService {
  constructor(
    private subdomainEnumerator: SubdomainEnumerator,
    private dnsResolver: DnsResolver,
    private portScanner: PortScanner,
    private httpProber: HttpProber,
    private technologyDetector: TechnologyDetector,
    private wafDetector: WafDetector,
    private sslAnalyzer: SslAnalyzer,
  ) {}

  /**
   * Enumerate subdomains for a given domain
   */
  async enumerateSubdomains(domain: string): Promise<string[]> {
    return this.subdomainEnumerator.enumerate(domain);
  }

  /**
   * Resolve DNS records for a domain
   */
  async resolveDns(domain: string): Promise<any> {
    return this.dnsResolver.resolveAll(domain);
  }

  /**
   * Scan ports on target hosts
   */
  async scanPorts(
    hosts: string[],
    ports?: string,
  ): Promise<PortResult[]> {
    return this.portScanner.scan(hosts, ports);
  }

  /**
   * Probe HTTP services on hosts
   */
  async probeHttp(hosts: string[]): Promise<HttpProbeResult[]> {
    return this.httpProber.probe(hosts);
  }

  /**
   * Detect technologies used by URLs
   */
  async detectTechnologies(urls: string[]): Promise<string[][]> {
    const results: string[][] = [];
    for (const url of urls) {
      const techs = await this.technologyDetector.detect(url);
      results.push(techs);
    }
    return results;
  }

  /**
   * Detect WAF/CDN protection
   */
  async detectWaf(url: string): Promise<string[]> {
    return this.wafDetector.detect(url);
  }

  /**
   * Analyze SSL/TLS configuration
   */
  async analyzeSsl(host: string): Promise<SslInfo> {
    return this.sslAnalyzer.analyze(host);
  }

  /**
   * Run full reconnaissance on a domain
   */
  async fullRecon(domain: string): Promise<{
    subdomains: string[];
    dns: any;
    ssl: SslInfo;
    waf: string[];
    aliveHosts: HttpProbeResult[];
    ports: PortResult[];
    technologies: Map<string, string[]>;
  }> {
    // Step 1: Get subdomains
    const subdomains = await this.enumerateSubdomains(domain);

    // Step 2: Get DNS records
    const dns = await this.resolveDns(domain);

    // Step 3: Analyze SSL
    const ssl = await this.analyzeSsl(domain);

    // Step 4: Detect WAF
    const waf = await this.detectWaf(`https://${domain}`);

    // Step 5: Probe HTTP
    const aliveHosts = await this.probeHttp(subdomains);

    // Step 6: Scan ports on alive hosts
    const aliveHostnames = aliveHosts.map((h) => h.subdomain);
    const ports = await this.scanPorts(aliveHostnames.slice(0, 50)); // Limit for performance

    // Step 7: Detect technologies
    const technologies = new Map<string, string[]>();
    for (const host of aliveHosts.slice(0, 50)) {
      const techs = await this.technologyDetector.detect(host.url);
      technologies.set(host.subdomain, techs);
    }

    return {
      subdomains,
      dns,
      ssl,
      waf,
      aliveHosts,
      ports,
      technologies,
    };
  }
}

