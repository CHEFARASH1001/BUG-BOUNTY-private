#!/usr/bin/env npx ts-node

import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.BB_API_URL || 'http://localhost:4000/api/v1';
const TOKEN = process.env.BB_TOKEN || '';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

// Interfaces for Watchtower CLI
interface SingleTargetResult {
  program: string;
  programId: string;
  domains: string[];
  subdomainCount: number;
  liveCount: number;
  lastScanAt: string | null;
  scope: {
    inScope: string[];
    outOfScope: string[];
  };
}

interface HTTPQueryResult {
  url: string;
  status: number;
  title: string;
  technologies: string[];
  changed: boolean;
  changeDetails?: {
    statusChanged: boolean;
    titleChanged: boolean;
    techChanged: boolean;
    previousStatus?: number;
    previousTitle?: string;
  };
}

interface LivesQueryResult {
  subdomain: string;
  ip: string[];
  status: number | null;
  title: string | null;
  discoveredAt: string;
  isNew: boolean;
  hasChanged: boolean;
}

class OutputFormatter {
  /**
   * Format output as JSON
   */
  static formatJSON(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Get status code color based on HTTP status
   */
  static getStatusColor(status: number): string {
    if (status >= 200 && status < 300) return colors.green;
    if (status >= 300 && status < 400) return colors.cyan;
    if (status >= 400 && status < 500) return colors.yellow;
    if (status >= 500) return colors.red;
    return colors.white;
  }

  /**
   * Format a single target result as a table
   */
  static formatSingleTargetTable(data: SingleTargetResult): string {
    const lines: string[] = [];
    
    lines.push(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
    lines.push(`${colors.bold}  Program: ${colors.green}${data.program}${colors.reset}`);
    lines.push(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
    lines.push('');
    lines.push(`  ${colors.bold}Program ID:${colors.reset}      ${data.programId}`);
    lines.push(`  ${colors.bold}Subdomain Count:${colors.reset} ${colors.yellow}${data.subdomainCount}${colors.reset}`);
    lines.push(`  ${colors.bold}Live Count:${colors.reset}      ${colors.green}${data.liveCount}${colors.reset}`);
    lines.push(`  ${colors.bold}Last Scan:${colors.reset}       ${data.lastScanAt ? new Date(data.lastScanAt).toLocaleString() : 'Never'}`);
    lines.push('');
    
    // Domains
    lines.push(`  ${colors.bold}${colors.blue}Domains (${data.domains.length}):${colors.reset}`);
    if (data.domains.length > 0) {
      data.domains.forEach(d => lines.push(`    • ${d}`));
    } else {
      lines.push(`    ${colors.dim}(none)${colors.reset}`);
    }
    lines.push('');
    
    // Scope
    lines.push(`  ${colors.bold}${colors.green}In Scope (${data.scope.inScope.length}):${colors.reset}`);
    if (data.scope.inScope.length > 0) {
      data.scope.inScope.forEach(s => lines.push(`    ${colors.green}✓${colors.reset} ${s}`));
    } else {
      lines.push(`    ${colors.dim}(none)${colors.reset}`);
    }
    
    lines.push(`  ${colors.bold}${colors.red}Out of Scope (${data.scope.outOfScope.length}):${colors.reset}`);
    if (data.scope.outOfScope.length > 0) {
      data.scope.outOfScope.forEach(s => lines.push(`    ${colors.red}✗${colors.reset} ${s}`));
    } else {
      lines.push(`    ${colors.dim}(none)${colors.reset}`);
    }
    
    lines.push('');
    lines.push(`${colors.cyan}───────────────────────────────────────────────────────────────${colors.reset}`);
    
    return lines.join('\n');
  }

  /**
   * Format HTTP query results as a table with change highlighting
   */
  static formatHTTPTable(data: HTTPQueryResult[], compareMode: boolean): string {
    if (data.length === 0) {
      return `${colors.yellow}No HTTP services found.${colors.reset}`;
    }

    const lines: string[] = [];
    
    // Header
    lines.push(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════════════════════════════════════════${colors.reset}`);
    lines.push(`${colors.bold}  HTTP Services (${data.length} results)${compareMode ? ' - Compare Mode' : ''}${colors.reset}`);
    lines.push(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════════════════════════════════════════${colors.reset}`);
    lines.push('');
    
    // Column headers
    const header = `  ${this.padRight('STATUS', 8)} ${this.padRight('URL', 50)} ${this.padRight('TITLE', 30)} TECHNOLOGIES`;
    lines.push(`${colors.bold}${header}${colors.reset}`);
    lines.push(`${colors.dim}  ${'-'.repeat(8)} ${'-'.repeat(50)} ${'-'.repeat(30)} ${'-'.repeat(20)}${colors.reset}`);
    
    // Data rows
    for (const item of data) {
      const statusColor = this.getStatusColor(item.status);
      const statusStr = item.status ? item.status.toString() : '-';
      const urlStr = this.truncate(item.url, 48);
      const titleStr = this.truncate(item.title || '(no title)', 28);
      const techStr = item.technologies.slice(0, 3).join(', ') || '-';
      
      let rowPrefix = '  ';
      let rowSuffix = '';
      
      // Highlight changed rows in compare mode
      if (compareMode && item.changed) {
        rowPrefix = `${colors.bgYellow}${colors.bold}  `;
        rowSuffix = colors.reset;
        
        // Show change details
        if (item.changeDetails) {
          const changes: string[] = [];
          if (item.changeDetails.statusChanged) {
            changes.push(`status: ${item.changeDetails.previousStatus} → ${item.status}`);
          }
          if (item.changeDetails.titleChanged) {
            changes.push(`title changed`);
          }
          if (item.changeDetails.techChanged) {
            changes.push(`tech changed`);
          }
          if (changes.length > 0) {
            lines.push(`${rowPrefix}${statusColor}${this.padRight(statusStr, 8)}${colors.reset} ${this.padRight(urlStr, 50)} ${this.padRight(titleStr, 30)} ${techStr}${rowSuffix}`);
            lines.push(`${colors.yellow}    ↳ Changes: ${changes.join(', ')}${colors.reset}`);
            continue;
          }
        }
      }
      
      lines.push(`${rowPrefix}${statusColor}${this.padRight(statusStr, 8)}${colors.reset} ${this.padRight(urlStr, 50)} ${this.padRight(titleStr, 30)} ${techStr}${rowSuffix}`);
    }
    
    lines.push('');
    lines.push(`${colors.cyan}───────────────────────────────────────────────────────────────────────────────────────────────────${colors.reset}`);
    
    return lines.join('\n');
  }

  /**
   * Format lives query results as a table with change highlighting
   */
  static formatLivesTable(data: LivesQueryResult[], compareMode: boolean): string {
    if (data.length === 0) {
      return `${colors.yellow}No live subdomains found in scope.${colors.reset}`;
    }

    const lines: string[] = [];
    
    // Header
    lines.push(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════════════════════════════════════════${colors.reset}`);
    lines.push(`${colors.bold}  Live Subdomains in Scope (${data.length} results)${compareMode ? ' - Compare Mode' : ''}${colors.reset}`);
    lines.push(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════════════════════════════════════════${colors.reset}`);
    lines.push('');
    
    // Column headers
    const header = `  ${this.padRight('STATUS', 8)} ${this.padRight('SUBDOMAIN', 45)} ${this.padRight('IP', 18)} ${this.padRight('TITLE', 25)} DISCOVERED`;
    lines.push(`${colors.bold}${header}${colors.reset}`);
    lines.push(`${colors.dim}  ${'-'.repeat(8)} ${'-'.repeat(45)} ${'-'.repeat(18)} ${'-'.repeat(25)} ${'-'.repeat(20)}${colors.reset}`);
    
    // Data rows
    for (const item of data) {
      const statusColor = item.status ? this.getStatusColor(item.status) : colors.dim;
      const statusStr = item.status ? item.status.toString() : '-';
      const subdomainStr = this.truncate(item.subdomain, 43);
      const ipStr = this.truncate(Array.isArray(item.ip) ? item.ip[0] || '-' : '-', 16);
      const titleStr = this.truncate(item.title || '(no title)', 23);
      const discoveredStr = item.discoveredAt ? new Date(item.discoveredAt).toLocaleDateString() : '-';
      
      let rowPrefix = '  ';
      let rowSuffix = '';
      let indicator = '';
      
      // Highlight new/changed rows in compare mode
      if (compareMode) {
        if (item.isNew) {
          rowPrefix = `${colors.bgGreen}${colors.bold}  `;
          rowSuffix = colors.reset;
          indicator = ` ${colors.green}[NEW]${colors.reset}`;
        } else if (item.hasChanged) {
          rowPrefix = `${colors.bgYellow}${colors.bold}  `;
          rowSuffix = colors.reset;
          indicator = ` ${colors.yellow}[CHANGED]${colors.reset}`;
        }
      }
      
      lines.push(`${rowPrefix}${statusColor}${this.padRight(statusStr, 8)}${colors.reset} ${this.padRight(subdomainStr, 45)} ${this.padRight(ipStr, 18)} ${this.padRight(titleStr, 25)} ${discoveredStr}${rowSuffix}${indicator}`);
    }
    
    lines.push('');
    
    // Summary in compare mode
    if (compareMode) {
      const newCount = data.filter(d => d.isNew).length;
      const changedCount = data.filter(d => d.hasChanged).length;
      if (newCount > 0 || changedCount > 0) {
        lines.push(`  ${colors.bold}Summary:${colors.reset} ${colors.green}${newCount} new${colors.reset}, ${colors.yellow}${changedCount} changed${colors.reset}`);
        lines.push('');
      }
    }
    
    lines.push(`${colors.cyan}───────────────────────────────────────────────────────────────────────────────────────────────────${colors.reset}`);
    
    return lines.join('\n');
  }

  // Helper methods
  static padRight(str: string, len: number): string {
    if (str.length >= len) return str.substring(0, len);
    return str + ' '.repeat(len - str.length);
  }

  static truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
  }
}

class BugBountyCLI {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
      },
      timeout: 300000, // 5 min timeout for long operations
    });
  }

  async login(email: string, password: string): Promise<string> {
    const res = await this.api.post('/auth/login', { email, password });
    const token = res.data.access_token || res.data.accessToken;
    this.api.defaults.headers['Authorization'] = `Bearer ${token}`;
    console.log(`✅ Logged in successfully!`);
    console.log(`\nTo use this token, run:`);
    console.log(`  export BB_TOKEN="${token}"`);
    return token;
  }

  async watchSubfinder(domain: string): Promise<void> {
    console.log(`\n🔍 Running subfinder for: ${domain}`);
    const res = await this.api.post(`/cli/watch/subfinder/${domain}`);
    this.printResult(res.data);
  }

  async watchCrtsh(domain: string): Promise<void> {
    console.log(`\n🔍 Running crt.sh lookup for: ${domain}`);
    const res = await this.api.post(`/cli/watch/crtsh/${domain}`);
    this.printResult(res.data);
  }

  async watchNs(domain: string): Promise<void> {
    console.log(`\n🌐 Running DNS resolution for: ${domain}`);
    const res = await this.api.post(`/cli/watch/ns/${domain}`);
    this.printResult(res.data);
  }

  async watchHttp(domain: string): Promise<void> {
    console.log(`\n🌍 Running HTTP probing for: ${domain}`);
    const res = await this.api.post(`/cli/watch/http/${domain}`);
    this.printResult(res.data);
  }

  async watchNsAll(): Promise<void> {
    console.log(`\n🌐 Running DNS resolution for all subdomains...`);
    const res = await this.api.post('/cli/watch/ns-all');
    this.printResult(res.data);
  }

  async watchHttpAll(): Promise<void> {
    console.log(`\n🌍 Running HTTP probing for all alive hosts...`);
    const res = await this.api.post('/cli/watch/http-all');
    this.printResult(res.data);
  }

  async quickRecon(domain: string): Promise<void> {
    console.log(`\n⚡ Running quick recon for: ${domain}`);
    console.log('   Pipeline: subfinder → DNS → HTTP\n');
    const res = await this.api.post(`/cli/quick-recon/${domain}`);
    
    console.log('📋 Subfinder Results:');
    this.printResult(res.data.subfinder);
    console.log('\n📋 DNS Results:');
    this.printResult(res.data.dns);
    console.log('\n📋 HTTP Results:');
    this.printResult(res.data.http);
    console.log(`\n⏱️  Total Duration: ${res.data.totalDuration}ms`);
  }

  async listDomains(): Promise<void> {
    console.log('\n📋 Listing domains...');
    const res = await this.api.get('/domains');
    const domains = res.data.data || res.data;
    console.log(`Found ${domains.length} domains:\n`);
    domains.forEach((d: any) => {
      console.log(`  • ${d.domain} (${d.subdomainCount || 0} subdomains)`);
    });
  }

  async triggerCronJob(jobName: string): Promise<void> {
    console.log(`\n⏰ Triggering cron job: ${jobName}`);
    const res = await this.api.post(`/cron/jobs/${jobName}/trigger`);
    console.log(`Job started: ${res.data._id}`);
    console.log(`Status: ${res.data.status}`);
  }

  async listCronJobs(): Promise<void> {
    console.log('\n⏰ Cron Jobs:');
    const res = await this.api.get('/cron/jobs');
    res.data.forEach((job: any) => {
      const status = job.enabled ? '✅' : '❌';
      console.log(`  ${status} ${job.jobName} - ${job.schedule}`);
      console.log(`     ${job.description}`);
    });
  }

  // ==================== Watchtower CLI Commands ====================

  /**
   * Get single target information for a program
   * Equivalent to: watchtower get single target <program>
   * Requirements: 15.1, 15.2
   */
  async getSingleTarget(program: string, format: 'json' | 'table' = 'table'): Promise<void> {
    console.log(`\n🎯 Getting target info for program: ${program}`);
    
    const res = await this.api.get(`/cli/target/${encodeURIComponent(program)}`, {
      params: { format: 'json' }, // Always get JSON from API, format locally
    });
    
    const data: SingleTargetResult = res.data;
    
    if (format === 'json') {
      console.log(OutputFormatter.formatJSON(data));
    } else {
      console.log(OutputFormatter.formatSingleTargetTable(data));
    }
  }

  /**
   * Get all HTTP services with optional filters
   * Equivalent to: watchtower get http all [--compare list]
   * Requirements: 16.1, 16.2
   */
  async getHTTPAll(options: {
    format?: 'json' | 'table';
    compare?: boolean;
    statusCode?: number;
    technology?: string;
    statusChanged?: boolean;
    titleChanged?: boolean;
    techChanged?: boolean;
  } = {}): Promise<void> {
    const { format = 'table', compare = false, ...filters } = options;
    
    console.log(`\n🌐 Getting HTTP services${compare ? ' (compare mode)' : ''}...`);
    
    const params: Record<string, any> = { format: 'json' };
    if (compare) params.compare = 'true';
    if (filters.statusCode) params.statusCode = filters.statusCode;
    if (filters.technology) params.technology = filters.technology;
    if (filters.statusChanged !== undefined) params.statusChanged = filters.statusChanged;
    if (filters.titleChanged !== undefined) params.titleChanged = filters.titleChanged;
    if (filters.techChanged !== undefined) params.techChanged = filters.techChanged;
    
    const res = await this.api.get('/cli/http', { params });
    
    const data: HTTPQueryResult[] = res.data;
    
    if (format === 'json') {
      console.log(OutputFormatter.formatJSON(data));
    } else {
      console.log(OutputFormatter.formatHTTPTable(data, compare));
    }
  }

  /**
   * Get HTTP services for a specific program
   * Requirements: 16.1
   */
  async getHTTPByProgram(program: string, options: {
    format?: 'json' | 'table';
    compare?: boolean;
    statusCode?: number;
    technology?: string;
  } = {}): Promise<void> {
    const { format = 'table', compare = false, ...filters } = options;
    
    console.log(`\n🌐 Getting HTTP services for program: ${program}${compare ? ' (compare mode)' : ''}...`);
    
    const params: Record<string, any> = { format: 'json' };
    if (compare) params.compare = 'true';
    if (filters.statusCode) params.statusCode = filters.statusCode;
    if (filters.technology) params.technology = filters.technology;
    
    const res = await this.api.get(`/cli/http/${encodeURIComponent(program)}`, { params });
    
    const data: HTTPQueryResult[] = res.data;
    
    if (format === 'json') {
      console.log(OutputFormatter.formatJSON(data));
    } else {
      console.log(OutputFormatter.formatHTTPTable(data, compare));
    }
  }

  /**
   * Get live subdomains within scope for a program
   * Equivalent to: watchtower get lives scope <program> [--compare list]
   * Requirements: 17.1, 17.2
   */
  async getLivesScope(program: string, options: {
    format?: 'json' | 'table';
    compare?: boolean;
    statusCode?: number;
    technology?: string;
  } = {}): Promise<void> {
    const { format = 'table', compare = false, ...filters } = options;
    
    console.log(`\n🔴 Getting live subdomains in scope for program: ${program}${compare ? ' (compare mode)' : ''}...`);
    
    const params: Record<string, any> = { format: 'json' };
    if (compare) params.compare = 'true';
    if (filters.statusCode) params.statusCode = filters.statusCode;
    if (filters.technology) params.technology = filters.technology;
    
    const res = await this.api.get(`/cli/lives/${encodeURIComponent(program)}`, { params });
    
    const data: LivesQueryResult[] = res.data;
    
    if (format === 'json') {
      console.log(OutputFormatter.formatJSON(data));
    } else {
      console.log(OutputFormatter.formatLivesTable(data, compare));
    }
  }

  private printResult(result: any): void {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.message}`);
    console.log(`⏱️  Duration: ${result.duration}ms`);
    
    if (result.results) {
      if (result.results.total !== undefined) {
        console.log(`📊 Total: ${result.results.total}`);
      }
      if (result.results.created !== undefined) {
        console.log(`🆕 Created: ${result.results.created}`);
      }
      if (result.results.updated !== undefined) {
        console.log(`🔄 Updated: ${result.results.updated}`);
      }
      if (result.results.resolved !== undefined) {
        console.log(`✓ Resolved: ${result.results.resolved}`);
      }
      if (result.results.failed !== undefined) {
        console.log(`✗ Failed: ${result.results.failed}`);
      }
      if (result.results.subdomains?.length > 0) {
        console.log(`\n📝 Sample subdomains (first 10):`);
        result.results.subdomains.slice(0, 10).forEach((s: string) => {
          console.log(`   • ${s}`);
        });
      }
    }
  }

  printHelp(): void {
    console.log(`
${colors.bold}${colors.cyan}🐛 Bug Bounty CLI - Terminal Interface${colors.reset}

${colors.bold}Usage:${colors.reset} bb <command> [options]

${colors.bold}${colors.yellow}Reconnaissance Commands:${colors.reset}
  login <email> <pass>  Login and get JWT token
  subfinder <domain>    Run subfinder for a domain
  crtsh <domain>        Run crt.sh lookup for a domain  
  ns <domain>           Run DNS resolution for a domain
  http <domain>         Run HTTP probing for a domain
  recon <domain>        Quick recon (subfinder → DNS → HTTP)
  
  ns-all                Run DNS for all subdomains
  http-all              Run HTTP probe for all alive hosts

${colors.bold}${colors.yellow}Watchtower Commands:${colors.reset}
  get single target <program>              Get target info for a program
  get http all [--compare]                 Get all HTTP services
  get http <program> [--compare]           Get HTTP services for a program
  get lives scope <program> [--compare]    Get live subdomains in scope

${colors.bold}${colors.yellow}Management Commands:${colors.reset}
  domains               List all domains
  cron                  List cron jobs
  trigger <job>         Trigger a cron job manually

${colors.bold}${colors.yellow}Options:${colors.reset}
  --format <json|table>     Output format (default: table)
  --compare                 Enable change comparison mode
  --status-code <code>      Filter by HTTP status code
  --technology <tech>       Filter by technology

${colors.bold}${colors.yellow}Environment Variables:${colors.reset}
  BB_API_URL            API URL (default: http://localhost:4000/api/v1)
  BB_TOKEN              JWT auth token

${colors.bold}${colors.yellow}Examples:${colors.reset}
  bb login admin@example.com password123
  bb subfinder example.com
  bb recon example.com
  bb trigger watch_subfinder_all
  
  ${colors.cyan}# Watchtower commands${colors.reset}
  bb get single target hackerone
  bb get single target hackerone --format json
  bb get http all
  bb get http all --compare
  bb get http hackerone --compare --status-code 200
  bb get lives scope hackerone
  bb get lives scope hackerone --compare --format json
`);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  command: string[];
  options: Record<string, any>;
} {
  const command: string[] = [];
  const options: Record<string, any> = {};
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      // Check if next arg is a value or another flag
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        options[key] = args[i + 1];
        i += 2;
      } else {
        // Boolean flag
        options[key] = true;
        i++;
      }
    } else {
      command.push(arg);
      i++;
    }
  }
  
  return { command, options };
}

async function main() {
  const cli = new BugBountyCLI();
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    cli.printHelp();
    process.exit(0);
  }

  const { command, options } = parseArgs(args);
  const format = (options.format as 'json' | 'table') || 'table';
  const compare = !!options.compare;

  try {
    // Handle multi-word commands (get single target, get http all, etc.)
    const cmdStr = command.join(' ').toLowerCase();
    
    // Watchtower: get single target <program>
    if (cmdStr.startsWith('get single target ')) {
      const program = command.slice(3).join(' ');
      if (!program) {
        console.error('Error: program name required');
        console.error('Usage: bb get single target <program>');
        process.exit(1);
      }
      await cli.getSingleTarget(program, format);
      return;
    }
    
    // Watchtower: get http all
    if (cmdStr === 'get http all') {
      await cli.getHTTPAll({
        format,
        compare,
        statusCode: options['status-code'] ? parseInt(options['status-code'], 10) : undefined,
        technology: options.technology,
        statusChanged: options['status-changed'] !== undefined ? options['status-changed'] === 'true' : undefined,
        titleChanged: options['title-changed'] !== undefined ? options['title-changed'] === 'true' : undefined,
        techChanged: options['tech-changed'] !== undefined ? options['tech-changed'] === 'true' : undefined,
      });
      return;
    }
    
    // Watchtower: get http <program>
    if (cmdStr.startsWith('get http ') && !cmdStr.startsWith('get http all')) {
      const program = command.slice(2).join(' ');
      if (!program) {
        console.error('Error: program name required');
        console.error('Usage: bb get http <program>');
        process.exit(1);
      }
      await cli.getHTTPByProgram(program, {
        format,
        compare,
        statusCode: options['status-code'] ? parseInt(options['status-code'], 10) : undefined,
        technology: options.technology,
      });
      return;
    }
    
    // Watchtower: get lives scope <program>
    if (cmdStr.startsWith('get lives scope ')) {
      const program = command.slice(3).join(' ');
      if (!program) {
        console.error('Error: program name required');
        console.error('Usage: bb get lives scope <program>');
        process.exit(1);
      }
      await cli.getLivesScope(program, {
        format,
        compare,
        statusCode: options['status-code'] ? parseInt(options['status-code'], 10) : undefined,
        technology: options.technology,
      });
      return;
    }

    // Legacy single-word commands
    const singleCommand = command[0];
    const target = command[1];

    switch (singleCommand) {
      case 'login':
        if (!target || !command[2]) { 
          console.error('Error: email and password required'); 
          console.error('Usage: bb login <email> <password>');
          process.exit(1); 
        }
        await cli.login(target, command[2]);
        break;
      case 'subfinder':
        if (!target) { console.error('Error: domain required'); process.exit(1); }
        await cli.watchSubfinder(target);
        break;
      case 'crtsh':
        if (!target) { console.error('Error: domain required'); process.exit(1); }
        await cli.watchCrtsh(target);
        break;
      case 'ns':
        if (!target) { console.error('Error: domain required'); process.exit(1); }
        await cli.watchNs(target);
        break;
      case 'http':
        if (!target) { console.error('Error: domain required'); process.exit(1); }
        await cli.watchHttp(target);
        break;
      case 'recon':
        if (!target) { console.error('Error: domain required'); process.exit(1); }
        await cli.quickRecon(target);
        break;
      case 'ns-all':
        await cli.watchNsAll();
        break;
      case 'http-all':
        await cli.watchHttpAll();
        break;
      case 'domains':
        await cli.listDomains();
        break;
      case 'cron':
        await cli.listCronJobs();
        break;
      case 'trigger':
        if (!target) { console.error('Error: job name required'); process.exit(1); }
        await cli.triggerCronJob(target);
        break;
      default:
        console.error(`Unknown command: ${cmdStr}`);
        cli.printHelp();
        process.exit(1);
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.error('❌ Authentication required. Set BB_TOKEN environment variable.');
    } else if (error.response?.status === 404) {
      console.error(`❌ Not found: ${error.response?.data?.message || 'Resource not found'}`);
    } else {
      console.error(`❌ Error: ${error.response?.data?.message || error.message}`);
    }
    process.exit(1);
  }
}

main();
