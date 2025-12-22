import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios, { AxiosInstance } from 'axios';
import {
  AbuseIPDBResult,
  AbuseIPDBResultDocument,
} from '../../../schemas/abuseipdb-result.schema';

export interface AbuseIPDBApiResponse {
  data: {
    ipAddress: string;
    isPublic: boolean;
    abuseConfidenceScore: number;
    countryCode: string;
    isp: string;
    domain: string;
    totalReports: number;
    lastReportedAt: string | null;
    isWhitelisted: boolean;
  };
}

export interface ParsedAbuseIPDBResult {
  ipAddress: string;
  isPublic: boolean;
  abuseConfidenceScore: number;
  countryCode: string;
  isp: string;
  domain: string;
  totalReports: number;
  lastReportedAt: Date | null;
  isWhitelisted: boolean;
}

@Injectable()
export class AbuseIPDBService {
  private readonly logger = new Logger(AbuseIPDBService.name);
  private client: AxiosInstance;
  private apiKey: string;

  constructor(
    private configService: ConfigService,
    @InjectModel(AbuseIPDBResult.name)
    private abuseIPDBResultModel: Model<AbuseIPDBResultDocument>,
  ) {
    this.apiKey = this.configService.get<string>('ABUSEIPDB_API_KEY') || '';
    this.client = axios.create({
      baseURL: 'https://api.abuseipdb.com/api/v2',
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        Key: this.apiKey,
      },
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }


  /**
   * Parse AbuseIPDB API response into structured result
   */
  parseApiResponse(response: AbuseIPDBApiResponse): ParsedAbuseIPDBResult {
    const data = response.data;
    return {
      ipAddress: data.ipAddress,
      isPublic: data.isPublic,
      abuseConfidenceScore: data.abuseConfidenceScore,
      countryCode: data.countryCode,
      isp: data.isp,
      domain: data.domain,
      totalReports: data.totalReports,
      lastReportedAt: data.lastReportedAt ? new Date(data.lastReportedAt) : null,
      isWhitelisted: data.isWhitelisted,
    };
  }

  /**
   * Check a single IP address against AbuseIPDB
   */
  async checkIP(ip: string): Promise<ParsedAbuseIPDBResult> {
    if (!this.isConfigured()) {
      throw new Error('AbuseIPDB API key not configured');
    }

    const response = await this.client.get<AbuseIPDBApiResponse>('/check', {
      params: {
        ipAddress: ip,
        maxAgeInDays: 90,
        verbose: true,
      },
    });

    return this.parseApiResponse(response.data);
  }

  /**
   * Check multiple IP addresses against AbuseIPDB (batch lookup)
   */
  async checkIPs(ips: string[]): Promise<ParsedAbuseIPDBResult[]> {
    if (!this.isConfigured()) {
      throw new Error('AbuseIPDB API key not configured');
    }

    const results: ParsedAbuseIPDBResult[] = [];
    
    // AbuseIPDB doesn't have a native batch endpoint, so we process sequentially
    // with rate limiting consideration
    for (const ip of ips) {
      try {
        const result = await this.checkIP(ip);
        results.push(result);
      } catch (error) {
        this.logger.warn(`Failed to check IP ${ip}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Store AbuseIPDB result in database
   */
  async storeResult(
    result: ParsedAbuseIPDBResult,
    options?: {
      subdomainId?: Types.ObjectId;
      domainId?: Types.ObjectId;
    },
  ): Promise<AbuseIPDBResultDocument> {
    const document = await this.abuseIPDBResultModel.create({
      ipAddress: result.ipAddress,
      isPublic: result.isPublic,
      abuseConfidenceScore: result.abuseConfidenceScore,
      countryCode: result.countryCode,
      isp: result.isp,
      domain: result.domain,
      totalReports: result.totalReports,
      lastReportedAt: result.lastReportedAt,
      isWhitelisted: result.isWhitelisted,
      subdomainId: options?.subdomainId,
      domainId: options?.domainId,
      checkedAt: new Date(),
    });

    return document;
  }

  /**
   * Check if abuse score exceeds threshold
   */
  exceedsThreshold(score: number, threshold: number): boolean {
    return score > threshold;
  }

  /**
   * Get stored results for an IP address
   */
  async getResultsForIP(ipAddress: string): Promise<AbuseIPDBResultDocument[]> {
    return this.abuseIPDBResultModel
      .find({ ipAddress })
      .sort({ checkedAt: -1 })
      .exec();
  }

  /**
   * Get stored results for a subdomain
   */
  async getResultsForSubdomain(
    subdomainId: Types.ObjectId,
  ): Promise<AbuseIPDBResultDocument[]> {
    return this.abuseIPDBResultModel
      .find({ subdomainId })
      .sort({ checkedAt: -1 })
      .exec();
  }

  /**
   * Get stored results for a domain
   */
  async getResultsForDomain(
    domainId: Types.ObjectId,
  ): Promise<AbuseIPDBResultDocument[]> {
    return this.abuseIPDBResultModel
      .find({ domainId })
      .sort({ checkedAt: -1 })
      .exec();
  }
}
