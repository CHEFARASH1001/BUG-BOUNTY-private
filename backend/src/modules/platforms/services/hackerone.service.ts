import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

// Bounty tier structure for severity-based bounty ranges
export interface BountyTier {
  severity: string;  // 'critical', 'high', 'medium', 'low'
  min: number | null;
  max: number | null;
}

// Response metrics interface
export interface ResponseMetrics {
  averageTimeToFirstResponse: number | null;  // in days
  averageTimeToBounty: number | null;         // in days
  averageTimeToResolution: number | null;     // in days
}

// Activity statistics interface
export interface ActivityStats {
  resolvedReportCount: number | null;
  totalBountiesPaid: number | null;
  hackersThanked: number | null;
  reportsLast90Days?: number | null;
}

// Bounty table structure with severity-based min/max
export interface BountyTable {
  critical?: { min: number | null; max: number | null };
  high?: { min: number | null; max: number | null };
  medium?: { min: number | null; max: number | null };
  low?: { min: number | null; max: number | null };
}

export interface HackerOneProgram {
  id: string;
  handle: string;
  name: string;
  url: string;
  state: string;
  submissionState: string;
  offersBounties: boolean;
  bountyRanges: {
    low: number;
    high: number;
  }[];
  
  // NEW: Bounty information (Requirements: 1.1, 1.2, 1.4)
  bountyTable: BountyTable | null;
  
  // NEW: Response metrics (Requirements: 2.1, 2.2, 2.3, 2.4)
  responseMetrics: ResponseMetrics | null;
  
  // NEW: Activity statistics (Requirements: 3.1, 3.2, 3.3)
  activityStats: ActivityStats | null;
  
  // NEW: Program launch date (Requirements: 3.4)
  launchedAt: string | null;
  
  scopes: HackerOneScope[];
  createdAt: string;
  updatedAt: string;
}

export interface HackerOneScope {
  id: string;
  assetType: string;
  assetIdentifier: string;
  eligibleForBounty: boolean;
  eligibleForSubmission: boolean;
  instruction: string;
  maxSeverity: string;
}

@Injectable()
export class HackerOneService {
  private readonly logger = new Logger(HackerOneService.name);
  private readonly client: AxiosInstance;
  private readonly apiUsername: string;
  private readonly apiToken: string;

  constructor(private configService: ConfigService) {
    this.apiUsername = this.configService.get<string>('HACKERONE_API_USERNAME', '');
    this.apiToken = this.configService.get<string>('HACKERONE_API_TOKEN', '');

    this.client = axios.create({
      baseURL: 'https://api.hackerone.com/v1',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      auth: {
        username: this.apiUsername,
        password: this.apiToken,
      },
    });
  }

  async getAllPrograms(page = 1, pageSize = 100): Promise<HackerOneProgram[]> {
    const programs: HackerOneProgram[] = [];

    try {
      this.logger.log(`Fetching HackerOne programs (page ${page})`);

      const response = await this.client.get('/hackers/programs', {
        params: {
          page: { number: page, size: pageSize },
        },
      });

      const data = response.data;
      if (data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          const program = this.transformProgram(item);
          programs.push(program);
        }

        // Handle pagination
        if (data.links?.next) {
          const nextPrograms = await this.getAllPrograms(page + 1, pageSize);
          programs.push(...nextPrograms);
        }
      }

      this.logger.log(`Fetched ${programs.length} programs from HackerOne`);
      return programs;
    } catch (error: any) {
      this.logger.error(`Failed to fetch HackerOne programs: ${error.message}`);
      throw error;
    }
  }

  async getProgramDetails(handle: string): Promise<HackerOneProgram | null> {
    try {
      this.logger.log(`Fetching HackerOne program: ${handle}`);

      const response = await this.client.get(`/hackers/programs/${handle}`);
      const data = response.data;

      if (data.data) {
        return this.transformProgram(data.data);
      }

      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      this.logger.error(`Failed to fetch HackerOne program ${handle}: ${error.message}`);
      throw error;
    }
  }

  async getProgramScopes(handle: string): Promise<HackerOneScope[]> {
    try {
      this.logger.log(`Fetching scopes for HackerOne program: ${handle}`);

      const response = await this.client.get(`/hackers/programs/${handle}/structured_scopes`);
      const data = response.data;

      const scopes: HackerOneScope[] = [];

      if (data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          scopes.push(this.transformScope(item));
        }
      }

      return scopes;
    } catch (error: any) {
      this.logger.error(`Failed to fetch scopes for ${handle}: ${error.message}`);
      throw error;
    }
  }

  async getPublicPrograms(): Promise<HackerOneProgram[]> {
    // Check if we have valid API credentials
    if (this.apiUsername && this.apiToken) {
      this.logger.log('Using HackerOne API with credentials');
      try {
        return await this.getAllPrograms();
      } catch (error: any) {
        this.logger.warn(`HackerOne API failed: ${error.message}, falling back to public directory`);
      }
    } else {
      this.logger.log('No HackerOne API credentials, using public directory');
    }
    
    return this.fetchPublicDirectory();
  }

  private async fetchPublicDirectory(): Promise<HackerOneProgram[]> {
    const programs: HackerOneProgram[] = [];

    try {
      this.logger.log('Fetching HackerOne public directory via GraphQL');

      // Use HackerOne's GraphQL endpoint for public programs
      // Fetch all available fields for better scoring
      const query = `
        query DirectoryQuery($cursor: String, $secureOrderBy: FiltersTeamFilterOrder, $where: FiltersTeamFilterInput) {
          teams(first: 100, after: $cursor, secure_order_by: $secureOrderBy, where: $where) {
            pageInfo {
              endCursor
              hasNextPage
            }
            edges {
              node {
                id
                handle
                name
                state
                offers_bounties
                submission_state
                started_accepting_at
                url
                launched_at
                currency
                base_bounty
                resolved_report_count
                reports_received_last_90_days
                first_response_time
                bounty_time
                resolution_time
                average_bounty_lower_amount
                average_bounty_upper_amount
                top_bounty_lower_amount
                top_bounty_upper_amount
                minimum_bounty_table_value
                maximum_bounty_table_value
                response_efficiency_percentage
                in_scope: structured_scopes(first: 100, archived: false, eligible_for_submission: true) {
                  edges {
                    node {
                      asset_type
                      asset_identifier
                      eligible_for_bounty
                      eligible_for_submission
                      instruction
                      max_severity
                    }
                  }
                }
                out_of_scope: structured_scopes(first: 100, archived: false, eligible_for_submission: false) {
                  edges {
                    node {
                      asset_type
                      asset_identifier
                      eligible_for_bounty
                      eligible_for_submission
                      instruction
                      max_severity
                    }
                  }
                }
              }
            }
          }
        }
      `;

      let hasNextPage = true;
      let cursor: string | null = null;

      while (hasNextPage) {
        const response = await axios.post(
          'https://hackerone.com/graphql',
          {
            operationName: 'DirectoryQuery',
            query,
            variables: {
              cursor,
              secureOrderBy: { launched_at: { _direction: 'DESC' } },
              where: {
                _and: [
                  { offers_bounties: { _eq: true } },
                  { _or: [
                    { state: { _eq: 'soft_launched' } },
                    { state: { _eq: 'public_mode' } }
                  ]},
                ],
              },
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          },
        );

        const responseData = response.data as any;
        
        // Check for GraphQL errors
        if (responseData?.errors) {
          this.logger.error(`HackerOne GraphQL errors: ${JSON.stringify(responseData.errors)}`);
          break;
        }
        
        const teamsData = responseData?.data?.teams;
        
        if (teamsData?.edges) {
          for (const edge of teamsData.edges) {
            const node = edge.node;
            const scopes: HackerOneScope[] = [];
            
            // Process in-scope items
            if (node.in_scope?.edges) {
              for (const scopeEdge of node.in_scope.edges) {
                const scopeNode = scopeEdge.node;
                scopes.push({
                  id: `${node.handle}-${scopeNode.asset_identifier}`,
                  assetType: scopeNode.asset_type || 'URL',
                  assetIdentifier: scopeNode.asset_identifier,
                  eligibleForBounty: scopeNode.eligible_for_bounty || false,
                  eligibleForSubmission: true, // In-scope
                  instruction: scopeNode.instruction || '',
                  maxSeverity: scopeNode.max_severity || 'critical',
                });
              }
            }
            
            // Process out-of-scope items
            if (node.out_of_scope?.edges) {
              for (const scopeEdge of node.out_of_scope.edges) {
                const scopeNode = scopeEdge.node;
                scopes.push({
                  id: `${node.handle}-${scopeNode.asset_identifier}-oos`,
                  assetType: scopeNode.asset_type || 'URL',
                  assetIdentifier: scopeNode.asset_identifier,
                  eligibleForBounty: false, // Out-of-scope items are not eligible
                  eligibleForSubmission: false, // Out of scope
                  instruction: scopeNode.instruction || '',
                  maxSeverity: scopeNode.max_severity || 'none',
                });
              }
            }

            programs.push({
              id: node.id,
              handle: node.handle,
              name: node.name,
              url: node.url || `https://hackerone.com/${node.handle}`,
              state: node.state || 'open',
              submissionState: node.submission_state || 'open',
              offersBounties: node.offers_bounties || false,
              bountyRanges: [],
              // Build bounty table from available fields
              bountyTable: this.buildBountyTableFromGraphQL(node),
              // Build response metrics from available fields
              responseMetrics: this.buildResponseMetricsFromGraphQL(node),
              // Extract activity statistics from available fields
              activityStats: {
                resolvedReportCount: node.resolved_report_count ?? null,
                totalBountiesPaid: null, // Not directly available
                hackersThanked: null,    // Not directly available
                reportsLast90Days: node.reports_received_last_90_days ?? null,
              },
              // Extract launch date
              launchedAt: node.launched_at || null,
              scopes,
              createdAt: node.started_accepting_at,
              updatedAt: node.started_accepting_at,
            });
          }

          hasNextPage = teamsData.pageInfo?.hasNextPage || false;
          cursor = teamsData.pageInfo?.endCursor || null;
          
          this.logger.log(`Fetched ${programs.length} programs so far...`);
          
          // Limit to avoid too many requests
          if (programs.length >= 500) {
            this.logger.log('Reached 500 program limit for public directory');
            break;
          }
        } else {
          hasNextPage = false;
        }
      }

      this.logger.log(`Fetched ${programs.length} programs from HackerOne public directory`);
      return programs;
    } catch (error: any) {
      this.logger.error(`Failed to fetch public directory: ${error.message}`);
      if (error.response) {
        this.logger.error(`Response status: ${error.response.status}`);
        this.logger.error(`Response data: ${JSON.stringify(error.response.data).substring(0, 500)}`);
      }
      if (error.stack) {
        this.logger.error(`Stack trace: ${error.stack.substring(0, 500)}`);
      }
      return programs;
    }
  }

  private transformProgram(data: any): HackerOneProgram {
    const attributes = data.attributes || {};
    const relationships = data.relationships || {};

    const bountyRanges: { low: number; high: number }[] = [];
    if (attributes.bounty_table) {
      for (const tier of attributes.bounty_table) {
        bountyRanges.push({
          low: tier.low || 0,
          high: tier.high || 0,
        });
      }
    }

    const scopes: HackerOneScope[] = [];
    if (relationships.structured_scopes?.data) {
      for (const scope of relationships.structured_scopes.data) {
        scopes.push(this.transformScope(scope));
      }
    }

    return {
      id: data.id,
      handle: attributes.handle,
      name: attributes.name,
      url: `https://hackerone.com/${attributes.handle}`,
      state: attributes.state,
      submissionState: attributes.submission_state,
      offersBounties: attributes.offers_bounties || false,
      bountyRanges,
      // Extract bounty table data (Requirements: 1.1, 1.2)
      bountyTable: this.extractBountyTableFromAttributes(attributes),
      // Extract response metrics (Requirements: 2.1, 2.2, 2.3)
      responseMetrics: this.extractResponseMetricsFromAttributes(attributes),
      // Extract activity statistics (Requirements: 3.1, 3.2, 3.3)
      activityStats: this.extractActivityStatsFromAttributes(attributes),
      // Extract launch date (Requirements: 3.4)
      launchedAt: attributes.launched_at || null,
      scopes,
      createdAt: attributes.started_accepting_at,
      updatedAt: attributes.updated_at,
    };
  }

  /**
   * Build bounty table from GraphQL response fields
   * Uses average_bounty, top_bounty, minimum/maximum_bounty_table_value
   */
  private buildBountyTableFromGraphQL(node: any): BountyTable | null {
    const hasAnyBountyData = 
      node.minimum_bounty_table_value !== undefined ||
      node.maximum_bounty_table_value !== undefined ||
      node.average_bounty_lower_amount !== undefined ||
      node.average_bounty_upper_amount !== undefined ||
      node.top_bounty_lower_amount !== undefined ||
      node.top_bounty_upper_amount !== undefined ||
      node.base_bounty !== undefined;

    if (!hasAnyBountyData) {
      return null;
    }

    // Build bounty table using available data
    // Use top_bounty as critical, average as medium, minimum as low
    const bountyTable: BountyTable = {};

    // Critical: use top bounty or maximum table value
    if (node.top_bounty_lower_amount !== undefined || node.top_bounty_upper_amount !== undefined || node.maximum_bounty_table_value !== undefined) {
      bountyTable.critical = {
        min: node.top_bounty_lower_amount ?? null,
        max: node.top_bounty_upper_amount ?? node.maximum_bounty_table_value ?? null,
      };
    }

    // High: estimate between top and average
    if (node.average_bounty_upper_amount !== undefined && node.top_bounty_lower_amount !== undefined) {
      bountyTable.high = {
        min: node.average_bounty_upper_amount ?? null,
        max: node.top_bounty_lower_amount ?? null,
      };
    }

    // Medium: use average bounty
    if (node.average_bounty_lower_amount !== undefined || node.average_bounty_upper_amount !== undefined) {
      bountyTable.medium = {
        min: node.average_bounty_lower_amount ?? null,
        max: node.average_bounty_upper_amount ?? null,
      };
    }

    // Low: use minimum table value or base bounty
    if (node.minimum_bounty_table_value !== undefined || node.base_bounty !== undefined) {
      bountyTable.low = {
        min: node.minimum_bounty_table_value ?? node.base_bounty ?? null,
        max: node.average_bounty_lower_amount ?? node.base_bounty ?? null,
      };
    }

    return Object.keys(bountyTable).length > 0 ? bountyTable : null;
  }

  /**
   * Build response metrics from GraphQL response fields
   * Uses first_response_time, bounty_time, resolution_time (in seconds)
   */
  private buildResponseMetricsFromGraphQL(node: any): ResponseMetrics | null {
    const hasAnyMetric = 
      node.first_response_time !== undefined ||
      node.bounty_time !== undefined ||
      node.resolution_time !== undefined ||
      node.response_efficiency_percentage !== undefined;

    if (!hasAnyMetric) {
      return null;
    }

    return {
      // Convert from seconds to days
      averageTimeToFirstResponse: this.convertSecondsToDays(node.first_response_time),
      averageTimeToBounty: this.convertSecondsToDays(node.bounty_time),
      averageTimeToResolution: this.convertSecondsToDays(node.resolution_time),
    };
  }

  /**
   * Extract bounty table from GraphQL response node
   * Requirements: 1.1, 1.2 - Extract min/max for each severity level
   * Uses null for missing data, not zero (Requirement 1.4)
   */
  extractBountyTable(bountyTableData: any): BountyTable | null {
    if (!bountyTableData) {
      return null;
    }

    const bountyTable: BountyTable = {};

    // Extract critical severity bounty range
    if (bountyTableData.critical_minimum !== undefined || bountyTableData.critical_maximum !== undefined) {
      bountyTable.critical = {
        min: bountyTableData.critical_minimum ?? null,
        max: bountyTableData.critical_maximum ?? null,
      };
    }

    // Extract high severity bounty range
    if (bountyTableData.high_minimum !== undefined || bountyTableData.high_maximum !== undefined) {
      bountyTable.high = {
        min: bountyTableData.high_minimum ?? null,
        max: bountyTableData.high_maximum ?? null,
      };
    }

    // Extract medium severity bounty range
    if (bountyTableData.medium_minimum !== undefined || bountyTableData.medium_maximum !== undefined) {
      bountyTable.medium = {
        min: bountyTableData.medium_minimum ?? null,
        max: bountyTableData.medium_maximum ?? null,
      };
    }

    // Extract low severity bounty range
    if (bountyTableData.low_minimum !== undefined || bountyTableData.low_maximum !== undefined) {
      bountyTable.low = {
        min: bountyTableData.low_minimum ?? null,
        max: bountyTableData.low_maximum ?? null,
      };
    }

    // Return null if no bounty data was found
    return Object.keys(bountyTable).length > 0 ? bountyTable : null;
  }

  /**
   * Extract bounty table from REST API attributes
   * Requirements: 1.1, 1.2 - Extract min/max for each severity level
   */
  private extractBountyTableFromAttributes(attributes: any): BountyTable | null {
    if (!attributes.bounty_table || !Array.isArray(attributes.bounty_table)) {
      return null;
    }

    const bountyTable: BountyTable = {};

    for (const tier of attributes.bounty_table) {
      const severity = tier.severity?.toLowerCase();
      if (severity && ['critical', 'high', 'medium', 'low'].includes(severity)) {
        bountyTable[severity as keyof BountyTable] = {
          min: tier.low ?? tier.min ?? null,
          max: tier.high ?? tier.max ?? null,
        };
      }
    }

    return Object.keys(bountyTable).length > 0 ? bountyTable : null;
  }

  /**
   * Extract response metrics from GraphQL response node
   * Requirements: 2.1, 2.2, 2.3 - Extract response time metrics
   * Converts from seconds to days
   */
  extractResponseMetrics(node: any): ResponseMetrics | null {
    const hasAnyMetric = 
      node.average_time_to_first_program_response !== undefined ||
      node.average_time_to_bounty_awarded !== undefined ||
      node.average_time_to_resolution !== undefined;

    if (!hasAnyMetric) {
      return null;
    }

    return {
      // Convert from seconds to days (Requirements: 2.1, 2.2, 2.3)
      averageTimeToFirstResponse: this.convertSecondsToDays(node.average_time_to_first_program_response),
      averageTimeToBounty: this.convertSecondsToDays(node.average_time_to_bounty_awarded),
      averageTimeToResolution: this.convertSecondsToDays(node.average_time_to_resolution),
    };
  }

  /**
   * Extract response metrics from REST API attributes
   * Requirements: 2.1, 2.2, 2.3 - Extract response time metrics
   */
  private extractResponseMetricsFromAttributes(attributes: any): ResponseMetrics | null {
    const hasAnyMetric = 
      attributes.average_time_to_first_program_response !== undefined ||
      attributes.average_time_to_bounty_awarded !== undefined ||
      attributes.average_time_to_resolution !== undefined;

    if (!hasAnyMetric) {
      return null;
    }

    return {
      averageTimeToFirstResponse: this.convertSecondsToDays(attributes.average_time_to_first_program_response),
      averageTimeToBounty: this.convertSecondsToDays(attributes.average_time_to_bounty_awarded),
      averageTimeToResolution: this.convertSecondsToDays(attributes.average_time_to_resolution),
    };
  }

  /**
   * Extract activity statistics from GraphQL response node
   * Requirements: 3.1, 3.2, 3.3 - Extract activity stats
   */
  extractActivityStats(node: any): ActivityStats | null {
    const hasAnyStats = 
      node.resolved_report_count !== undefined ||
      node.total_bounties_paid_amount !== undefined ||
      node.hackers_thanked_count !== undefined;

    if (!hasAnyStats) {
      return null;
    }

    return {
      resolvedReportCount: node.resolved_report_count ?? null,
      totalBountiesPaid: node.total_bounties_paid_amount ?? null,
      hackersThanked: node.hackers_thanked_count ?? null,
    };
  }

  /**
   * Extract activity statistics from REST API attributes
   * Requirements: 3.1, 3.2, 3.3 - Extract activity stats
   */
  private extractActivityStatsFromAttributes(attributes: any): ActivityStats | null {
    const hasAnyStats = 
      attributes.resolved_report_count !== undefined ||
      attributes.total_bounties_paid_amount !== undefined ||
      attributes.hackers_thanked_count !== undefined;

    if (!hasAnyStats) {
      return null;
    }

    return {
      resolvedReportCount: attributes.resolved_report_count ?? null,
      totalBountiesPaid: attributes.total_bounties_paid_amount ?? null,
      hackersThanked: attributes.hackers_thanked_count ?? null,
    };
  }

  /**
   * Convert seconds to days
   * Returns null if input is null/undefined
   */
  private convertSecondsToDays(seconds: number | null | undefined): number | null {
    if (seconds === null || seconds === undefined) {
      return null;
    }
    // Convert seconds to days (86400 seconds per day)
    return Math.round((seconds / 86400) * 100) / 100;
  }

  private transformScope(data: any): HackerOneScope {
    const attributes = data.attributes || data;

    return {
      id: data.id,
      assetType: attributes.asset_type,
      assetIdentifier: attributes.asset_identifier,
      eligibleForBounty: attributes.eligible_for_bounty || false,
      eligibleForSubmission: attributes.eligible_for_submission || true,
      instruction: attributes.instruction || '',
      maxSeverity: attributes.max_severity || 'critical',
    };
  }
}

