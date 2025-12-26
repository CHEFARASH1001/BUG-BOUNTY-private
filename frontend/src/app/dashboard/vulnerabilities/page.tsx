'use client';

import { useState, useEffect } from 'react';
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
  Cpu,
  Wrench,
} from 'lucide-react';
import { cn, getSeverityBgColor, timeAgo } from '@/lib/utils';
import { vulnerabilitiesApi } from '@/lib/api';

// Vulnerability interface matching backend schema
interface Vulnerability {
  _id: string;
  title: string;
  severity: string;
  type: string;
  target: string;
  status: string;
  template?: string;
  createdAt: string;
  cvss?: number;
  cwe?: string;
  sourceTool?: string;
  evidence?: {
    sourceTool?: string;
    [key: string]: unknown;
  };
}

const severityOptions = ['critical', 'high', 'medium', 'low', 'info'];
const statusOptions = ['new', 'confirmed', 'false_positive', 'reported', 'fixed', 'duplicate'];

export default function VulnerabilitiesPage() {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [sourceTools, setSourceTools] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedSourceTool, setSelectedSourceTool] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch source tools on mount
  useEffect(() => {
    const fetchSourceTools = async () => {
      try {
        const response = await vulnerabilitiesApi.getSourceTools();
        setSourceTools(response.data || []);
      } catch (error) {
        console.error('Failed to fetch source tools:', error);
      }
    };
    fetchSourceTools();
  }, []);

  // Fetch vulnerabilities from API
  useEffect(() => {
    const fetchVulnerabilities = async () => {
      try {
        setLoading(true);
        const filters: Record<string, string> = {};
        if (selectedSeverity) filters.severity = selectedSeverity;
        if (selectedStatus) filters.status = selectedStatus;
        if (selectedSourceTool) filters.sourceTool = selectedSourceTool;
        if (searchQuery) filters.search = searchQuery;
        
        const response = await vulnerabilitiesApi.getAll(filters);
        setVulnerabilities(response.data || []);
      } catch (error) {
        console.error('Failed to fetch vulnerabilities:', error);
        setVulnerabilities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVulnerabilities();
  }, [selectedSeverity, selectedStatus, selectedSourceTool, searchQuery]);

  const filteredVulns = vulnerabilities;

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

  const getSourceToolBadge = (sourceTool?: string) => {
    if (!sourceTool) return null;
    
    const isHexStrike = sourceTool.toLowerCase().includes('hexstrike');
    return (
      <span className={cn(
        'px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1',
        isHexStrike 
          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
          : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
      )}>
        {isHexStrike ? <Cpu className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
        {sourceTool}
      </span>
    );
  };

  // Get source tool from vulnerability (check both top-level and evidence)
  const getSourceTool = (vuln: Vulnerability): string | undefined => {
    return vuln.sourceTool || vuln.evidence?.sourceTool as string | undefined;
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
            {loading ? 'Loading...' : `${filteredVulns.length} vulnerabilities found`}
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
      <div className="flex flex-wrap items-center gap-4">
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

        {/* Source Tool Filter */}
        <select
          value={selectedSourceTool || ''}
          onChange={(e) => setSelectedSourceTool(e.target.value || null)}
          className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
        >
          <option value="">All Sources</option>
          {sourceTools.map((tool) => (
            <option key={tool} value={tool}>
              {tool.includes('hexstrike') ? 'HexStrike AI' : tool.charAt(0).toUpperCase() + tool.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      )}

      {/* Vulnerabilities List */}
      {!loading && (
        <div className="space-y-3">
          {filteredVulns.map((vuln, index) => (
            <motion.div
              key={vuln._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
            >
              {/* Main row */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-dark-800/50 transition-colors"
                onClick={() => setExpandedId(expandedId === vuln._id ? null : vuln._id)}
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
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
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
                    {/* Source Tool Badge */}
                    {getSourceTool(vuln) && getSourceToolBadge(getSourceTool(vuln))}
                  </div>
                  <h3 className="text-white font-medium truncate">{vuln.title}</h3>
                  <p className="text-sm text-slate-500 truncate">{vuln.target}</p>
                </div>

                {/* Meta */}
                <div className="text-right shrink-0">
                  {vuln.cvss && <div className="text-sm text-slate-400">CVSS: {vuln.cvss}</div>}
                  <div className="text-xs text-slate-500">{timeAgo(vuln.createdAt)}</div>
                </div>

                <ChevronDown className={cn(
                  'w-5 h-5 text-slate-500 transition-transform',
                  expandedId === vuln._id && 'rotate-180'
                )} />
              </div>

              {/* Expanded content */}
              {expandedId === vuln._id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-dark-800 p-4 bg-dark-800/30"
                >
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">CWE</div>
                      <div className="text-sm text-white">{vuln.cwe || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Template</div>
                      <div className="text-sm text-white">{vuln.template || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">CVSS Score</div>
                      <div className="text-sm text-white">{vuln.cvss || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Discovered</div>
                      <div className="text-sm text-white">{timeAgo(vuln.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Source Tool</div>
                      <div className="text-sm text-white flex items-center gap-1">
                        {getSourceTool(vuln) ? (
                          <>
                            {getSourceTool(vuln)?.toLowerCase().includes('hexstrike') ? (
                              <Cpu className="w-3 h-3 text-purple-400" />
                            ) : (
                              <Wrench className="w-3 h-3 text-slate-400" />
                            )}
                            {getSourceTool(vuln)}
                          </>
                        ) : (
                          'Unknown'
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-xs text-slate-500 mb-1">Target URL</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-dark-900 rounded text-sm text-primary-400 overflow-x-auto">
                        {vuln.target}
                      </code>
                      <button 
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(vuln.target);
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={vuln.target}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                        onClick={(e) => e.stopPropagation()}
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
      )}

      {!loading && filteredVulns.length === 0 && (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No vulnerabilities found</h3>
          <p className="text-slate-400">
            {searchQuery || selectedSeverity || selectedStatus || selectedSourceTool 
              ? 'Try adjusting your search or filters' 
              : 'Run a scan to discover vulnerabilities'}
          </p>
        </div>
      )}
    </div>
  );
}
