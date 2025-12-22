#!/usr/bin/env npx ts-node

import axios, { AxiosInstance } from 'axios';
import * as readline from 'readline';

const API_URL = process.env.BB_API_URL || 'http://localhost:4000/api/v1';
const TOKEN = process.env.BB_TOKEN || '';

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

  async watchEnumAll(): Promise<void> {
    console.log(`\n🔍 Running enumeration for all domains...`);
    const res = await this.api.post('/cli/watch/enum-all');
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
🐛 Bug Bounty CLI - Terminal Interface

Usage: bb <command> [options]

Commands:
  login <email> <pass>  Login and get JWT token
  subfinder <domain>    Run subfinder for a domain
  crtsh <domain>        Run crt.sh lookup for a domain  
  ns <domain>           Run DNS resolution for a domain
  http <domain>         Run HTTP probing for a domain
  recon <domain>        Quick recon (subfinder → DNS → HTTP)
  
  enum-all              Run subfinder for all domains
  ns-all                Run DNS for all subdomains
  http-all              Run HTTP probe for all alive hosts
  
  domains               List all domains
  cron                  List cron jobs
  trigger <job>         Trigger a cron job manually

Environment Variables:
  BB_API_URL            API URL (default: http://localhost:4000/api/v1)
  BB_TOKEN              JWT auth token

Examples:
  bb login admin@example.com password123
  bb subfinder example.com
  bb recon example.com
  bb enum-all
  bb trigger watch_subfinder_all
`);
  }
}

async function main() {
  const cli = new BugBountyCLI();
  const args = process.argv.slice(2);
  const command = args[0];
  const target = args[1];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    cli.printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'login':
        if (!target || !args[2]) { 
          console.error('Error: email and password required'); 
          console.error('Usage: bb login <email> <password>');
          process.exit(1); 
        }
        await cli.login(target, args[2]);
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
      case 'enum-all':
        await cli.watchEnumAll();
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
        console.error(`Unknown command: ${command}`);
        cli.printHelp();
        process.exit(1);
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.error('❌ Authentication required. Set BB_TOKEN environment variable.');
    } else {
      console.error(`❌ Error: ${error.response?.data?.message || error.message}`);
    }
    process.exit(1);
  }
}

main();
