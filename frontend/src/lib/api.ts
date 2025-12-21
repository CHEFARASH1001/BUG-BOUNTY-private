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
  getAll: (filters?: { status?: string; platform?: string; search?: string }) =>
    api.get('/programs', { params: filters }),
  getById: (id: string) => api.get(`/programs/${id}`),
  create: (data: any) => api.post('/programs', data),
  update: (id: string, data: any) => api.put(`/programs/${id}`, data),
  delete: (id: string) => api.delete(`/programs/${id}`),
  getStats: (id: string) => api.get(`/programs/${id}/stats`),
  getDomains: (id: string) => api.get(`/programs/${id}/domains`),
  getVulnerabilities: (id: string) => api.get(`/programs/${id}/vulnerabilities`),
  getScopes: (id: string) => api.get(`/programs/${id}/scopes`),
};

// Domains API
export const domainsApi = {
  getAll: (filters?: { programId?: string; status?: string; search?: string }) =>
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
  getAll: (filters?: { domainId?: string; isAlive?: boolean; search?: string }) =>
    api.get('/subdomains', { params: filters }),
  getById: (id: string) => api.get(`/subdomains/${id}`),
  getEndpoints: (id: string) => api.get(`/subdomains/${id}/endpoints`),
  getStats: (id: string) => api.get(`/subdomains/${id}/stats`),
};

// Vulnerabilities API
export const vulnerabilitiesApi = {
  getAll: (filters?: { severity?: string; status?: string; programId?: string; search?: string }) =>
    api.get('/vulnerabilities', { params: filters }),
  getById: (id: string) => api.get(`/vulnerabilities/${id}`),
  update: (id: string, data: any) => api.put(`/vulnerabilities/${id}`, data),
  updateStatus: (id: string, status: string) => api.put(`/vulnerabilities/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/vulnerabilities/${id}`),
  getStats: (programId?: string) => api.get('/vulnerabilities/stats', { params: { programId } }),
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
  getExecutions: (filters?: { jobName?: string; limit?: number }) =>
    api.get('/cron/executions', { params: filters }),
  getRunningJobs: () => api.get('/cron/running'),
  getExecutionLogs: (executionId: string) => api.get(`/cron/executions/${executionId}/logs`),
  cleanupStaleJobs: (maxAgeHours?: number) => api.post('/cron/cleanup/stale', null, { params: maxAgeHours ? { maxAgeHours } : {} }),
  cancelJob: (executionId: string) => api.post(`/cron/executions/${executionId}/cancel`),
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

// HTTP Services API
export const httpServicesApi = {
  getAll: (filters?: { domain?: string; tech?: string; title?: string; limit?: number }) =>
    api.get('/http/all', { params: filters }),
  getFresh: (filters?: { domain?: string; limit?: number }) =>
    api.get('/http/fresh', { params: filters }),
  getSingle: (domain: string) => api.get(`/http/single/${domain}`),
  getChanges: (filters?: { domain?: string }) =>
    api.get('/http/changes', { params: filters }),
  getStats: (filters?: { domain?: string }) =>
    api.get('/http/stats', { params: filters }),
};

// Technologies API
export const technologiesApi = {
  getList: (filters?: { domain?: string; limit?: number }) =>
    api.get('/technologies/list', { params: filters }),
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
  
  // Get top scores with sorting options
  getTopPrograms: (filters?: { 
    limit?: number; 
    sortBy?: 'totalScore' | 'exploitabilityScore' | 'historicalScore' | 
             'programQualityScore' | 'competitionScore' | 'attackSurfaceScore' | 'pentestScore';
  }) => api.get('/scores/top/programs', { params: filters }),
  
  getTopDomains: (filters?: { 
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

