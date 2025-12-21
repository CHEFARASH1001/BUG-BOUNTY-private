import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

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
                structured_scopes(first: 100, archived: false) {
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
            
            if (node.structured_scopes?.edges) {
              for (const scopeEdge of node.structured_scopes.edges) {
                const scopeNode = scopeEdge.node;
                scopes.push({
                  id: `${node.handle}-${scopeNode.asset_identifier}`,
                  assetType: scopeNode.asset_type || 'URL',
                  assetIdentifier: scopeNode.asset_identifier,
                  eligibleForBounty: scopeNode.eligible_for_bounty || false,
                  eligibleForSubmission: scopeNode.eligible_for_submission || true,
                  instruction: scopeNode.instruction || '',
                  maxSeverity: scopeNode.max_severity || 'critical',
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
      scopes,
      createdAt: attributes.started_accepting_at,
      updatedAt: attributes.updated_at,
    };
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

