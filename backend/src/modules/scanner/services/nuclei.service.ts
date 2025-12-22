import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export type NucleiSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface NucleiResult {
  templateId: string;
  templateName: string;
  severity: NucleiSeverity;
  host: string;
  matchedAt: string;
  extractedResults: string[];
  timestamp: Date;
  curl: string;
  matcher: string;
  // Extended fields for compatibility
  templateID?: string;
  info?: {
    name: string;
    author: string;
    severity: string;
    description?: string;
    reference?: string[];
    tags?: string[];
    classification?: {
      cvssMetrics?: string;
      cvssScore?: number;
      cveId?: string[];
      cweId?: string[];
    };
  };
  type?: string;
  matched?: string;
  matcherName?: string;
  request?: string;
  response?: string;
  curlCommand?: string;
}

export interface NucleiCommandOptions {
  targets: string[];
  templates?: string[];
  severities?: NucleiSeverity[];
  rateLimit?: number;
  bulkSize?: number;
  concurrency?: number;
  timeout?: number;
  retries?: number;
  tags?: string[];
}

export interface RawNucleiOutput {
  'template-id'?: string;
  templateID?: string;
  info?: {
    name?: string;
    author?: string;
    severity?: string;
    description?: string;
    reference?: string[];
    tags?: string[];
    classification?: {
      cvssMetrics?: string;
      cvssScore?: number;
      cveId?: string[];
      cweId?: string[];
    };
  };
  type?: string;
  host?: string;
  matched?: string;
  'matched-at'?: string;
  'matcher-name'?: string;
  matcherName?: string;
  'extracted-results'?: string[];
  extractedResults?: string[];
  request?: string;
  response?: string;
  timestamp?: string;
  'curl-command'?: string;
  curlCommand?: string;
}

@Injectable()
export class NucleiService {
  private resultsDir = '/app/results';

  /**
   * Build nuclei command from options
   * This method is exposed for testing purposes
   */
  buildCommand(options: NucleiCommandOptions, inputFile: string, outputFile: string): string {
    const { targets, templates, severities, rateLimit = 100, bulkSize = 25, concurrency = 25, timeout = 10, retries = 2, tags } = options;

    if (targets.length === 0) {
      throw new Error('At least one target is required');
    }

    let command = `docker exec bb-nuclei nuclei -l /results/${path.basename(inputFile)} ` +
      `-json -o /results/${path.basename(outputFile)} ` +
      `-rate-limit ${rateLimit} -bulk-size ${bulkSize} -concurrency ${concurrency} ` +
      `-timeout ${timeout} -retries ${retries}`;

    // Add severity filter
    if (severities && severities.length > 0) {
      command += ` -severity ${severities.join(',')}`;
    } else {
      command += ` -severity critical,high,medium,low,info`;
    }

    // Add specific templates if provided
    if (templates && templates.length > 0) {
      command += ` -t ${templates.join(',')}`;
    } else if (tags && tags.length > 0) {
      // Use tags if no templates specified
      command += ` -tags ${tags.join(',')}`;
    } else {
      // Default to commonly useful templates
      command += ` -tags cve,exposure,misconfig,tech,token,file`;
    }

    return command;
  }

  /**
   * Parse a single line of Nuclei JSON output
   * This method is exposed for testing purposes
   */
  parseNucleiOutput(rawOutput: RawNucleiOutput): NucleiResult {
    const templateId = rawOutput['template-id'] || rawOutput.templateID || '';
    const severity = (rawOutput.info?.severity || 'info').toLowerCase() as NucleiSeverity;
    const validSeverities: NucleiSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];
    const normalizedSeverity = validSeverities.includes(severity) ? severity : 'info';

    return {
      templateId,
      templateName: rawOutput.info?.name || templateId,
      severity: normalizedSeverity,
      host: rawOutput.host || '',
      matchedAt: rawOutput.matched || rawOutput['matched-at'] || '',
      extractedResults: rawOutput['extracted-results'] || rawOutput.extractedResults || [],
      timestamp: rawOutput.timestamp ? new Date(rawOutput.timestamp) : new Date(),
      curl: rawOutput['curl-command'] || rawOutput.curlCommand || '',
      matcher: rawOutput['matcher-name'] || rawOutput.matcherName || '',
      // Extended fields for backward compatibility
      templateID: templateId,
      info: {
        name: rawOutput.info?.name || templateId,
        author: rawOutput.info?.author || '',
        severity: normalizedSeverity,
        description: rawOutput.info?.description,
        reference: rawOutput.info?.reference,
        tags: rawOutput.info?.tags,
        classification: rawOutput.info?.classification,
      },
      type: rawOutput.type || '',
      matched: rawOutput.matched || rawOutput['matched-at'] || '',
      matcherName: rawOutput['matcher-name'] || rawOutput.matcherName,
      request: rawOutput.request,
      response: rawOutput.response,
      curlCommand: rawOutput['curl-command'] || rawOutput.curlCommand,
    };
  }

  /**
   * Check if a severity should trigger an immediate alert
   * Returns true for critical or high severity findings
   */
  shouldTriggerAlert(severity: NucleiSeverity): boolean {
    return severity === 'critical' || severity === 'high';
  }

  /**
   * Run Nuclei scan on a single target
   */
  async scanSingle(target: string, templates?: string[]): Promise<NucleiResult[]> {
    return this.scan([target], templates);
  }

  /**
   * Get available templates
   */
  async getAvailableTemplates(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        'docker exec bb-nuclei nuclei -tl -silent',
        { timeout: 60000 },
      );
      return stdout.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Run Nuclei scan on targets
   */
  async scan(targets: string[], templates?: string[]): Promise<NucleiResult[]> {
    if (targets.length === 0) {
      return [];
    }

    const results: NucleiResult[] = [];

    try {
      const inputFile = path.join(this.resultsDir, `nuclei-input-${uuidv4()}.txt`);
      const outputFile = path.join(this.resultsDir, `nuclei-output-${uuidv4()}.json`);

      // Write targets to file
      await fs.writeFile(inputFile, targets.join('\n'));

      // Build nuclei command using the helper method
      const options: NucleiCommandOptions = {
        targets,
        templates,
        tags: templates ? undefined : ['cve', 'exposure', 'misconfig', 'tech', 'token', 'file'],
      };
      const command = this.buildCommand(options, inputFile, outputFile);

      // Run nuclei
      await execAsync(command, { timeout: 1800000 }); // 30 minute timeout

      // Parse results
      try {
        const content = await fs.readFile(outputFile, 'utf-8');
        const lines = content.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const rawResult = JSON.parse(line) as RawNucleiOutput;
            results.push(this.parseNucleiOutput(rawResult));
          } catch {
            continue;
          }
        }
      } catch {
        // Output file might not exist if no results
      }

      // Cleanup
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});
    } catch (error) {
      console.error('Nuclei scan error:', error);
    }

    return results;
  }

  /**
   * Run scan with specific severity filter
   */
  async scanBySeverity(
    targets: string[],
    severities: NucleiSeverity[],
  ): Promise<NucleiResult[]> {
    if (targets.length === 0) {
      return [];
    }

    const results: NucleiResult[] = [];

    try {
      const inputFile = path.join(this.resultsDir, `nuclei-sev-input-${uuidv4()}.txt`);
      const outputFile = path.join(this.resultsDir, `nuclei-sev-output-${uuidv4()}.json`);

      await fs.writeFile(inputFile, targets.join('\n'));

      const options: NucleiCommandOptions = {
        targets,
        severities,
      };
      const command = this.buildCommand(options, inputFile, outputFile);

      await execAsync(command, { timeout: 1800000 });

      try {
        const content = await fs.readFile(outputFile, 'utf-8');
        const lines = content.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const rawResult = JSON.parse(line) as RawNucleiOutput;
            results.push(this.parseNucleiOutput(rawResult));
          } catch {
            continue;
          }
        }
      } catch {
        // No results
      }

      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});
    } catch (error) {
      console.error('Nuclei severity scan error:', error);
    }

    return results;
  }

  /**
   * Run quick scan with common vulnerability templates
   */
  async quickScan(targets: string[]): Promise<NucleiResult[]> {
    const quickTemplates = [
      'cves/',
      'exposures/',
      'misconfiguration/',
      'vulnerabilities/',
      'default-logins/',
      'takeovers/',
    ];

    return this.scan(targets, quickTemplates);
  }

  /**
   * Run CVE-only scan
   */
  async cveScan(targets: string[]): Promise<NucleiResult[]> {
    return this.scan(targets, ['cves/']);
  }

  /**
   * Run exposure/leak scan
   */
  async exposureScan(targets: string[]): Promise<NucleiResult[]> {
    return this.scan(targets, ['exposures/', 'misconfiguration/']);
  }

  /**
   * Run technology detection
   */
  async techDetect(targets: string[]): Promise<NucleiResult[]> {
    return this.scan(targets, ['technologies/']);
  }

  /**
   * Update nuclei templates
   */
  async updateTemplates(): Promise<boolean> {
    try {
      await execAsync('docker exec bb-nuclei nuclei -update-templates', {
        timeout: 300000,
      });
      return true;
    } catch (error) {
      console.error('Template update error:', error);
      return false;
    }
  }

  /**
   * List available template tags
   */
  async listTemplateTags(): Promise<string[]> {
    return this.getAvailableTemplates();
  }
}

