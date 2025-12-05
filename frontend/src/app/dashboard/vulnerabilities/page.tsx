'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Search,
  Filter,
  MoreHorizontal,
  ExternalLink,
  Copy,
  CheckCircle,
  XCircle,
  Flag,
  ArrowUpRight,
  ChevronDown,
} from 'lucide-react';
import { cn, getSeverityBgColor, timeAgo } from '@/lib/utils';

// Mock data
const vulnerabilities = [
  {
    id: '1',
    title: 'SQL Injection in login endpoint',
    severity: 'critical',
    type: 'SQL Injection',
    target: 'https://api.example.com/v1/auth/login',
    status: 'new',
    template: 'generic-sqli',
    createdAt: '2024-01-15T10:30:00Z',
    cvss: 9.8,
    cwe: 'CWE-89',
  },
  {
    id: '2',
    title: 'Reflected XSS in search parameter',
    severity: 'high',
    type: 'XSS',
    target: 'https://www.test.io/search?q=',
    status: 'confirmed',
    template: 'generic-xss',
    createdAt: '2024-01-15T09:15:00Z',
    cvss: 7.5,
    cwe: 'CWE-79',
  },
  {
    id: '3',
    title: 'CORS Misconfiguration',
    severity: 'medium',
    type: 'Misconfiguration',
    target: 'https://api.demo.org/graphql',
    status: 'new',
    template: 'cors-misconfig',
    createdAt: '2024-01-15T08:45:00Z',
    cvss: 5.3,
    cwe: 'CWE-942',
  },
  {
    id: '4',
    title: 'Missing X-Frame-Options Header',
    severity: 'low',
    type: 'Security Header',
    target: 'https://app.net/',
    status: 'false_positive',
    template: 'security-headers',
    createdAt: '2024-01-14T16:30:00Z',
    cvss: 3.1,
    cwe: 'CWE-1021',
  },
  {
    id: '5',
    title: 'SSRF via image URL parameter',
    severity: 'critical',
    type: 'SSRF',
    target: 'https://example.com/api/fetch-image?url=',
    status: 'reported',
    template: 'ssrf-generic',
    createdAt: '2024-01-14T14:20:00Z',
    cvss: 9.1,
    cwe: 'CWE-918',
  },
];

const severityOptions = ['critical', 'high', 'medium', 'low', 'info'];
const statusOptions = ['new', 'confirmed', 'false_positive', 'reported', 'fixed', 'duplicate'];

export default function VulnerabilitiesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredVulns = vulnerabilities.filter((vuln) => {
    const matchesSearch = vuln.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vuln.target.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = !selectedSeverity || vuln.severity === selectedSeverity;
    const matchesStatus = !selectedStatus || vuln.status === selectedStatus;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-400 border-red-500/50',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      low: 'bg-green-500/20 text-green-400 border-green-500/50',
      info: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    };
    return colors[severity] || 'bg-slate-500/20 text-slate-400';
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/20 text-blue-400',
      confirmed: 'bg-green-500/20 text-green-400',
      false_positive: 'bg-slate-500/20 text-slate-400',
      reported: 'bg-purple-500/20 text-purple-400',
      fixed: 'bg-emerald-500/20 text-emerald-400',
      duplicate: 'bg-yellow-500/20 text-yellow-400',
    };
    return colors[status] || 'bg-slate-500/20 text-slate-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-red-400" />
            Vulnerabilities
          </h1>
          <p className="text-slate-400 mt-1">
            {filteredVulns.length} vulnerabilities found
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 hover:bg-dark-700 transition-colors">
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {['critical', 'high', 'medium', 'low', 'info'].map((sev) => {
          const count = vulnerabilities.filter((v) => v.severity === sev).length;
          return (
            <motion.div
              key={sev}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-4 rounded-xl border cursor-pointer transition-all',
                getSeverityBgColor(sev),
                selectedSeverity === sev && 'ring-2 ring-white/20'
              )}
              onClick={() => setSelectedSeverity(selectedSeverity === sev ? null : sev)}
            >
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm capitalize opacity-80">{sev}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search vulnerabilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>

        <select
          value={selectedStatus || ''}
          onChange={(e) => setSelectedStatus(e.target.value || null)}
          className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
        >
          <option value="">All Status</option>
          {statusOptions.map((status) => (
            <option key={status} value={status} className="capitalize">
              {status.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Vulnerabilities List */}
      <div className="space-y-3">
        {filteredVulns.map((vuln, index) => (
          <motion.div
            key={vuln.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
          >
            {/* Main row */}
            <div
              className="p-4 flex items-center gap-4 cursor-pointer hover:bg-dark-800/50 transition-colors"
              onClick={() => setExpandedId(expandedId === vuln.id ? null : vuln.id)}
            >
              {/* Severity indicator */}
              <div className={cn(
                'w-1 h-12 rounded-full self-stretch',
                vuln.severity === 'critical' && 'bg-red-500',
                vuln.severity === 'high' && 'bg-orange-500',
                vuln.severity === 'medium' && 'bg-yellow-500',
                vuln.severity === 'low' && 'bg-green-500',
                vuln.severity === 'info' && 'bg-blue-500',
              )} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded border uppercase',
                    getSeverityBadge(vuln.severity)
                  )}>
                    {vuln.severity}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded capitalize',
                    getStatusBadge(vuln.status)
                  )}>
                    {vuln.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-500">
                    {vuln.type}
                  </span>
                </div>
                <h3 className="text-white font-medium truncate">{vuln.title}</h3>
                <p className="text-sm text-slate-500 truncate">{vuln.target}</p>
              </div>

              {/* Meta */}
              <div className="text-right shrink-0">
                <div className="text-sm text-slate-400">CVSS: {vuln.cvss}</div>
                <div className="text-xs text-slate-500">{timeAgo(vuln.createdAt)}</div>
              </div>

              <ChevronDown className={cn(
                'w-5 h-5 text-slate-500 transition-transform',
                expandedId === vuln.id && 'rotate-180'
              )} />
            </div>

            {/* Expanded content */}
            {expandedId === vuln.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-dark-800 p-4 bg-dark-800/30"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">CWE</div>
                    <div className="text-sm text-white">{vuln.cwe}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Template</div>
                    <div className="text-sm text-white">{vuln.template}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">CVSS Score</div>
                    <div className="text-sm text-white">{vuln.cvss}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Discovered</div>
                    <div className="text-sm text-white">{timeAgo(vuln.createdAt)}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-1">Target URL</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-dark-900 rounded text-sm text-primary-400 overflow-x-auto">
                      {vuln.target}
                    </code>
                    <button className="p-2 text-slate-400 hover:text-white transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      href={vuln.target}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-green-500/20 text-green-400 text-sm rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Confirm
                  </button>
                  <button className="px-3 py-1.5 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-1">
                    <XCircle className="w-4 h-4" />
                    False Positive
                  </button>
                  <button className="px-3 py-1.5 bg-purple-500/20 text-purple-400 text-sm rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-1">
                    <Flag className="w-4 h-4" />
                    Mark Reported
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {filteredVulns.length === 0 && (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No vulnerabilities found</h3>
          <p className="text-slate-400">
            {searchQuery ? 'Try adjusting your search or filters' : 'Run a scan to discover vulnerabilities'}
          </p>
        </div>
      )}
    </div>
  );
}

