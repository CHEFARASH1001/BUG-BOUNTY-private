import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Score, ScoreDocument, ScoreTargetType } from '../../schemas/score.schema';
import { Program, ProgramDocument } from '../../schemas/program.schema';
import { Domain, DomainDocument } from '../../schemas/domain.schema';
import { Subdomain, SubdomainDocument } from '../../schemas/subdomain.schema';
import { Live, LiveDocument } from '../../schemas/live.schema';
import { HttpService, HttpServiceDocument } from '../../schemas/http-service.schema';
import { Vulnerability, VulnerabilityDocument } from '../../schemas/vulnerability.schema';

export interface ScoreBreakdown {
  // Penetration factors (weighted total: 60%)
  exposedServices: number;
  outdatedTech: number;
  knownVulns: number;
  misconfigurations: number;
  authMechanisms: number;

  // Exposure factors (weighted total: 40%)
  subdomainCount: number;
  liveHostCount: number;
  openPortCount: number;
  httpServiceCount: number;
  endpointCount: number;

  // Priority factors
  freshAssetBonus: number;
  programValue: number;
  vulnerabilityCount: number;
}

export interface ScoreCalculationResult {
  pentestScore: number;
  exposureScore: number;
  priorityScore: number;
  totalScore: number;
  breakdown: ScoreBreakdown;
}

@Injectable()
export class ScoresService {
  private readonly logger = new Logger(ScoresService.name);

  // Technologies that increase pentest probability
  private readonly highRiskTech = [
    'wordpress', 'drupal', 'joomla', 'php', 'asp.net', 'java', 'tomcat',
    'apache', 'nginx', 'iis', 'jenkins', 'gitlab', 'grafana', 'kibana',
    'elasticsearch', 'mongodb', 'redis', 'mysql', 'postgresql', 'mssql',
  ];

  private readonly authTech = ['ntlm', 'basic', 'digest', 'oauth', 'saml', 'jwt'];

  constructor(
    @InjectModel(Score.name) private scoreModel: Model<ScoreDocument>,
    @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    @InjectModel(Subdomain.name) private subdomainModel: Model<SubdomainDocument>,
    @InjectModel(Live.name) private liveModel: Model<LiveDocument>,
    @InjectModel(HttpService.name) private httpServiceModel: Model<HttpServiceDocument>,
    @InjectModel(Vulnerability.name) private vulnModel: Model<VulnerabilityDocument>,
  ) {}

  // Calculate scores daily
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledScoreCalculation() {
    this.logger.log('Starting scheduled score calculation');
    await this.calculateAllScores();
  }

  async calculateAllScores(): Promise<{ programs: number; domains: number }> {
    let programCount = 0;
    let domainCount = 0;

    try {
      // Calculate scores for all programs
      const programs = await this.programModel.find({ isActive: true });
      for (const program of programs) {
        await this.calculateProgramScore(program._id.toString());
        programCount++;
      }

      // Calculate scores for all domains
      const domains = await this.domainModel.find({ isActive: true });
      for (const domain of domains) {
        await this.calculateDomainScore(domain._id.toString());
        domainCount++;
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
    const domainNames = domains.map(d => d.domain);

    // Get aggregated stats
    const [subdomainCount, liveCount, httpCount, vulnCount, httpServices] = await Promise.all([
      this.subdomainModel.countDocuments({ domainId: { $in: domains.map(d => d._id) } }),
      this.liveModel.countDocuments({ domain: { $in: domainNames } }),
      this.httpServiceModel.countDocuments({ domain: { $in: domainNames } }),
      this.vulnModel.countDocuments({ targetId: new Types.ObjectId(programId) }),
      this.httpServiceModel.find({ domain: { $in: domainNames } }).select('technologies statusCode'),
    ]);

    // Calculate scores
    const result = this.calculateScores({
      subdomainCount,
      liveCount,
      httpCount,
      vulnCount,
      httpServices,
      bountyMax: program.bountyRange?.max || 0,
      hasFreshAssets: await this.hasFreshAssets(domainNames),
    });

    // Save score
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

    // Get stats for this domain
    const [subdomainCount, liveCount, httpCount, vulnCount, httpServices] = await Promise.all([
      this.subdomainModel.countDocuments({ domainId: new Types.ObjectId(domainId) }),
      this.liveModel.countDocuments({ domain: domain.domain }),
      this.httpServiceModel.countDocuments({ domain: domain.domain }),
      this.vulnModel.countDocuments({ targetId: new Types.ObjectId(domainId) }),
      this.httpServiceModel.find({ domain: domain.domain }).select('technologies statusCode'),
    ]);

    // Calculate scores
    const result = this.calculateScores({
      subdomainCount,
      liveCount,
      httpCount,
      vulnCount,
      httpServices,
      bountyMax: 0,
      hasFreshAssets: await this.hasFreshAssets([domain.domain]),
    });

    // Save score
    return this.saveScore({
      targetId: new Types.ObjectId(domainId),
      targetType: ScoreTargetType.DOMAIN,
      targetName: domain.domain,
      ...result,
    });
  }

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
    return this.scoreModel
      .find({ targetType })
      .sort({ [sortBy]: -1 })
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

  private calculateScores(data: {
    subdomainCount: number;
    liveCount: number;
    httpCount: number;
    vulnCount: number;
    httpServices: any[];
    bountyMax: number;
    hasFreshAssets: boolean;
  }): ScoreCalculationResult {
    const breakdown: ScoreBreakdown = {
      exposedServices: 0,
      outdatedTech: 0,
      knownVulns: 0,
      misconfigurations: 0,
      authMechanisms: 0,
      subdomainCount: 0,
      liveHostCount: 0,
      openPortCount: 0,
      httpServiceCount: 0,
      endpointCount: 0,
      freshAssetBonus: 0,
      programValue: 0,
      vulnerabilityCount: 0,
    };

    // Analyze technologies
    const allTech = new Set<string>();
    let authCount = 0;
    let statusCodeIssues = 0;

    for (const service of data.httpServices) {
      if (service.technologies) {
        for (const tech of service.technologies) {
          allTech.add(tech.toLowerCase());
          if (this.authTech.some(a => tech.toLowerCase().includes(a))) {
            authCount++;
          }
        }
      }
      // Count interesting status codes (403, 401, 500, 502, 503)
      if ([403, 401, 500, 502, 503].includes(service.statusCode)) {
        statusCodeIssues++;
      }
    }

    // Calculate exposure score (max 100)
    breakdown.subdomainCount = Math.min(data.subdomainCount / 100, 1) * 25;
    breakdown.liveHostCount = Math.min(data.liveCount / 50, 1) * 25;
    breakdown.httpServiceCount = Math.min(data.httpCount / 30, 1) * 25;
    breakdown.endpointCount = 0; // Would need endpoint data
    breakdown.openPortCount = 0; // Would need port data

    const exposureScore = Math.min(100,
      breakdown.subdomainCount +
      breakdown.liveHostCount +
      breakdown.httpServiceCount +
      breakdown.openPortCount +
      breakdown.endpointCount
    );

    // Calculate pentest score (max 100)
    const highRiskCount = Array.from(allTech).filter(t =>
      this.highRiskTech.some(hr => t.includes(hr))
    ).length;

    breakdown.exposedServices = Math.min(highRiskCount * 5, 30);
    breakdown.outdatedTech = 0; // Would need version detection
    breakdown.knownVulns = Math.min(data.vulnCount * 10, 30);
    breakdown.misconfigurations = Math.min(statusCodeIssues * 3, 20);
    breakdown.authMechanisms = Math.min(authCount * 5, 20);

    const pentestScore = Math.min(100,
      breakdown.exposedServices +
      breakdown.outdatedTech +
      breakdown.knownVulns +
      breakdown.misconfigurations +
      breakdown.authMechanisms
    );

    // Calculate priority score
    breakdown.freshAssetBonus = data.hasFreshAssets ? 20 : 0;
    breakdown.programValue = Math.min(data.bountyMax / 500, 1) * 30;
    breakdown.vulnerabilityCount = Math.min(data.vulnCount * 5, 30);

    const priorityScore = Math.min(100,
      breakdown.freshAssetBonus +
      breakdown.programValue +
      breakdown.vulnerabilityCount +
      (pentestScore * 0.2) // Add 20% of pentest score
    );

    // Calculate total score with weights
    const totalScore = Math.round(
      (pentestScore * 0.6) + (exposureScore * 0.4)
    );

    return {
      pentestScore: Math.round(pentestScore),
      exposureScore: Math.round(exposureScore),
      priorityScore: Math.round(priorityScore),
      totalScore,
      breakdown,
    };
  }

  private async hasFreshAssets(domains: string[]): Promise<boolean> {
    const freshCount = await this.liveModel.countDocuments({
      domain: { $in: domains },
      isFresh: true,
    });
    return freshCount > 0;
  }

  private async saveScore(data: {
    targetId: Types.ObjectId;
    targetType: ScoreTargetType;
    targetName: string;
    pentestScore: number;
    exposureScore: number;
    priorityScore: number;
    totalScore: number;
    breakdown: ScoreBreakdown;
  }): Promise<ScoreDocument> {
    const existing = await this.scoreModel.findOne({
      targetId: data.targetId,
      targetType: data.targetType,
    });

    const historyEntry = {
      date: new Date(),
      pentestScore: data.pentestScore,
      exposureScore: data.exposureScore,
      priorityScore: data.priorityScore,
      totalScore: data.totalScore,
    };

    if (existing) {
      // Update existing score
      existing.pentestScore = data.pentestScore;
      existing.exposureScore = data.exposureScore;
      existing.priorityScore = data.priorityScore;
      existing.totalScore = data.totalScore;
      existing.breakdown = data.breakdown;
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

