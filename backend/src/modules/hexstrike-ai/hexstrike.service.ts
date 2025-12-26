import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, catchError, timeout, retry } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import {
  TargetProfile,
  SecurityTool,
  ToolExecution,
  AIWorkflow,
  HexStrikeProcess,
  HexStrikeHealthStatus,
  HexStrikeConfig,
  ToolCategory,
} from './interfaces/hexstrike.interface';
import { HexStrikeConfigService } from './services/hexstrike-config.service';

@Injectable()
export class HexStrikeService {
  private readonly logger = new Logger(HexStrikeService.name);
  private readonly baseUrl: string;
  private readonly defaultTimeout = 30000; // 30 seconds for most operations
  private readonly longOperationTimeout = 300000; // 5 minutes for tool execution

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly hexStrikeConfigService: HexStrikeConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('HEXSTRIKE_URL') || 'http://hexstrike-ai:8888';
    this.logger.log(`HexStrike AI service initialized with URL: ${this.baseUrl}`);
  }

  /**
   * Check health status of HexStrike AI server
   */
  async getHealth(): Promise<HexStrikeHealthStatus> {
    try {
      const response = await firstValueFrom<AxiosResponse<HexStrikeHealthStatus>>(
        this.httpService.get<HexStrikeHealthStatus>(`${this.baseUrl}/health`).pipe(
          timeout(this.defaultTimeout),
          retry({ count: 2, delay: 1000 }),
          catchError((error: AxiosError) => {
            this.logger.error(`Health check failed: ${error.message}`);
            throw new ServiceUnavailableException('HexStrike AI server is not available');
          }),
        ),
      );
      return response.data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Health check error: ${(error as Error).message}`);
      throw new ServiceUnavailableException('HexStrike AI server is not available');
    }
  }

  /**
   * Analyze a target and get comprehensive profile
   */
  async analyzeTarget(target: string): Promise<TargetProfile> {
    try {
      const response = await firstValueFrom<AxiosResponse<TargetProfile>>(
        this.httpService.post<TargetProfile>(`${this.baseUrl}/api/intelligence/analyze-target`, { target }).pipe(
          timeout(this.longOperationTimeout),
          catchError((error: AxiosError) => {
            this.logger.error(`Target analysis failed: ${error.message}`);
            throw new ServiceUnavailableException('Failed to analyze target');
          }),
        ),
      );
      return response.data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Target analysis error: ${(error as Error).message}`);
      throw new ServiceUnavailableException('HexStrike AI server is not available');
    }
  }

  /**
   * Get list of available security tools
   * Note: HexStrike AI doesn't have a dedicated tools list endpoint,
   * so we derive the tools from the health check response
   */
  async getTools(): Promise<SecurityTool[]> {
    try {
      // Get tools status from health endpoint
      const healthResponse = await firstValueFrom<AxiosResponse<HexStrikeHealthStatus>>(
        this.httpService.get<HexStrikeHealthStatus>(`${this.baseUrl}/health`).pipe(
          timeout(this.defaultTimeout),
          catchError((error: AxiosError) => {
            this.logger.error(`Get tools failed: ${error.message}`);
            throw new ServiceUnavailableException('Failed to get tools list');
          }),
        ),
      );

      // Transform tools_status into SecurityTool array
      const toolsStatus = healthResponse.data.tools_status || {};
      const categoryStats = healthResponse.data.category_stats || {};

      const tools: SecurityTool[] = Object.entries(toolsStatus).map(([name, isInstalled]) => ({
        name,
        displayName: name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        category: this.categorizeToolByName(name),
        description: `Security tool: ${name}`,
        parameters: [],
        effectiveness: {},
        isInstalled: isInstalled as boolean,
      }));

      return tools;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Get tools error: ${(error as Error).message}`);
      throw new ServiceUnavailableException('HexStrike AI server is not available');
    }
  }

  /**
   * Categorize tool by name
   */
  private categorizeToolByName(toolName: string): ToolCategory {
    const categories: Record<ToolCategory, string[]> = {
      network: ['nmap', 'masscan', 'rustscan', 'arp-scan', 'nbtscan', 'tcpdump', 'wireshark', 'tshark'],
      web: ['gobuster', 'dirb', 'dirsearch', 'nikto', 'wpscan', 'ffuf', 'feroxbuster', 'katana', 'httpx', 'nuclei', 'burpsuite', 'zaproxy'],
      cloud: ['prowler', 'scout-suite', 'trivy', 'clair', 'kube-hunter', 'kube-bench', 'docker-bench-security', 'checkov', 'terrascan', 'falco'],
      binary: ['gdb', 'radare2', 'ghidra', 'binwalk', 'ropgadget', 'checksec', 'strings', 'objdump', 'angr', 'pwntools'],
      osint: ['amass', 'subfinder', 'theharvester', 'sherlock', 'spiderfoot', 'maltego', 'recon-ng', 'shodan-cli'],
      ctf: ['hydra', 'john', 'hashcat', 'medusa', 'patator', 'ophcrack', 'metasploit', 'msfvenom', 'sqlmap', 'searchsploit', 'exploit-db'],
    };

    for (const [category, tools] of Object.entries(categories)) {
      if (tools.some(t => toolName.toLowerCase().includes(t))) {
        return category as ToolCategory;
      }
    }
    return 'web'; // Default to web category
  }

  /**
   * Execute a specific security tool
   * Note: HexStrike AI tools are at /api/tools/<tool> (POST)
   */
  async executeTool(
    tool: string,
    target: string,
    parameters: Record<string, any> = {},
  ): Promise<ToolExecution> {
    try {
      const response = await firstValueFrom<AxiosResponse<ToolExecution>>(
        this.httpService.post<ToolExecution>(`${this.baseUrl}/api/tools/${tool}`, {
          target,
          ...parameters,
        }).pipe(
          timeout(this.longOperationTimeout),
          catchError((error: AxiosError) => {
            this.logger.error(`Tool execution failed: ${error.message}`);
            throw new ServiceUnavailableException(`Failed to execute tool: ${tool}`);
          }),
        ),
      );
      return response.data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Tool execution error: ${(error as Error).message}`);
      throw new ServiceUnavailableException('HexStrike AI server is not available');
    }
  }

  /**
   * Get list of available AI workflows
   * Note: HexStrike AI doesn't have a dedicated workflows list endpoint,
   * so we return a predefined list of available workflows
   */
  async getWorkflows(): Promise<AIWorkflow[]> {
    // Return predefined list of available workflows based on HexStrike AI capabilities
    const workflows: AIWorkflow[] = [
      {
        type: 'reconnaissance',
        name: 'Reconnaissance Workflow',
        description: 'Comprehensive reconnaissance workflow for bug bounty hunting',
        steps: [],
        estimatedTime: 300,
        requiredTools: ['nmap', 'subfinder', 'httpx', 'nuclei'],
      },
      {
        type: 'vulnerability-hunting',
        name: 'Vulnerability Hunting Workflow',
        description: 'Vulnerability hunting workflow prioritized by impact',
        steps: [],
        estimatedTime: 600,
        requiredTools: ['nuclei', 'sqlmap', 'ffuf', 'nikto'],
      },
      {
        type: 'bugbounty',
        name: 'Bug Bounty Comprehensive',
        description: 'Comprehensive bug bounty assessment workflow',
        steps: [],
        estimatedTime: 900,
        requiredTools: ['nmap', 'nuclei', 'ffuf', 'sqlmap', 'burpsuite'],
      },
      {
        type: 'osint',
        name: 'OSINT Gathering',
        description: 'OSINT gathering workflow',
        steps: [],
        estimatedTime: 240,
        requiredTools: ['amass', 'subfinder', 'theharvester', 'sherlock'],
      },
      {
        type: 'ctf',
        name: 'CTF Challenge',
        description: 'CTF-focused workflow for capture the flag challenges',
        steps: [],
        estimatedTime: 600,
        requiredTools: ['nmap', 'gobuster', 'binwalk', 'gdb'],
      },
    ];

    return workflows;
  }

  /**
   * Start an AI workflow
   * Note: Maps workflow types to HexStrike AI endpoints
   */
  async startWorkflow(
    type: string,
    target: string,
    options: Record<string, any> = {},
  ): Promise<ToolExecution> {
    // Map workflow types to HexStrike AI endpoints
    const workflowEndpoints: Record<string, string> = {
      'reconnaissance': '/api/bugbounty/reconnaissance-workflow',
      'vulnerability-hunting': '/api/bugbounty/vulnerability-hunting-workflow',
      'business-logic': '/api/bugbounty/business-logic-workflow',
      'osint': '/api/bugbounty/osint-workflow',
      'smart-scan': '/api/intelligence/smart-scan',
      'comprehensive': '/api/bugbounty/comprehensive-assessment',
      'bugbounty': '/api/bugbounty/comprehensive-assessment',
      'ctf': '/api/intelligence/smart-scan',
    };

    const endpoint = workflowEndpoints[type];
    if (!endpoint) {
      throw new ServiceUnavailableException(`Unknown workflow type: ${type}`);
    }

    try {
      // HexStrike AI expects 'domain' instead of 'target'
      const response = await firstValueFrom<AxiosResponse<ToolExecution>>(
        this.httpService.post<ToolExecution>(`${this.baseUrl}${endpoint}`, {
          domain: target,
          ...options,
        }).pipe(
          timeout(this.longOperationTimeout),
          catchError((error: AxiosError) => {
            this.logger.error(`Workflow start failed: ${error.message}`);
            throw new ServiceUnavailableException(`Failed to start workflow: ${type}`);
          }),
        ),
      );
      return response.data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Workflow start error: ${(error as Error).message}`);
      throw new ServiceUnavailableException('HexStrike AI server is not available');
    }
  }

  /**
   * Get list of active processes
   * Note: HexStrike AI uses /api/processes/list
   */
  async getProcesses(): Promise<HexStrikeProcess[]> {
    try {
      const response = await firstValueFrom<AxiosResponse<HexStrikeProcess[]>>(
        this.httpService.get<HexStrikeProcess[]>(`${this.baseUrl}/api/processes/list`).pipe(
          timeout(this.defaultTimeout),
          catchError((error: AxiosError) => {
            this.logger.error(`Get processes failed: ${error.message}`);
            throw new ServiceUnavailableException('Failed to get processes list');
          }),
        ),
      );
      return response.data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Get processes error: ${(error as Error).message}`);
      throw new ServiceUnavailableException('HexStrike AI server is not available');
    }
  }

  /**
   * Get process status by PID
   * Note: HexStrike AI uses /api/processes/status/<pid>
   */
  async getProcessStatus(pid: number): Promise<HexStrikeProcess> {
    try {
      const response = await firstValueFrom<AxiosResponse<HexStrikeProcess>>(
        this.httpService.get<HexStrikeProcess>(`${this.baseUrl}/api/processes/status/${pid}`).pipe(
          timeout(this.defaultTimeout),
          catchError((error: AxiosError) => {
            this.logger.error(`Get process status failed: ${error.message}`);
            throw new ServiceUnavailableException(`Failed to get process status: ${pid}`);
          }),
        ),
      );
      return response.data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Get process status error: ${(error as Error).message}`);
      throw new ServiceUnavailableException('HexStrike AI server is not available');
    }
  }

  /**
   * Terminate a running process
   * Note: HexStrike AI uses /api/processes/terminate/<pid>
   */
  async terminateProcess(pid: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await firstValueFrom<AxiosResponse<{ success: boolean; message: string }>>(
        this.httpService.post<{ success: boolean; message: string }>(`${this.baseUrl}/api/processes/terminate/${pid}`).pipe(
          timeout(this.defaultTimeout),
          catchError((error: AxiosError) => {
            this.logger.error(`Process termination failed: ${error.message}`);
            throw new ServiceUnavailableException(`Failed to terminate process: ${pid}`);
          }),
        ),
      );
      return response.data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Process termination error: ${(error as Error).message}`);
      throw new ServiceUnavailableException('HexStrike AI server is not available');
    }
  }

  /**
   * Get HexStrike AI configuration from MongoDB
   * Requirements: 8.3
   */
  async getConfig(): Promise<HexStrikeConfig> {
    return this.hexStrikeConfigService.getConfig();
  }

  /**
   * Update HexStrike AI configuration in MongoDB
   * Applies changes without requiring container restart
   * Requirements: 8.3, 8.4
   */
  async updateConfig(config: Partial<HexStrikeConfig>): Promise<HexStrikeConfig> {
    return this.hexStrikeConfigService.updateConfig(config);
  }
}
