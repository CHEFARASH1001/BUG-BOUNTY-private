import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Interface representing a scope target from bounty-targets-data
 */
export interface BountyTargetsScope {
  type: string;
  target: string;
  instruction?: string;
  eligibleForBounty?: boolean;
}

/**
 * Interface representing a transformed program from bounty-targets-data
 */
export interface BountyTargetsProgram {
  name: string;
  handle: string;
  url: string;
  platform: string;
  offersBounties: boolean;
  maxBounty: number | null;
  inScope: BountyTargetsScope[];
  outOfScope: BountyTargetsScope[];
}

/**
 * Raw HackerOne data format from bounty-targets-data
 */
interface HackerOneRawData {
  id?: string;
  handle: string;
  name: string;
  url?: string;
  offers_bounties?: boolean;
  offers_swag?: boolean;
  targets?: {
    in_scope?: Array<{
      asset_type?: string;
      asset_identifier: string;
      eligible_for_bounty?: boolean;
      instruction?: string;
    }>;
    out_of_scope?: Array<{
      asset_type?: string;
      asset_identifier: string;
      instruction?: string;
    }>;
  };
}

/**
 * Raw Bugcrowd data format from bounty-targets-data
 */
interface BugcrowdRawData {
  name: string;
  url?: string;
  targets?: {
    in_scope?: Array<{
      type?: string;
      target: string;
    }>;
    out_of_scope?: Array<{
      type?: string;
      target: string;
    }>;
  };
}

/**
 * Raw Intigriti data format from bounty-targets-data
 */
interface IntigritiRawData {
  company_handle: string;
  name: string;
  url?: string;
  max_bounty?: number;
  min_bounty?: number;
  targets?: {
    in_scope?: Array<{
      type?: string;
      endpoint: string;
    }>;
    out_of_scope?: Array<{
      type?: string;
      endpoint: string;
    }>;
  };
}

/**
 * Raw YesWeHack data format from bounty-targets-data
 */
interface YesWeHackRawData {
  slug: string;
  title: string;
  url?: string;
  max_bounty?: number;
  min_bounty?: number;
  scopes?: Array<{
    scope_type?: string;
    scope: string;
  }>;
}

/**
 * Raw Federacy data format from bounty-targets-data
 */
interface FederacyRawData {
  slug: string;
  name: string;
  url?: string;
  targets?: {
    in_scope?: Array<{
      type?: string;
      target: string;
    }>;
  };
}

const BOUNTY_TARGETS_BASE_URL = 'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/main/data/';

const BOUNTY_TARGETS_FILES = {
  hackerone: 'hackerone_data.json',
  bugcrowd: 'bugcrowd_data.json',
  intigriti: 'intigriti_data.json',
  yeswehack: 'yeswehack_data.json',
  federacy: 'federacy_data.json',
};

/**
 * Service for fetching and processing data from bounty-targets-data GitHub repository
 * 
 * This service aggregates program information from multiple bug bounty platforms
 * (HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy) into a single format.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 */
@Injectable()
export class BountyTargetsService {
  private readonly logger = new Logger(BountyTargetsService.name);

  /**
   * Fetch and parse a specific platform's data file
   * 
   * Requirements: 2.1 - Fetch from raw GitHub URL
   * Requirements: 2.8 - Log error and continue with remaining files on failure
   * 
   * @param platform The platform to fetch data for
   * @returns Array of BountyTargetsProgram objects
   */
  async fetchPlatformData(platform: keyof typeof BOUNTY_TARGETS_FILES): Promise<BountyTargetsProgram[]> {
    const filename = BOUNTY_TARGETS_FILES[platform];
    const url = `${BOUNTY_TARGETS_BASE_URL}${filename}`;

    try {
      this.logger.log(`Fetching ${platform} data from bounty-targets-data...`);
      
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BugBountyPlatform/1.0',
        },
      });

      if (!Array.isArray(response.data)) {
        this.logger.warn(`${platform} data is not an array`);
        return [];
      }

      // Transform based on platform
      let programs: BountyTargetsProgram[];
      switch (platform) {
        case 'hackerone':
          programs = this.transformHackerOneData(response.data);
          break;
        case 'bugcrowd':
          programs = this.transformBugcrowdData(response.data);
          break;
        case 'intigriti':
          programs = this.transformIntigritiData(response.data);
          break;
        case 'yeswehack':
          programs = this.transformYesWeHackData(response.data);
          break;
        case 'federacy':
          programs = this.transformFederacyData(response.data);
          break;
        default:
          programs = [];
      }

      this.logger.log(`Fetched ${programs.length} programs from ${platform}`);
      return programs;
    } catch (error: any) {
      // Requirements: 2.8 - Log error and return empty result
      this.logger.error(`Failed to fetch ${platform} data: ${error.message}`);
      return [];
    }
  }

  /**
   * Transform HackerOne format to internal format
   * 
   * Requirements: 2.2 - Parse hackerone_data.json
   * Requirements: 2.7 - Extract in-scope and out-of-scope targets
   * 
   * @param data Raw HackerOne data array
   * @returns Array of BountyTargetsProgram objects
   */
  transformHackerOneData(data: HackerOneRawData[]): BountyTargetsProgram[] {
    return data
      .filter(item => item && item.handle && item.name)
      .map(item => {
        const inScope: BountyTargetsScope[] = (item.targets?.in_scope || []).map(scope => ({
          type: scope.asset_type || 'URL',
          target: scope.asset_identifier,
          instruction: scope.instruction,
          eligibleForBounty: scope.eligible_for_bounty,
        }));

        const outOfScope: BountyTargetsScope[] = (item.targets?.out_of_scope || []).map(scope => ({
          type: scope.asset_type || 'URL',
          target: scope.asset_identifier,
          instruction: scope.instruction,
          eligibleForBounty: false,
        }));

        return {
          name: item.name,
          handle: item.handle,
          url: item.url || `https://hackerone.com/${item.handle}`,
          platform: 'hackerone',
          offersBounties: item.offers_bounties || false,
          maxBounty: null, // Not available in bounty-targets HackerOne data
          inScope,
          outOfScope,
        };
      });
  }

  /**
   * Transform Bugcrowd format to internal format
   * 
   * Requirements: 2.3 - Parse bugcrowd_data.json
   * Requirements: 2.7 - Extract in-scope and out-of-scope targets
   * 
   * @param data Raw Bugcrowd data array
   * @returns Array of BountyTargetsProgram objects
   */
  transformBugcrowdData(data: BugcrowdRawData[]): BountyTargetsProgram[] {
    return data
      .filter(item => item && item.name)
      .map(item => {
        // Extract handle from URL or generate from name
        const handle = this.extractHandleFromUrl(item.url) || this.normalizeHandle(item.name);

        const inScope: BountyTargetsScope[] = (item.targets?.in_scope || []).map(scope => ({
          type: scope.type || 'website',
          target: scope.target,
          eligibleForBounty: true,
        }));

        const outOfScope: BountyTargetsScope[] = (item.targets?.out_of_scope || []).map(scope => ({
          type: scope.type || 'website',
          target: scope.target,
          eligibleForBounty: false,
        }));

        return {
          name: item.name,
          handle,
          url: item.url || '',
          platform: 'bugcrowd',
          offersBounties: true, // Bugcrowd programs typically offer bounties
          maxBounty: null,
          inScope,
          outOfScope,
        };
      });
  }

  /**
   * Transform Intigriti format to internal format
   * 
   * Requirements: 2.4 - Parse intigriti_data.json
   * Requirements: 2.7 - Extract in-scope and out-of-scope targets
   * 
   * @param data Raw Intigriti data array
   * @returns Array of BountyTargetsProgram objects
   */
  transformIntigritiData(data: IntigritiRawData[]): BountyTargetsProgram[] {
    return data
      .filter(item => item && item.company_handle && item.name)
      .map(item => {
        const inScope: BountyTargetsScope[] = (item.targets?.in_scope || []).map(scope => ({
          type: scope.type || 'url',
          target: scope.endpoint,
          eligibleForBounty: true,
        }));

        const outOfScope: BountyTargetsScope[] = (item.targets?.out_of_scope || []).map(scope => ({
          type: scope.type || 'url',
          target: scope.endpoint,
          eligibleForBounty: false,
        }));

        return {
          name: item.name,
          handle: item.company_handle,
          url: item.url || `https://app.intigriti.com/programs/${item.company_handle}`,
          platform: 'intigriti',
          offersBounties: (item.max_bounty != null && item.max_bounty > 0) || false,
          maxBounty: item.max_bounty ?? null,
          inScope,
          outOfScope,
        };
      });
  }

  /**
   * Transform YesWeHack format to internal format
   * 
   * Requirements: 2.5 - Parse yeswehack_data.json
   * Requirements: 2.7 - Extract in-scope targets (YesWeHack uses 'scopes' array)
   * 
   * @param data Raw YesWeHack data array
   * @returns Array of BountyTargetsProgram objects
   */
  transformYesWeHackData(data: YesWeHackRawData[]): BountyTargetsProgram[] {
    return data
      .filter(item => item && item.slug && item.title)
      .map(item => {
        // YesWeHack uses 'scopes' array instead of targets.in_scope
        const inScope: BountyTargetsScope[] = (item.scopes || []).map(scope => ({
          type: scope.scope_type || 'web-application',
          target: scope.scope,
          eligibleForBounty: true,
        }));

        return {
          name: item.title,
          handle: item.slug,
          url: item.url || `https://yeswehack.com/programs/${item.slug}`,
          platform: 'yeswehack',
          offersBounties: (item.max_bounty != null && item.max_bounty > 0) || false,
          maxBounty: item.max_bounty ?? null,
          inScope,
          outOfScope: [], // YesWeHack data doesn't include out-of-scope
        };
      });
  }

  /**
   * Transform Federacy format to internal format
   * 
   * Requirements: 2.6 - Parse federacy_data.json
   * Requirements: 2.7 - Extract in-scope targets
   * 
   * @param data Raw Federacy data array
   * @returns Array of BountyTargetsProgram objects
   */
  transformFederacyData(data: FederacyRawData[]): BountyTargetsProgram[] {
    return data
      .filter(item => item && item.slug && item.name)
      .map(item => {
        const inScope: BountyTargetsScope[] = (item.targets?.in_scope || []).map(scope => ({
          type: scope.type || 'website',
          target: scope.target,
          eligibleForBounty: true,
        }));

        return {
          name: item.name,
          handle: item.slug,
          url: item.url || `https://www.federacy.com/programs/${item.slug}`,
          platform: 'federacy',
          offersBounties: true, // Federacy programs offer bounties
          maxBounty: null,
          inScope,
          outOfScope: [], // Federacy data doesn't include out-of-scope
        };
      });
  }

  /**
   * Fetch all platform data files and aggregate programs
   * 
   * Requirements: 2.1 - Fetch from all platform data files
   * Requirements: 2.8 - Continue with remaining files if one fails
   * 
   * @returns Array of all BountyTargetsProgram objects from all platforms
   */
  async getAllPrograms(): Promise<BountyTargetsProgram[]> {
    const allPrograms: BountyTargetsProgram[] = [];
    const platforms = Object.keys(BOUNTY_TARGETS_FILES) as Array<keyof typeof BOUNTY_TARGETS_FILES>;

    for (const platform of platforms) {
      try {
        const programs = await this.fetchPlatformData(platform);
        allPrograms.push(...programs);
      } catch (error: any) {
        // Requirements: 2.8 - Log error and continue with remaining files
        this.logger.error(`Failed to fetch ${platform} data: ${error.message}`);
        // Continue with remaining platforms
      }
    }

    this.logger.log(`Fetched total of ${allPrograms.length} programs from bounty-targets-data`);
    return allPrograms;
  }

  /**
   * Extract handle from a URL
   * 
   * @param url The URL to extract handle from
   * @returns The extracted handle or empty string
   */
  private extractHandleFromUrl(url?: string): string {
    if (!url) return '';
    
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      return pathParts[pathParts.length - 1] || '';
    } catch {
      return '';
    }
  }

  /**
   * Normalize a name to create a consistent handle
   * 
   * @param name The name to normalize
   * @returns A normalized handle string
   */
  private normalizeHandle(name: string): string {
    if (!name || typeof name !== 'string') {
      return '';
    }

    return name
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
