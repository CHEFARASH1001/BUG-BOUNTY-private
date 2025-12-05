import { Injectable } from '@nestjs/common';
import { NucleiService, NucleiResult } from './services/nuclei.service';
import { VulnerabilityCheckerService } from './services/vulnerability-checker.service';
import { EndpointDiscoveryService } from './services/endpoint-discovery.service';
import { ScreenshotService } from './services/screenshot.service';

@Injectable()
export class ScannerService {
  constructor(
    private nucleiService: NucleiService,
    private vulnChecker: VulnerabilityCheckerService,
    private endpointDiscovery: EndpointDiscoveryService,
    private screenshotService: ScreenshotService,
  ) {}

  /**
   * Run Nuclei vulnerability scan
   */
  async runNucleiScan(targets: string[], templates?: string[]): Promise<NucleiResult[]> {
    return this.nucleiService.scan(targets, templates);
  }

  /**
   * Run comprehensive vulnerability scan
   */
  async runComprehensiveScan(url: string): Promise<{
    nuclei: NucleiResult[];
    xss: any[];
    sqli: any[];
    ssrf: any[];
    openRedirect: any[];
    lfi: any[];
    rce: any[];
  }> {
    const [nuclei, xss, sqli, ssrf, openRedirect, lfi, rce] = await Promise.allSettled([
      this.nucleiService.scan([url]),
      this.vulnChecker.checkXss(url),
      this.vulnChecker.checkSqli(url),
      this.vulnChecker.checkSsrf(url),
      this.vulnChecker.checkOpenRedirect(url),
      this.vulnChecker.checkLfi(url),
      this.vulnChecker.checkRce(url),
    ]);

    return {
      nuclei: nuclei.status === 'fulfilled' ? nuclei.value : [],
      xss: xss.status === 'fulfilled' ? xss.value : [],
      sqli: sqli.status === 'fulfilled' ? sqli.value : [],
      ssrf: ssrf.status === 'fulfilled' ? ssrf.value : [],
      openRedirect: openRedirect.status === 'fulfilled' ? openRedirect.value : [],
      lfi: lfi.status === 'fulfilled' ? lfi.value : [],
      rce: rce.status === 'fulfilled' ? rce.value : [],
    };
  }

  /**
   * Discover endpoints
   */
  async discoverEndpoints(
    url: string,
    options?: { wayback?: boolean; js?: boolean; crawl?: boolean },
  ): Promise<string[]> {
    return this.endpointDiscovery.discover(url, options);
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(url: string, outputPath: string): Promise<string> {
    return this.screenshotService.capture(url, outputPath);
  }

  /**
   * Take batch screenshots
   */
  async takeBatchScreenshots(urls: string[], outputDir: string): Promise<Map<string, string>> {
    return this.screenshotService.captureBatch(urls, outputDir);
  }

  /**
   * Check for sensitive files
   */
  async checkSensitiveFiles(baseUrl: string): Promise<any[]> {
    return this.vulnChecker.checkSensitiveFiles(baseUrl);
  }

  /**
   * Check for subdomain takeover
   */
  async checkSubdomainTakeover(subdomain: string): Promise<any> {
    return this.vulnChecker.checkSubdomainTakeover(subdomain);
  }

  /**
   * Check for CORS misconfiguration
   */
  async checkCorsMisconfig(url: string): Promise<any> {
    return this.vulnChecker.checkCorsMisconfig(url);
  }

  /**
   * Check security headers
   */
  async checkSecurityHeaders(url: string): Promise<any> {
    return this.vulnChecker.checkSecurityHeaders(url);
  }
}

