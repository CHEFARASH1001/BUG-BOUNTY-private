import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface GitHubProgram {
  name: string;
  url: string;
  domains: string[];
  bounty: boolean;
  swag: boolean;
  platform: string;
}

@Injectable()
export class GitHubProgramsService {
  private readonly logger = new Logger(GitHubProgramsService.name);
  private readonly sources = [
    {
      name: 'Arkadiyt Bug Bounty List',
      url: 'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/main/data/domains.txt',
      type: 'domains',
    },
    {
      name: 'Arkadiyt Wildcards',
      url: 'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/main/data/wildcards.txt',
      type: 'wildcards',
    },
    {
      name: 'ProjectDiscovery Chaos',
      url: 'https://chaos-data.projectdiscovery.io/index.json',
      type: 'chaos',
    },
  ];

  constructor(private configService: ConfigService) {}

  async fetchAllDomains(): Promise<string[]> {
    const domains: Set<string> = new Set();

    try {
      // Fetch from Arkadiyt domains
      const domainsResponse = await axios.get(this.sources[0].url);
      if (domainsResponse.data) {
        const lines = domainsResponse.data.split('\n');
        for (const line of lines) {
          const domain = line.trim().toLowerCase();
          if (domain && !domain.startsWith('#')) {
            domains.add(domain);
          }
        }
      }
      this.logger.log(`Fetched ${domains.size} domains from Arkadiyt`);
    } catch (error: any) {
      this.logger.error(`Failed to fetch Arkadiyt domains: ${error.message}`);
    }

    return Array.from(domains);
  }

  async fetchWildcards(): Promise<string[]> {
    const wildcards: string[] = [];

    try {
      const response = await axios.get(this.sources[1].url);
      if (response.data) {
        const lines = response.data.split('\n');
        for (const line of lines) {
          const wildcard = line.trim().toLowerCase();
          if (wildcard && !wildcard.startsWith('#')) {
            wildcards.push(wildcard);
          }
        }
      }
      this.logger.log(`Fetched ${wildcards.length} wildcards from Arkadiyt`);
    } catch (error: any) {
      this.logger.error(`Failed to fetch wildcards: ${error.message}`);
    }

    return wildcards;
  }

  async fetchChaosPrograms(): Promise<{ name: string; url: string; count: number }[]> {
    const programs: { name: string; url: string; count: number }[] = [];

    try {
      const response = await axios.get(this.sources[2].url);
      if (response.data && Array.isArray(response.data)) {
        for (const item of response.data) {
          programs.push({
            name: item.name,
            url: item.URL,
            count: item.count || 0,
          });
        }
      }
      this.logger.log(`Fetched ${programs.length} Chaos programs`);
    } catch (error: any) {
      this.logger.error(`Failed to fetch Chaos programs: ${error.message}`);
    }

    return programs;
  }

  async downloadChaosData(programUrl: string): Promise<string[]> {
    const domains: string[] = [];

    try {
      const response = await axios.get(programUrl, {
        responseType: 'arraybuffer',
      });

      // The data is in zip format, need to extract
      // For simplicity, we'll log that manual extraction is needed
      this.logger.log(`Downloaded Chaos data from ${programUrl}`);
      
      // In a real implementation, you would unzip and parse the content
      // For now, return empty array
    } catch (error: any) {
      this.logger.error(`Failed to download Chaos data: ${error.message}`);
    }

    return domains;
  }

  async fetchDiscloseIoPrograms(): Promise<GitHubProgram[]> {
    const programs: GitHubProgram[] = [];

    try {
      const response = await axios.get(
        'https://raw.githubusercontent.com/disclose/diodb/master/program-list.json',
      );

      if (response.data && Array.isArray(response.data)) {
        for (const item of response.data) {
          programs.push({
            name: item.program_name,
            url: item.policy_url || '',
            domains: item.targets?.filter((t: any) => t.type === 'web')?.map((t: any) => t.target) || [],
            bounty: item.bounty || false,
            swag: item.swag || false,
            platform: item.platform || 'independent',
          });
        }
      }
      this.logger.log(`Fetched ${programs.length} programs from Disclose.io`);
    } catch (error: any) {
      this.logger.error(`Failed to fetch Disclose.io programs: ${error.message}`);
    }

    return programs;
  }
}

