import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { FuzzJob, FuzzJobDocument, FuzzJobStatus, FuzzResult, FuzzFilters } from '../../../schemas/fuzz-job.schema';

export interface FuzzConfig {
  url: string;
  wordlist: string;
  extensions?: string[];
  matchCodes?: number[];
  filterWords?: number;
  filterLines?: number;
  filterSize?: number;
  threads?: number;
  timeout?: number;
}

export interface RawFfufResult {
  input?: {
    FUZZ?: string;
  };
  position?: number;
  status?: number;
  length?: number;
  words?: number;
  lines?: number;
  'content-type'?: string;
  contentType?: string;
  redirectlocation?: string;
  url?: string;
  resultfile?: string;
  host?: string;
}

@Injectable()
export class FuzzService {
  private runningJobs: Map<string, ChildProcess> = new Map();
  private wordlistsDir = '/app/wordlists';
  private defaultWordlists = [
    'common.txt',
    'directory-list-2.3-medium.txt',
    'directory-list-2.3-small.txt',
    'raft-large-directories.txt',
    'raft-medium-directories.txt',
    'raft-small-directories.txt',
    'big.txt',
    'api-endpoints.txt',
  ];

  constructor(
    @InjectModel(FuzzJob.name) private fuzzJobModel: Model<FuzzJobDocument>,
  ) {}

  /**
   * Build ffuf command from config
   * This method is exposed for testing purposes
   */
  buildCommand(config: FuzzConfig): string[] {
    const {
      url,
      wordlist,
      extensions,
      matchCodes,
      filterWords,
      filterLines,
      filterSize,
      threads = 40,
      timeout = 10,
    } = config;

    if (!url || !wordlist) {
      throw new Error('URL and wordlist are required');
    }

    // Ensure URL contains FUZZ keyword
    const targetUrl = url.includes('FUZZ') ? url : `${url.replace(/\/$/, '')}/FUZZ`;

    const args: string[] = [
      '-u', targetUrl,
      '-w', path.join(this.wordlistsDir, wordlist),
      '-t', threads.toString(),
      '-timeout', timeout.toString(),
      '-json',
      '-s', // Silent mode (no banner)
    ];

    // Add extensions if provided
    if (extensions && extensions.length > 0) {
      args.push('-e', extensions.join(','));
    }

    // Add match codes filter
    if (matchCodes && matchCodes.length > 0) {
      args.push('-mc', matchCodes.join(','));
    } else {
      // Default: match all status codes except 404
      args.push('-mc', 'all');
      args.push('-fc', '404');
    }

    // Add filter options
    if (filterWords !== undefined && filterWords >= 0) {
      args.push('-fw', filterWords.toString());
    }

    if (filterLines !== undefined && filterLines >= 0) {
      args.push('-fl', filterLines.toString());
    }

    if (filterSize !== undefined && filterSize >= 0) {
      args.push('-fs', filterSize.toString());
    }

    return args;
  }

  /**
   * Parse a single line of ffuf JSON output
   * This method is exposed for testing purposes
   */
  parseFfufOutput(rawOutput: RawFfufResult): FuzzResult | null {
    // Skip non-result lines (like progress updates)
    if (!rawOutput.url && !rawOutput.status) {
      return null;
    }

    return {
      url: rawOutput.url || '',
      status: rawOutput.status || 0,
      length: rawOutput.length || 0,
      words: rawOutput.words || 0,
      lines: rawOutput.lines || 0,
      contentType: rawOutput['content-type'] || rawOutput.contentType || '',
      redirectLocation: rawOutput.redirectlocation,
    };
  }

  /**
   * Start a fuzzing job
   */
  async startFuzz(
    config: FuzzConfig,
    userId: string,
    programId?: string,
  ): Promise<FuzzJobDocument> {
    // Create job record
    const job = new this.fuzzJobModel({
      url: config.url,
      wordlist: config.wordlist,
      extensions: config.extensions || [],
      filters: {
        matchCodes: config.matchCodes,
        filterWords: config.filterWords,
        filterLines: config.filterLines,
        filterSize: config.filterSize,
      } as FuzzFilters,
      status: FuzzJobStatus.PENDING,
      results: [],
      userId: new Types.ObjectId(userId),
      programId: programId ? new Types.ObjectId(programId) : undefined,
    });

    await job.save();

    // Start the fuzzing process asynchronously
    this.executeFuzz(job._id.toString(), config).catch((error) => {
      console.error(`Fuzz job ${job._id} failed:`, error);
    });

    return job;
  }

  /**
   * Execute fuzzing and stream results
   */
  async *streamFuzz(config: FuzzConfig): AsyncGenerator<FuzzResult> {
    const args = this.buildCommand(config);

    const ffufProcess = spawn('ffuf', args);

    let buffer = '';

    for await (const chunk of ffufProcess.stdout) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const rawResult = JSON.parse(line) as RawFfufResult;
          const result = this.parseFfufOutput(rawResult);
          if (result) {
            yield result;
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const rawResult = JSON.parse(buffer) as RawFfufResult;
        const result = this.parseFfufOutput(rawResult);
        if (result) {
          yield result;
        }
      } catch {
        // Skip non-JSON lines
      }
    }
  }

  /**
   * Execute fuzzing job and update database
   */
  private async executeFuzz(jobId: string, config: FuzzConfig): Promise<void> {
    const job = await this.fuzzJobModel.findById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      // Update job status to running
      job.status = FuzzJobStatus.RUNNING;
      job.startedAt = new Date();
      await job.save();

      const args = this.buildCommand(config);
      const ffufProcess = spawn('ffuf', args);

      // Store process reference for cancellation
      this.runningJobs.set(jobId, ffufProcess);

      const results: FuzzResult[] = [];
      let buffer = '';

      ffufProcess.stdout.on('data', async (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const rawResult = JSON.parse(line) as RawFfufResult;
            const result = this.parseFfufOutput(rawResult);
            if (result) {
              results.push(result);
              // Update job with new result periodically
              if (results.length % 10 === 0) {
                await this.fuzzJobModel.findByIdAndUpdate(jobId, {
                  results,
                });
              }
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      });

      ffufProcess.stderr.on('data', (data) => {
        console.error(`ffuf stderr: ${data}`);
      });

      await new Promise<void>((resolve, reject) => {
        ffufProcess.on('close', async (code) => {
          this.runningJobs.delete(jobId);

          // Process remaining buffer
          if (buffer.trim()) {
            try {
              const rawResult = JSON.parse(buffer) as RawFfufResult;
              const result = this.parseFfufOutput(rawResult);
              if (result) {
                results.push(result);
              }
            } catch {
              // Skip non-JSON lines
            }
          }

          // Update job with final results
          const updatedJob = await this.fuzzJobModel.findById(jobId);
          if (updatedJob) {
            updatedJob.results = results;
            updatedJob.completedAt = new Date();
            updatedJob.status = code === 0 ? FuzzJobStatus.COMPLETED : FuzzJobStatus.FAILED;
            if (code !== 0) {
              updatedJob.error = `ffuf exited with code ${code}`;
            }
            await updatedJob.save();
          }

          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`ffuf exited with code ${code}`));
          }
        });

        ffufProcess.on('error', async (error) => {
          this.runningJobs.delete(jobId);
          const updatedJob = await this.fuzzJobModel.findById(jobId);
          if (updatedJob) {
            updatedJob.status = FuzzJobStatus.FAILED;
            updatedJob.error = error.message;
            updatedJob.completedAt = new Date();
            await updatedJob.save();
          }
          reject(error);
        });
      });
    } catch (error) {
      // Update job status on error
      const updatedJob = await this.fuzzJobModel.findById(jobId);
      if (updatedJob) {
        updatedJob.status = FuzzJobStatus.FAILED;
        updatedJob.error = error instanceof Error ? error.message : 'Unknown error';
        updatedJob.completedAt = new Date();
        await updatedJob.save();
      }
      throw error;
    }
  }

  /**
   * Stop a running fuzzing job
   */
  async stopFuzz(jobId: string): Promise<FuzzJobDocument | null> {
    const process = this.runningJobs.get(jobId);
    if (process) {
      process.kill('SIGTERM');
      this.runningJobs.delete(jobId);
    }

    const job = await this.fuzzJobModel.findByIdAndUpdate(
      jobId,
      {
        status: FuzzJobStatus.CANCELLED,
        completedAt: new Date(),
      },
      { new: true },
    );

    return job;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<FuzzJobDocument | null> {
    return this.fuzzJobModel.findById(jobId);
  }

  /**
   * Get jobs by user
   */
  async getJobsByUser(userId: string, limit = 20): Promise<FuzzJobDocument[]> {
    return this.fuzzJobModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Get available wordlists
   */
  async getAvailableWordlists(): Promise<string[]> {
    // In production, this would scan the wordlists directory
    // For now, return the default list
    return this.defaultWordlists;
  }

  /**
   * Store results for a job
   * This method is exposed for testing purposes
   */
  async storeResults(jobId: string, results: FuzzResult[]): Promise<FuzzJobDocument | null> {
    return this.fuzzJobModel.findByIdAndUpdate(
      jobId,
      { results },
      { new: true },
    );
  }
}
