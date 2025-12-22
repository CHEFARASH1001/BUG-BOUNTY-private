import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChaosSync, ChaosSyncDocument } from '../../../schemas/chaos-sync.schema';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface ChaosProgram {
  name: string;
  url: string;
  count: number;
  lastUpdated: Date;
}

export interface ChaosSyncResult {
  program: string;
  subdomainsImported: number;
  newSubdomains: number;
  timestamp: Date;
}

export interface ChaosIndexEntry {
  name: string;
  URL: string;
  count: number;
  change: number;
  is_new: boolean;
  platform: string;
  last_updated: string;
  bounty: boolean;
}

@Injectable()
export class ChaosService {
  private readonly logger = new Logger(ChaosService.name);
  private readonly chaosIndexUrl = 'https://chaos-data.projectdiscovery.io/index.json';
  private readonly tempDir = path.join(os.tmpdir(), 'chaos-data');

  constructor(
    @InjectModel(ChaosSync.name) private chaosSyncModel: Model<ChaosSyncDocument>,
  ) {
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }


  /**
   * Fetch the Chaos index from ProjectDiscovery
   * Implements Requirement 14.1: Fetch the Chaos index from chaos-data.projectdiscovery.io
   * Property 33: Chaos Index Parsing - extracts program names, URLs, and subdomain counts correctly
   */
  async fetchIndex(): Promise<ChaosProgram[]> {
    try {
      const indexData = await this.downloadJson(this.chaosIndexUrl);
      return this.parseIndex(indexData);
    } catch (error) {
      this.logger.error('Failed to fetch Chaos index:', error);
      throw error;
    }
  }

  /**
   * Parse the Chaos index JSON response
   * Property 33: Chaos Index Parsing - extracts program names, URLs, and subdomain counts correctly
   */
  parseIndex(indexData: ChaosIndexEntry[]): ChaosProgram[] {
    if (!Array.isArray(indexData)) {
      return [];
    }

    return indexData.map((entry) => ({
      name: entry.name || '',
      url: entry.URL || '',
      count: typeof entry.count === 'number' ? entry.count : 0,
      lastUpdated: entry.last_updated ? new Date(entry.last_updated) : new Date(),
    }));
  }

  /**
   * Sync a specific program from Chaos
   * Implements Requirement 14.2: Download and extract ZIP files for matching programs
   * Implements Requirement 14.3: Import subdomains with source set to chaos
   * Implements Requirement 14.4: Report the count of new subdomains discovered
   */
  async syncProgram(programName: string, existingSubdomains: string[] = []): Promise<ChaosSyncResult> {
    const programs = await this.fetchIndex();
    const program = programs.find(
      (p) => p.name.toLowerCase() === programName.toLowerCase(),
    );

    if (!program) {
      throw new Error(`Program "${programName}" not found in Chaos index`);
    }

    // Download and extract the ZIP file
    const subdomains = await this.downloadAndExtractZip(program);

    // Calculate new subdomains
    const existingSet = new Set(existingSubdomains.map((s) => s.toLowerCase()));
    const newSubdomains = subdomains.filter(
      (s) => !existingSet.has(s.toLowerCase()),
    );

    const result: ChaosSyncResult = {
      program: programName,
      subdomainsImported: subdomains.length,
      newSubdomains: newSubdomains.length,
      timestamp: new Date(),
    };

    // Store sync record
    await this.chaosSyncModel.findOneAndUpdate(
      { programName: programName.toLowerCase() },
      {
        programName: programName.toLowerCase(),
        chaosUrl: program.url,
        subdomainsImported: result.subdomainsImported,
        newSubdomains: result.newSubdomains,
        syncedAt: result.timestamp,
      },
      { upsert: true, new: true },
    );

    return result;
  }


  /**
   * Download and extract ZIP file for a program
   * Property 34: Chaos ZIP Extraction - produces a list of subdomains matching the expected count
   */
  async downloadAndExtractZip(program: ChaosProgram): Promise<string[]> {
    if (!program.url) {
      return [];
    }

    const zipPath = path.join(this.tempDir, `${program.name}.zip`);
    const extractDir = path.join(this.tempDir, program.name);

    try {
      // Download the ZIP file
      await this.downloadFile(program.url, zipPath);

      // Create extraction directory
      if (!fs.existsSync(extractDir)) {
        fs.mkdirSync(extractDir, { recursive: true });
      }

      // Extract the ZIP file using unzip command
      await execAsync(`unzip -o "${zipPath}" -d "${extractDir}"`, {
        timeout: 60000, // 1 minute timeout
      });

      // Read all .txt files in the extracted directory
      const subdomains = await this.readSubdomainsFromDir(extractDir);

      // Cleanup
      this.cleanupFiles(zipPath, extractDir);

      return subdomains;
    } catch (error) {
      this.logger.error(`Failed to download/extract ZIP for ${program.name}:`, error);
      // Cleanup on error
      this.cleanupFiles(zipPath, extractDir);
      return [];
    }
  }

  /**
   * Read subdomains from extracted directory
   */
  private async readSubdomainsFromDir(dir: string): Promise<string[]> {
    const subdomains = new Set<string>();

    try {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isFile() && (file.endsWith('.txt') || !file.includes('.'))) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');

          for (const line of lines) {
            const subdomain = line.trim().toLowerCase();
            if (subdomain && this.isValidSubdomain(subdomain)) {
              subdomains.add(subdomain);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error reading subdomains from directory:', error);
    }

    return Array.from(subdomains);
  }

  /**
   * Validate subdomain format
   */
  private isValidSubdomain(subdomain: string): boolean {
    if (!subdomain || subdomain.length === 0 || subdomain.length > 253) {
      return false;
    }

    // Check for valid subdomain characters
    const validPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
    return validPattern.test(subdomain);
  }

  /**
   * Cleanup temporary files
   */
  private cleanupFiles(zipPath: string, extractDir: string): void {
    try {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup temporary files:', error);
    }
  }


  /**
   * Sync all programs from Chaos
   * Batch syncing for multiple programs
   */
  async syncAll(existingSubdomainsMap: Map<string, string[]> = new Map()): Promise<ChaosSyncResult[]> {
    const programs = await this.fetchIndex();
    const results: ChaosSyncResult[] = [];

    for (const program of programs) {
      try {
        const existingSubdomains = existingSubdomainsMap.get(program.name.toLowerCase()) || [];
        const result = await this.syncProgram(program.name, existingSubdomains);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to sync program ${program.name}:`, error);
        // Continue with other programs
      }
    }

    return results;
  }

  /**
   * Find programs matching a search query
   * Implements Requirement 14.1: Search for programs in the Chaos index
   */
  async findMatchingPrograms(query: string): Promise<ChaosProgram[]> {
    const programs = await this.fetchIndex();
    const lowerQuery = query.toLowerCase();

    return programs.filter((program) =>
      program.name.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * Get sync status for a program
   */
  async getSyncStatus(programName: string): Promise<ChaosSync | null> {
    return this.chaosSyncModel.findOne({
      programName: programName.toLowerCase(),
    });
  }

  /**
   * Enable or disable watching for a program
   * Implements Requirement 14.5: Enable/disable Chaos watching
   */
  async setWatchEnabled(programName: string, enabled: boolean): Promise<ChaosSync | null> {
    return this.chaosSyncModel.findOneAndUpdate(
      { programName: programName.toLowerCase() },
      { watchEnabled: enabled },
      { new: true },
    );
  }

  /**
   * Get all programs with watching enabled
   */
  async getWatchedPrograms(): Promise<ChaosSync[]> {
    return this.chaosSyncModel.find({ watchEnabled: true });
  }


  /**
   * Download JSON from a URL
   */
  private async downloadJson(url: string): Promise<ChaosIndexEntry[]> {
    try {
      const response = await axios.get<ChaosIndexEntry[]>(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'BugBountyPlatform/1.0',
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to download JSON from ${url}:`, error);
      throw new Error(`Failed to download index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download a file from a URL
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    try {
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 120000, // 2 minute timeout for large files
        headers: {
          'User-Agent': 'BugBountyPlatform/1.0',
        },
      });

      const writer = fs.createWriteStream(destPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', (err) => {
          fs.unlinkSync(destPath);
          reject(err);
        });
      });
    } catch (error) {
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the list of subdomains extracted from a program
   * Returns subdomains with source attribution set to "chaos"
   * Property 35: Chaos Source Attribution - source set to "chaos"
   */
  getSubdomainsWithSource(subdomains: string[]): { subdomain: string; source: string }[] {
    return subdomains.map((subdomain) => ({
      subdomain: subdomain.toLowerCase(),
      source: 'chaos',
    }));
  }

  /**
   * Calculate new subdomain count
   * Property 36: Chaos Sync Count Accuracy - new count equals difference between imported and existing
   */
  calculateNewSubdomainCount(
    importedSubdomains: string[],
    existingSubdomains: string[],
  ): number {
    const existingSet = new Set(existingSubdomains.map((s) => s.toLowerCase()));
    const newSubdomains = importedSubdomains.filter(
      (s) => !existingSet.has(s.toLowerCase()),
    );
    return newSubdomains.length;
  }
}
