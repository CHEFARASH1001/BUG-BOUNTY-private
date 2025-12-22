import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService as HttpServiceSchema, HttpServiceDocument } from '../../schemas/http-service.schema';
import { HttpProber, HttpProbeResult, HttpProbeOptions, DEFAULT_PROBE_OPTIONS } from '../recon/services/http-prober.service';

/**
 * Represents a detected change in an HTTP service
 */
export interface HTTPChangeEvent {
  url: string;
  changeType: 'status_code' | 'title' | 'technology' | 'favicon' | 'content';
  previousValue: any;
  currentValue: any;
  detectedAt: Date;
}

/**
 * Configuration for HTTP monitoring
 */
export interface HTTPMonitorConfig {
  targets: string[];
  options?: HttpProbeOptions;
}

/**
 * Result of a monitoring operation
 */
export interface MonitorResult {
  probed: number;
  created: number;
  updated: number;
  changes: HTTPChangeEvent[];
}

/**
 * Previous scan data structure for comparison
 */
export interface PreviousScanData {
  statusCode?: number;
  title?: string;
  technologies?: string[];
  contentLength?: number;
  bodyHash?: string;
  faviconHash?: string;
  scannedAt?: Date;
}

@Injectable()
export class HttpMonitorService {
  private readonly logger = new Logger(HttpMonitorService.name);

  constructor(
    @InjectModel(HttpServiceSchema.name) private httpServiceModel: Model<HttpServiceDocument>,
    private readonly httpProber: HttpProber,
  ) {}


  /**
   * Detect changes between current and previous scan results
   * @param current Current probe result
   * @param previous Previous scan data
   * @returns Array of detected changes
   */
  detectChanges(current: HttpProbeResult, previous: PreviousScanData | null | undefined): HTTPChangeEvent[] {
    const changes: HTTPChangeEvent[] = [];
    const now = new Date();

    // No previous data means no changes to detect (first scan)
    if (!previous) {
      return changes;
    }

    // Check status code change
    if (previous.statusCode !== undefined && current.statusCode !== previous.statusCode) {
      changes.push({
        url: current.url,
        changeType: 'status_code',
        previousValue: previous.statusCode,
        currentValue: current.statusCode,
        detectedAt: now,
      });
    }

    // Check title change
    if (previous.title !== undefined && current.title !== previous.title) {
      changes.push({
        url: current.url,
        changeType: 'title',
        previousValue: previous.title,
        currentValue: current.title,
        detectedAt: now,
      });
    }

    // Check technology change
    const prevTech = previous.technologies || [];
    const currTech = current.technologies || [];
    const prevTechSorted = [...prevTech].sort().join(',');
    const currTechSorted = [...currTech].sort().join(',');
    
    if (prevTechSorted !== currTechSorted) {
      changes.push({
        url: current.url,
        changeType: 'technology',
        previousValue: prevTech,
        currentValue: currTech,
        detectedAt: now,
      });
    }

    // Check favicon hash change
    if (previous.faviconHash !== undefined && current.faviconHash !== undefined && 
        previous.faviconHash !== current.faviconHash) {
      changes.push({
        url: current.url,
        changeType: 'favicon',
        previousValue: previous.faviconHash,
        currentValue: current.faviconHash,
        detectedAt: now,
      });
    }

    // Check content/body hash change
    if (previous.bodyHash !== undefined && current.bodyHash !== undefined &&
        previous.bodyHash !== current.bodyHash) {
      changes.push({
        url: current.url,
        changeType: 'content',
        previousValue: previous.bodyHash,
        currentValue: current.bodyHash,
        detectedAt: now,
      });
    }

    return changes;
  }

  /**
   * Determine change flags from detected changes
   * @param changes Array of detected changes
   * @returns Object with change flags
   */
  getChangeFlags(changes: HTTPChangeEvent[]): {
    statusCodeChanged: boolean;
    titleChanged: boolean;
    techChanged: boolean;
  } {
    return {
      statusCodeChanged: changes.some(c => c.changeType === 'status_code'),
      titleChanged: changes.some(c => c.changeType === 'title'),
      techChanged: changes.some(c => c.changeType === 'technology'),
    };
  }

  /**
   * Preserve previous scan data before updating
   * @param existing Existing HTTP service document
   * @returns Previous scan data object
   */
  preservePreviousScan(existing: HttpServiceDocument): PreviousScanData {
    return {
      statusCode: existing.statusCode,
      title: existing.title,
      technologies: existing.technologies ? [...existing.technologies] : [],
      contentLength: existing.contentLength,
      bodyHash: existing.bodyHash,
      faviconHash: existing.faviconHash,
      scannedAt: existing.scannedAt,
    };
  }


  /**
   * Probe targets and update HTTP services with change detection
   * @param config Monitor configuration
   * @returns Monitor result with changes
   */
  async probe(config: HTTPMonitorConfig): Promise<MonitorResult> {
    const { targets, options } = config;
    const probeOptions = { ...DEFAULT_PROBE_OPTIONS, ...options };

    if (targets.length === 0) {
      return { probed: 0, created: 0, updated: 0, changes: [] };
    }

    // Probe all targets
    const probeResults = await this.httpProber.probe(targets, probeOptions);
    
    let created = 0;
    let updated = 0;
    const allChanges: HTTPChangeEvent[] = [];

    for (const result of probeResults) {
      try {
        const { isNew, changes } = await this.upsertWithChangeDetection(result);
        
        if (isNew) {
          created++;
        } else {
          updated++;
          allChanges.push(...changes);
        }
      } catch (error: any) {
        this.logger.error(`Failed to upsert HTTP service ${result.url}: ${error.message}`);
      }
    }

    return {
      probed: probeResults.length,
      created,
      updated,
      changes: allChanges,
    };
  }

  /**
   * Probe a single URL with change detection
   * @param url URL to probe
   * @param options Probe options
   * @returns Probe result with changes
   */
  async probeSingle(url: string, options?: HttpProbeOptions): Promise<{
    result: HttpProbeResult | null;
    changes: HTTPChangeEvent[];
    isNew: boolean;
  }> {
    const probeOptions = { ...DEFAULT_PROBE_OPTIONS, ...options };
    const result = await this.httpProber.probeSingle(url, probeOptions);

    if (!result) {
      return { result: null, changes: [], isNew: false };
    }

    const { isNew, changes } = await this.upsertWithChangeDetection(result);
    return { result, changes, isNew };
  }

  /**
   * Upsert HTTP service with change detection
   * @param probeResult Probe result to upsert
   * @returns Whether it's new and detected changes
   */
  private async upsertWithChangeDetection(probeResult: HttpProbeResult): Promise<{
    isNew: boolean;
    changes: HTTPChangeEvent[];
  }> {
    const existing = await this.httpServiceModel.findOne({ url: probeResult.url });

    if (!existing) {
      // Create new service
      await this.httpServiceModel.create({
        url: probeResult.url,
        subdomain: probeResult.subdomain,
        domain: this.extractDomain(probeResult.subdomain),
        statusCode: probeResult.statusCode,
        title: probeResult.title,
        contentLength: probeResult.contentLength,
        contentType: probeResult.contentType,
        webServer: probeResult.webServer,
        technologies: probeResult.technologies,
        headers: probeResult.headers,
        faviconHash: probeResult.faviconHash,
        faviconUrl: probeResult.faviconUrl,
        redirectChain: probeResult.redirectChain,
        finalUrl: probeResult.finalUrl,
        bodyHash: probeResult.bodyHash,
        responseTime: probeResult.responseTime,
        isFresh: true,
        firstSeen: new Date(),
        lastSeen: new Date(),
        scannedAt: new Date(),
        statusCodeChanged: false,
        titleChanged: false,
        techChanged: false,
      });

      return { isNew: true, changes: [] };
    }

    // Preserve previous scan data
    const previousScan = this.preservePreviousScan(existing);

    // Detect changes
    const changes = this.detectChanges(probeResult, previousScan);
    const changeFlags = this.getChangeFlags(changes);

    // Update existing service
    existing.statusCode = probeResult.statusCode;
    existing.title = probeResult.title;
    existing.contentLength = probeResult.contentLength;
    existing.contentType = probeResult.contentType;
    existing.webServer = probeResult.webServer;
    existing.technologies = probeResult.technologies;
    existing.headers = probeResult.headers || existing.headers;
    existing.faviconHash = probeResult.faviconHash || existing.faviconHash;
    existing.faviconUrl = probeResult.faviconUrl || existing.faviconUrl;
    existing.redirectChain = probeResult.redirectChain || existing.redirectChain;
    existing.finalUrl = probeResult.finalUrl || existing.finalUrl;
    existing.bodyHash = probeResult.bodyHash || existing.bodyHash;
    existing.responseTime = probeResult.responseTime;
    existing.previousScan = previousScan;
    existing.statusCodeChanged = changeFlags.statusCodeChanged;
    existing.titleChanged = changeFlags.titleChanged;
    existing.techChanged = changeFlags.techChanged;
    existing.lastSeen = new Date();
    existing.scannedAt = new Date();

    await existing.save();

    return { isNew: false, changes };
  }


  /**
   * Watch all HTTP services for changes
   * @param options Probe options
   * @returns Monitor result
   */
  async watchAll(options?: HttpProbeOptions): Promise<MonitorResult> {
    const services = await this.httpServiceModel.find({}).select('url').exec();
    const targets = services.map(s => s.url);

    this.logger.log(`Watching ${targets.length} HTTP services for changes`);

    return this.probe({ targets, options });
  }

  /**
   * Watch only fresh HTTP services for changes
   * @param options Probe options
   * @returns Monitor result
   */
  async watchFresh(options?: HttpProbeOptions): Promise<MonitorResult> {
    const services = await this.httpServiceModel.find({ isFresh: true }).select('url').exec();
    const targets = services.map(s => s.url);

    this.logger.log(`Watching ${targets.length} fresh HTTP services for changes`);

    return this.probe({ targets, options });
  }

  /**
   * Watch HTTP services by domain
   * @param domain Domain to watch
   * @param options Probe options
   * @returns Monitor result
   */
  async watchByDomain(domain: string, options?: HttpProbeOptions): Promise<MonitorResult> {
    const services = await this.httpServiceModel
      .find({ domain: domain.toLowerCase() })
      .select('url')
      .exec();
    const targets = services.map(s => s.url);

    this.logger.log(`Watching ${targets.length} HTTP services for domain ${domain}`);

    return this.probe({ targets, options });
  }

  /**
   * Get services with detected changes
   * @returns Services with changes
   */
  async getChangedServices(): Promise<HttpServiceDocument[]> {
    return this.httpServiceModel.find({
      $or: [
        { statusCodeChanged: true },
        { titleChanged: true },
        { techChanged: true },
      ],
    }).sort({ scannedAt: -1 }).exec();
  }

  /**
   * Clear change flags for a service
   * @param url URL of the service
   */
  async clearChangeFlags(url: string): Promise<void> {
    await this.httpServiceModel.updateOne(
      { url },
      {
        $set: {
          statusCodeChanged: false,
          titleChanged: false,
          techChanged: false,
        },
      },
    );
  }

  /**
   * Clear all change flags
   */
  async clearAllChangeFlags(): Promise<number> {
    const result = await this.httpServiceModel.updateMany(
      {
        $or: [
          { statusCodeChanged: true },
          { titleChanged: true },
          { techChanged: true },
        ],
      },
      {
        $set: {
          statusCodeChanged: false,
          titleChanged: false,
          techChanged: false,
        },
      },
    );

    return result.modifiedCount;
  }

  /**
   * Extract root domain from subdomain
   * @param subdomain Subdomain string
   * @returns Root domain
   */
  private extractDomain(subdomain: string): string {
    const parts = subdomain.toLowerCase().split('.');
    if (parts.length <= 2) {
      return subdomain.toLowerCase();
    }
    // Return last two parts as domain
    return parts.slice(-2).join('.');
  }
}
