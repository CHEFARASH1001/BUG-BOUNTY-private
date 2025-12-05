import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export interface NucleiResult {
  templateID: string;
  info: {
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
  type: string;
  host: string;
  matched: string;
  matcherName?: string;
  extractedResults?: string[];
  request?: string;
  response?: string;
  timestamp: string;
  curlCommand?: string;
}

@Injectable()
export class NucleiService {
  private resultsDir = '/app/results';

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

      // Build nuclei command
      let command = `docker exec bb-nuclei nuclei -l /results/${path.basename(inputFile)} ` +
        `-json -o /results/${path.basename(outputFile)} ` +
        `-severity critical,high,medium,low,info ` +
        `-rate-limit 100 -bulk-size 25 -concurrency 25 ` +
        `-timeout 10 -retries 2`;

      // Add specific templates if provided
      if (templates && templates.length > 0) {
        command += ` -t ${templates.join(',')}`;
      } else {
        // Default to commonly useful templates
        command += ` -tags cve,exposure,misconfig,tech,token,file`;
      }

      // Run nuclei
      await execAsync(command, { timeout: 1800000 }); // 30 minute timeout

      // Parse results
      try {
        const content = await fs.readFile(outputFile, 'utf-8');
        const lines = content.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const result = JSON.parse(line);
            results.push(this.normalizeResult(result));
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
    severities: ('critical' | 'high' | 'medium' | 'low' | 'info')[],
  ): Promise<NucleiResult[]> {
    if (targets.length === 0) {
      return [];
    }

    const results: NucleiResult[] = [];

    try {
      const inputFile = path.join(this.resultsDir, `nuclei-sev-input-${uuidv4()}.txt`);
      const outputFile = path.join(this.resultsDir, `nuclei-sev-output-${uuidv4()}.json`);

      await fs.writeFile(inputFile, targets.join('\n'));

      const command = `docker exec bb-nuclei nuclei -l /results/${path.basename(inputFile)} ` +
        `-json -o /results/${path.basename(outputFile)} ` +
        `-severity ${severities.join(',')} ` +
        `-rate-limit 100 -bulk-size 25 -concurrency 25`;

      await execAsync(command, { timeout: 1800000 });

      try {
        const content = await fs.readFile(outputFile, 'utf-8');
        const lines = content.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const result = JSON.parse(line);
            results.push(this.normalizeResult(result));
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
   * Normalize Nuclei result
   */
  private normalizeResult(result: any): NucleiResult {
    return {
      templateID: result['template-id'] || result.templateID || '',
      info: {
        name: result.info?.name || result['template-id'] || '',
        author: result.info?.author || '',
        severity: (result.info?.severity || 'info').toLowerCase(),
        description: result.info?.description,
        reference: result.info?.reference,
        tags: result.info?.tags,
        classification: result.info?.classification,
      },
      type: result.type || '',
      host: result.host || '',
      matched: result.matched || result['matched-at'] || '',
      matcherName: result['matcher-name'] || result.matcherName,
      extractedResults: result['extracted-results'] || result.extractedResults,
      request: result.request,
      response: result.response,
      timestamp: result.timestamp || new Date().toISOString(),
      curlCommand: result['curl-command'] || result.curlCommand,
    };
  }
}

