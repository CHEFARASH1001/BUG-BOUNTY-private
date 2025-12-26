/**
 * HexStrike AI Integration Interfaces
 * Based on the design document specifications
 */

/**
 * Target type classification
 */
export type TargetType =
  | 'web_application'
  | 'network_host'
  | 'api_endpoint'
  | 'cloud_service'
  | 'binary_file'
  | 'unknown';

/**
 * Risk level classification
 */
export type RiskLevel =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'minimal'
  | 'unknown';

/**
 * Severity level for vulnerabilities
 */
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Tool category classification
 */
export type ToolCategory =
  | 'network'
  | 'web'
  | 'cloud'
  | 'binary'
  | 'ctf'
  | 'osint';

/**
 * Execution status for tools and workflows
 */
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Workflow status including pause capability
 */
export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'cancelled';

/**
 * Process status
 */
export type ProcessStatus = 'running' | 'completed' | 'failed' | 'terminated';

/**
 * Workflow type classification
 */
export type WorkflowType =
  | 'bugbounty'
  | 'ctf'
  | 'reconnaissance'
  | 'vulnerability-hunting'
  | 'osint';

/**
 * Comprehensive target analysis profile
 */
export interface TargetProfile {
  target: string;
  targetType: TargetType;
  ipAddresses: string[];
  openPorts: number[];
  services: Record<number, string>;
  technologies: string[];
  cmsType?: string;
  cloudProvider?: string;
  securityHeaders: Record<string, string>;
  sslInfo: Record<string, any>;
  subdomains: string[];
  endpoints: string[];
  attackSurfaceScore: number;
  riskLevel: RiskLevel;
  confidenceScore: number;
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

/**
 * Security tool definition
 */
export interface SecurityTool {
  name: string;
  displayName: string;
  category: ToolCategory;
  description: string;
  parameters: ToolParameter[];
  effectiveness: Record<string, number>;
  isInstalled: boolean;
}

/**
 * Tool execution record
 */
export interface ToolExecution {
  id: string;
  tool: string;
  target: string;
  parameters: Record<string, any>;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  output?: string;
  results?: any;
  error?: string;
  pid?: number;
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  tool: string;
  parameters: Record<string, any>;
  expectedOutcome: string;
  successProbability: number;
  executionTimeEstimate: number;
  dependencies: string[];
}

/**
 * AI workflow definition
 */
export interface AIWorkflow {
  type: WorkflowType;
  name: string;
  description: string;
  steps: WorkflowStep[];
  estimatedTime: number;
  requiredTools: string[];
}

/**
 * Workflow execution record
 */
export interface WorkflowExecution {
  id: string;
  type: WorkflowType;
  target: string;
  status: WorkflowStatus;
  currentStep?: number;
  totalSteps?: number;
  startTime: Date;
  endTime?: Date;
  findings?: any[];
  error?: string;
}

/**
 * Vulnerability discovered by HexStrike AI
 */
export interface HexStrikeVulnerability {
  name: string;
  severity: SeverityLevel;
  description: string;
  target: string;
  tool: string;
  evidence?: string;
  remediation?: string;
  cvss?: number;
  cve?: string;
  discoveredAt: Date;
}

/**
 * HexStrike AI process information
 */
export interface HexStrikeProcess {
  pid: number;
  status: ProcessStatus;
  command: string;
  tool?: string;
  target?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  output?: string;
}

/**
 * HexStrike AI health status
 */
export interface HexStrikeHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  version?: string;
  uptime?: number;
  toolsAvailable?: number;
  activeProcesses?: number;
  lastCheck?: Date;
  // Additional fields from actual HexStrike AI server
  tools_status?: Record<string, boolean>;
  category_stats?: Record<string, { available: number; total: number }>;
  total_tools_available?: number;
  total_tools_count?: number;
  all_essential_tools_available?: boolean;
  telemetry?: {
    average_execution_time: string;
    commands_executed: number;
    success_rate: string;
    uptime_seconds: number;
    system_metrics?: {
      cpu_percent: number;
      disk_usage: number;
      memory_percent: number;
      network_io?: Record<string, number>;
    };
  };
  cache_stats?: {
    evictions: number;
    hit_rate: string;
    hits: number;
    max_size: number;
    misses: number;
    size: number;
  };
}

/**
 * HexStrike AI configuration
 */
export interface HexStrikeConfig {
  threads: number;
  timeout: number;
  rateLimit: number;
  scanDepth: number;
  outputDir: string;
  version?: string;
}
