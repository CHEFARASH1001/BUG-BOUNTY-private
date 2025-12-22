import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface ScopeStats {
  totalAssets: number;
  wildcardCount: number;
  domainCount: number;
  apiCount: number;
  mobileAppCount: number;
  bountyEligibleCount: number;
}

export interface BugcrowdProgram {
  id: string;
  code: string;
  name: string;
  url: string;
  programUrl: string;
  status: string;
  managed: boolean;
  minRewards: number | null;
  maxRewards: number | null;
  scopes: BugcrowdScope[];
  scopeStats: ScopeStats;
  createdAt: string;
  updatedAt: string;
}

export interface BugcrowdScope {
  id: string;
  name: string;
  uri: string;
  category: string;
  inScope: boolean;
  targetType: string;
}

@Injectable()
export class BugcrowdService {
  private readonly logger = new Logger(BugcrowdService.name);
  private readonly client: AxiosInstance;
  private readonly apiToken: string;

  constructor(private configService: ConfigService) {
    this.apiToken = this.configService.get<string>('BUGCROWD_API_TOKEN', '');

    this.client = axios.create({
      baseURL: 'https://api.bugcrowd.com',
      headers: {
        'Accept': 'application/vnd.bugcrowd+json',
        'Authorization': `Token ${this.apiToken}`,
      },
    });
  }

  async getAllPrograms(offset = 0, limit = 100): Promise<BugcrowdProgram[]> {
    const programs: BugcrowdProgram[] = [];

    try {
      this.logger.log(`Fetching Bugcrowd programs (offset: ${offset})`);

      const response = await this.client.get('/bounties', {
        params: {
          offset,
          limit,
          sort: 'promoted-desc',
        },
      });

      const data = response.data;

      if (data.bounties && Array.isArray(data.bounties)) {
        for (const item of data.bounties) {
          const program = this.transformProgram(item);
          programs.push(program);
        }

        // Handle pagination
        if (data.bounties.length === limit) {
          const nextPrograms = await this.getAllPrograms(offset + limit, limit);
          programs.push(...nextPrograms);
        }
      }

      this.logger.log(`Fetched ${programs.length} programs from Bugcrowd`);
      return programs;
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.logger.warn('Bugcrowd API authentication failed, using public data');
        return this.fetchPublicPrograms();
      }
      this.logger.error(`Failed to fetch Bugcrowd programs: ${error.message}`);
      throw error;
    }
  }

  async getProgramDetails(code: string): Promise<BugcrowdProgram | null> {
    try {
      this.logger.log(`Fetching Bugcrowd program: ${code}`);

      const response = await this.client.get(`/bounties/${code}`);
      const data = response.data;

      if (data.bounty) {
        return this.transformProgram(data.bounty);
      }

      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      this.logger.error(`Failed to fetch Bugcrowd program ${code}: ${error.message}`);
      throw error;
    }
  }

  async getProgramScopes(code: string): Promise<BugcrowdScope[]> {
    try {
      this.logger.log(`Fetching scopes for Bugcrowd program: ${code}`);

      const response = await this.client.get(`/bounties/${code}/targets`);
      const data = response.data;

      const scopes: BugcrowdScope[] = [];

      if (data.targets && Array.isArray(data.targets)) {
        for (const item of data.targets) {
          scopes.push(this.transformScope(item));
        }
      }

      return scopes;
    } catch (error: any) {
      this.logger.error(`Failed to fetch scopes for ${code}: ${error.message}`);
      throw error;
    }
  }

  async fetchPublicPrograms(): Promise<BugcrowdProgram[]> {
    const programs: BugcrowdProgram[] = [];

    try {
      this.logger.log('Fetching Bugcrowd public programs');

      // Use public programs list
      const response = await axios.get('https://bugcrowd.com/programs.json', {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.data.programs) {
        for (const item of response.data.programs) {
          // Use null for missing reward data instead of defaulting to zero
          const minRewards = item.min_rewards != null ? item.min_rewards : null;
          const maxRewards = item.max_rewards != null ? item.max_rewards : null;
          
          // Calculate scope stats (empty for public programs without scope data)
          const scopeStats = this.calculateScopeStats([]);
          
          programs.push({
            id: item.uuid || item.code,
            code: item.code,
            name: item.name,
            url: item.url || `https://bugcrowd.com/${item.code}`,
            programUrl: `https://bugcrowd.com/${item.code}`,
            status: item.status || 'open',
            managed: item.managed || false,
            minRewards,
            maxRewards,
            scopes: [],
            scopeStats,
            createdAt: item.starts_at,
            updatedAt: item.ends_at || item.starts_at,
          });
        }
      }

      this.logger.log(`Fetched ${programs.length} public programs from Bugcrowd`);
      return programs;
    } catch (error: any) {
      this.logger.error(`Failed to fetch public programs: ${error.message}`);
      return programs;
    }
  }

  private transformProgram(data: any): BugcrowdProgram {
    const scopes: BugcrowdScope[] = [];

    if (data.target_groups) {
      for (const group of data.target_groups) {
        if (group.targets) {
          for (const target of group.targets) {
            scopes.push(this.transformScope(target));
          }
        }
      }
    }

    // Use null for missing reward data instead of defaulting to zero
    const minRewards = data.min_rewards != null ? data.min_rewards : null;
    const maxRewards = data.max_rewards != null ? data.max_rewards : null;

    // Calculate scope statistics
    const scopeStats = this.calculateScopeStats(scopes);

    return {
      id: data.uuid || data.code,
      code: data.code,
      name: data.name,
      url: data.briefing_url || `https://bugcrowd.com/${data.code}`,
      programUrl: `https://bugcrowd.com/${data.code}`,
      status: data.status || 'open',
      managed: data.managed || false,
      minRewards,
      maxRewards,
      scopes,
      scopeStats,
      createdAt: data.starts_at,
      updatedAt: data.ends_at || data.starts_at,
    };
  }

  /**
   * Calculate scope statistics from an array of scopes
   * Counts assets by type (domain, wildcard, API, mobile) and bounty-eligible assets
   */
  calculateScopeStats(scopes: BugcrowdScope[]): ScopeStats {
    const inScopeAssets = scopes.filter(scope => scope.inScope);
    
    let wildcardCount = 0;
    let domainCount = 0;
    let apiCount = 0;
    let mobileAppCount = 0;

    for (const scope of inScopeAssets) {
      const targetType = scope.targetType?.toLowerCase() || '';
      const category = scope.category?.toLowerCase() || '';
      const uri = scope.uri || '';

      // Check for wildcard (*.domain.com pattern)
      if (uri.startsWith('*.') || uri.includes('*')) {
        wildcardCount++;
      }

      // Count by target type
      if (targetType === 'api' || category === 'api') {
        apiCount++;
      } else if (
        targetType === 'android' || 
        targetType === 'ios' || 
        targetType === 'mobile' ||
        category === 'android' ||
        category === 'ios' ||
        category === 'mobile'
      ) {
        mobileAppCount++;
      } else if (
        targetType === 'website' || 
        targetType === 'domain' ||
        category === 'website' ||
        category === 'domain' ||
        category === 'url'
      ) {
        domainCount++;
      } else {
        // Default to domain for unknown types
        domainCount++;
      }
    }

    return {
      totalAssets: inScopeAssets.length,
      wildcardCount,
      domainCount,
      apiCount,
      mobileAppCount,
      bountyEligibleCount: inScopeAssets.length, // All in-scope assets are bounty-eligible on Bugcrowd
    };
  }

  private transformScope(data: any): BugcrowdScope {
    return {
      id: data.id || data.uuid,
      name: data.name,
      uri: data.uri || data.target,
      category: data.category || 'website',
      inScope: data.in_scope !== false,
      targetType: data.target_type || 'website',
    };
  }
}

