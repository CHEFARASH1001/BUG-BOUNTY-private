import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { Wordlist, WordlistDocument, WordlistSource } from '../../../schemas/wordlist.schema';

const execAsync = promisify(exec);
const fsPromises = fs.promises;

export interface WordlistInfo {
  name: string;
  path: string;
  lineCount: number;
  sizeBytes: number;
  lastUpdated: Date;
  source: string;
}

@Injectable()
export class WordlistService {
  private readonly logger = new Logger(WordlistService.name);
  private readonly wordlistDir = '/tmp/wordlists';

  constructor(
    @InjectModel(Wordlist.name) private wordlistModel: Model<WordlistDocument>,
  ) {
    this.ensureWordlistDir();
  }

  /**
   * Ensure the wordlist directory exists
   */
  private async ensureWordlistDir(): Promise<void> {
    try {
      await fsPromises.mkdir(this.wordlistDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create wordlist directory: ${error}`);
    }
  }

  /**
   * Download a wordlist from a remote URL
   * Requirements: 11.1, 18.2
   */
  async downloadWordlist(url: string, name: string): Promise<WordlistInfo> {
    const outputPath = path.join(this.wordlistDir, `${name}.txt`);
    
    await this.ensureWordlistDir();
    
    await this.downloadFile(url, outputPath);
    
    const stats = await this.getFileStats(outputPath);
    
    const wordlistInfo: WordlistInfo = {
      name,
      path: outputPath,
      lineCount: stats.lineCount,
      sizeBytes: stats.sizeBytes,
      lastUpdated: new Date(),
      source: WordlistSource.ASSETNOTE,
    };

    // Save to database
    await this.wordlistModel.findOneAndUpdate(
      { name },
      {
        ...wordlistInfo,
        sourceUrl: url,
        isReady: true,
      },
      { upsert: true, new: true },
    );

    return wordlistInfo;
  }

  /**
   * Download a file from URL to local path
   */
  private downloadFile(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(outputPath);

      const request = protocol.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            fs.unlinkSync(outputPath);
            this.downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(outputPath);
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      });

      request.on('error', (err) => {
        file.close();
        fs.unlink(outputPath, () => {}); // Delete partial file
        reject(err);
      });

      file.on('error', (err) => {
        file.close();
        fs.unlink(outputPath, () => {}); // Delete partial file
        reject(err);
      });

      // Set timeout
      request.setTimeout(300000, () => {
        request.destroy();
        file.close();
        fs.unlink(outputPath, () => {});
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Generate character combinations using crunch
   * Requirements: 11.2
   */
  async generateCrunch(minLen: number, maxLen: number, charset: string): Promise<string> {
    const outputPath = path.join(this.wordlistDir, `crunch_${minLen}_${maxLen}_${Date.now()}.txt`);
    
    await this.ensureWordlistDir();

    // Validate inputs
    if (minLen < 1 || maxLen < minLen || maxLen > 10) {
      throw new Error('Invalid length parameters: minLen must be >= 1, maxLen must be >= minLen and <= 10');
    }

    if (!charset || charset.length === 0) {
      throw new Error('Charset cannot be empty');
    }

    // Build crunch command
    const command = `crunch ${minLen} ${maxLen} ${charset} -o ${outputPath}`;
    
    try {
      await execAsync(command, {
        timeout: 600000, // 10 minute timeout
        maxBuffer: 10 * 1024 * 1024,
      });

      // Save to database
      const stats = await this.getFileStats(outputPath);
      await this.wordlistModel.findOneAndUpdate(
        { name: `crunch_${minLen}_${maxLen}` },
        {
          name: `crunch_${minLen}_${maxLen}`,
          path: outputPath,
          lineCount: stats.lineCount,
          sizeBytes: stats.sizeBytes,
          lastUpdated: new Date(),
          source: WordlistSource.GENERATED,
          isReady: true,
        },
        { upsert: true, new: true },
      );

      return outputPath;
    } catch (error) {
      this.logger.error(`Crunch generation failed: ${error}`);
      throw new Error(`Failed to generate wordlist with crunch: ${error}`);
    }
  }

  /**
   * Merge multiple wordlists into one, removing duplicates
   * Requirements: 11.1, 11.3
   */
  async mergeWordlists(paths: string[], outputPath: string): Promise<WordlistInfo> {
    await this.ensureWordlistDir();

    // Validate input paths exist
    for (const p of paths) {
      try {
        await fsPromises.access(p, fs.constants.R_OK);
      } catch {
        throw new Error(`Wordlist file not found: ${p}`);
      }
    }

    // Use sort -u for efficient deduplication
    // cat all files | sort | uniq > output
    const inputFiles = paths.map(p => `"${p}"`).join(' ');
    const command = `cat ${inputFiles} | sort -u > "${outputPath}"`;

    try {
      await execAsync(command, {
        timeout: 600000, // 10 minute timeout
        maxBuffer: 100 * 1024 * 1024, // 100MB buffer
        shell: '/bin/sh',
      });

      const stats = await this.getFileStats(outputPath);
      const name = path.basename(outputPath, '.txt');

      const wordlistInfo: WordlistInfo = {
        name,
        path: outputPath,
        lineCount: stats.lineCount,
        sizeBytes: stats.sizeBytes,
        lastUpdated: new Date(),
        source: WordlistSource.MERGED,
      };

      // Save to database
      await this.wordlistModel.findOneAndUpdate(
        { name },
        {
          ...wordlistInfo,
          isReady: true,
        },
        { upsert: true, new: true },
      );

      return wordlistInfo;
    } catch (error) {
      this.logger.error(`Wordlist merge failed: ${error}`);
      throw new Error(`Failed to merge wordlists: ${error}`);
    }
  }

  /**
   * Append domain suffix to each entry in a wordlist
   * Requirements: 11.3
   */
  async appendDomain(wordlistPath: string, domain: string, outputPath: string): Promise<string> {
    await this.ensureWordlistDir();

    // Validate input file exists
    try {
      await fsPromises.access(wordlistPath, fs.constants.R_OK);
    } catch {
      throw new Error(`Wordlist file not found: ${wordlistPath}`);
    }

    // Validate domain
    if (!domain || domain.length === 0) {
      throw new Error('Domain cannot be empty');
    }

    // Use sed to append domain to each line, then deduplicate
    // sed 's/$/.domain/' input | sort -u > output
    const sanitizedDomain = domain.replace(/['"\\]/g, '');
    const command = `sed 's/$/.${sanitizedDomain}/' "${wordlistPath}" | sort -u > "${outputPath}"`;

    try {
      await execAsync(command, {
        timeout: 600000, // 10 minute timeout
        maxBuffer: 100 * 1024 * 1024, // 100MB buffer
        shell: '/bin/sh',
      });

      return outputPath;
    } catch (error) {
      this.logger.error(`Domain append failed: ${error}`);
      throw new Error(`Failed to append domain to wordlist: ${error}`);
    }
  }

  /**
   * Get list of available wordlists
   */
  async getAvailableWordlists(): Promise<WordlistInfo[]> {
    const wordlists = await this.wordlistModel.find({ isReady: true }).exec();
    
    return wordlists.map(w => ({
      name: w.name,
      path: w.path,
      lineCount: w.lineCount,
      sizeBytes: w.sizeBytes,
      lastUpdated: w.lastUpdated,
      source: w.source,
    }));
  }

  /**
   * Get statistics for a specific wordlist
   * Requirements: 18.3
   */
  async getWordlistStats(name: string): Promise<WordlistInfo> {
    const wordlist = await this.wordlistModel.findOne({ name }).exec();
    
    if (!wordlist) {
      throw new Error(`Wordlist not found: ${name}`);
    }

    // Refresh stats from file if it exists
    try {
      const stats = await this.getFileStats(wordlist.path);
      
      // Update database with fresh stats
      await this.wordlistModel.updateOne(
        { name },
        {
          lineCount: stats.lineCount,
          sizeBytes: stats.sizeBytes,
        },
      );

      return {
        name: wordlist.name,
        path: wordlist.path,
        lineCount: stats.lineCount,
        sizeBytes: stats.sizeBytes,
        lastUpdated: wordlist.lastUpdated,
        source: wordlist.source,
      };
    } catch {
      // File doesn't exist, return database values
      return {
        name: wordlist.name,
        path: wordlist.path,
        lineCount: wordlist.lineCount,
        sizeBytes: wordlist.sizeBytes,
        lastUpdated: wordlist.lastUpdated,
        source: wordlist.source,
      };
    }
  }

  /**
   * Get file statistics (line count and size)
   */
  private async getFileStats(filePath: string): Promise<{ lineCount: number; sizeBytes: number }> {
    try {
      const stat = await fsPromises.stat(filePath);
      const sizeBytes = stat.size;

      // Count lines using wc -l
      const { stdout } = await execAsync(`wc -l < "${filePath}"`, {
        timeout: 60000,
      });
      const lineCount = parseInt(stdout.trim(), 10) || 0;

      return { lineCount, sizeBytes };
    } catch (error) {
      this.logger.error(`Failed to get file stats: ${error}`);
      return { lineCount: 0, sizeBytes: 0 };
    }
  }
}
