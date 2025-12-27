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
    hasTechnologyData: boolean;
    hasBountyData: boolean;
    hasHistoricalData: boolean;
    // Enriched data availability (Requirements 5.4)
    hasBountyTableData?: boolean;
    hasResponseMetricsData?: boolean;
    hasActivityStatsData?: boolean;
    hasScopeStatsData?: boolean;
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
      vulnerabilities,
      recentVulns,
    ] = await Promise.all([
      this.subdomainModel.find({ domainId: { $in: domainIds } }),
      this.liveModel.find({ domain: { $in: domainNames } }),
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
    const [subdomains, liveHosts, vulnerabilities, recentVulns] =
      await Promise.all([
        this.subdomainModel.find({ domainId: new Types.ObjectId(domainId) }),
        this.liveModel.find({ domain: domain.domain }),
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
    vulnerabilities: VulnerabilityDocument[];
    recentVulns: VulnerabilityDocument[];
  }): ScoreCalculationResult {
    // Extract all technologies from subdomains
    const allTechnologies = this.extractTechnologies(data.subdomains);

    // Calculate individual score components
    const exploitability = this.calculateExploitability(allTechnologies, data.subdomains);
    const historical = this.calculateHistorical(data.vulnerabilities, data.recentVulns, data.program);
    const programQuality = this.calculateProgramQuality(data.program, data.scopes, data.domains);
    const competition = this.calculateCompetition(data.subdomains, data.liveHosts, data.domains);
    const attackSurface = this.calculateAttackSurface(data.subdomains, data.liveHosts, data.program);
    const penetration = this.calculatePenetration(allTechnologies, data.subdomains, data.vulnerabilities);

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
    // Adjust weights based on data availability - give more weight to categories we have data for
    const hasReconData = data.subdomains.length > 0;
    
    let totalScore: number;
    if (hasReconData) {
      // Full weights when we have reconnaissance data
      // Weights: Exploitability 25%, Historical 20%, Program Quality 15%, 
      //          Competition 10%, Attack Surface 15%, Penetration 15%
      totalScore = Math.round(
        (exploitability.total * 0.25) +
        (historical.total * 0.20) +
        (programQuality.total * 0.15) +
        (competition.total * 0.10) +
        (attackSurface.total * 0.15) +
        (penetration.total * 0.15)
      );
    } else {
      // Adjusted weights when no recon data - emphasize program quality and competition
      // These are the categories we can score from platform sync data alone
      // Weights: Exploitability 10%, Historical 25%, Program Quality 35%, 
      //          Competition 20%, Attack Surface 5%, Penetration 5%
      totalScore = Math.round(
        (exploitability.total * 0.10) +
        (historical.total * 0.25) +
        (programQuality.total * 0.35) +
        (competition.total * 0.20) +
        (attackSurface.total * 0.05) +
        (penetration.total * 0.05)
      );
    }

    // Calculate tier (S/A/B/C/D/F)
    const tier = this.calculateTier(totalScore);

    // Calculate confidence based on data availability (Requirements 5.4)
    const dataAvailability = {
      hasVulnerabilityData: data.vulnerabilities.length > 0,
      hasSubdomainData: data.subdomains.length > 0,
      hasTechnologyData: allTechnologies.size > 0,
      hasBountyData: !!(data.program?.bountyTable?.critical?.max || data.program?.bountyRange?.max),
      hasHistoricalData: data.vulnerabilities.length >= 3,
      // New enriched data availability checks
      hasBountyTableData: !!(data.program?.bountyTable && 
        (data.program.bountyTable.critical || data.program.bountyTable.high || 
         data.program.bountyTable.medium || data.program.bountyTable.low)),
      hasResponseMetricsData: !!(data.program?.responseMetrics && 
        (data.program.responseMetrics.averageTimeToFirstResponse !== undefined ||
         data.program.responseMetrics.averageTimeToBounty !== undefined ||
         data.program.responseMetrics.averageTimeToResolution !== undefined)),
      hasActivityStatsData: !!(data.program?.activityStats && 
        (data.program.activityStats.resolvedReportCount !== undefined ||
         data.program.activityStats.totalBountiesPaid !== undefined ||
         data.program.activityStats.hackersThanked !== undefined)),
      hasScopeStatsData: !!(data.program?.scopeStats && 
        (data.program.scopeStats.totalAssets !== undefined ||
         data.program.scopeStats.wildcardCount !== undefined)),
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

  private extractTechnologies(subdomains: SubdomainDocument[]): Set<string> {
    const technologies = new Set<string>();
    for (const subdomain of subdomains) {
      if (subdomain.technologies && Array.isArray(subdomain.technologies)) {
        for (const tech of subdomain.technologies) {
          technologies.add(tech.toLowerCase());
        }
      }
    }
    return technologies;
  }

  private calculateExploitability(
    technologies: Set<string>,
    subdomains: SubdomainDocument[],
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

    // Auth bypass potential - check subdomains with 401/403 status
    for (const subdomain of subdomains) {
      if (subdomain.httpStatus === 401 || subdomain.httpStatus === 403) {
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
    program: ProgramDocument | null,
  ): HistoricalBreakdown {
    let pastVulnsCritical = 0;
    let pastVulnsHigh = 0;
    let pastVulnsMedium = 0;
    let pastVulnsLow = 0;
    let vulnCategories = 0;
    let recurringPatterns = 0;
    let daysSinceLastVuln = 0;
    let successRate = 0;

    // Use activityStats from program if available (Requirements 3.5)
    if (program?.activityStats) {
      const { resolvedReportCount, totalBountiesPaid } = program.activityStats;
      
      // Use resolvedReportCount for activity assessment
      // More resolved reports = more active program = higher score
      if (resolvedReportCount !== undefined && resolvedReportCount !== null) {
        // Scale: 0-10 reports = 0-20, 10-50 = 20-50, 50-200 = 50-80, 200+ = 80-100
        if (resolvedReportCount >= 200) {
          pastVulnsCritical = Math.min(100, 80 + (resolvedReportCount - 200) / 50 * 20);
        } else if (resolvedReportCount >= 50) {
          pastVulnsCritical = 50 + (resolvedReportCount - 50) / 150 * 30;
        } else if (resolvedReportCount >= 10) {
          pastVulnsCritical = 20 + (resolvedReportCount - 10) / 40 * 30;
        } else {
          pastVulnsCritical = resolvedReportCount * 2;
        }
        pastVulnsCritical = Math.min(100, Math.round(pastVulnsCritical));
      }
      
      // Use totalBountiesPaid for program value assessment
      // Higher bounties paid = more valuable program = higher score
      if (totalBountiesPaid !== undefined && totalBountiesPaid !== null) {
        // Scale: $0-10k = 0-30, $10k-100k = 30-60, $100k-1M = 60-85, $1M+ = 85-100
        if (totalBountiesPaid >= 1000000) {
          pastVulnsHigh = Math.min(100, 85 + (totalBountiesPaid - 1000000) / 10000000 * 15);
        } else if (totalBountiesPaid >= 100000) {
          pastVulnsHigh = 60 + (totalBountiesPaid - 100000) / 900000 * 25;
        } else if (totalBountiesPaid >= 10000) {
          pastVulnsHigh = 30 + (totalBountiesPaid - 10000) / 90000 * 30;
        } else {
          pastVulnsHigh = totalBountiesPaid / 10000 * 30;
        }
        pastVulnsHigh = Math.min(100, Math.round(pastVulnsHigh));
      }
    }

    // Count vulns by severity from local vulnerability data
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

    // If no activityStats, fall back to local vulnerability data
    if (!program?.activityStats?.resolvedReportCount) {
      // Score based on severity (critical findings = high exploitability)
      pastVulnsCritical = Math.max(pastVulnsCritical, Math.min(100, severityCounts.critical * 25));
    }
    if (!program?.activityStats?.totalBountiesPaid) {
      pastVulnsHigh = Math.max(pastVulnsHigh, Math.min(100, severityCounts.high * 15));
    }
    
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
      // Bounty scoring - use bountyTable data if available (Requirements 1.5, 5.1)
      // Priority: bountyTable.critical > bountyRange (fallback)
      const criticalMax = program.bountyTable?.critical?.max;
      const criticalMin = program.bountyTable?.critical?.min;
      
      // Use bountyTable data if available, otherwise fall back to bountyRange
      const maxBounty = criticalMax ?? program.bountyRange?.max ?? null;
      const minBounty = criticalMin ?? program.bountyRange?.min ?? null;
      
      // Calculate bountyMax score: scale from 0-100 based on max bounty (up to $50,000)
      if (maxBounty !== null) {
        bountyMax = Math.min(100, (maxBounty / 50000) * 100);
      }
      
      // Calculate bountyMin score: scale from 0-100 based on min bounty (up to $1,000)
      if (minBounty !== null) {
        bountyMin = Math.min(100, (minBounty / 1000) * 100);
      }
      
      // Calculate bountyAverage from actual bountyTable data if available
      if (program.bountyTable) {
        const bountyValues: number[] = [];
        const severities = ['critical', 'high', 'medium', 'low'] as const;
        for (const severity of severities) {
          const tier = program.bountyTable[severity];
          if (tier?.min !== undefined && tier?.min !== null) bountyValues.push(tier.min);
          if (tier?.max !== undefined && tier?.max !== null) bountyValues.push(tier.max);
        }
        if (bountyValues.length > 0) {
          const avgBounty = bountyValues.reduce((a, b) => a + b, 0) / bountyValues.length;
          bountyAverage = Math.min(100, (avgBounty / 10000) * 100);
        }
      } else {
        // Fallback to simple average of min/max scores
        bountyAverage = Math.round((bountyMin + bountyMax) / 2);
      }

      // Response time scoring - use responseMetrics if available (Requirements 2.5, 5.2)
      if (program.responseMetrics?.averageTimeToFirstResponse !== undefined && 
          program.responseMetrics.averageTimeToFirstResponse !== null) {
        // Faster response = higher score
        // 1 day = 100, 7 days = 70, 14 days = 40, 30+ days = 10
        const days = program.responseMetrics.averageTimeToFirstResponse;
        if (days <= 1) responseTime = 100;
        else if (days <= 3) responseTime = 90;
        else if (days <= 7) responseTime = 70;
        else if (days <= 14) responseTime = 50;
        else if (days <= 30) responseTime = 30;
        else responseTime = 10;
      }
      
      // Factor in time to bounty and resolution for resolutionRate
      if (program.responseMetrics?.averageTimeToBounty !== undefined && 
          program.responseMetrics.averageTimeToBounty !== null) {
        const bountyDays = program.responseMetrics.averageTimeToBounty;
        // Faster bounty payment = higher score
        if (bountyDays <= 7) resolutionRate = 100;
        else if (bountyDays <= 14) resolutionRate = 80;
        else if (bountyDays <= 30) resolutionRate = 60;
        else if (bountyDays <= 60) resolutionRate = 40;
        else resolutionRate = 20;
      }

      // Program age scoring - use launchedAt if available
      const launchDate = program.launchedAt || program.firstSyncedAt;
      if (launchDate) {
        const ageInDays = Math.floor(
          (Date.now() - new Date(launchDate).getTime()) / (24 * 60 * 60 * 1000)
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

    // Scope size scoring - use scopeStats if available (Requirements 4.4)
    if (program?.scopeStats?.totalAssets !== undefined && program.scopeStats.totalAssets !== null) {
      // Use enriched scopeStats data
      scopeSize = Math.min(100, (program.scopeStats.totalAssets / 50) * 100);
    } else {
      // Fallback to counting scopes and domains
      const inScopeCount = scopes.filter(s => s.status === 'in_scope' || s.eligibility?.isEligible).length;
      const domainCount = domains.length;
      scopeSize = Math.min(100, ((inScopeCount + domainCount) / 20) * 100);
    }

    // Wildcard scoring - use scopeStats.wildcardCount if available (Requirements 4.5)
    if (program?.scopeStats?.wildcardCount !== undefined && program.scopeStats.wildcardCount !== null) {
      // Programs with wildcards get higher scores - each wildcard adds significant value
      wildcards = Math.min(100, program.scopeStats.wildcardCount * 25);
    } else {
      // Fallback to counting wildcard scopes manually
      const wildcardScopes = scopes.filter(s => 
        s.target?.startsWith('*.') || s.target?.includes('*') || s.type === 'wildcard'
      );
      wildcards = Math.min(100, wildcardScopes.length * 20);
    }

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
    program: ProgramDocument | null,
  ): AttackSurfaceBreakdown {
    let subdomainCount = 0;
    let liveHostCount = 0;
    let httpServiceCount = 0;
    let openPortCount = 0;
    let endpointCount = 0;
    let apiEndpoints = 0;
    let adminPanels = 0;
    let loginPages = 0;
    let fileUploads = 0;

    // Use scopeStats from program if available (Requirements 4.4)
    if (program?.scopeStats) {
      const { totalAssets, wildcardCount, apiCount } = program.scopeStats;
      
      // Use totalAssets for attack surface size
      if (totalAssets !== undefined && totalAssets !== null) {
        // Scale: 0-10 assets = 0-20, 10-50 = 20-50, 50-200 = 50-80, 200+ = 80-100
        if (totalAssets >= 200) {
          subdomainCount = Math.min(100, 80 + (totalAssets - 200) / 300 * 20);
        } else if (totalAssets >= 50) {
          subdomainCount = 50 + (totalAssets - 50) / 150 * 30;
        } else if (totalAssets >= 10) {
          subdomainCount = 20 + (totalAssets - 10) / 40 * 30;
        } else {
          subdomainCount = totalAssets * 2;
        }
      }
      
      // Use wildcardCount for opportunity assessment
      // Wildcards significantly increase attack surface
      if (wildcardCount !== undefined && wildcardCount !== null && wildcardCount > 0) {
        // Each wildcard adds substantial value - scale up to 100
        openPortCount = Math.min(100, wildcardCount * 25);
      }
      
      // Use apiCount for API endpoint scoring
      if (apiCount !== undefined && apiCount !== null) {
        apiEndpoints = Math.min(100, apiCount * 15);
      }
    }
    
    // Fall back to or supplement with local data
    if (!program?.scopeStats?.totalAssets) {
      subdomainCount = Math.max(subdomainCount, Math.min(100, (subdomains.length / 500) * 100));
    }
    
    liveHostCount = Math.min(100, (liveHosts.length / 100) * 100);
    
    // Count alive subdomains as HTTP services
    const aliveSubdomains = subdomains.filter(s => s.isAlive);
    httpServiceCount = Math.min(100, (aliveSubdomains.length / 50) * 100);

    // Analyze subdomains for interesting endpoints based on title
    for (const subdomain of aliveSubdomains) {
      const url = (subdomain.subdomain || '').toLowerCase();
      const title = (subdomain.title || '').toLowerCase();

      if (url.includes('api') || url.includes('v1') || url.includes('v2') || 
          url.includes('graphql') || url.includes('rest')) {
        apiEndpoints += 10;
      }

      if (url.includes('admin') || url.includes('manager') || url.includes('dashboard') ||
          title.includes('admin') || title.includes('dashboard') || title.includes('control panel')) {
        adminPanels += 15;
      }

      if (url.includes('login') || url.includes('signin') || url.includes('auth') ||
          title.includes('login') || title.includes('sign in')) {
        loginPages += 10;
      }

      if (url.includes('upload') || url.includes('import') || title.includes('upload')) {
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
    subdomains: SubdomainDocument[],
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

    // Misconfigurations (based on status codes)
    let misconfigurations = 0;
    for (const subdomain of subdomains) {
      if ([403, 401, 500, 502, 503].includes(subdomain.httpStatus || 0)) {
        misconfigurations += 5;
      }
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

    // Sensitive exposure - check subdomain names for sensitive patterns
    let sensitiveExposure = 0;
    for (const subdomain of subdomains) {
      const url = (subdomain.subdomain || '').toLowerCase();
      if (url.includes('git') || url.includes('env') || url.includes('bak') ||
          url.includes('backup') || url.includes('config') || url.includes('sql') ||
          url.includes('dev') || url.includes('staging') || url.includes('test')) {
        sensitiveExposure += 15;
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
    // Adjusted thresholds to account for programs without full reconnaissance data
    // Programs start with limited data and scores improve as scanning progresses
    if (totalScore >= 80) return 'S';
    if (totalScore >= 65) return 'A';
    if (totalScore >= 50) return 'B';
    if (totalScore >= 35) return 'C';
    if (totalScore >= 20) return 'D';
    return 'F';
  }

  private calculateConfidence(dataAvailability: {
    hasVulnerabilityData: boolean;
    hasSubdomainData: boolean;
    hasTechnologyData: boolean;
    hasBountyData: boolean;
    hasHistoricalData: boolean;
    // New enriched data fields (Requirements 5.4)
    hasBountyTableData?: boolean;
    hasResponseMetricsData?: boolean;
    hasActivityStatsData?: boolean;
    hasScopeStatsData?: boolean;
  }): number {
    let confidence = 0;
    
    // Base data availability (60% weight)
    if (dataAvailability.hasVulnerabilityData) confidence += 15;
    if (dataAvailability.hasSubdomainData) confidence += 15;
    if (dataAvailability.hasTechnologyData) confidence += 15;
    if (dataAvailability.hasBountyData) confidence += 9;
    if (dataAvailability.hasHistoricalData) confidence += 6;
    
    // Enriched data availability (40% weight) - Requirements 5.4
    // Higher confidence when more enriched fields are populated
    if (dataAvailability.hasBountyTableData) confidence += 10;
    if (dataAvailability.hasResponseMetricsData) confidence += 10;
    if (dataAvailability.hasActivityStatsData) confidence += 10;
    if (dataAvailability.hasScopeStatsData) confidence += 10;
    
    return Math.min(100, confidence);
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
    page = 1,
    limit = 20,
    sortBy = 'totalScore',
  ): Promise<{ data: ScoreDocument[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const validSortFields = [
      'totalScore', 'exploitabilityScore', 'historicalScore',
      'programQualityScore', 'competitionScore', 'attackSurfaceScore', 'pentestScore',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'totalScore';
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.scoreModel
        .find({ targetType })
        .sort({ [sortField]: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.scoreModel.countDocuments({ targetType }).exec(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
