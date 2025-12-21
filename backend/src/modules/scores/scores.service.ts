import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Score,
  ScoreDocument,
  ScoreTargetType,
  ExploitabilityBreakdown,
  HistoricalBreakdown,
  ProgramQualityBreakdown,
  CompetitionBreakdown,
  AttackSurfaceBreakdown,
  PenetrationBreakdown,
  FullScoreBreakdown,
} from '../../schemas/score.schema';
import { Program, ProgramDocument } from '../../schemas/program.schema';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { Subdomain, SubdomainDocument } from '../../schemas/subdomain.schema';
import { Live, LiveDocument } from '../../schemas/live.schema';
import { HttpService, HttpServiceDocument } from '../../schemas/http-service.schema';
import { Vulnerability, VulnerabilityDocument, Severity } from '../../schemas/vulnerability.schema';
import { Scope, ScopeDocument } from '../../schemas/scope.schema';

export interface ScoreCalculationResult {
  exploitabilityScore: number;
  historicalScore: number;
  programQualityScore: number;
  competitionScore: number;
  attackSurfaceScore: number;
  pentestScore: number;
  exposureScore: number;
  priorityScore: number;
  totalScore: number;
  tier: string;
  confidence: number;
  breakdown: FullScoreBreakdown;
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
  dataAvailability: {
    hasVulnerabilityData: boolean;
    hasSubdomainData: boolean;
    hasHttpServiceData: boolean;
    hasTechnologyData: boolean;
    hasBountyData: boolean;
    hasHistoricalData: boolean;
  };
}

// CVE database simulation - technologies with known high CVE counts
const CVE_RISK_MAP: Record<string, number> = {
  'wordpress': 95,
  'drupal': 85,
  'joomla': 80,
  'apache struts': 90,
  'apache tomcat': 75,
  'jenkins': 85,
  'gitlab': 70,
  'grafana': 65,
  'elasticsearch': 70,
  'kibana': 65,
  'confluence': 80,
  'jira': 75,
  'apache': 60,
  'nginx': 40,
  'iis': 55,
  'php': 70,
  'asp.net': 50,
  'java': 60,
  'spring': 65,
  'laravel': 45,
  'django': 40,
  'ruby on rails': 55,
  'node.js': 50,
  'express': 45,
  'mongodb': 55,
  'mysql': 50,
  'postgresql': 40,
  'redis': 45,
  'memcached': 50,
  'docker': 45,
  'kubernetes': 50,
  'exchange': 85,
  'sharepoint': 80,
  'oracle': 70,
  'weblogic': 85,
  'websphere': 75,
  'coldfusion': 80,
  'adobe': 75,
  'jquery': 35,
  'bootstrap': 20,
  'react': 25,
  'angular': 30,
  'vue': 25,
};

// Technologies with public exploits available
const PUBLIC_EXPLOIT_TECH = [
  'wordpress', 'drupal', 'joomla', 'apache struts', 'jenkins',
  'confluence', 'jira', 'exchange', 'sharepoint', 'weblogic',
  'coldfusion', 'gitlab', 'grafana', 'elasticsearch', 'kibana',
  'apache tomcat', 'oracle', 'websphere', 'php', 'java',
];

// Legacy/outdated technologies
const OUTDATED_TECH = [
  'php/5', 'php/4', 'apache/2.2', 'apache/2.0', 'nginx/1.0',
  'nginx/1.1', 'tomcat/6', 'tomcat/7', 'java/1.6', 'java/1.7',
  'jquery/1', 'jquery/2', 'angular/1', 'asp.net/2', 'asp.net/3',
  'iis/6', 'iis/7', 'mysql/5.0', 'mysql/5.1', 'wordpress/3',
  'wordpress/4', 'drupal/6', 'drupal/7',
];

@Injectable()
export class ScoresService {
  private readonly logger = new Logger(ScoresService.name);

  constructor(
    @InjectModel(Score.name) private scoreModel: Model<ScoreDocument>,
    @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    @InjectModel(Subdomain.name) private subdomainModel: Model<SubdomainDocument>,
    @InjectModel(Live.name) private liveModel: Model<LiveDocument>,
    @InjectModel(HttpService.name) private httpServiceModel: Model<HttpServiceDocument>,
    @InjectModel(Vulnerability.name) private vulnModel: Model<VulnerabilityDocument>,
    @InjectModel(Scope.name) private scopeModel: Model<ScopeDocument>,
  ) {}

  // Calculate scores daily at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledScoreCalculation() {
    this.logger.log('Starting scheduled score calculation');
    await this.calculateAllScores();
  }

  async calculateAllScores(): Promise<{ programs: number; domains: number }> {
    let programCount = 0;
    let domainCount = 0;

    try {
      // Calculate scores for all active programs
      const programs = await this.programModel.find({ isActive: true });
      for (const program of programs) {
        try {
          await this.calculateProgramScore(program._id.toString());
          programCount++;
        } catch (err: any) {
          this.logger.warn(`Failed to score program ${program.name}: ${err.message}`);
        }
      }

      // Calculate scores for all active domains
      const domains = await this.domainModel.find({ isActive: true });
      for (const domain of domains) {
        try {
          await this.calculateDomainScore(domain._id.toString());
          domainCount++;
        } catch (err: any) {
          this.logger.warn(`Failed to score domain ${domain.domain}: ${err.message}`);
        }
      }

      this.logger.log(`Calculated scores for ${programCount} programs and ${domainCount} domains`);
    } catch (error: any) {
      this.logger.error(`Score calculation failed: ${error.message}`);
    }

    return { programs: programCount, domains: domainCount };
  }

  async calculateProgramScore(programId: string): Promise<ScoreDocument> {
    const program = await this.programModel.findById(programId);
    if (!program) {
      throw new NotFoundException('Program not found');
    }

    // Get all domains for this program
    const domains = await this.domainModel.find({ programId: new Types.ObjectId(programId) });
    const domainIds = domains.map(d => d._id);
    const domainNames = domains.map(d => d.domain);

    // Get all scopes for this program
    const scopes = await this.scopeModel.find({ programId: new Types.ObjectId(programId) });

    // Get aggregated stats in parallel
    const [
      subdomains,
      liveHosts,
      httpServices,
      vulnerabilities,
      recentVulns,
    ] = await Promise.all([
      this.subdomainModel.find({ domainId: { $in: domainIds } }),
      this.liveModel.find({ domain: { $in: domainNames } }),
      this.httpServiceModel.find({ domain: { $in: domainNames } }),
      this.vulnModel.find({ programId: new Types.ObjectId(programId) }),
      this.vulnModel.find({
        programId: new Types.ObjectId(programId),
        createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    // Calculate all score components
    const result = this.calculateFullScore({
      program,
      domains,
      scopes,
      subdomains,
      liveHosts,
      httpServices,
      vulnerabilities,
      recentVulns,
    });

    // Save and return score
    return this.saveScore({
      targetId: new Types.ObjectId(programId),
      targetType: ScoreTargetType.PROGRAM,
      targetName: program.name,
      ...result,
    });
  }

  async calculateDomainScore(domainId: string): Promise<ScoreDocument> {
    const domain = await this.domainModel.findById(domainId);
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    // Get program for this domain
    const program = domain.programId
      ? await this.programModel.findById(domain.programId)
      : null;

    // Get all data for this domain
    const [subdomains, liveHosts, httpServices, vulnerabilities, recentVulns] =
      await Promise.all([
        this.subdomainModel.find({ domainId: new Types.ObjectId(domainId) }),
        this.liveModel.find({ domain: domain.domain }),
        this.httpServiceModel.find({ domain: domain.domain }),
        this.vulnModel.find({ targetId: new Types.ObjectId(domainId) }),
        this.vulnModel.find({
          targetId: new Types.ObjectId(domainId),
          createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        }),
      ]);

    // Calculate score
    const result = this.calculateFullScore({
      program,
      domains: [domain],
      scopes: [],
      subdomains,
      liveHosts,
      httpServices,
      vulnerabilities,
      recentVulns,
    });

    return this.saveScore({
      targetId: new Types.ObjectId(domainId),
      targetType: ScoreTargetType.DOMAIN,
      targetName: domain.domain,
      ...result,
    });
  }

  private calculateFullScore(data: {
    program: ProgramDocument | null;
    domains: DomainDocument[];
    scopes: ScopeDocument[];
    subdomains: SubdomainDocument[];
    liveHosts: LiveDocument[];
    httpServices: HttpServiceDocument[];
    vulnerabilities: VulnerabilityDocument[];
    recentVulns: VulnerabilityDocument[];
  }): ScoreCalculationResult {
    // Extract all technologies
    const allTechnologies = this.extractTechnologies(data.httpServices);

    // Calculate individual score components
    const exploitability = this.calculateExploitability(allTechnologies, data.httpServices);
    const historical = this.calculateHistorical(data.vulnerabilities, data.recentVulns);
    const programQuality = this.calculateProgramQuality(data.program, data.scopes, data.domains);
    const competition = this.calculateCompetition(data.subdomains, data.liveHosts, data.domains);
    const attackSurface = this.calculateAttackSurface(data.subdomains, data.liveHosts, data.httpServices);
    const penetration = this.calculatePenetration(allTechnologies, data.httpServices, data.vulnerabilities);

    // Build full breakdown
    const breakdown: FullScoreBreakdown = {
      exploitability,
      historical,
      programQuality,
      competition,
      attackSurface,
      penetration,
    };

    // Calculate weighted total score
    // Weights: Exploitability 25%, Historical 20%, Program Quality 15%, 
    //          Competition 10%, Attack Surface 15%, Penetration 15%
    const totalScore = Math.round(
      (exploitability.total * 0.25) +
      (historical.total * 0.20) +
      (programQuality.total * 0.15) +
      (competition.total * 0.10) +
      (attackSurface.total * 0.15) +
      (penetration.total * 0.15)
    );

    // Calculate tier (S/A/B/C/D/F)
    const tier = this.calculateTier(totalScore);

    // Calculate confidence based on data availability
    const dataAvailability = {
      hasVulnerabilityData: data.vulnerabilities.length > 0,
      hasSubdomainData: data.subdomains.length > 0,
      hasHttpServiceData: data.httpServices.length > 0,
      hasTechnologyData: allTechnologies.size > 0,
      hasBountyData: !!(data.program?.bountyRange?.max),
      hasHistoricalData: data.vulnerabilities.length >= 3,
    };
    const confidence = this.calculateConfidence(dataAvailability);

    // Generate recommendations, strengths, and weaknesses
    const { recommendations, strengths, weaknesses } = this.generateInsights(
      breakdown,
      data.program,
      totalScore,
    );

    // Legacy scores for backward compatibility
    const exposureScore = attackSurface.total;
    const priorityScore = Math.round((programQuality.total + exploitability.total) / 2);

    return {
      exploitabilityScore: exploitability.total,
      historicalScore: historical.total,
      programQualityScore: programQuality.total,
      competitionScore: competition.total,
      attackSurfaceScore: attackSurface.total,
      pentestScore: penetration.total,
      exposureScore,
      priorityScore,
      totalScore,
      tier,
      confidence,
      breakdown,
      recommendations,
      strengths,
      weaknesses,
      dataAvailability,
    };
  }

  private extractTechnologies(httpServices: HttpServiceDocument[]): Set<string> {
    const technologies = new Set<string>();
    for (const service of httpServices) {
      if (service.technologies && Array.isArray(service.technologies)) {
        for (const tech of service.technologies) {
          technologies.add(tech.toLowerCase());
        }
      }
    }
    return technologies;
  }

  private calculateExploitability(
    technologies: Set<string>,
    httpServices: HttpServiceDocument[],
  ): ExploitabilityBreakdown {
    let cveCount = 0;
    let publicExploits = 0;
    let attackComplexity = 50; // Base complexity
    let techStackAge = 0;
    let authBypass = 0;

    const techArray = Array.from(technologies);

    // Calculate CVE risk score
    for (const tech of techArray) {
      for (const [riskTech, score] of Object.entries(CVE_RISK_MAP)) {
        if (tech.includes(riskTech)) {
          cveCount += score / 10;
        }
      }
    }
    cveCount = Math.min(100, cveCount);

    // Check for public exploits
    for (const tech of techArray) {
      if (PUBLIC_EXPLOIT_TECH.some(pe => tech.includes(pe))) {
        publicExploits += 15;
      }
    }
    publicExploits = Math.min(100, publicExploits);

    // Attack complexity based on tech stack
    const hasWAF = techArray.some(t => 
      t.includes('cloudflare') || t.includes('akamai') || t.includes('incapsula') ||
      t.includes('sucuri') || t.includes('imperva') || t.includes('modsecurity')
    );
    if (hasWAF) attackComplexity -= 20;
    
    const hasOldTech = techArray.some(t => OUTDATED_TECH.some(ot => t.includes(ot)));
    if (hasOldTech) attackComplexity += 30;
    
    attackComplexity = Math.max(0, Math.min(100, attackComplexity));

    // Tech stack age
    for (const tech of techArray) {
      if (OUTDATED_TECH.some(ot => tech.includes(ot))) {
        techStackAge += 20;
      }
    }
    techStackAge = Math.min(100, techStackAge);

    // Auth bypass potential
    for (const service of httpServices) {
      if (service.statusCode === 401 || service.statusCode === 403) {
        authBypass += 10;
      }
    }
    authBypass = Math.min(100, authBypass);

    const total = Math.round(
      (cveCount * 0.30) +
      (publicExploits * 0.25) +
      (attackComplexity * 0.20) +
      (techStackAge * 0.15) +
      (authBypass * 0.10)
    );

    return {
      cveCount: Math.round(cveCount),
      publicExploits: Math.round(publicExploits),
      attackComplexity: Math.round(attackComplexity),
      techStackAge: Math.round(techStackAge),
      authBypass: Math.round(authBypass),
      total: Math.min(100, total),
    };
  }

  private calculateHistorical(
    allVulns: VulnerabilityDocument[],
    recentVulns: VulnerabilityDocument[],
  ): HistoricalBreakdown {
    let pastVulnsCritical = 0;
    let pastVulnsHigh = 0;
    let pastVulnsMedium = 0;
    let pastVulnsLow = 0;
    let vulnCategories = 0;
    let recurringPatterns = 0;
    let daysSinceLastVuln = 0;
    let successRate = 0;

    // Count vulns by severity
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    const vulnTypes = new Set<string>();
    const vulnTypeCount: Record<string, number> = {};

    for (const vuln of allVulns) {
      const severity = vuln.severity?.toLowerCase() || 'info';
      severityCounts[severity as keyof typeof severityCounts]++;
      
      if (vuln.type) {
        vulnTypes.add(vuln.type);
        vulnTypeCount[vuln.type] = (vulnTypeCount[vuln.type] || 0) + 1;
      }
    }

    // Score based on severity (critical findings = high exploitability)
    pastVulnsCritical = Math.min(100, severityCounts.critical * 25);
    pastVulnsHigh = Math.min(100, severityCounts.high * 15);
    pastVulnsMedium = Math.min(100, severityCounts.medium * 8);
    pastVulnsLow = Math.min(100, severityCounts.low * 3);

    // Vulnerability category diversity
    vulnCategories = Math.min(100, vulnTypes.size * 12);

    // Recurring patterns (same type appearing multiple times = easier to find more)
    for (const count of Object.values(vulnTypeCount)) {
      if (count >= 3) recurringPatterns += 20;
      else if (count >= 2) recurringPatterns += 10;
    }
    recurringPatterns = Math.min(100, recurringPatterns);

    // Days since last vuln (recent = active program, more to find)
    if (recentVulns.length > 0) {
      const latestVuln = recentVulns.reduce((latest, v) => {
        const vCreatedAt = (v as any).createdAt;
        const latestCreatedAt = (latest as any).createdAt;
        return vCreatedAt > latestCreatedAt ? v : latest;
      });
      const days = Math.floor(
        (Date.now() - new Date((latestVuln as any).createdAt).getTime()) / (24 * 60 * 60 * 1000)
      );
      if (days <= 7) daysSinceLastVuln = 100;
      else if (days <= 30) daysSinceLastVuln = 80;
      else if (days <= 60) daysSinceLastVuln = 50;
      else if (days <= 90) daysSinceLastVuln = 30;
      else daysSinceLastVuln = 10;
    }

    // Success rate
    const confirmedVulns = allVulns.filter(v => 
      v.status === 'confirmed' || v.status === 'reported' || v.status === 'fixed'
    ).length;
    const falsePositives = allVulns.filter(v => v.status === 'false_positive').length;
    if (allVulns.length > 0) {
      successRate = Math.round((confirmedVulns / (confirmedVulns + falsePositives || 1)) * 100);
    }

    const total = Math.round(
      (pastVulnsCritical * 0.25) +
      (pastVulnsHigh * 0.20) +
      (pastVulnsMedium * 0.10) +
      (pastVulnsLow * 0.05) +
      (vulnCategories * 0.15) +
      (recurringPatterns * 0.10) +
      (daysSinceLastVuln * 0.10) +
      (successRate * 0.05)
    );

    return {
      pastVulnsCritical: Math.round(pastVulnsCritical),
      pastVulnsHigh: Math.round(pastVulnsHigh),
      pastVulnsMedium: Math.round(pastVulnsMedium),
      pastVulnsLow: Math.round(pastVulnsLow),
      vulnCategories: Math.round(vulnCategories),
      recurringPatterns: Math.round(recurringPatterns),
      daysSinceLastVuln: Math.round(daysSinceLastVuln),
      successRate: Math.round(successRate),
      total: Math.min(100, total),
    };
  }

  private calculateProgramQuality(
    program: ProgramDocument | null,
    scopes: ScopeDocument[],
    domains: DomainDocument[],
  ): ProgramQualityBreakdown {
    let bountyMin = 0;
    let bountyMax = 0;
    let bountyAverage = 0;
    let responseTime = 50; // Default neutral
    let resolutionRate = 50;
    let programAge = 50;
    let scopeSize = 0;
    let wildcards = 0;

    if (program) {
      // Bounty scoring
      const minBounty = program.bountyRange?.min || 0;
      const maxBounty = program.bountyRange?.max || 0;
      
      bountyMin = Math.min(100, (minBounty / 100) * 10);
      bountyMax = Math.min(100, (maxBounty / 5000) * 100);
      bountyAverage = Math.round((bountyMin + bountyMax) / 2);

      // Program age scoring
      if (program.firstSyncedAt) {
        const ageInDays = Math.floor(
          (Date.now() - new Date(program.firstSyncedAt).getTime()) / (24 * 60 * 60 * 1000)
        );
        if (ageInDays > 365) programAge = 80;
        else if (ageInDays > 180) programAge = 60;
        else if (ageInDays > 90) programAge = 40;
        else programAge = 20;
      }

      // Check if offers bounties
      if (program.offersBounties) {
        bountyMin = Math.max(bountyMin, 30);
      }
    }

    // Scope size scoring
    const inScopeCount = scopes.filter(s => s.status === 'in_scope' || s.eligibility?.isEligible).length;
    const domainCount = domains.length;
    scopeSize = Math.min(100, ((inScopeCount + domainCount) / 20) * 100);

    // Wildcard scoring (more opportunity)
    const wildcardScopes = scopes.filter(s => 
      s.target?.startsWith('*.') || s.target?.includes('*') || s.type === 'wildcard'
    );
    wildcards = Math.min(100, wildcardScopes.length * 20);

    const total = Math.round(
      (bountyMax * 0.30) +
      (bountyMin * 0.10) +
      (responseTime * 0.15) +
      (resolutionRate * 0.10) +
      (programAge * 0.10) +
      (scopeSize * 0.15) +
      (wildcards * 0.10)
    );

    return {
      bountyMin: Math.round(bountyMin),
      bountyMax: Math.round(bountyMax),
      bountyAverage: Math.round(bountyAverage),
      responseTime: Math.round(responseTime),
      resolutionRate: Math.round(resolutionRate),
      programAge: Math.round(programAge),
      scopeSize: Math.round(scopeSize),
      wildcards: Math.round(wildcards),
      total: Math.min(100, total),
    };
  }

  private calculateCompetition(
    subdomains: SubdomainDocument[],
    liveHosts: LiveDocument[],
    domains: DomainDocument[],
  ): CompetitionBreakdown {
    let scopeCoverage = 0;
    let activityLevel = 0;
    let scopeFreshness = 0;
    let uniqueAssets = 0;

    // Calculate coverage (scanned vs total)
    const totalAssets = domains.length + subdomains.length;
    const scannedAssets = liveHosts.length;
    if (totalAssets > 0) {
      // Lower coverage = more opportunity = higher score
      scopeCoverage = Math.max(0, 100 - Math.round((scannedAssets / totalAssets) * 100));
    } else {
      scopeCoverage = 100; // No data = unexplored = high opportunity
    }

    // Activity level (fresh assets discovered recently)
    const recentAssets = subdomains.filter(s => {
      const createdAt = (s as any).createdAt;
      if (!createdAt) return false;
      const age = Date.now() - new Date(createdAt).getTime();
      return age < 30 * 24 * 60 * 60 * 1000; // 30 days
    }).length;
    activityLevel = Math.min(100, (recentAssets / 10) * 100);

    // Scope freshness
    const freshDomains = domains.filter(d => {
      const createdAt = (d as any).createdAt;
      if (!createdAt) return false;
      const age = Date.now() - new Date(createdAt).getTime();
      return age < 60 * 24 * 60 * 60 * 1000; // 60 days
    }).length;
    if (domains.length > 0) {
      scopeFreshness = Math.round((freshDomains / domains.length) * 100);
    }

    // Unique/unexplored assets (not yet scanned/alive)
    const unexploredSubdomains = subdomains.filter(s => !s.isAlive).length;
    if (subdomains.length > 0) {
      uniqueAssets = Math.round((unexploredSubdomains / subdomains.length) * 100);
    } else {
      uniqueAssets = 80; // No subdomains = unexplored
    }

    const total = Math.round(
      (scopeCoverage * 0.30) +
      (activityLevel * 0.25) +
      (scopeFreshness * 0.25) +
      (uniqueAssets * 0.20)
    );

    return {
      scopeCoverage: Math.round(scopeCoverage),
      activityLevel: Math.round(activityLevel),
      scopeFreshness: Math.round(scopeFreshness),
      uniqueAssets: Math.round(uniqueAssets),
      total: Math.min(100, total),
    };
  }

  private calculateAttackSurface(
    subdomains: SubdomainDocument[],
    liveHosts: LiveDocument[],
    httpServices: HttpServiceDocument[],
  ): AttackSurfaceBreakdown {
    const subdomainCount = Math.min(100, (subdomains.length / 500) * 100);
    const liveHostCount = Math.min(100, (liveHosts.length / 100) * 100);
    const httpServiceCount = Math.min(100, (httpServices.length / 50) * 100);
    let openPortCount = 0;
    let endpointCount = 0;
    let apiEndpoints = 0;
    let adminPanels = 0;
    let loginPages = 0;
    let fileUploads = 0;

    // Analyze HTTP services for interesting endpoints
    for (const service of httpServices) {
      const url = (service.url || '').toLowerCase();
      const title = (service.title || '').toLowerCase();

      if (url.includes('/api') || url.includes('/v1') || url.includes('/v2') || 
          url.includes('/graphql') || url.includes('/rest')) {
        apiEndpoints += 10;
      }

      if (url.includes('/admin') || url.includes('/manager') || url.includes('/dashboard') ||
          title.includes('admin') || title.includes('dashboard') || title.includes('control panel')) {
        adminPanels += 15;
      }

      if (url.includes('/login') || url.includes('/signin') || url.includes('/auth') ||
          title.includes('login') || title.includes('sign in')) {
        loginPages += 10;
      }

      if (url.includes('/upload') || url.includes('/import') || title.includes('upload')) {
        fileUploads += 20;
      }
    }

    apiEndpoints = Math.min(100, apiEndpoints);
    adminPanels = Math.min(100, adminPanels);
    loginPages = Math.min(100, loginPages);
    fileUploads = Math.min(100, fileUploads);

    const total = Math.round(
      (subdomainCount * 0.20) +
      (liveHostCount * 0.20) +
      (httpServiceCount * 0.15) +
      (apiEndpoints * 0.15) +
      (adminPanels * 0.10) +
      (loginPages * 0.10) +
      (fileUploads * 0.10)
    );

    return {
      subdomainCount: Math.round(subdomainCount),
      liveHostCount: Math.round(liveHostCount),
      httpServiceCount: Math.round(httpServiceCount),
      openPortCount: Math.round(openPortCount),
      endpointCount: Math.round(endpointCount),
      apiEndpoints: Math.round(apiEndpoints),
      adminPanels: Math.round(adminPanels),
      loginPages: Math.round(loginPages),
      fileUploads: Math.round(fileUploads),
      total: Math.min(100, total),
    };
  }

  private calculatePenetration(
    technologies: Set<string>,
    httpServices: HttpServiceDocument[],
    vulnerabilities: VulnerabilityDocument[],
  ): PenetrationBreakdown {
    const techArray = Array.from(technologies);
    
    // Exposed services
    const highRiskTech = ['wordpress', 'drupal', 'joomla', 'jenkins', 'gitlab', 'grafana',
      'kibana', 'elasticsearch', 'phpmyadmin', 'adminer', 'tomcat', 'weblogic'];
    let exposedServices = 0;
    for (const tech of techArray) {
      if (highRiskTech.some(hr => tech.includes(hr))) {
        exposedServices += 15;
      }
    }
    exposedServices = Math.min(100, exposedServices);

    // Outdated tech
    let outdatedTech = 0;
    for (const tech of techArray) {
      if (OUTDATED_TECH.some(ot => tech.includes(ot))) {
        outdatedTech += 20;
      }
    }
    outdatedTech = Math.min(100, outdatedTech);

    // Known vulns
    const knownVulns = Math.min(100, vulnerabilities.length * 8);

    // Misconfigurations (based on status codes and headers)
    let misconfigurations = 0;
    for (const service of httpServices) {
      if ([403, 401, 500, 502, 503].includes(service.statusCode)) {
        misconfigurations += 5;
      }
      // Would check headers for security misconfigs here
    }
    misconfigurations = Math.min(100, misconfigurations);

    // Auth mechanisms
    let authMechanisms = 0;
    const authRelated = ['ntlm', 'basic', 'digest', 'oauth', 'saml', 'jwt', 'bearer'];
    for (const tech of techArray) {
      if (authRelated.some(a => tech.includes(a))) {
        authMechanisms += 12;
      }
    }
    authMechanisms = Math.min(100, authMechanisms);

    // Sensitive exposure
    let sensitiveExposure = 0;
    for (const service of httpServices) {
      const url = (service.url || '').toLowerCase();
      if (url.includes('.git') || url.includes('.env') || url.includes('.bak') ||
          url.includes('backup') || url.includes('config') || url.includes('.sql')) {
        sensitiveExposure += 25;
      }
    }
    sensitiveExposure = Math.min(100, sensitiveExposure);

    const total = Math.round(
      (exposedServices * 0.25) +
      (outdatedTech * 0.20) +
      (knownVulns * 0.20) +
      (misconfigurations * 0.15) +
      (authMechanisms * 0.10) +
      (sensitiveExposure * 0.10)
    );

    return {
      exposedServices: Math.round(exposedServices),
      outdatedTech: Math.round(outdatedTech),
      knownVulns: Math.round(knownVulns),
      misconfigurations: Math.round(misconfigurations),
      authMechanisms: Math.round(authMechanisms),
      sensitiveExposure: Math.round(sensitiveExposure),
      total: Math.min(100, total),
    };
  }

  private calculateTier(totalScore: number): string {
    if (totalScore >= 90) return 'S';
    if (totalScore >= 80) return 'A';
    if (totalScore >= 65) return 'B';
    if (totalScore >= 50) return 'C';
    if (totalScore >= 35) return 'D';
    return 'F';
  }

  private calculateConfidence(dataAvailability: {
    hasVulnerabilityData: boolean;
    hasSubdomainData: boolean;
    hasHttpServiceData: boolean;
    hasTechnologyData: boolean;
    hasBountyData: boolean;
    hasHistoricalData: boolean;
  }): number {
    let confidence = 0;
    if (dataAvailability.hasVulnerabilityData) confidence += 20;
    if (dataAvailability.hasSubdomainData) confidence += 20;
    if (dataAvailability.hasHttpServiceData) confidence += 20;
    if (dataAvailability.hasTechnologyData) confidence += 15;
    if (dataAvailability.hasBountyData) confidence += 10;
    if (dataAvailability.hasHistoricalData) confidence += 15;
    return confidence;
  }

  private generateInsights(
    breakdown: FullScoreBreakdown,
    program: ProgramDocument | null,
    totalScore: number,
  ): { recommendations: string[]; strengths: string[]; weaknesses: string[] } {
    const recommendations: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Analyze exploitability
    if (breakdown.exploitability.total >= 70) {
      strengths.push('High exploitability - many known vulnerabilities in tech stack');
    }
    if (breakdown.exploitability.publicExploits >= 60) {
      recommendations.push('Check for public exploits against detected technologies');
    }
    if (breakdown.exploitability.techStackAge >= 60) {
      strengths.push('Outdated technology stack increases vulnerability likelihood');
    }

    // Analyze historical
    if (breakdown.historical.pastVulnsCritical >= 50) {
      strengths.push('Previous critical vulnerabilities found - high-value target');
    }
    if (breakdown.historical.recurringPatterns >= 50) {
      recommendations.push('Recurring vulnerability patterns detected - look for similar issues');
    }
    if (breakdown.historical.total < 20) {
      weaknesses.push('Limited historical vulnerability data');
    }

    // Analyze program quality
    if (breakdown.programQuality.bountyMax >= 70) {
      strengths.push('High bounty payouts - valuable program');
    }
    if (breakdown.programQuality.wildcards >= 60) {
      recommendations.push('Wildcard domains available - extensive subdomain enumeration recommended');
    }
    if (breakdown.programQuality.bountyMax < 20 && !program?.offersBounties) {
      weaknesses.push('No bounties offered or low payout');
    }

    // Analyze attack surface
    if (breakdown.attackSurface.adminPanels >= 50) {
      recommendations.push('Admin panels detected - check for authentication bypasses');
    }
    if (breakdown.attackSurface.apiEndpoints >= 50) {
      recommendations.push('API endpoints found - test for authorization issues');
    }
    if (breakdown.attackSurface.fileUploads >= 50) {
      recommendations.push('File upload functionality detected - test for unrestricted uploads');
    }
    if (breakdown.attackSurface.total >= 70) {
      strengths.push('Large attack surface with multiple entry points');
    }

    // Analyze competition
    if (breakdown.competition.scopeCoverage >= 70) {
      strengths.push('Low scope coverage - unexplored areas remain');
    }
    if (breakdown.competition.scopeFreshness >= 60) {
      recommendations.push('Fresh assets added recently - check new scope items');
    }

    // Analyze penetration
    if (breakdown.penetration.exposedServices >= 60) {
      strengths.push('High-risk services exposed (CMS, dev tools, etc.)');
    }
    if (breakdown.penetration.sensitiveExposure >= 40) {
      recommendations.push('Potential sensitive file exposure - check for .git, .env, backups');
    }

    // General recommendations based on total score
    if (totalScore >= 80) {
      recommendations.push('High-priority target - allocate significant testing time');
    } else if (totalScore >= 60) {
      recommendations.push('Good target - balanced testing effort recommended');
    } else if (totalScore < 40) {
      recommendations.push('Lower priority - consider focusing on higher-scored programs first');
    }

    return { recommendations, strengths, weaknesses };
  }

  // ========== Query Methods ==========

  async getScore(targetId: string, targetType: ScoreTargetType): Promise<ScoreDocument | null> {
    return this.scoreModel.findOne({
      targetId: new Types.ObjectId(targetId),
      targetType,
    });
  }

  async getTopScores(
    targetType: ScoreTargetType,
    limit = 20,
    sortBy = 'totalScore',
  ): Promise<ScoreDocument[]> {
    const validSortFields = [
      'totalScore', 'exploitabilityScore', 'historicalScore',
      'programQualityScore', 'competitionScore', 'attackSurfaceScore', 'pentestScore',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'totalScore';

    return this.scoreModel
      .find({ targetType })
      .sort({ [sortField]: -1 })
      .limit(limit)
      .exec();
  }

  async compareScores(targetIds: string[], targetType: ScoreTargetType): Promise<ScoreDocument[]> {
    return this.scoreModel
      .find({
        targetId: { $in: targetIds.map(id => new Types.ObjectId(id)) },
        targetType,
      })
      .exec();
  }

  async getScoreHistory(targetId: string, targetType: ScoreTargetType, days = 30): Promise<any[]> {
    const score = await this.scoreModel.findOne({
      targetId: new Types.ObjectId(targetId),
      targetType,
    });

    if (!score) {
      return [];
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return score.history.filter(h => h.date >= cutoff);
  }

  async getScoresByTier(tier: string): Promise<ScoreDocument[]> {
    return this.scoreModel.find({ tier: tier.toUpperCase() }).sort({ totalScore: -1 }).exec();
  }

  async getScoreStats(): Promise<{
    totalPrograms: number;
    totalDomains: number;
    avgScore: number;
    tierDistribution: Record<string, number>;
  }> {
    const programs = await this.scoreModel.countDocuments({ targetType: ScoreTargetType.PROGRAM });
    const domains = await this.scoreModel.countDocuments({ targetType: ScoreTargetType.DOMAIN });
    
    const avgResult = await this.scoreModel.aggregate([
      { $group: { _id: null, avg: { $avg: '$totalScore' } } },
    ]);
    const avgScore = avgResult[0]?.avg || 0;

    const tierAgg = await this.scoreModel.aggregate([
      { $group: { _id: '$tier', count: { $sum: 1 } } },
    ]);
    const tierDistribution: Record<string, number> = {};
    for (const item of tierAgg) {
      tierDistribution[item._id] = item.count;
    }

    return {
      totalPrograms: programs,
      totalDomains: domains,
      avgScore: Math.round(avgScore),
      tierDistribution,
    };
  }

  // ========== Save Score ==========

  private async saveScore(data: {
    targetId: Types.ObjectId;
    targetType: ScoreTargetType;
    targetName: string;
  } & ScoreCalculationResult): Promise<ScoreDocument> {
    const existing = await this.scoreModel.findOne({
      targetId: data.targetId,
      targetType: data.targetType,
    });

    const historyEntry = {
      date: new Date(),
      exploitabilityScore: data.exploitabilityScore,
      historicalScore: data.historicalScore,
      programQualityScore: data.programQualityScore,
      competitionScore: data.competitionScore,
      attackSurfaceScore: data.attackSurfaceScore,
      pentestScore: data.pentestScore,
      totalScore: data.totalScore,
      tier: data.tier,
    };

    if (existing) {
      // Update existing score
      existing.exploitabilityScore = data.exploitabilityScore;
      existing.historicalScore = data.historicalScore;
      existing.programQualityScore = data.programQualityScore;
      existing.competitionScore = data.competitionScore;
      existing.attackSurfaceScore = data.attackSurfaceScore;
      existing.pentestScore = data.pentestScore;
      existing.exposureScore = data.exposureScore;
      existing.priorityScore = data.priorityScore;
      existing.totalScore = data.totalScore;
      existing.tier = data.tier;
      existing.confidence = data.confidence;
      existing.breakdown = data.breakdown;
      existing.recommendations = data.recommendations;
      existing.strengths = data.strengths;
      existing.weaknesses = data.weaknesses;
      existing.dataAvailability = data.dataAvailability;
      existing.calculatedAt = new Date();

      // Add to history (keep last 90 days)
      existing.history.push(historyEntry);
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      existing.history = existing.history.filter(h => h.date >= cutoff);

      return existing.save();
    }

    // Create new score
    return this.scoreModel.create({
      ...data,
      history: [historyEntry],
      calculatedAt: new Date(),
    });
  }
}
