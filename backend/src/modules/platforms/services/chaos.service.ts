import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Interface representing an entry from the Chaos API index
 * Source: https://chaos-data.projectdiscovery.io/index.json
 */
export interface ChaosIndexEntry {
  name: string;
  url: string;
  bounty: boolean;
  swag: boolean;
  count: number;
  change: number;
  is_new: boolean;
  platform: string;
  last_updated: string;
}

/**
 * Interface representing a transformed Chaos program for internal use
 */
export interface ChaosProgram {
  name: string;
  handle: string;
  url: string;
  bounty: boolean;
  swag: boolean;
  domains: string[];
  subdomainCount: number;
  lastUpdated: string;
  platform: string;
}

const CHAOS_INDEX_URL = 'https://chaos-data.projectdiscovery.io/index.json';

/**
 * Service for interacting with ProjectDiscovery Chaos API
 * 
 * Chaos provides subdomain data for bug bounty programs, making it a valuable
 * data source for reconnaissance and program discovery.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
@Injectable()
export class ChaosService {
  private readonly logger = new Logger(ChaosService.name);

  /**
   * Fetch the program index from Chaos API
   * 
   * Requirements: 1.1 - Fetch program index from chaos-data.projectdiscovery.io/index.json
   * 
   * @returns Array of ChaosIndexEntry objects
   */
  async fetchProgramIndex(): Promise<ChaosIndexEntry[]> {
    try {
      this.logger.log('Fetching Chaos program index...');
      
      const response = await axios.get<ChaosIndexEntry[]>(CHAOS_INDEX_URL, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BugBountyPlatform/1.0',
        },
      });

      if (!Array.isArray(response.data)) {
        this.logger.warn('Chaos API returned non-array response');
        return [];
      }

      this.logger.log(`Fetched ${response.data.length} programs from Chaos index`);
      return response.data;
    } catch (error: any) {
      // Requirements: 1.5 - Log error and return empty result without crashing
      this.logger.error(`Failed to fetch Chaos program index: ${error.message}`);
      return [];
    }
  }

  /**
   * Normalize a program name to create a consistent handle
   * 
   * Requirements: 1.4 - Normalize program names to create consistent handles
   * (lowercase, hyphenated, no special characters)
   * 
   * @param name The program name to normalize
   * @returns A normalized handle string
   */
  normalizeHandle(name: string): string {
    if (!name || typeof name !== 'string') {
      return '';
    }

    return name
      .toLowerCase()
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, '-')
      // Remove special characters except hyphens
      .replace(/[^a-z0-9-]/g, '')
      // Replace multiple consecutive hyphens with single hyphen
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Transform a Chaos index entry to internal program format
   * 
   * Requirements: 1.2 - Extract program name, URL, bounty status, and subdomain count
   * Requirements: 1.3 - Store subdomain download URL for later retrieval
   * 
   * @param entry The ChaosIndexEntry to transform
   * @returns A ChaosProgram object
   */
  transformToProgram(entry: ChaosIndexEntry): ChaosProgram {
    return {
      name: entry.name || '',
      handle: this.normalizeHandle(entry.name),
      url: entry.url || '',
      bounty: entry.bounty || false,
      swag: entry.swag || false,
      domains: [], // Domains would be fetched separately if needed
      subdomainCount: entry.count || 0,
      lastUpdated: entry.last_updated || '',
      platform: entry.platform || 'chaos',
    };
  }

  /**
   * Fetch all programs with their metadata
   * 
   * This is the main public method for getting Chaos program data.
   * 
   * @returns Array of ChaosProgram objects
   */
  async getPrograms(): Promise<ChaosProgram[]> {
    try {
      const indexEntries = await this.fetchProgramIndex();
      
      if (indexEntries.length === 0) {
        return [];
      }

      const programs = indexEntries
        .filter(entry => entry.name) // Filter out entries without names
        .map(entry => this.transformToProgram(entry));

      this.logger.log(`Transformed ${programs.length} Chaos programs`);
      return programs;
    } catch (error: any) {
      // Requirements: 1.5 - Log error and return empty result without crashing
      this.logger.error(`Failed to get Chaos programs: ${error.message}`);
      return [];
    }
  }
}
