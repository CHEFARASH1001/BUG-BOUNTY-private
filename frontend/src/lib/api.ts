import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post('/auth/register', { email, password, name }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// Programs API
export const programsApi = {
  getAll: (filters?: { 
    status?: string; 
    platform?: string; 
    search?: string;
    offersBounties?: string;
    dataSource?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) =>
    api.get('/programs', { params: filters }),
  getById: (id: string) => api.get(`/programs/${id}`),
  create: (data: any) => api.post('/programs', data),
  update: (id: string, data: any) => api.put(`/programs/${id}`, data),
  delete: (id: string) => api.delete(`/programs/${id}`),
  getStats: (id: string) => api.get(`/programs/${id}/stats`),
  getDomains: (id: string) => api.get(`/programs/${id}/domains`),
  getVulnerabilities: (id: string) => api.get(`/programs/${id}/vulnerabilities`),
  getScopes: (id: string) => api.get(`/programs/${id}/scopes`),
  getDashboardStats: () => api.get('/programs/dashboard-stats'),
};

// Domains API
export const domainsApi = {
  getAll: (filters?: { 
    programId?: string; 
    status?: string; 
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) =>
    api.get('/domains', { params: filters }),
  getById: (id: string) => api.get(`/domains/${id}`),
  create: (data: any) => api.post('/domains', data),
  update: (id: string, data: any) => api.put(`/domains/${id}`, data),
  delete: (id: string) => api.delete(`/domains/${id}`),
  getStats: (id: string) => api.get(`/domains/${id}/stats`),
  getSubdomains: (id: string) => api.get(`/domains/${id}/subdomains`),
  startScan: (id: string) => api.post(`/domains/${id}/scan`),
};

// Subdomains API
export const subdomainsApi = {
  getAll: (filters?: { 
    domainId?: string;
    programId?: string;
    isAlive?: string | boolean; 
    httpStatus?: string | number;
    hasCdn?: string | boolean;
    cdn?: string;
    technology?: string;
    source?: string;
    isNew?: string | boolean;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) =>
    api.get('/subdomains', { params: filters }),
  getById: (id: string) => api.get(`/subdomains/${id}`),
  getEndpoints: (id: string) => api.get(`/subdomains/${id}/endpoints`),
  getStats: (id: string) => api.get(`/subdomains/${id}/stats`),
  getOverviewStats: () => api.get('/subdomains/stats/overview'),
  getFilterOptions: () => api.get('/subdomains/filters/options'),
};

// Vulnerabilities API
export const vulnerabilitiesApi = {
  getAll: (filters?: { severity?: string; status?: string; programId?: string; sourceTool?: string; search?: string }) =>
    api.get('/vulnerabilities', { params: filters }),
  getById: (id: string) => api.get(`/vulnerabilities/${id}`),
  update: (id: string, data: any) => api.put(`/vulnerabilities/${id}`, data),
  updateStatus: (id: string, status: string) => api.put(`/vulnerabilities/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/vulnerabilities/${id}`),
  getStats: (programId?: string) => api.get('/vulnerabilities/stats', { params: { programId } }),
  getSourceTools: () => api.get('/vulnerabilities/source-tools'),
};

// Scans API
export const scansApi = {
  getAll: (filters?: { targetId?: string; type?: string; status?: string; limit?: number }) =>
    api.get('/scans', { params: filters }),
  getById: (id: string) => api.get(`/scans/${id}`),
  create: (data: any) => api.post('/scans', data),
  cancel: (id: string) => api.post(`/scans/${id}/cancel`),
  retry: (id: string) => api.post(`/scans/${id}/retry`),
  getQueueStats: () => api.get('/scans/queue/stats'),
  getRecent: (limit?: number) => api.get('/scans/recent', { params: { limit } }),
  getRunning: () => api.get('/scans/running'),
};

// Reports API
export const reportsApi = {
  getDashboard: () => api.get('/reports/dashboard'),
  getJson: (params?: { programId?: string; domainId?: string }) =>
    api.get('/reports/json', { params }),
  downloadCsvVulns: (params?: { programId?: string; domainId?: string }) =>
    api.get('/reports/csv/vulnerabilities', { params, responseType: 'blob' }),
  downloadCsvSubdomains: (params?: { domainId?: string }) =>
    api.get('/reports/csv/subdomains', { params, responseType: 'blob' }),
  downloadPdf: (params?: { programId?: string; domainId?: string }) =>
    api.get('/reports/pdf', { params, responseType: 'blob' }),
};

// Notifications API
export const notificationsApi = {
  getAll: (filters?: { type?: string; read?: boolean; limit?: number }) =>
    api.get('/notifications', { params: filters }),
  getUnreadCount: () => api.get('/notifications/unread/count'),
  markAsRead: (ids: string[]) => api.post('/notifications/mark-read', { ids }),
  markAllAsRead: () => api.post('/notifications/mark-all-read'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

// Users API
export const usersApi = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data: any) => api.put('/users/me', data),
  updatePassword: (currentPassword: string, newPassword: string) =>
    api.put('/users/me/password', { currentPassword, newPassword }),
  updateApiKeys: (keys: any) => api.put('/users/me/api-keys', keys),
  updateNotifications: (settings: any) => api.put('/users/me/notifications', settings),
};

// Cron Jobs API
export const cronApi = {
  getConfigs: () => api.get('/cron/configs'),
  getConfig: (jobName: string) => api.get(`/cron/configs/${jobName}`),
  updateConfig: (jobName: string, data: { schedule?: string; enabled?: boolean }) =>
    api.put(`/cron/configs/${jobName}`, data),
  triggerJob: (jobName: string) => api.post(`/cron/trigger/${jobName}`),
  getExecutions: (filters?: { jobName?: string; page?: number; limit?: number }) =>
    api.get('/cron/executions', { params: filters }),
  getRunningJobs: () => api.get('/cron/running'),
  getExecutionLogs: (executionId: string) => api.get(`/cron/executions/${executionId}/logs`),
  cleanupStaleJobs: (maxAgeHours?: number) => api.post('/cron/cleanup/stale', undefined, { params: maxAgeHours ? { maxAgeHours } : {} }),
  cancelJob: (executionId: string) => api.post(`/cron/executions/${executionId}/cancel`),
  // Subfinder queue management
  getSubfinderQueueStats: () => api.get('/cron/queue/subfinder/stats'),
  clearSubfinderQueue: () => api.post('/cron/queue/subfinder/clear'),
};

// Platform Sync API
export const platformsApi = {
  syncAll: () => api.post('/platforms/sync'),
  syncHackerOne: () => api.post('/platforms/sync/hackerone'),
  syncBugcrowd: () => api.post('/platforms/sync/bugcrowd'),
  syncGitHub: () => api.post('/platforms/sync/github'),
  getHackerOnePrograms: () => api.get('/platforms/hackerone/programs'),
  getBugcrowdPrograms: () => api.get('/platforms/bugcrowd/programs'),
};

// Lives API (DNS-resolved hosts)
export const livesApi = {
  getAll: (filters?: { domain?: string; isCdn?: boolean; limit?: number }) =>
    api.get('/lives/all', { params: filters }),
  getFresh: (filters?: { domain?: string; limit?: number }) =>
    api.get('/lives/fresh', { params: filters }),
  getByScope: (scope: string, filters?: { isCdn?: boolean; count?: boolean }) =>
    api.get(`/lives/scope/${scope}`, { params: filters }),
  getStats: (filters?: { domain?: string }) =>
    api.get('/lives/stats', { params: filters }),
};

// Technologies API
export const technologiesApi = {
  getList: (filters?: { domain?: string; limit?: number }) =>
    api.get('/subdomains/technologies', { params: filters }),
};

// Scores API - Enhanced scoring system
export const scoresApi = {
  // Calculate scores
  calculateAll: () => api.post('/scores/calculate/all'),
  calculateProgram: (id: string) => api.post(`/scores/calculate/program/${id}`),
  calculateDomain: (id: string) => api.post(`/scores/calculate/domain/${id}`),
  
  // Get individual scores
  getProgramScore: (id: string) => api.get(`/scores/program/${id}`),
  getDomainScore: (id: string) => api.get(`/scores/domain/${id}`),
  
  // Get top scores with sorting options and pagination
  getTopPrograms: (filters?: { 
    page?: number;
    limit?: number; 
    sortBy?: 'totalScore' | 'exploitabilityScore' | 'historicalScore' | 
             'programQualityScore' | 'competitionScore' | 'attackSurfaceScore' | 'pentestScore';
  }) => api.get('/scores/top/programs', { params: filters }),
  
  getTopDomains: (filters?: { 
    page?: number;
    limit?: number; 
    sortBy?: 'totalScore' | 'exploitabilityScore' | 'historicalScore' | 
             'programQualityScore' | 'competitionScore' | 'attackSurfaceScore' | 'pentestScore';
  }) => api.get('/scores/top/domains', { params: filters }),
  
  // Get by tier (S/A/B/C/D/F)
  getByTier: (tier: 'S' | 'A' | 'B' | 'C' | 'D' | 'F') => 
    api.get(`/scores/tier/${tier}`),
  
  // Get overall statistics
  getStats: () => api.get('/scores/stats'),
  
  // Compare multiple targets
  compare: (ids: string[], type: 'program' | 'domain') =>
    api.get('/scores/compare', { params: { ids: ids.join(','), type } }),
  
  // Get score history
  getHistory: (id: string, type: 'program' | 'domain', days?: number) =>
    api.get(`/scores/history/${id}`, { params: { type, days } }),
};


// CLI API - Watch commands for reconnaissance
export const cliApi = {
  // Single domain commands
  watchSubfinder: (domain: string) => api.post(`/cli/watch/subfinder/${domain}`),
  watchCrtsh: (domain: string) => api.post(`/cli/watch/crtsh/${domain}`),
  watchNs: (domain: string) => api.post(`/cli/watch/ns/${domain}`),
  watchHttp: (domain: string) => api.post(`/cli/watch/http/${domain}`),
  
  // Bulk commands
  watchNsAll: () => api.post('/cli/watch/ns-all'),
  watchHttpAll: () => api.post('/cli/watch/http-all'),
  
  // Quick recon pipeline
  quickRecon: (domain: string) => api.post(`/cli/quick-recon/${domain}`),
  
  // Get available commands
  getCommands: () => api.get('/cli/commands'),
  
  // Watchtower CLI query methods
  // Get single target info for a program (Requirements: 15.1)
  getSingleTarget: (program: string, options?: { format?: 'json' | 'table' }) =>
    api.get(`/cli/target/${program}`, { params: options }),
  
  // Get all HTTP services with filters (Requirements: 16.1)
  getHTTPServices: (options?: {
    format?: 'json' | 'table';
    compare?: boolean;
    statusCode?: number;
    technology?: string;
    statusChanged?: boolean;
    titleChanged?: boolean;
    techChanged?: boolean;
  }) => api.get('/cli/http', { params: options }),
  
  // Get HTTP services for a specific program
  getHTTPByProgram: (program: string, options?: {
    format?: 'json' | 'table';
    compare?: boolean;
    statusCode?: number;
    technology?: string;
  }) => api.get(`/cli/http/${program}`, { params: options }),
  
  // Get live subdomains by scope for a program (Requirements: 17.1)
  getLivesScope: (program: string, options?: {
    format?: 'json' | 'table';
    compare?: boolean;
    statusCode?: number;
    technology?: string;
  }) => api.get(`/cli/lives/${program}`, { params: options }),
};

// Fuzz API - Web fuzzing with FFUF
export const fuzzApi = {
  // Start a new fuzzing job
  start: (config: {
    url: string;
    wordlist: string;
    extensions?: string[];
    matchCodes?: number[];
    filterWords?: number;
    filterLines?: number;
    filterSize?: number;
    threads?: number;
    timeout?: number;
    programId?: string;
  }) => api.post('/fuzz', config),
  
  // Get job status and results
  getJob: (id: string) => api.get(`/fuzz/${id}`),
  
  // Cancel a running job
  cancel: (id: string) => api.delete(`/fuzz/${id}`),
  
  // Get available wordlists
  getWordlists: () => api.get('/fuzz/wordlists'),
  
  // Get user's jobs
  getJobs: () => api.get('/fuzz'),
};

// Alerts API - Alert rules for monitoring
export const alertsApi = {
  // Get all alert rules
  getRules: (filters?: { programId?: string; enabled?: boolean }) =>
    api.get('/alerts/rules', { params: filters }),
  
  // Get single alert rule
  getRule: (id: string) => api.get(`/alerts/rules/${id}`),
  
  // Create alert rule
  createRule: (data: {
    name: string;
    condition: {
      type: 'status_change' | 'title_match' | 'tech_change' | 'favicon_change' | 'abuse_score';
      operator: 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than';
      value: any;
      previousValue?: any;
    };
    severity?: 'info' | 'warning' | 'critical';
    channels?: ('discord' | 'slack' | 'telegram' | 'email')[];
    enabled?: boolean;
    programId?: string;
  }) => api.post('/alerts/rules', data),
  
  // Update alert rule
  updateRule: (id: string, data: {
    name?: string;
    condition?: {
      type: 'status_change' | 'title_match' | 'tech_change' | 'favicon_change' | 'abuse_score';
      operator: 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than';
      value: any;
      previousValue?: any;
    };
    severity?: 'info' | 'warning' | 'critical';
    channels?: ('discord' | 'slack' | 'telegram' | 'email')[];
    enabled?: boolean;
    programId?: string;
  }) => api.put(`/alerts/rules/${id}`, data),
  
  // Delete alert rule
  deleteRule: (id: string) => api.delete(`/alerts/rules/${id}`),
};

// AbuseIPDB API - IP reputation lookup
export const abuseipdbApi = {
  // Check a single IP address
  checkIP: (ip: string) => api.get(`/recon/abuseipdb/check/${ip}`),
  
  // Check multiple IP addresses (batch lookup)
  checkIPs: (ips: string[]) => api.post('/recon/abuseipdb/check', { ips }),
  
  // Get stored results for an IP
  getResultsForIP: (ip: string) => api.get(`/recon/abuseipdb/results/ip/${ip}`),
  
  // Get stored results for a subdomain
  getResultsForSubdomain: (subdomainId: string) => 
    api.get(`/recon/abuseipdb/results/subdomain/${subdomainId}`),
  
  // Get stored results for a domain
  getResultsForDomain: (domainId: string) => 
    api.get(`/recon/abuseipdb/results/domain/${domainId}`),
};

// Waybackurls API - Historical URL discovery
export const waybackApi = {
  // Fetch historical URLs for a domain
  fetchUrls: (domain: string) => api.post(`/recon/wayback/${domain}`),
  
  // Get extracted domains from wayback results
  getExtractedDomains: (domain: string) => 
    api.get(`/recon/wayback/${domain}/domains`),
  
  // Get extracted endpoints from wayback results
  getExtractedEndpoints: (domain: string) => 
    api.get(`/recon/wayback/${domain}/endpoints`),
};

// DNS Brute API - DNS brute forcing
export const dnsBruteApi = {
  // Start a new DNS brute job
  start: (config: {
    domain: string;
    mode: 'static' | 'dynamic';
    wordlistConfig?: {
      sources: {
        bestDns?: boolean;
        twoMillionSubdomains?: boolean;
        crunch?: boolean;
        custom?: string[];
      };
      crunchConfig?: {
        minLength: number;
        maxLength: number;
        charset: string;
      };
    };
    threads?: number;
    resolvers?: string;
    programId?: string;
  }) => api.post('/dns-brute', config),
  
  // Get job status and results
  getJob: (id: string) => api.get(`/dns-brute/${id}`),
  
  // Cancel a running job
  cancel: (id: string) => api.delete(`/dns-brute/${id}`),
  
  // Get job history
  getHistory: (limit?: number) => api.get('/dns-brute/history', { params: { limit } }),
};

// Wordlists API - Wordlist management
export const wordlistsApi = {
  // Get available wordlists
  getAll: () => api.get('/wordlists'),
  
  // Download a wordlist
  download: (url: string, name: string) => api.post('/wordlists/download', { url, name }),
  
  // Get wordlist statistics
  getStats: (name: string) => api.get(`/wordlists/${name}/stats`),
};

// Nuclei API - Vulnerability scanning
export const nucleiApi = {
  // Run a scan on targets
  scan: (data: {
    targets: string[];
    templates?: string[];
    severities?: ('info' | 'low' | 'medium' | 'high' | 'critical')[];
    tags?: string[];
  }) => api.post('/scanner/nuclei/scan', data),
  
  // Run a scan on a single target
  scanSingle: (target: string, templates?: string[]) => 
    api.post('/scanner/nuclei/scan/single', { target, templates }),
  
  // Run a quick scan with common vulnerability templates
  quickScan: (targets: string[]) => 
    api.post('/scanner/nuclei/scan/quick', { targets }),
  
  // Run CVE-only scan
  cveScan: (targets: string[]) => 
    api.post('/scanner/nuclei/scan/cve', { targets }),
  
  // Run exposure/leak scan
  exposureScan: (targets: string[]) => 
    api.post('/scanner/nuclei/scan/exposure', { targets }),
  
  // Run technology detection
  techDetect: (targets: string[]) => 
    api.post('/scanner/nuclei/scan/tech', { targets }),
  
  // Get available templates
  getTemplates: () => api.get('/scanner/nuclei/templates'),
  
  // Update nuclei templates
  updateTemplates: () => api.post('/scanner/nuclei/templates/update'),
};

// Chaos API - ProjectDiscovery Chaos subdomain dataset
export const chaosApi = {
  // Get available Chaos programs
  getPrograms: (search?: string) => 
    api.get('/chaos/programs', { params: search ? { search } : {} }),
  
  // Start syncing a Chaos program
  sync: (data: { programName: string; existingSubdomains?: string[] }) => 
    api.post('/chaos/sync', data),
  
  // Get sync job status
  getSyncStatus: (id: string) => api.get(`/chaos/sync/${id}`),
  
  // Enable/disable watching for a program
  setWatch: (programId: string, data: { enabled: boolean }) => 
    api.put(`/chaos/watch/${programId}`, data),
  
  // Get all watched programs
  getWatched: () => api.get('/chaos/watched'),
};

// GAU API - GetAllUrls for historical URL discovery
export const gauApi = {
  // Start GAU enumeration for a domain
  start: (config: {
    domain: string;
    providers?: ('wayback' | 'commoncrawl' | 'otx' | 'urlscan')[];
    blacklist?: string[];
    threads?: number;
  }) => api.post('/gau', config),
  
  // Get GAU job status and results
  getResults: (id: string) => api.get(`/gau/${id}`),
};

// Tools API - Security Tools Registry
export const toolsApi = {
  // Get all tools with optional filters
  getAll: (filters?: { 
    search?: string; 
    category?: string; 
    installedOnly?: boolean;
  }) => api.get('/tools', { params: filters }),
  
  // Get single tool by ID
  getById: (id: string) => api.get(`/tools/${id}`),
  
  // Create a new tool
  create: (data: {
    name: string;
    displayName: string;
    description: string;
    githubUrl: string;
    categories: string[];
    binaryName: string;
    configOptions?: Array<{
      name: string;
      flag: string;
      type: 'string' | 'number' | 'boolean' | 'file';
      description: string;
      required: boolean;
      default?: any;
    }>;
  }) => api.post('/tools', data),
  
  // Update a tool
  update: (id: string, data: {
    name?: string;
    displayName?: string;
    description?: string;
    githubUrl?: string;
    categories?: string[];
    binaryName?: string;
    configOptions?: Array<{
      name: string;
      flag: string;
      type: 'string' | 'number' | 'boolean' | 'file';
      description: string;
      required: boolean;
      default?: any;
    }>;
    userConfig?: Record<string, any>;
    isActive?: boolean;
  }) => api.put(`/tools/${id}`, data),
  
  // Delete a tool
  delete: (id: string) => api.delete(`/tools/${id}`),
  
  // Execute a tool
  execute: (id: string, data: {
    arguments: string[];
    config?: Record<string, any>;
    timeout?: number;
  }) => api.post(`/tools/${id}/execute`, data),
  
  // Get execution history for a tool
  getExecutions: (id: string, filters?: {
    limit?: number;
    startDate?: string;
    endDate?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  }) => api.get(`/tools/${id}/executions`, { params: filters }),
  
  // Get installation status for a tool
  getStatus: (id: string) => api.get(`/tools/${id}/status`),
  
  // Bulk import predefined tools
  bulkImport: () => api.post('/tools/bulk-import'),

  // Sync existing tools with latest predefined data
  sync: () => api.post('/tools/sync'),
  
  // Re-validate a tool's GitHub metrics
  validate: (id: string) => api.post(`/tools/${id}/validate`),

  // Install a tool
  install: (id: string, method?: string) => 
    api.post(`/tools/${id}/install${method ? `?method=${method}` : ''}`),
  
  // Get available installation methods for a tool
  getInstallMethods: (id: string) => api.get(`/tools/${id}/install-methods`),

  // Install all tools that are not currently installed
  installAll: () => api.post('/tools/install-all'),

  // Refresh installation status of all tools
  refreshStatus: () => api.post('/tools/refresh-status'),
};


// XSS API - Cross-Site Scripting scanning
export const xssApi = {
  // Start a new XSS scan
  start: (config: {
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
    programId?: string;
  }) => api.post('/xss', config),
  
  // Get scan status and results
  getScan: (id: string) => api.get(`/xss/${id}`),
  
  // Cancel a running scan
  cancel: (id: string) => api.delete(`/xss/${id}`),
  
  // Get available XSS tools
  getTools: () => api.get('/xss/tools'),
  
  // Get XSS payloads
  getPayloads: (type?: 'basic' | 'waf-bypass' | 'all') => 
    api.get('/xss/payloads', { params: type ? { type } : {} }),
  
  // Get user's scans
  getScans: () => api.get('/xss'),
};

// HexStrike AI API - AI-powered penetration testing framework
export const hexstrikeApi = {
  // Health check - Get HexStrike AI server health status
  // Requirements: 2.2
  getHealth: () => api.get('/hexstrike/health'),

  // Target Analysis - Analyze a target and get comprehensive profile
  // Requirements: 2.3
  analyzeTarget: (data: {
    target: string;
    depth?: number;
    mode?: 'passive' | 'active' | 'aggressive';
  }) => api.post('/hexstrike/analyze-target', data),

  // Tools - Get list of available security tools
  // Requirements: 2.4
  getTools: () => api.get('/hexstrike/tools'),

  // Tool Execution - Execute a specific security tool
  // Requirements: 2.5
  executeTool: (tool: string, data: {
    target: string;
    parameters?: Record<string, any>;
  }) => api.post(`/hexstrike/tools/${tool}/execute`, data),

  // Workflows - Get list of available AI workflows
  // Requirements: 2.1
  getWorkflows: () => api.get('/hexstrike/workflows'),

  // Start Workflow - Start an AI workflow
  // Requirements: 2.1
  startWorkflow: (type: string, data: {
    target: string;
    options?: Record<string, any>;
  }) => api.post(`/hexstrike/workflows/${type}/start`, data),

  // Processes - Get list of active processes
  // Requirements: 2.1
  getProcesses: () => api.get('/hexstrike/processes'),

  // Get Process Status - Get process status by PID
  // Requirements: 2.1
  getProcessStatus: (pid: number) => api.get(`/hexstrike/processes/${pid}`),

  // Terminate Process - Terminate a running process
  // Requirements: 2.1
  terminateProcess: (pid: number) => api.post(`/hexstrike/processes/${pid}/terminate`),

  // Configuration - Get HexStrike AI configuration
  // Requirements: 2.1
  getConfig: () => api.get('/hexstrike/config'),

  // Update Configuration - Update HexStrike AI configuration
  // Requirements: 2.1
  updateConfig: (data: {
    threads?: number;
    timeout?: number;
    rateLimit?: number;
    scanDepth?: number;
    outputDir?: string;
  }) => api.put('/hexstrike/config', data),
};
