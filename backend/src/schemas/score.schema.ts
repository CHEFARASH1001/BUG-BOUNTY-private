import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ScoreDocument = Score & Document;

export enum ScoreTargetType {
  PROGRAM = 'program',
  DOMAIN = 'domain',
  SUBDOMAIN = 'subdomain',
}

// Detailed breakdown interfaces
export interface ExploitabilityBreakdown {
  cveCount: number;           // Known CVEs in detected technologies
  publicExploits: number;     // Technologies with public exploits
  attackComplexity: number;   // How easy to attack (based on tech stack)
  techStackAge: number;       // Older = more exploits available
  authBypass: number;         // Auth bypass potential
  total: number;
}

export interface HistoricalBreakdown {
  pastVulnsCritical: number;  // Previous critical vulns
  pastVulnsHigh: number;      // Previous high vulns
  pastVulnsMedium: number;    // Previous medium vulns
  pastVulnsLow: number;       // Previous low vulns
  vulnCategories: number;     // Diversity of vuln types (XSS, SQLi, etc.)
  recurringPatterns: number;  // Same type of vulns keep appearing
  daysSinceLastVuln: number;  // Freshness of vuln discoveries
  successRate: number;        // Ratio of confirmed vs false positives
  total: number;
}

export interface ProgramQualityBreakdown {
  bountyMin: number;          // Minimum bounty
  bountyMax: number;          // Maximum bounty
  bountyAverage: number;      // Average bounty paid
  responseTime: number;       // How fast they respond (from platform)
  resolutionRate: number;     // % of reports resolved
  programAge: number;         // Maturity of program
  scopeSize: number;          // Number of assets in scope
  wildcards: number;          // Wildcard domains (more opportunity)
  total: number;
}

export interface CompetitionBreakdown {
  scopeCoverage: number;      // How much scope is already scanned
  activityLevel: number;      // Recent scanning activity
  scopeFreshness: number;     // New assets added recently
  uniqueAssets: number;       // Assets with less coverage
  total: number;
}

export interface AttackSurfaceBreakdown {
  subdomainCount: number;
  liveHostCount: number;
  httpServiceCount: number;
  openPortCount: number;
  endpointCount: number;
  apiEndpoints: number;
  adminPanels: number;
  loginPages: number;
  fileUploads: number;
  total: number;
}

export interface PenetrationBreakdown {
  exposedServices: number;
  outdatedTech: number;
  knownVulns: number;
  misconfigurations: number;
  authMechanisms: number;
  sensitiveExposure: number;
  total: number;
}

export interface FullScoreBreakdown {
  exploitability: ExploitabilityBreakdown;
  historical: HistoricalBreakdown;
  programQuality: ProgramQualityBreakdown;
  competition: CompetitionBreakdown;
  attackSurface: AttackSurfaceBreakdown;
  penetration: PenetrationBreakdown;
}

@Schema({ timestamps: true, collection: 'scores' })
export class Score {
  @Prop({ required: true, type: Types.ObjectId, refPath: 'targetType' })
  targetId: Types.ObjectId;

  @Prop({ required: true, enum: ScoreTargetType })
  targetType: ScoreTargetType;

  @Prop({ required: true })
  targetName: string;

  // ========== PRIMARY SCORES (0-100 each) ==========

  // Exploitability Score - How likely vulnerabilities can be exploited
  @Prop({ default: 0 })
  exploitabilityScore: number;

  // Historical Score - Based on past vulnerabilities and patterns
  @Prop({ default: 0 })
  historicalScore: number;

  // Program Quality Score - Bounty value, response time, etc.
  @Prop({ default: 0 })
  programQualityScore: number;

  // Competition Score - How crowded/untapped the program is
  @Prop({ default: 0 })
  competitionScore: number;

  // Attack Surface Score - Size and complexity of attack surface
  @Prop({ default: 0 })
  attackSurfaceScore: number;

  // Penetration Score - Technical penetration indicators
  @Prop({ default: 0 })
  pentestScore: number;

  // ========== LEGACY SCORES (for backward compatibility) ==========

  @Prop({ default: 0 })
  exposureScore: number;

  @Prop({ default: 0 })
  priorityScore: number;

  // ========== FINAL SCORES ==========

  // Final Weighted Score (0-100)
  @Prop({ default: 0 })
  totalScore: number;

  // Recommendation tier (S/A/B/C/D/F)
  @Prop({ default: 'C' })
  tier: string;

  // Confidence level (how reliable is this score)
  @Prop({ default: 0 })
  confidence: number;

  // ========== DETAILED BREAKDOWN ==========

  @Prop({ type: Object, default: {} })
  breakdown: FullScoreBreakdown;

  // ========== RECOMMENDATIONS ==========

  @Prop({ type: [String], default: [] })
  recommendations: string[];

  @Prop({ type: [String], default: [] })
  strengths: string[];

  @Prop({ type: [String], default: [] })
  weaknesses: string[];

  // ========== METADATA ==========

  // Historical scores for trending
  @Prop({ type: [Object], default: [] })
  history: {
    date: Date;
    exploitabilityScore: number;
    historicalScore: number;
    programQualityScore: number;
    competitionScore: number;
    attackSurfaceScore: number;
    pentestScore: number;
    totalScore: number;
    tier: string;
  }[];

  @Prop({ default: false })
  isFresh: boolean;

  @Prop()
  calculatedAt: Date;

  @Prop()
  notes: string;

  // Data completeness (what data was available for scoring)
  @Prop({ type: Object, default: {} })
  dataAvailability: {
    hasVulnerabilityData: boolean;
    hasSubdomainData: boolean;
    hasTechnologyData: boolean;
    hasBountyData: boolean;
    hasHistoricalData: boolean;
  };
}

export const ScoreSchema = SchemaFactory.createForClass(Score);

ScoreSchema.index({ targetId: 1, targetType: 1 }, { unique: true });
ScoreSchema.index({ targetType: 1 });
ScoreSchema.index({ totalScore: -1 });
ScoreSchema.index({ exploitabilityScore: -1 });
ScoreSchema.index({ historicalScore: -1 });
ScoreSchema.index({ programQualityScore: -1 });
ScoreSchema.index({ competitionScore: -1 });
ScoreSchema.index({ attackSurfaceScore: -1 });
ScoreSchema.index({ pentestScore: -1 });
ScoreSchema.index({ tier: 1 });
ScoreSchema.index({ calculatedAt: -1 });
