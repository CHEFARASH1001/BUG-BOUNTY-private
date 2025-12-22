import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ReconService } from '../recon/recon.service';
import { DomainsService } from '../domains/domains.service';
import { SubdomainsService } from '../subdomains/subdomains.service';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { Subdomain, SubdomainDocument } from '../../schemas/subdomain.schema';
import { Live, LiveDocument } from '../../schemas/live.schema';
import { Program, ProgramDocument } from '../../schemas/program.schema';
import { Scope, ScopeDocument, ScopeStatus } from '../../schemas/scope.schema';

const execAsync = promisify(exec);

export interface WatchResult {
  command: string;
  domain?: string;
  success: boolean;
  message: string;
  results?: any;
  duration: number;
  timestamp: Date;
}

// Watchtower CLI interfaces
export interface CLIQueryOptions {
  format: 'json' | 'table';
  compare?: boolean;
  filter?: Record<string, any>;
}

export interface SingleTargetResult {
  program: string;
  programId: string;
  domains: string[];
  subdomainCount: number;
  liveCount: number;
  lastScanAt: Date | null;
  scope: {
    inScope: string[];
    outOfScope: string[];
  };
}

export interface HTTPQueryResult {
  url: string;
  status: number;
  title: string;
  technologies: string[];
  changed: boolean;
  changeDetails?: {
    statusChanged: boolean;
    titleChanged: boolean;
    techChanged: boolean;
    previousStatus?: number;
    previousTitle?: string;
  };
}

export interface LivesQueryResult {
  subdomain: string;
  ip: string[];
  status: number | null;
  title: string | null;
  discoveredAt: Date;
  isNew: boolean;
  hasChanged: boolean;
}

@Injectable()
export class CliService {
  private readonly logger = new Logger(CliService.name);
  private readonly resultsDir = '/app/results';

  constructor(
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    @InjectModel(Subdomain.name) private subdomainModel: Model<SubdomainDocument>,
    @InjectModel(Live.name) private liveModel: Model<LiveDocument>,
    @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
    @InjectModel(Scope.name) private scopeModel: Model<ScopeDocument>,
    private reconService: ReconService,
    private domainsService: DomainsService,
    private subdomainsService: SubdomainsService,
  ) {}

  /**
   * Debug method to check domain-subdomain relationships
   */
  async debugDomainSubdomains(): Promise<any> {
    // Get sample domains
    const domains = await this.domainModel.find({}).limit(5);
    const domainSamples = [];

    for (const domain of domains) {
      const byId = await this.subdomainModel.countDocuments({ domainId: domain._id });
      const bySuffix = await this.subdomainModel.countDocuments({
        subdomain: { $regex: new RegExp(`\\.${domain.domain.replace(/\./g, '\\.')}$`, 'i') },
      });
      domainSamples.push({
        domain: domain.domain,
        domainId: domain._id,
        subdomainsByDomainId: byId,
        subdomainsBySuffix: bySuffix,
      });
    }

    // Get sample subdomains
    const subdomains = await this.subdomainModel.find({}).limit(10);
    const subdomainSamples = subdomains.map((s) => ({
      subdomain: s.subdomain,
      domainId: s.domainId,
      hasDomainId: !!s.domainId,
    }));

    // Get total counts
    const totalDomains = await this.domainModel.countDocuments({});
    const totalSubdomains = await this.subdomainModel.countDocuments({});
    const subdomainsWithDomainId = await this.subdomainModel.countDocuments({
      domainId: { $exists: true, $ne: null },
    });

    return {
      totalDomains,
      totalSubdomains,
      subdomainsWithDomainId,
      subdomainsWithoutDomainId: totalSubdomains - subdomainsWithDomainId,
      domainSamples,
      subdomainSamples,
    };
  }

  /**
   * Test live detection for a domain with detailed diagnostics
   */
  async testLiveDetection(domain: string): Promise<any> {
    const domainDoc = await this.domainModel.findOne({ domain: domain.toLowerCase() });
    
    if (!domainDoc) {
      return { error: `Domain ${domain} not found in database` };
    }

    const escapedDomain = domain.replace(/\./g, '\\.');
    
    // Test different query methods
    const byDomainId = await this.subdomainModel.find({ domainId: domainDoc._id }).limit(10);
    const bySuffixRegex = await this.subdomainModel.find({
      subdomain: { $regex: new RegExp(`\\.${escapedDomain}$`, 'i') },
    }).limit(10);
    const byExactMatch = await this.subdomainModel.findOne({ subdomain: domain.toLowerCase() });
    const byContains = await this.subdomainModel.find({
      subdomain: { $regex: new RegExp(escapedDomain, 'i') },
    }).limit(10);

    // Get counts
    const countByDomainId = await this.subdomainModel.countDocuments({ domainId: domainDoc._id });
    const countBySuffix = await this.subdomainModel.countDocuments({
      subdomain: { $regex: new RegExp(`\\.${escapedDomain}$`, 'i') },
    });
    const countByContains = await this.subdomainModel.countDocuments({
      subdomain: { $regex: new RegExp(escapedDomain, 'i') },
    });

    // Get sample subdomains from DB
    const sampleSubdomains = await this.subdomainModel.find({}).limit(5);

    return {
      domain,
      domainId: domainDoc._id,
      counts: {
        byDomainId: countByDomainId,
        bySuffix: countBySuffix,
        byContains: countByContains,
      },
      samples: {
        byDomainId: byDomainId.map(s => s.subdomain),
        bySuffixRegex: bySuffixRegex.map(s => s.subdomain),
        byExactMatch: byExactMatch?.subdomain || null,
        byContains: byContains.map(s => s.subdomain),
      },
      regexUsed: `\\.${escapedDomain}$`,
      sampleSubdomainsInDb: sampleSubdomains.map(s => ({
        subdomain: s.subdomain,
        domainId: s.domainId?.toString(),
      })),
    };
  }

  /**
   * Run subfinder for a specific domain
   * Equivalent to: watch_subfinder <domain>
   */
  async watchSubfinder(domain: string): Promise<WatchResult> {
    const startTime = Date.now();
    const source = 'subfinder';
    this.logger.log(`Starting subfinder for domain: ${domain}`);

    try {
      // Extract root domain if subdomain is passed (e.g., www.example.com -> example.com)
      const rootDomain = this.extractRootDomain(domain);
      
      // Run subfinder via Docker or directly
      const { subdomains, toolAvailable } = await this.runSubfinderCommand(rootDomain);
      
      if (!toolAvailable) {
        return {
          command: 'watch_subfinder',
          domain,
          success: false,
          message: 'Subfinder not available. Install it with: go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest',
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }
      
      // Find or create domain in database
      let domainDoc = await this.domainModel.findOne({ domain: domain.toLowerCase() });
      
      if (!domainDoc) {
        this.logger.log(`Domain ${domain} not found in database, creating...`);
        domainDoc = await this.domainModel.create({
          domain: domain.toLowerCase(),
          status: 'pending',
          subdomainCount: 0,
        });
      }

      // Save subdomains to database with source tracking
      let created = 0;
      let updated = 0;
      
      for (const subdomain of subdomains) {
        try {
          const existing = await this.subdomainModel.findOne({
            subdomain: subdomain.toLowerCase(),
          });

          if (existing) {
            // Add source if not already present
            const sources = existing.sources || [];
            if (!sources.includes(source)) {
              sources.push(source);
            }
            await this.subdomainModel.updateOne(
              { _id: existing._id },
              { 
                $set: { 
                  lastSeen: new Date(), 
                  isNew: false,
                  sources,
                } 
              },
            );
            updated++;
          } else {
            await this.subdomainModel.create({
              subdomain: subdomain.toLowerCase(),
              domainId: domainDoc._id,
              firstSeen: new Date(),
              lastSeen: new Date(),
              isNew: true,
              isAlive: false,
              sources: [source],
            });
            created++;
          }
        } catch (e: any) {
          if (!e.message?.includes('duplicate')) {
            this.logger.warn(`Failed to save subdomain ${subdomain}: ${e.message}`);
          }
        }
      }

      // Update domain subdomain count
      const totalCount = await this.subdomainModel.countDocuments({
        domainId: domainDoc._id,
      });
      await this.domainModel.findByIdAndUpdate(domainDoc._id, {
        subdomainCount: totalCount,
      });

      const duration = Date.now() - startTime;
      
      return {
        command: 'watch_subfinder',
        domain,
        success: true,
        message: `Found ${subdomains.length} subdomains (${created} new, ${updated} updated)`,
        results: {
          total: subdomains.length,
          created,
          updated,
          source,
          subdomains: subdomains.slice(0, 50),
        },
        duration,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(`Subfinder failed for ${domain}: ${error.message}`);
      
      return {
        command: 'watch_subfinder',
        domain,
        success: false,
        message: `Subfinder failed: ${error.message}`,
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run crt.sh lookup for a domain
   * Equivalent to: watch_crtsh <domain>
   */
  async watchCrtsh(domain: string): Promise<WatchResult> {
    const startTime = Date.now();
    const source = 'crtsh';
    this.logger.log(`Starting crt.sh lookup for domain: ${domain}`);

    try {
      const rootDomain = this.extractRootDomain(domain);
      const subdomains = await this.runCrtshQuery(rootDomain);
      
      let domainDoc = await this.domainModel.findOne({ domain: domain.toLowerCase() });
      if (!domainDoc) {
        domainDoc = await this.domainModel.create({
          domain: domain.toLowerCase(),
          status: 'pending',
          subdomainCount: 0,
        });
      }

      let created = 0;
      let updated = 0;
      for (const subdomain of subdomains) {
        try {
          const existing = await this.subdomainModel.findOne({
            subdomain: subdomain.toLowerCase(),
          });
          if (existing) {
            const sources = existing.sources || [];
            if (!sources.includes(source)) {
              sources.push(source);
            }
            await this.subdomainModel.updateOne(
              { _id: existing._id },
              { $set: { lastSeen: new Date(), sources } },
            );
            updated++;
          } else {
            await this.subdomainModel.create({
              subdomain: subdomain.toLowerCase(),
              domainId: domainDoc._id,
              firstSeen: new Date(),
              lastSeen: new Date(),
              isNew: true,
              isAlive: false,
              sources: [source],
            });
            created++;
          }
        } catch (e: any) {
          // Ignore duplicates
        }
      }

      const duration = Date.now() - startTime;
      
      return {
        command: 'watch_crtsh',
        domain,
        success: true,
        message: `Found ${subdomains.length} subdomains from crt.sh (${created} new, ${updated} updated)`,
        results: {
          total: subdomains.length,
          created,
          updated,
          source,
          subdomains: subdomains.slice(0, 50),
        },
        duration,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        command: 'watch_crtsh',
        domain,
        success: false,
        message: `crt.sh lookup failed: ${error.message}`,
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run DNS resolution for a domain's subdomains
   * Equivalent to: watch_ns <domain>
   */
  async watchNs(domain: string): Promise<WatchResult> {
    const startTime = Date.now();
    this.logger.log(`Starting DNS resolution for domain: ${domain}`);

    try {
      const domainDoc = await this.domainModel.findOne({ domain: domain.toLowerCase() });
      if (!domainDoc) {
        return {
          command: 'watch_ns',
          domain,
          success: false,
          message: `Domain ${domain} not found in database`,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      const subdomains = await this.subdomainModel.find({ domainId: domainDoc._id });
      const subdomainNames = subdomains.map(s => s.subdomain);
      
      let resolved = 0;
      let failed = 0;
      const dns = require('dns').promises;

      for (const subdomain of subdomainNames) {
        try {
          const addresses = await dns.resolve(subdomain);
          await this.subdomainModel.updateOne(
            { subdomain },
            { 
              $set: { 
                isAlive: true, 
                ipAddresses: addresses,
                lastSeen: new Date(),
              } 
            },
          );
          
          // Create or update live record
          await this.liveModel.updateOne(
            { subdomain },
            {
              $set: {
                subdomain,
                ip: addresses[0],
                isAlive: true,
                isFresh: true,
                resolvedAt: new Date(),
              },
            },
            { upsert: true },
          );
          
          resolved++;
        } catch (e) {
          await this.subdomainModel.updateOne(
            { subdomain },
            { $set: { isAlive: false } },
          );
          failed++;
        }
      }

      const duration = Date.now() - startTime;
      
      return {
        command: 'watch_ns',
        domain,
        success: true,
        message: `DNS resolution complete: ${resolved} alive, ${failed} dead`,
        results: {
          total: subdomainNames.length,
          resolved,
          failed,
        },
        duration,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        command: 'watch_ns',
        domain,
        success: false,
        message: `DNS resolution failed: ${error.message}`,
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run HTTP probing for a domain
   * Equivalent to: watch_http <domain>
   */
  async watchHttp(domain: string): Promise<WatchResult> {
    const startTime = Date.now();
    this.logger.log(`Starting HTTP probing for domain: ${domain}`);

    try {
      const domainDoc = await this.domainModel.findOne({ domain: domain.toLowerCase() });
      if (!domainDoc) {
        return {
          command: 'watch_http',
          domain,
          success: false,
          message: `Domain ${domain} not found in database`,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // Get alive subdomains
      const aliveSubdomains = await this.subdomainModel.find({
        domainId: domainDoc._id,
        isAlive: true,
      });

      // Create map for quick lookup
      const subdomainToId = new Map<string, any>();
      for (const sub of aliveSubdomains) {
        subdomainToId.set(sub.subdomain.toLowerCase(), sub._id);
      }

      const hosts = aliveSubdomains.map(s => s.subdomain);
      const probeResults = await this.reconService.probeHttp(hosts);

      let probed = 0;
      for (const result of probeResults) {
        try {
          const subdomainLower = result.subdomain.toLowerCase();
          const subdomainId = subdomainToId.get(subdomainLower);
          
          // Update subdomain document with HTTP data
          if (subdomainId) {
            await this.subdomainModel.updateOne(
              { _id: subdomainId },
              {
                $set: {
                  httpStatus: result.statusCode,
                  title: result.title,
                  technologies: result.technologies || [],
                  contentLength: result.contentLength,
                  contentType: result.contentType,
                  headers: result.headers,
                  webServer: result.webServer,
                  faviconHash: result.faviconHash,
                  lastSeen: new Date(),
                },
              },
            );
            probed++;
          }
        } catch (e: any) {
          this.logger.warn(`Failed to update subdomain ${result.subdomain}: ${e.message}`);
        }
      }

      const duration = Date.now() - startTime;
      
      return {
        command: 'watch_http',
        domain,
        success: true,
        message: `HTTP probing complete: ${probed} subdomains updated`,
        results: {
          total: hosts.length,
          probed,
          services: probeResults.slice(0, 20),
        },
        duration,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        command: 'watch_http',
        domain,
        success: false,
        message: `HTTP probing failed: ${error.message}`,
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run DNS resolution for all subdomains
   * Equivalent to: watch_ns_all
   */
  async watchNsAll(): Promise<WatchResult> {
    const startTime = Date.now();
    this.logger.log('Starting DNS resolution for all subdomains...');

    try {
      const subdomains = await this.subdomainModel.find({}).limit(1000);
      
      if (subdomains.length === 0) {
        return {
          command: 'watch_ns_all',
          success: false,
          message: 'No subdomains found in database',
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      let resolved = 0;
      let failed = 0;
      const dns = require('dns').promises;

      for (const sub of subdomains) {
        try {
          const addresses = await dns.resolve(sub.subdomain);
          await this.subdomainModel.updateOne(
            { _id: sub._id },
            { $set: { isAlive: true, ipAddresses: addresses, lastSeen: new Date() } },
          );
          resolved++;
        } catch (e) {
          await this.subdomainModel.updateOne(
            { _id: sub._id },
            { $set: { isAlive: false } },
          );
          failed++;
        }
      }

      const duration = Date.now() - startTime;
      
      return {
        command: 'watch_ns_all',
        success: true,
        message: `DNS resolution complete: ${resolved} alive, ${failed} dead out of ${subdomains.length}`,
        results: {
          total: subdomains.length,
          resolved,
          failed,
        },
        duration,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        command: 'watch_ns_all',
        success: false,
        message: `DNS resolution failed: ${error.message}`,
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run live subdomain detection using dnsx for a domain
   * Equivalent to: watch_live <domain>
   * Uses: dnsx -l {subdomains_file} -silent -wd {domain} -resp -json -a -aaaa -cname -cdn
   * Falls back to Node.js DNS if dnsx is not available
   */
  async watchLive(domain: string): Promise<WatchResult> {
    const startTime = Date.now();
    this.logger.log(`Starting live detection for domain: ${domain}`);

    try {
      const domainDoc = await this.domainModel
        .findOne({ domain: domain.toLowerCase() })
        .populate('programId');
      if (!domainDoc) {
        return {
          command: 'watch_live',
          domain,
          success: false,
          message: `Domain ${domain} not found in database`,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // Try to find subdomains by domainId first
      let subdomains = await this.subdomainModel.find({ domainId: domainDoc._id });

      // If no subdomains found by domainId, try to find by domain suffix pattern
      if (subdomains.length === 0) {
        // Match subdomains ending with .domain.com OR exact domain match
        const escapedDomain = domain.replace(/\./g, '\\.');
        subdomains = await this.subdomainModel.find({
          $or: [
            { subdomain: { $regex: new RegExp(`\\.${escapedDomain}$`, 'i') } },
            { subdomain: domain.toLowerCase() },
          ],
        }).limit(5000);
        
        this.logger.debug(`Found ${subdomains.length} subdomains by suffix match for ${domain}`);
        
        // If still no subdomains, try a more permissive match (contains domain)
        if (subdomains.length === 0) {
          this.logger.log(`No suffix match found for ${domain}, trying contains match...`);
          subdomains = await this.subdomainModel.find({
            subdomain: { $regex: new RegExp(`${escapedDomain}`, 'i') },
          }).limit(5000);
          this.logger.debug(`Found ${subdomains.length} subdomains by contains match for ${domain}`);
        }
      }

      if (subdomains.length === 0) {
        return {
          command: 'watch_live',
          domain,
          success: false,
          message: `No subdomains found for ${domain}. Run enumeration first.`,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      const subdomainNames = subdomains.map((s) => s.subdomain);
      this.logger.log(`Found ${subdomainNames.length} subdomains for ${domain}`);

      // Try dnsx first, fallback to Node.js DNS
      let { results, toolAvailable } = await this.runDnsxCommand(subdomainNames, domain);

      if (!toolAvailable) {
        this.logger.warn('dnsx not available, falling back to Node.js DNS resolver');
        results = await this.runNodeDnsResolve(subdomainNames);
      }

      const usedProvider = toolAvailable ? 'dnsx' : 'node-dns';
      this.logger.log(`Resolved ${results.length} live subdomains using ${usedProvider}`);

      let created = 0;
      let updated = 0;
      const newLives: string[] = [];

      for (const result of results) {
        try {
          const existing = await this.liveModel.findOne({
            subdomain: result.subdomain.toLowerCase(),
          });
          const isNew = !existing;

          await this.liveModel.updateOne(
            { subdomain: result.subdomain.toLowerCase() },
            {
              $setOnInsert: {
                subdomain: result.subdomain.toLowerCase(),
                domain: domain.toLowerCase(),
                programId: domainDoc.programId,
                firstSeen: new Date(),
              },
              $set: {
                ip: result.a || [],
                cname: result.cname || [],
                isCdn: result.cdn || false,
                cdnProvider: result.cdnName ? [result.cdnName] : [],
                provider: usedProvider,
                isFresh: true,
                lastSeen: new Date(),
                resolvedAt: new Date(),
                dnsRecords: {
                  a: result.a,
                  aaaa: result.aaaa,
                  cname: result.cname,
                },
              },
            },
            { upsert: true },
          );

          // Update subdomain record
          await this.subdomainModel.updateOne(
            { subdomain: result.subdomain.toLowerCase() },
            {
              $set: {
                isAlive: true,
                ip: result.a || [],
                cname: result.cname || [],
                cdn: result.cdnName ? [result.cdnName] : [],
                lastSeen: new Date(),
              },
            },
          );

          if (isNew) {
            created++;
            newLives.push(result.subdomain);
          } else {
            updated++;
          }
        } catch (e: any) {
          this.logger.warn(`Failed to save live ${result.subdomain}: ${e.message}`);
        }
      }

      // Mark non-resolved subdomains as not alive
      const resolvedSubdomains = results.map((r) => r.subdomain.toLowerCase());
      const deadSubdomains = subdomainNames.filter(
        (s) => !resolvedSubdomains.includes(s.toLowerCase()),
      );
      if (deadSubdomains.length > 0) {
        await this.subdomainModel.updateMany(
          { subdomain: { $in: deadSubdomains } },
          { $set: { isAlive: false } },
        );
      }

      const duration = Date.now() - startTime;

      return {
        command: 'watch_live',
        domain,
        success: true,
        message: `Live detection complete: ${results.length} alive (${created} new, ${updated} updated), ${deadSubdomains.length} dead`,
        results: {
          total: subdomainNames.length,
          alive: results.length,
          dead: deadSubdomains.length,
          created,
          updated,
          newLives: newLives.slice(0, 20),
          provider: usedProvider,
        },
        duration,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        command: 'watch_live',
        domain,
        success: false,
        message: `Live detection failed: ${error.message}`,
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Repair orphaned subdomains by linking them to their parent domains
   * This fixes subdomains that were created without proper domainId references
   */
  async repairSubdomainLinks(): Promise<WatchResult> {
    const startTime = Date.now();
    this.logger.log('Starting subdomain link repair...');

    try {
      const domains = await this.domainModel.find({});
      let totalFixed = 0;
      let totalOrphaned = 0;

      for (const domain of domains) {
        const escapedDomain = domain.domain.replace(/\./g, '\\.');
        
        // Find subdomains that match this domain but have wrong/missing domainId
        const orphanedSubdomains = await this.subdomainModel.find({
          $and: [
            {
              $or: [
                { subdomain: { $regex: new RegExp(`\\.${escapedDomain}$`, 'i') } },
                { subdomain: domain.domain.toLowerCase() },
              ],
            },
            { domainId: { $ne: domain._id } },
          ],
        });

        if (orphanedSubdomains.length > 0) {
          this.logger.log(`Found ${orphanedSubdomains.length} orphaned subdomains for ${domain.domain}`);
          totalOrphaned += orphanedSubdomains.length;

          // Update them with correct domainId
          const result = await this.subdomainModel.updateMany(
            {
              $and: [
                {
                  $or: [
                    { subdomain: { $regex: new RegExp(`\\.${escapedDomain}$`, 'i') } },
                    { subdomain: domain.domain.toLowerCase() },
                  ],
                },
                { domainId: { $ne: domain._id } },
              ],
            },
            { $set: { domainId: domain._id } },
          );
          totalFixed += result.modifiedCount;
        }

        // Update domain subdomain count
        const count = await this.subdomainModel.countDocuments({ domainId: domain._id });
        await this.domainModel.findByIdAndUpdate(domain._id, { subdomainCount: count });
      }

      const duration = Date.now() - startTime;
      return {
        command: 'repair_subdomain_links',
        success: true,
        message: `Repaired ${totalFixed} orphaned subdomains across ${domains.length} domains`,
        results: {
          domainsProcessed: domains.length,
          orphanedFound: totalOrphaned,
          fixed: totalFixed,
        },
        duration,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        command: 'repair_subdomain_links',
        success: false,
        message: `Repair failed: ${error.message}`,
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run live subdomain detection for all domains
   * Equivalent to: watch_live_all
   */
  async watchLiveAll(): Promise<WatchResult> {
    const startTime = Date.now();
    this.logger.log('Starting live detection for all domains...');

    try {
      // Only get domains that have subdomains (subdomainCount > 0)
      const domains = await this.domainModel
        .find({ subdomainCount: { $gt: 0 } })
        .sort({ subdomainCount: -1 })
        .limit(100);

      if (domains.length === 0) {
        // Fallback: try to find any domains and check if they have subdomains via query
        this.logger.log('No domains with subdomainCount > 0, trying fallback...');
        const allDomains = await this.domainModel.find({}).limit(100);
        
        if (allDomains.length === 0) {
          return {
            command: 'watch_live_all',
            success: false,
            message: 'No domains found in database',
            duration: Date.now() - startTime,
            timestamp: new Date(),
          };
        }
        
        // Check which domains actually have subdomains
        const domainsWithSubs = [];
        for (const d of allDomains) {
          const count = await this.subdomainModel.countDocuments({ domainId: d._id });
          if (count > 0) {
            domainsWithSubs.push(d);
          }
        }
        
        if (domainsWithSubs.length === 0) {
          return {
            command: 'watch_live_all',
            success: false,
            message: 'No domains with subdomains found. Run enumeration first.',
            duration: Date.now() - startTime,
            timestamp: new Date(),
          };
        }
        
        // Use the domains that have subdomains
        domains.length = 0;
        domains.push(...domainsWithSubs);
      }

      this.logger.log(`Found ${domains.length} domains with subdomains to process`);

      // Check total subdomains first
      const totalSubdomains = await this.subdomainModel.countDocuments({});
      this.logger.log(`Total subdomains in database: ${totalSubdomains}`);

      if (totalSubdomains === 0) {
        return {
          command: 'watch_live_all',
          success: false,
          message: 'No subdomains found in database. Run watch_subfinder_all first.',
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      let totalAlive = 0;
      let totalDead = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let domainsWithSubdomains = 0;
      const allNewLives: string[] = [];
      const failedDomains: string[] = [];

      for (const domain of domains) {
        try {
          const result = await this.watchLive(domain.domain);
          if (result.success && result.results) {
            totalAlive += result.results.alive || 0;
            totalDead += result.results.dead || 0;
            totalCreated += result.results.created || 0;
            totalUpdated += result.results.updated || 0;
            domainsWithSubdomains++;
            if (result.results.newLives) {
              allNewLives.push(...result.results.newLives);
            }
          } else {
            failedDomains.push(`${domain.domain}: ${result.message}`);
          }
        } catch (e: any) {
          this.logger.warn(`Failed live detection for ${domain.domain}: ${e.message}`);
          failedDomains.push(`${domain.domain}: ${e.message}`);
        }
      }

      // Log first few failures for debugging
      if (failedDomains.length > 0) {
        this.logger.log(`Failed domains (first 5): ${failedDomains.slice(0, 5).join(' | ')}`);
      }

      const duration = Date.now() - startTime;

      return {
        command: 'watch_live_all',
        success: true,
        message: `Live detection complete for ${domainsWithSubdomains}/${domains.length} domains: ${totalAlive} alive (${totalCreated} new), ${totalDead} dead`,
        results: {
          domainsProcessed: domains.length,
          domainsWithSubdomains,
          totalAlive,
          totalDead,
          totalCreated,
          totalUpdated,
          newLives: allNewLives.slice(0, 50),
        },
        duration,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        command: 'watch_live_all',
        success: false,
        message: `Live detection failed: ${error.message}`,
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run HTTP probing for all alive hosts
   * Equivalent to: watch_http_all
   * Updates the subdomains collection with HTTP response data
   */
  async watchHttpAll(): Promise<WatchResult> {
    const startTime = Date.now();
    this.logger.log('Starting HTTP probing for all alive hosts...');

    try {
      const aliveSubdomains = await this.subdomainModel.find({ isAlive: true })
        .populate('domainId', 'domain')
        .limit(500);
      
      if (aliveSubdomains.length === 0) {
        return {
          command: 'watch_http_all',
          success: false,
          message: 'No alive subdomains found. Run DNS resolution first.',
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // Create maps for quick lookup
      const subdomainToId = new Map<string, any>();
      for (const sub of aliveSubdomains) {
        subdomainToId.set(sub.subdomain.toLowerCase(), sub._id);
      }

      const hosts = aliveSubdomains.map(s => s.subdomain);
      const probeResults = await this.reconService.probeHttp(hosts);

      let probed = 0;
      for (const result of probeResults) {
        try {
          const subdomainLower = result.subdomain.toLowerCase();
          const subdomainId = subdomainToId.get(subdomainLower);
          
          // Update subdomain document with HTTP data
          if (subdomainId) {
            await this.subdomainModel.updateOne(
              { _id: subdomainId },
              {
                $set: {
                  httpStatus: result.statusCode,
                  title: result.title,
                  technologies: result.technologies || [],
                  contentLength: result.contentLength,
                  contentType: result.contentType,
                  headers: result.headers,
                  webServer: result.webServer,
                  faviconHash: result.faviconHash,
                  lastSeen: new Date(),
                },
              },
            );
            probed++;
          }
        } catch (e) {
          // Ignore errors
        }
      }

      const duration = Date.now() - startTime;
      
      return {
        command: 'watch_http_all',
        success: true,
        message: `HTTP probing complete: ${probed} subdomains updated from ${hosts.length} hosts`,
        results: {
          hostsChecked: hosts.length,
          subdomainsUpdated: probed,
        },
        duration,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        command: 'watch_http_all',
        success: false,
        message: `HTTP probing failed: ${error.message}`,
        duration,
        timestamp: new Date(),
      };
    }
  }

  // Helper methods

  private extractRootDomain(domain: string): string {
    // Remove www. prefix and extract root domain
    let d = domain.toLowerCase().replace(/^www\./, '');
    
    // Simple extraction - get last 2 parts (or 3 for co.uk, com.au, etc.)
    const parts = d.split('.');
    if (parts.length <= 2) return d;
    
    // Check for common second-level TLDs
    const secondLevelTlds = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];
    if (parts.length >= 3 && secondLevelTlds.includes(parts[parts.length - 2])) {
      return parts.slice(-3).join('.');
    }
    
    return parts.slice(-2).join('.');
  }

  private async runSubfinderCommand(domain: string): Promise<{ subdomains: string[]; toolAvailable: boolean }> {
    try {
      // Try Docker first
      const outputFile = path.join(this.resultsDir, `subfinder-${uuidv4()}.txt`);
      
      try {
        // Ensure results directory exists
        await fs.mkdir(this.resultsDir, { recursive: true }).catch(() => {});
        
        const { stdout, stderr } = await execAsync(
          `docker exec bb-subfinder subfinder -d ${domain} -all -silent`,
          { timeout: 300000 },
        );
        
        if (stderr && stderr.includes('Error')) {
          this.logger.warn(`Subfinder stderr: ${stderr}`);
        }
        
        const subdomains = stdout.split('\n').map(s => s.trim()).filter(Boolean);
        return { subdomains, toolAvailable: true };
      } catch (dockerError: any) {
        // Check if it's a "container not found" error
        if (dockerError.message?.includes('No such container') || 
            dockerError.message?.includes('not found')) {
          this.logger.warn('Docker subfinder container not found, trying direct command...');
        } else {
          this.logger.warn(`Docker subfinder error: ${dockerError.message}`);
        }
        
        // Fallback to direct command if Docker fails
        try {
          const { stdout } = await execAsync(
            `subfinder -d ${domain} -all -silent`,
            { timeout: 300000 },
          );
          
          const subdomains = stdout.split('\n').map(s => s.trim()).filter(Boolean);
          return { subdomains, toolAvailable: true };
        } catch (directError: any) {
          // Check if subfinder is not installed
          if (directError.message?.includes('not found') || 
              directError.message?.includes('ENOENT') ||
              directError.code === 127) {
            this.logger.error('Subfinder not installed');
            return { subdomains: [], toolAvailable: false };
          }
          throw directError;
        }
      }
    } catch (error: any) {
      this.logger.error(`Subfinder command failed: ${error.message}`);
      return { subdomains: [], toolAvailable: false };
    }
  }

  private async runCrtshQuery(domain: string): Promise<string[]> {
    const https = require('https');
    
    return new Promise((resolve, reject) => {
      const url = `https://crt.sh/?q=%25.${domain}&output=json`;
      
      https.get(url, { timeout: 30000 }, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const subdomains = new Set<string>();
            
            for (const cert of json) {
              const names = cert.name_value?.split('\n') || [];
              names.forEach((name: string) => {
                const clean = name.replace('*.', '').trim().toLowerCase();
                if (clean.endsWith(domain) && !clean.includes('*')) {
                  subdomains.add(clean);
                }
              });
            }
            
            resolve(Array.from(subdomains));
          } catch (e) {
            reject(new Error('Failed to parse crt.sh response'));
          }
        });
      }).on('error', reject);
    });
  }

  private async runDnsxCommand(
    subdomains: string[],
    domain: string,
  ): Promise<{ results: { subdomain: string; a?: string[]; aaaa?: string[]; cname?: string[]; cdn?: boolean; cdnName?: string }[]; toolAvailable: boolean }> {
    interface DnsxResult {
      subdomain: string;
      a?: string[];
      aaaa?: string[];
      cname?: string[];
      cdn?: boolean;
      cdnName?: string;
    }

    try {
      // Create temp file with subdomains
      const tempFile = path.join(this.resultsDir, `dnsx-input-${uuidv4()}.txt`);
      await fs.mkdir(this.resultsDir, { recursive: true }).catch(() => {});
      await fs.writeFile(tempFile, subdomains.join('\n'));

      const resolvers = '8.8.4.4,129.250.35.251,208.67.222.222';
      const results: DnsxResult[] = [];

      try {
        // Try Docker first
        const { stdout } = await execAsync(
          `docker exec bb-dnsx dnsx -l /app/results/${path.basename(tempFile)} -silent -wd ${domain} -resp -json -a -aaaa -cname -cdn -r ${resolvers}`,
          { timeout: 300000, maxBuffer: 50 * 1024 * 1024 },
        );

        for (const line of stdout.split('\n').filter(Boolean)) {
          try {
            const json = JSON.parse(line);
            results.push({
              subdomain: json.host || json.name,
              a: json.a,
              aaaa: json.aaaa,
              cname: json.cname,
              cdn: json.cdn === 'true' || json.cdn === true,
              cdnName: json.cdn_name,
            });
          } catch {
            // Skip invalid JSON lines
          }
        }

        await fs.unlink(tempFile).catch(() => {});
        return { results, toolAvailable: true };
      } catch (dockerError: any) {
        // Fallback to direct command
        if (dockerError.message?.includes('No such container')) {
          this.logger.warn('Docker dnsx container not found, trying direct command...');
        }

        try {
          const { stdout } = await execAsync(
            `dnsx -l ${tempFile} -silent -wd ${domain} -resp -json -a -aaaa -cname -cdn -r ${resolvers}`,
            { timeout: 300000, maxBuffer: 50 * 1024 * 1024 },
          );

          for (const line of stdout.split('\n').filter(Boolean)) {
            try {
              const json = JSON.parse(line);
              results.push({
                subdomain: json.host || json.name,
                a: json.a,
                aaaa: json.aaaa,
                cname: json.cname,
                cdn: json.cdn === 'true' || json.cdn === true,
                cdnName: json.cdn_name,
              });
            } catch {
              // Skip invalid JSON lines
            }
          }

          await fs.unlink(tempFile).catch(() => {});
          return { results, toolAvailable: true };
        } catch (directError: any) {
          await fs.unlink(tempFile).catch(() => {});
          if (
            directError.message?.includes('not found') ||
            directError.message?.includes('ENOENT') ||
            directError.code === 127
          ) {
            return { results: [], toolAvailable: false };
          }
          throw directError;
        }
      }
    } catch (error: any) {
      this.logger.error(`dnsx command failed: ${error.message}`);
      return { results: [], toolAvailable: false };
    }
  }

  /**
   * Fallback DNS resolver using Node.js dns module
   * Used when dnsx is not available
   */
  private async runNodeDnsResolve(
    subdomains: string[],
  ): Promise<
    { subdomain: string; a?: string[]; aaaa?: string[]; cname?: string[]; cdn?: boolean; cdnName?: string }[]
  > {
    const dns = require('dns').promises;
    const results: {
      subdomain: string;
      a?: string[];
      aaaa?: string[];
      cname?: string[];
      cdn?: boolean;
      cdnName?: string;
    }[] = [];

    // CDN detection patterns
    const cdnPatterns: { pattern: RegExp; name: string }[] = [
      { pattern: /cloudflare/i, name: 'Cloudflare' },
      { pattern: /cloudfront/i, name: 'CloudFront' },
      { pattern: /akamai/i, name: 'Akamai' },
      { pattern: /fastly/i, name: 'Fastly' },
      { pattern: /incapsula/i, name: 'Incapsula' },
      { pattern: /sucuri/i, name: 'Sucuri' },
      { pattern: /stackpath/i, name: 'StackPath' },
      { pattern: /cdn77/i, name: 'CDN77' },
      { pattern: /azureedge/i, name: 'Azure CDN' },
      { pattern: /edgecast/i, name: 'Edgecast' },
    ];

    const detectCdn = (cnames: string[]): { isCdn: boolean; cdnName?: string } => {
      for (const cname of cnames) {
        for (const { pattern, name } of cdnPatterns) {
          if (pattern.test(cname)) {
            return { isCdn: true, cdnName: name };
          }
        }
      }
      return { isCdn: false };
    };

    // Process in batches to avoid overwhelming DNS
    const batchSize = 50;
    for (let i = 0; i < subdomains.length; i += batchSize) {
      const batch = subdomains.slice(i, i + batchSize);
      const promises = batch.map(async (subdomain) => {
        try {
          const [aRecords, cnameRecords] = await Promise.allSettled([
            dns.resolve4(subdomain),
            dns.resolveCname(subdomain),
          ]);

          const a = aRecords.status === 'fulfilled' ? aRecords.value : undefined;
          const cname = cnameRecords.status === 'fulfilled' ? cnameRecords.value : undefined;

          // Only include if we got at least A records
          if (a && a.length > 0) {
            const cdnInfo = cname ? detectCdn(cname) : { isCdn: false };
            return {
              subdomain,
              a,
              cname,
              cdn: cdnInfo.isCdn,
              cdnName: cdnInfo.cdnName,
            };
          }
          return null;
        } catch {
          return null;
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null));
    }

    return results;
  }

  // ==================== Watchtower CLI Methods ====================

  /**
   * Get single target information for a program
   * Equivalent to: watchtower get single target <program>
   * Requirements: 15.1, 15.2
   */
  async getSingleTarget(programName: string, options: CLIQueryOptions = { format: 'json' }): Promise<SingleTargetResult> {
    this.logger.log(`Getting single target info for program: ${programName}`);

    // Find program by name or handle (case-insensitive)
    const program = await this.programModel.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${programName}$`, 'i') } },
        { handle: { $regex: new RegExp(`^${programName}$`, 'i') } },
      ],
    });

    if (!program) {
      throw new NotFoundException(`Program not found: ${programName}`);
    }

    const programId = program._id;

    // Get all domains for this program
    const domains = await this.domainModel.find({ programId });
    const domainNames = domains.map(d => d.domain);
    const domainIds = domains.map(d => d._id);

    // Get subdomain count
    const subdomainCount = await this.subdomainModel.countDocuments({
      domainId: { $in: domainIds },
    });

    // Get live count
    const liveCount = await this.liveModel.countDocuments({
      programId,
    });

    // Get scope information
    const scopes = await this.scopeModel.find({ programId });
    const inScope = scopes
      .filter(s => s.status === ScopeStatus.IN_SCOPE)
      .map(s => s.target);
    const outOfScope = scopes
      .filter(s => s.status === ScopeStatus.OUT_OF_SCOPE)
      .map(s => s.target);

    // Get last scan timestamp
    const lastScannedDomain = await this.domainModel
      .findOne({ programId, lastScan: { $exists: true } })
      .sort({ lastScan: -1 });

    return {
      program: program.name,
      programId: programId.toString(),
      domains: domainNames,
      subdomainCount,
      liveCount,
      lastScanAt: lastScannedDomain?.lastScan || program.lastScannedAt || null,
      scope: {
        inScope,
        outOfScope,
      },
    };
  }

  /**
   * Get all HTTP services with optional filters
   * Equivalent to: watchtower get http all [--compare list]
   * Requirements: 16.1
   */
  async getHTTPAll(options: CLIQueryOptions = { format: 'json' }): Promise<HTTPQueryResult[]> {
    this.logger.log('Getting all HTTP services');

    const query: any = { isAlive: true };

    // Apply filters if provided
    if (options.filter) {
      if (options.filter.statusCode) {
        query.httpStatus = parseInt(options.filter.statusCode, 10);
      }
      if (options.filter.technology) {
        query.technologies = { $in: [options.filter.technology] };
      }
      if (options.filter.statusChanged !== undefined) {
        query.statusCodeChanged = options.filter.statusChanged;
      }
      if (options.filter.titleChanged !== undefined) {
        query.titleChanged = options.filter.titleChanged;
      }
      if (options.filter.techChanged !== undefined) {
        query.techChanged = options.filter.techChanged;
      }
    }

    const subdomains = await this.subdomainModel
      .find(query)
      .select('subdomain httpStatus title technologies statusCodeChanged titleChanged techChanged previousScan')
      .limit(1000)
      .exec();

    return subdomains.map(sub => {
      const hasChanges = !!(sub as any).statusCodeChanged || 
                         !!(sub as any).titleChanged || 
                         !!(sub as any).techChanged;

      const result: HTTPQueryResult = {
        url: `https://${sub.subdomain}`,
        status: sub.httpStatus || 0,
        title: sub.title || '',
        technologies: sub.technologies || [],
        changed: options.compare ? hasChanges : false,
      };

      // Include change details if compare mode is enabled and there are changes
      if (options.compare && hasChanges) {
        const previousScan = (sub as any).previousScan || {};
        result.changeDetails = {
          statusChanged: !!(sub as any).statusCodeChanged,
          titleChanged: !!(sub as any).titleChanged,
          techChanged: !!(sub as any).techChanged,
          previousStatus: previousScan.httpStatus,
          previousTitle: previousScan.title,
        };
      }

      return result;
    });
  }

  /**
   * Get HTTP services for a specific program
   * Requirements: 16.1
   */
  async getHTTPByProgram(programName: string, options: CLIQueryOptions = { format: 'json' }): Promise<HTTPQueryResult[]> {
    this.logger.log(`Getting HTTP services for program: ${programName}`);

    // Find program
    const program = await this.programModel.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${programName}$`, 'i') } },
        { handle: { $regex: new RegExp(`^${programName}$`, 'i') } },
      ],
    });

    if (!program) {
      throw new NotFoundException(`Program not found: ${programName}`);
    }

    // Get domains for this program
    const domains = await this.domainModel.find({ programId: program._id });
    const domainIds = domains.map(d => d._id);

    const query: any = { 
      domainId: { $in: domainIds },
      isAlive: true,
    };

    // Apply filters if provided
    if (options.filter) {
      if (options.filter.statusCode) {
        query.httpStatus = parseInt(options.filter.statusCode, 10);
      }
      if (options.filter.technology) {
        query.technologies = { $in: [options.filter.technology] };
      }
    }

    const subdomains = await this.subdomainModel
      .find(query)
      .select('subdomain httpStatus title technologies statusCodeChanged titleChanged techChanged previousScan')
      .limit(1000)
      .exec();

    return subdomains.map(sub => {
      const hasChanges = !!(sub as any).statusCodeChanged || 
                         !!(sub as any).titleChanged || 
                         !!(sub as any).techChanged;

      const result: HTTPQueryResult = {
        url: `https://${sub.subdomain}`,
        status: sub.httpStatus || 0,
        title: sub.title || '',
        technologies: sub.technologies || [],
        changed: options.compare ? hasChanges : false,
      };

      if (options.compare && hasChanges) {
        const previousScan = (sub as any).previousScan || {};
        result.changeDetails = {
          statusChanged: !!(sub as any).statusCodeChanged,
          titleChanged: !!(sub as any).titleChanged,
          techChanged: !!(sub as any).techChanged,
          previousStatus: previousScan.httpStatus,
          previousTitle: previousScan.title,
        };
      }

      return result;
    });
  }

  /**
   * Get live subdomains within scope for a program
   * Equivalent to: watchtower get lives scope <program> [--compare list]
   * Requirements: 17.1
   */
  async getLivesScope(programName: string, options: CLIQueryOptions = { format: 'json' }): Promise<LivesQueryResult[]> {
    this.logger.log(`Getting live subdomains in scope for program: ${programName}`);

    // Find program
    const program = await this.programModel.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${programName}$`, 'i') } },
        { handle: { $regex: new RegExp(`^${programName}$`, 'i') } },
      ],
    });

    if (!program) {
      throw new NotFoundException(`Program not found: ${programName}`);
    }

    // Get in-scope targets
    const inScopeTargets = await this.scopeModel.find({
      programId: program._id,
      status: ScopeStatus.IN_SCOPE,
    });

    // Get out-of-scope targets for filtering
    const outOfScopeTargets = await this.scopeModel.find({
      programId: program._id,
      status: ScopeStatus.OUT_OF_SCOPE,
    });

    // Build scope patterns for matching
    const inScopePatterns = inScopeTargets.map(s => {
      // Handle wildcard domains (*.example.com)
      if (s.target.startsWith('*.')) {
        const domain = s.target.slice(2);
        return new RegExp(`\\.${domain.replace(/\./g, '\\.')}$|^${domain.replace(/\./g, '\\.')}$`, 'i');
      }
      return new RegExp(`^${s.target.replace(/\./g, '\\.')}$`, 'i');
    });

    const outOfScopePatterns = outOfScopeTargets.map(s => {
      if (s.target.startsWith('*.')) {
        const domain = s.target.slice(2);
        return new RegExp(`\\.${domain.replace(/\./g, '\\.')}$|^${domain.replace(/\./g, '\\.')}$`, 'i');
      }
      return new RegExp(`^${s.target.replace(/\./g, '\\.')}$`, 'i');
    });

    // Get live subdomains for this program
    const lives = await this.liveModel.find({ programId: program._id });

    // Filter by scope
    const inScopeLives = lives.filter(live => {
      // Check if matches any in-scope pattern
      const isInScope = inScopePatterns.length === 0 || 
        inScopePatterns.some(pattern => pattern.test(live.subdomain));
      
      // Check if matches any out-of-scope pattern
      const isOutOfScope = outOfScopePatterns.some(pattern => pattern.test(live.subdomain));
      
      return isInScope && !isOutOfScope;
    });

    // Get corresponding subdomain data for HTTP info
    const subdomainNames = inScopeLives.map(l => l.subdomain);
    const subdomains = await this.subdomainModel.find({
      subdomain: { $in: subdomainNames },
    });

    const subdomainMap = new Map<string, SubdomainDocument>();
    subdomains.forEach(s => subdomainMap.set(s.subdomain.toLowerCase(), s));

    // Determine comparison window (24 hours by default)
    const comparisonWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Apply filters if provided
    let filteredLives = inScopeLives;
    if (options.filter) {
      if (options.filter.statusCode) {
        const statusCode = parseInt(options.filter.statusCode, 10);
        filteredLives = filteredLives.filter(live => {
          const sub = subdomainMap.get(live.subdomain.toLowerCase());
          return sub?.httpStatus === statusCode;
        });
      }
      if (options.filter.technology) {
        filteredLives = filteredLives.filter(live => {
          const sub = subdomainMap.get(live.subdomain.toLowerCase());
          return sub?.technologies?.includes(options.filter!.technology);
        });
      }
    }

    return filteredLives.map(live => {
      const sub = subdomainMap.get(live.subdomain.toLowerCase());
      const isNew = live.firstSeen && live.firstSeen > comparisonWindow;
      const hasChanged = !!(sub as any)?.statusCodeChanged || 
                         !!(sub as any)?.titleChanged || 
                         !!(sub as any)?.techChanged;

      return {
        subdomain: live.subdomain,
        ip: live.ip || [],
        status: sub?.httpStatus || null,
        title: sub?.title || null,
        discoveredAt: live.firstSeen || live.resolvedAt || new Date(),
        isNew: options.compare ? isNew : false,
        hasChanged: options.compare ? hasChanged : false,
      };
    });
  }

  /**
   * Format output for CLI display
   * Requirements: 15.4
   */
  formatOutput(data: any, format: 'json' | 'table'): string {
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // Table format
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return 'No results found.';
      }

      // Get column headers from first item
      const headers = Object.keys(data[0]);
      const columnWidths = headers.map(h => {
        const maxDataWidth = Math.max(...data.map(row => {
          const val = row[h];
          if (Array.isArray(val)) {
            return val.join(', ').length;
          }
          return String(val ?? '').length;
        }));
        return Math.max(h.length, maxDataWidth, 10);
      });

      // Build header row
      const headerRow = headers.map((h, i) => h.padEnd(columnWidths[i])).join(' | ');
      const separator = columnWidths.map(w => '-'.repeat(w)).join('-+-');

      // Build data rows
      const dataRows = data.map(row => {
        return headers.map((h, i) => {
          const val = row[h];
          let strVal: string;
          if (Array.isArray(val)) {
            strVal = val.join(', ');
          } else if (val === null || val === undefined) {
            strVal = '';
          } else if (val instanceof Date) {
            strVal = val.toISOString();
          } else {
            strVal = String(val);
          }
          return strVal.padEnd(columnWidths[i]);
        }).join(' | ');
      });

      return [headerRow, separator, ...dataRows].join('\n');
    }

    // Single object
    if (typeof data === 'object' && data !== null) {
      const lines: string[] = [];
      for (const [key, value] of Object.entries(data)) {
        let strVal: string;
        if (Array.isArray(value)) {
          strVal = value.length > 0 ? value.join(', ') : '(none)';
        } else if (value === null || value === undefined) {
          strVal = '(none)';
        } else if (value instanceof Date) {
          strVal = value.toISOString();
        } else if (typeof value === 'object') {
          strVal = JSON.stringify(value);
        } else {
          strVal = String(value);
        }
        lines.push(`${key}: ${strVal}`);
      }
      return lines.join('\n');
    }

    return String(data);
  }
}
