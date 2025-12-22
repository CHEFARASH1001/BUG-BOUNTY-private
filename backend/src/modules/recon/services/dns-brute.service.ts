import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { WordlistService } from './wordlist.service';
import {
  DNSBruteJob,
  DNSBruteJobDocument,
  DNSBruteJobStatus,
  DNSBruteMode,
  WordlistConfig,
} from '../../../schemas/dns-brute-job.schema';

const execAsync = promisify(exec);
const fsPromises = fs.promises;

export interface DNSBruteConfig {
  domain: string;
  wordlistConfig: WordlistConfig;
  threads: number;
  resolvers?: string;
  mode: 'static' | 'dynamic';
}

// Wordlist URLs for static brute forcing
const WORDLIST_URLS = {
  bestDns: 'https://wordlists-cdn.assetnote.io/data/manual/best-dns-wordlist.txt',
  twoMillionSubdomains: 'https://wordlists-cdn.assetnote.io/data/manual/2m-subdomains.txt',
  dnsgenWords: 'https://raw.githubusercontent.com/ProjectAnte/dnsgen/master/dnsgen/words.txt',
  altdnsWords: 'https://raw.githubusercontent.com/infosec-au/altdns/master/words.txt',
};

@Injectable()
export class DNSBruteService {
  private readonly logger = new Logger(DNSBruteService.name);
  private readonly workDir = '/tmp/dns-brute';
  private readonly defaultResolvers = '/app/resolvers.txt';
  private runningJobs: Map<string, ChildProcess> = new Map();

  constructor(
    @InjectModel(DNSBruteJob.name) private dnsBruteJobModel: Model<DNSBruteJobDocument>,
    private wordlistService: WordlistService,
  ) {
    this.ensureWorkDir();
  }

  /**
   * Ensure the work directory exists
   */
  private async ensureWorkDir(): Promise<void> {
    try {
      await fsPromises.mkdir(this.workDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create work directory: ${error}`);
    }
  }

  /**
   * Prepare static wordlist by downloading and merging wordlists
   * Requirements: 11.1, 11.2, 11.3
   */
  async prepareStaticWordlist(config: WordlistConfig, domain: string): Promise<string> {
    await this.ensureWorkDir();
    const wordlistPaths: string[] = [];
    const timestamp = Date.now();

    // Download best-dns-wordlist if enabled
    if (config.sources.bestDns) {
      try {
        const info = await this.wordlistService.downloadWordlist(
          WORDLIST_URLS.bestDns,
          'best-dns-wordlist',
        );
        wordlistPaths.push(info.path);
        this.logger.log(`Downloaded best-dns-wordlist: ${info.lineCount} lines`);
      } catch (error) {
        this.logger.warn(`Failed to download best-dns-wordlist: ${error}`);
      }
    }

    // Download 2m-subdomains if enabled
    if (config.sources.twoMillionSubdomains) {
      try {
        const info = await this.wordlistService.downloadWordlist(
          WORDLIST_URLS.twoMillionSubdomains,
          '2m-subdomains',
        );
        wordlistPaths.push(info.path);
        this.logger.log(`Downloaded 2m-subdomains: ${info.lineCount} lines`);
      } catch (error) {
        this.logger.warn(`Failed to download 2m-subdomains: ${error}`);
      }
    }

    // Generate crunch wordlist if enabled
    if (config.sources.crunch && config.crunchConfig) {
      try {
        const crunchPath = await this.wordlistService.generateCrunch(
          config.crunchConfig.minLength,
          config.crunchConfig.maxLength,
          config.crunchConfig.charset,
        );
        wordlistPaths.push(crunchPath);
        this.logger.log(`Generated crunch wordlist`);
      } catch (error) {
        this.logger.warn(`Failed to generate crunch wordlist: ${error}`);
      }
    }

    // Add custom wordlists if provided
    if (config.sources.custom && config.sources.custom.length > 0) {
      for (const customPath of config.sources.custom) {
        try {
          await fsPromises.access(customPath, fs.constants.R_OK);
          wordlistPaths.push(customPath);
        } catch {
          this.logger.warn(`Custom wordlist not found: ${customPath}`);
        }
      }
    }

    if (wordlistPaths.length === 0) {
      throw new Error('No wordlists available for DNS brute forcing');
    }

    // Merge all wordlists
    const mergedPath = path.join(this.workDir, `merged_${timestamp}.txt`);
    await this.wordlistService.mergeWordlists(wordlistPaths, mergedPath);

    // Append domain to each entry
    const finalPath = path.join(this.workDir, `final_${domain}_${timestamp}.txt`);
    await this.wordlistService.appendDomain(mergedPath, domain, finalPath);

    // Clean up merged file
    try {
      await fsPromises.unlink(mergedPath);
    } catch {
      // Ignore cleanup errors
    }

    return finalPath;
  }

  /**
   * Prepare dynamic wordlist by downloading dnsgen and altdns wordlists
   * Requirements: 12.1, 12.2
   */
  async prepareDynamicWordlist(existingSubdomains: string[]): Promise<string> {
    await this.ensureWorkDir();
    const timestamp = Date.now();
    const wordlistPaths: string[] = [];

    // Download dnsgen words
    try {
      const info = await this.wordlistService.downloadWordlist(
        WORDLIST_URLS.dnsgenWords,
        'dnsgen-words',
      );
      wordlistPaths.push(info.path);
      this.logger.log(`Downloaded dnsgen words: ${info.lineCount} lines`);
    } catch (error) {
      this.logger.warn(`Failed to download dnsgen words: ${error}`);
    }

    // Download altdns words
    try {
      const info = await this.wordlistService.downloadWordlist(
        WORDLIST_URLS.altdnsWords,
        'altdns-words',
      );
      wordlistPaths.push(info.path);
      this.logger.log(`Downloaded altdns words: ${info.lineCount} lines`);
    } catch (error) {
      this.logger.warn(`Failed to download altdns words: ${error}`);
    }

    if (wordlistPaths.length === 0) {
      throw new Error('No wordlists available for dynamic DNS brute forcing');
    }

    // Merge wordlists
    const mergedPath = path.join(this.workDir, `dynamic_words_${timestamp}.txt`);
    await this.wordlistService.mergeWordlists(wordlistPaths, mergedPath);

    // Write existing subdomains to a file for dnsgen input
    const subdomainsPath = path.join(this.workDir, `subdomains_${timestamp}.txt`);
    await fsPromises.writeFile(subdomainsPath, existingSubdomains.join('\n'));

    return mergedPath;
  }

  /**
   * Build shuffledns command for static brute forcing
   * Requirements: 11.4
   */
  buildShuffleDNSCommand(
    wordlistPath: string,
    domain: string,
    threads: number,
    resolversPath: string,
    outputPath: string,
  ): string[] {
    return [
      '-d', domain,
      '-w', wordlistPath,
      '-r', resolversPath,
      '-t', threads.toString(),
      '-m', 'massdns', // Use massdns mode
      '-o', outputPath,
      '-silent',
    ];
  }

  /**
   * Build dnsgen command for generating permutations
   * Requirements: 12.3
   */
  buildDNSGenCommand(subdomainsPath: string, wordlistPath: string): string[] {
    return [
      subdomainsPath,
      '-w', wordlistPath,
    ];
  }

  /**
   * Build dnsx command for resolving permutations
   * Requirements: 12.4
   */
  buildDNSXCommand(resolversPath: string): string[] {
    return [
      '-silent',
      '-r', resolversPath,
      '-resp',
    ];
  }

  /**
   * Run static DNS brute forcing using shuffledns
   * Requirements: 11.4, 11.5
   */
  async *runStaticBrute(config: DNSBruteConfig): AsyncGenerator<string> {
    const timestamp = Date.now();
    const outputPath = path.join(this.workDir, `output_${config.domain}_${timestamp}.txt`);
    const resolversPath = config.resolvers || this.defaultResolvers;

    // Prepare wordlist
    const wordlistPath = await this.prepareStaticWordlist(config.wordlistConfig, config.domain);

    const args = this.buildShuffleDNSCommand(
      wordlistPath,
      config.domain,
      config.threads,
      resolversPath,
      outputPath,
    );

    this.logger.log(`Starting shuffledns with args: ${args.join(' ')}`);

    const shuffledns = spawn('shuffledns', args);

    let buffer = '';

    for await (const chunk of shuffledns.stdout) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const subdomain = line.trim();
        if (subdomain && this.isValidSubdomain(subdomain, config.domain)) {
          yield subdomain;
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const subdomain = buffer.trim();
      if (subdomain && this.isValidSubdomain(subdomain, config.domain)) {
        yield subdomain;
      }
    }

    // Also read from output file if it exists
    try {
      const outputContent = await fsPromises.readFile(outputPath, 'utf-8');
      const outputLines = outputContent.split('\n');
      for (const line of outputLines) {
        const subdomain = line.trim();
        if (subdomain && this.isValidSubdomain(subdomain, config.domain)) {
          yield subdomain;
        }
      }
    } catch {
      // Output file may not exist if all results were streamed
    }

    // Cleanup
    try {
      await fsPromises.unlink(wordlistPath);
      await fsPromises.unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Run dynamic DNS brute forcing using dnsgen and dnsx
   * Requirements: 12.3, 12.4, 12.5
   */
  async *runDynamicBrute(
    domain: string,
    existingSubdomains: string[],
    resolversPath?: string,
  ): AsyncGenerator<string> {
    const timestamp = Date.now();
    const resolvers = resolversPath || this.defaultResolvers;

    // Write existing subdomains to file
    const subdomainsPath = path.join(this.workDir, `subdomains_${timestamp}.txt`);
    await fsPromises.writeFile(subdomainsPath, existingSubdomains.join('\n'));

    // Prepare dynamic wordlist
    const wordlistPath = await this.prepareDynamicWordlist(existingSubdomains);

    // Build commands
    const dnsgenArgs = this.buildDNSGenCommand(subdomainsPath, wordlistPath);
    const dnsxArgs = this.buildDNSXCommand(resolvers);

    this.logger.log(`Starting dnsgen with args: ${dnsgenArgs.join(' ')}`);
    this.logger.log(`Piping to dnsx with args: ${dnsxArgs.join(' ')}`);

    // Run dnsgen | dnsx pipeline
    const dnsgen = spawn('dnsgen', dnsgenArgs);
    const dnsx = spawn('dnsx', dnsxArgs);

    // Pipe dnsgen output to dnsx input
    dnsgen.stdout.pipe(dnsx.stdin);

    let buffer = '';

    for await (const chunk of dnsx.stdout) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        // dnsx output format: subdomain [ip]
        const parts = line.trim().split(/\s+/);
        const subdomain = parts[0];
        if (subdomain && this.isValidSubdomain(subdomain, domain)) {
          yield subdomain;
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const parts = buffer.trim().split(/\s+/);
      const subdomain = parts[0];
      if (subdomain && this.isValidSubdomain(subdomain, domain)) {
        yield subdomain;
      }
    }

    // Cleanup
    try {
      await fsPromises.unlink(subdomainsPath);
      await fsPromises.unlink(wordlistPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Start a DNS brute job
   */
  async startJob(
    config: DNSBruteConfig,
    userId: string,
    programId?: string,
  ): Promise<DNSBruteJobDocument> {
    const job = new this.dnsBruteJobModel({
      domain: config.domain,
      mode: config.mode,
      wordlistConfig: config.wordlistConfig,
      threads: config.threads,
      status: DNSBruteJobStatus.PENDING,
      results: [],
      userId: new Types.ObjectId(userId),
      programId: programId ? new Types.ObjectId(programId) : undefined,
    });

    await job.save();

    // Execute job asynchronously
    this.executeJob(job._id.toString(), config).catch((error) => {
      this.logger.error(`DNS brute job ${job._id} failed: ${error}`);
    });

    return job;
  }

  /**
   * Execute a DNS brute job
   */
  private async executeJob(jobId: string, config: DNSBruteConfig): Promise<void> {
    const job = await this.dnsBruteJobModel.findById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      // Update status to preparing
      job.status = DNSBruteJobStatus.PREPARING;
      job.startedAt = new Date();
      await job.save();

      const results: string[] = [];
      const seenSubdomains = new Set<string>();

      // Update status to running
      job.status = DNSBruteJobStatus.RUNNING;
      await job.save();

      if (config.mode === DNSBruteMode.STATIC) {
        for await (const subdomain of this.runStaticBrute(config)) {
          if (!seenSubdomains.has(subdomain)) {
            seenSubdomains.add(subdomain);
            results.push(subdomain);

            // Update progress periodically
            if (results.length % 100 === 0) {
              await this.dnsBruteJobModel.findByIdAndUpdate(jobId, {
                results,
                discoveredCount: results.length,
              });
            }
          }
        }
      } else {
        // For dynamic mode, we need existing subdomains
        // This would typically come from the database
        const existingSubdomains = job.results || [];
        for await (const subdomain of this.runDynamicBrute(
          config.domain,
          existingSubdomains,
        )) {
          if (!seenSubdomains.has(subdomain)) {
            seenSubdomains.add(subdomain);
            results.push(subdomain);

            // Update progress periodically
            if (results.length % 100 === 0) {
              await this.dnsBruteJobModel.findByIdAndUpdate(jobId, {
                results,
                discoveredCount: results.length,
              });
            }
          }
        }
      }

      // Update job with final results
      const updatedJob = await this.dnsBruteJobModel.findById(jobId);
      if (updatedJob) {
        updatedJob.results = results;
        updatedJob.discoveredCount = results.length;
        updatedJob.status = DNSBruteJobStatus.COMPLETED;
        updatedJob.completedAt = new Date();
        updatedJob.progress = 100;
        await updatedJob.save();
      }
    } catch (error) {
      const updatedJob = await this.dnsBruteJobModel.findById(jobId);
      if (updatedJob) {
        updatedJob.status = DNSBruteJobStatus.FAILED;
        updatedJob.error = error instanceof Error ? error.message : 'Unknown error';
        updatedJob.completedAt = new Date();
        await updatedJob.save();
      }
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<DNSBruteJobDocument | null> {
    return this.dnsBruteJobModel.findById(jobId);
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<DNSBruteJobDocument | null> {
    const process = this.runningJobs.get(jobId);
    if (process) {
      process.kill('SIGTERM');
      this.runningJobs.delete(jobId);
    }

    return this.dnsBruteJobModel.findByIdAndUpdate(
      jobId,
      {
        status: DNSBruteJobStatus.CANCELLED,
        completedAt: new Date(),
      },
      { new: true },
    );
  }

  /**
   * Get job history for a user
   */
  async getJobHistory(userId: string, limit = 20): Promise<DNSBruteJobDocument[]> {
    return this.dnsBruteJobModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Calculate progress percentage
   * Requirements: 19.1
   */
  calculateProgress(processed: number, total: number): number {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((processed / total) * 100));
  }

  /**
   * Validate subdomain format
   */
  private isValidSubdomain(subdomain: string, parentDomain: string): boolean {
    if (!subdomain || !subdomain.endsWith(parentDomain)) {
      return false;
    }

    // Check for valid characters
    const validPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
    if (!validPattern.test(subdomain)) {
      return false;
    }

    // Check for reasonable length
    if (subdomain.length > 255) {
      return false;
    }

    return true;
  }
}
