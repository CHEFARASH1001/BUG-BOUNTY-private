'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Search,
  Filter,
  Download,
  ExternalLink,
  CheckCircle,
  XCircle,
  Shield,
  Copy,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Radio,
  Globe,
  Code,
  FileText,
  AlertTriangle,
  Link2,
  ChevronDown,
  ChevronUp,
  Server,
  Hash,
  Clock,
  Sparkles,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { subdomainsApi } from '@/lib/api';
import { socketClient } from '@/lib/socket';

interface Subdomain {
  _id: string;
  subdomain: string;
  domain?: string;
  domainId?: {
    _id: string;
    domain: string;
    programId?: {
      _id: string;
      name: string;
      handle?: string;
      platform?: string;
    };
  };
  ip?: string[];
  cname?: string[];
  cdn?: string[];
  isAlive: boolean;
  httpStatus?: number;
  httpsStatus?: number;
  title?: string;
  technologies?: string[];
  ports?: { port: number; protocol?: string; service?: string }[];
  waf?: string[];
  sources?: string[];
  endpointCount?: number;
  abuseScore?: number;
  headers?: Record<string, string>;
  webServer?: string;
  faviconHash?: string;
  contentLength?: number;
  contentType?: string;
  ssl?: {
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    isExpired?: boolean;
    isValid?: boolean;
  };
  isNew?: boolean;
  createdAt?: string;
  lastSeen?: string;
  firstSeen?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface FilterOptions {
  technologies: string[];
  sources: string[];
  cdns: string[];
  httpStatuses: number[];
  domains: { _id: string; domain: string }[];
  programs: { _id: string; name: string }[];
  platforms: string[];
  dataSources: string[];
}

const getStatusColor = (status: number | null | undefined) => {
  if (!status) return 'text-slate-500';
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-blue-400';
  if (status >= 400 && status < 500) return 'text-yellow-400';
  return 'text-red-400';
};

const getStatusBgColor = (status: number | null | undefined) => {
  if (!status) return 'bg-slate-500/20';
  if (status >= 200 && status < 300) return 'bg-green-500/20';
  if (status >= 300 && status < 400) return 'bg-blue-500/20';
  if (status >= 400 && status < 500) return 'bg-yellow-500/20';
  return 'bg-red-500/20';
};

const getAbuseScoreColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return 'text-slate-500';
  if (score >= 75) return 'text-red-400';
  if (score >= 50) return 'text-orange-400';
  if (score >= 25) return 'text-yellow-400';
  return 'text-green-400';
};

const getAbuseScoreBgColor = (score: number | null | undefined) => {
  if (score === null || score === undefined) return 'bg-slate-500/20';
  if (score >= 75) return 'bg-red-500/20';
  if (score >= 50) return 'bg-orange-500/20';
  if (score >= 25) return 'bg-yellow-500/20';
  return 'bg-green-500/20';
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Expandable details component for HTTP info
function SubdomainDetails({ sub }: { sub: Subdomain }) {
  const hasHeaders = sub.headers && Object.keys(sub.headers).length > 0;
  const hasPorts = sub.ports && sub.ports.length > 0;
  const hasSSL = sub.ssl && (sub.ssl.issuer || sub.ssl.validTo);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="px-4 py-4 bg-dark-800/50 border-t border-dark-700"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Web Server & Content Info */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Server Info</h4>
          <div className="space-y-1.5">
            {sub.webServer && (
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-sm text-slate-300">{sub.webServer}</span>
              </div>
            )}
            {sub.contentType && (
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-sm text-slate-300 truncate">{sub.contentType}</span>
              </div>
            )}
            {sub.contentLength !== undefined && (
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-sm text-slate-300">{sub.contentLength.toLocaleString()} bytes</span>
              </div>
            )}
            {sub.faviconHash && (
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-sm text-slate-300 font-mono text-xs">{sub.faviconHash}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ports */}
        {hasPorts && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Open Ports</h4>
            <div className="flex flex-wrap gap-1.5">
              {sub.ports!.map((port, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded font-mono"
                  title={port.service || ''}
                >
                  {port.port}{port.service ? `/${port.service}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SSL Info */}
        {hasSSL && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">SSL Certificate</h4>
            <div className="space-y-1.5">
              {sub.ssl!.issuer && (
                <div className="text-sm text-slate-300 truncate" title={sub.ssl!.issuer}>
                  Issuer: {sub.ssl!.issuer}
                </div>
              )}
              {sub.ssl!.validTo && (
                <div className={cn(
                  'text-sm',
                  sub.ssl!.isExpired ? 'text-red-400' : 'text-green-400'
                )}>
                  {sub.ssl!.isExpired ? '⚠ Expired' : '✓ Valid'} until {new Date(sub.ssl!.validTo).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Timeline</h4>
          <div className="space-y-1.5">
            {sub.firstSeen && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-sm text-slate-300">First: {new Date(sub.firstSeen).toLocaleDateString()}</span>
              </div>
            )}
            {sub.lastSeen && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-sm text-slate-300">Last: {new Date(sub.lastSeen).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Headers */}
      {hasHeaders && (
        <div className="mt-4 pt-4 border-t border-dark-700">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Response Headers</h4>
          <div className="bg-dark-900 rounded-lg p-3 max-h-48 overflow-y-auto">
            <table className="w-full text-xs font-mono">
              <tbody>
                {Object.entries(sub.headers!).slice(0, 15).map(([key, value]) => (
                  <tr key={key} className="border-b border-dark-800 last:border-0">
                    <td className="py-1 pr-4 text-cyan-400 whitespace-nowrap">{key}</td>
                    <td className="py-1 text-slate-300 break-all">{value}</td>
                  </tr>
                ))}
                {Object.keys(sub.headers!).length > 15 && (
                  <tr>
                    <td colSpan={2} className="py-1 text-slate-500">
                      +{Object.keys(sub.headers!).length - 15} more headers
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function SubdomainsPage() {
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<{ total: number; alive: number; dead: number; withCdn: number } | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAlive, setFilterAlive] = useState<string>('');
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [filterProgram, setFilterProgram] = useState<string>('');
  const [filterDomain, setFilterDomain] = useState<string>('');
  const [filterHttpStatus, setFilterHttpStatus] = useState<string>('');
  const [filterCdn, setFilterCdn] = useState<string>('');
  const [filterTechnology, setFilterTechnology] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterFresh, setFilterFresh] = useState<string>('');
  const [filterPlatform, setFilterPlatform] = useState<string>('');
  const [filterProgramType, setFilterProgramType] = useState<string>('');
  const [filterDataSource, setFilterDataSource] = useState<string>('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Sync showLiveOnly toggle with filterAlive
  useEffect(() => {
    if (showLiveOnly) {
      setFilterAlive('true');
    } else if (filterAlive === 'true') {
      setFilterAlive('');
    }
  }, [showLiveOnly]);

  // WebSocket subscription for real-time subdomain updates
  const handleSubdomainUpdate = useCallback((data: { subdomain: Subdomain; action: 'created' | 'updated' | 'deleted' }) => {
    if (data.action === 'updated') {
      setSubdomains(prev => prev.map(sub => 
        sub._id === data.subdomain._id ? { ...sub, ...data.subdomain } : sub
      ));
    } else if (data.action === 'created') {
      if (!showLiveOnly || data.subdomain.isAlive) {
        setSubdomains(prev => [data.subdomain, ...prev.slice(0, pagination.limit - 1)]);
        setPagination(prev => ({ ...prev, total: prev.total + 1 }));
      }
    } else if (data.action === 'deleted') {
      setSubdomains(prev => prev.filter(sub => sub._id !== data.subdomain._id));
      setPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    }
  }, [showLiveOnly, pagination.limit]);

  const handleSubdomainStatusChange = useCallback((data: { subdomainId: string; isAlive: boolean; httpStatus?: number; title?: string; technologies?: string[] }) => {
    setSubdomains(prev => prev.map(sub => {
      if (sub._id === data.subdomainId) {
        return { 
          ...sub, 
          isAlive: data.isAlive,
          httpStatus: data.httpStatus ?? sub.httpStatus,
          title: data.title ?? sub.title,
          technologies: data.technologies ?? sub.technologies,
        };
      }
      return sub;
    }));
    
    if (showLiveOnly && !data.isAlive) {
      setSubdomains(prev => prev.filter(sub => sub._id !== data.subdomainId));
    }
  }, [showLiveOnly]);

  useEffect(() => {
    socketClient.connect();
    const unsubscribeUpdate = socketClient.on('subdomain:update', handleSubdomainUpdate);
    const unsubscribeStatus = socketClient.on('subdomain:status', handleSubdomainStatusChange);
    return () => {
      unsubscribeUpdate();
      unsubscribeStatus();
    };
  }, [handleSubdomainUpdate, handleSubdomainStatusChange]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [filterResponse, statsResponse] = await Promise.all([
          subdomainsApi.getFilterOptions(),
          subdomainsApi.getOverviewStats(),
        ]);
        setFilterOptions(filterResponse.data);
        setStats(statsResponse.data);
        setFilterOptionsLoaded(true);
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
      }
    };
    fetchInitialData();
  }, []);

  const fetchSubdomains = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit: pagination.limit, sortBy, sortOrder };
      if (filterAlive) params.isAlive = filterAlive;
      if (filterProgram) params.programId = filterProgram;
      if (filterDomain) params.domainId = filterDomain;
      if (filterHttpStatus) params.httpStatus = filterHttpStatus;
      if (filterCdn) params.cdn = filterCdn;
      if (filterTechnology) params.technology = filterTechnology;
      if (filterSource) params.source = filterSource;
      if (filterFresh) params.isNew = filterFresh;
      if (filterPlatform) params.platform = filterPlatform;
      if (filterProgramType) params.programType = filterProgramType;
      if (filterDataSource) params.dataSource = filterDataSource;
      if (debouncedSearch) params.search = debouncedSearch;

      const response = await subdomainsApi.getAll(params);
      const result = response.data;
      
      if (result.data && result.pagination) {
        setSubdomains(result.data);
        setPagination(result.pagination);
      } else {
        setSubdomains(Array.isArray(result) ? result : []);
      }
    } catch (err: any) {
      console.error('Failed to fetch subdomains:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load subdomains');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, filterAlive, filterProgram, filterDomain, filterHttpStatus, filterCdn, filterTechnology, filterSource, filterFresh, filterPlatform, filterProgramType, filterDataSource, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchSubdomains(1);
  }, [filterAlive, filterProgram, filterDomain, filterHttpStatus, filterCdn, filterTechnology, filterSource, filterFresh, filterPlatform, filterProgramType, filterDataSource, debouncedSearch, sortBy, sortOrder]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchSubdomains(newPage);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterAlive('');
    setShowLiveOnly(false);
    setFilterProgram('');
    setFilterDomain('');
    setFilterHttpStatus('');
    setFilterCdn('');
    setFilterTechnology('');
    setFilterSource('');
    setFilterFresh('');
    setFilterPlatform('');
    setFilterProgramType('');
    setFilterDataSource('');
  };

  const activeFilterCount = [filterAlive, filterProgram, filterDomain, filterHttpStatus, filterCdn, filterTechnology, filterSource, filterFresh, filterPlatform, filterProgramType, filterDataSource].filter(Boolean).length;

  const exportSubdomains = async () => {
    try {
      const params: Record<string, any> = { limit: 10000 };
      if (filterAlive) params.isAlive = filterAlive;
      if (filterProgram) params.programId = filterProgram;
      if (filterDomain) params.domainId = filterDomain;
      if (filterHttpStatus) params.httpStatus = filterHttpStatus;
      if (filterCdn) params.cdn = filterCdn;
      if (filterTechnology) params.technology = filterTechnology;
      if (filterSource) params.source = filterSource;
      if (filterFresh) params.isNew = filterFresh;
      if (filterPlatform) params.platform = filterPlatform;
      if (filterProgramType) params.programType = filterProgramType;
      if (filterDataSource) params.dataSource = filterDataSource;
      if (debouncedSearch) params.search = debouncedSearch;

      const response = await subdomainsApi.getAll(params);
      const result = response.data;
      const allSubs = result.data || result;
      const data = allSubs.map((s: Subdomain) => s.subdomain).join('\n');
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'subdomains.txt';
      a.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Layers className="w-7 h-7 text-primary-400" />
            Subdomains
          </h1>
          <p className="text-slate-400 mt-1">
            {loading ? 'Loading...' : `${pagination.total.toLocaleString()} subdomains total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLiveOnly(!showLiveOnly)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-all',
              showLiveOnly
                ? 'bg-green-600/20 border-green-500/50 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                : 'bg-dark-800 border-dark-700 text-slate-300 hover:bg-dark-700'
            )}
          >
            <Radio className={cn('w-4 h-4', showLiveOnly && 'animate-pulse')} />
            {showLiveOnly ? 'Live Only' : 'All Subdomains'}
          </button>
          <button
            onClick={() => fetchSubdomains(pagination.page)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-sm text-slate-300 font-medium transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={exportSubdomains}
            disabled={pagination.total === 0}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-sm text-slate-300 font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats?.total?.toLocaleString() ?? '...', icon: Layers, color: 'text-primary-400' },
          { label: 'Alive', value: stats?.alive?.toLocaleString() ?? '...', icon: CheckCircle, color: 'text-green-400' },
          { label: 'Dead', value: stats?.dead?.toLocaleString() ?? '...', icon: XCircle, color: 'text-red-400' },
          { label: 'With CDN', value: stats?.withCdn?.toLocaleString() ?? '...', icon: Shield, color: 'text-orange-400' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <stat.icon className={cn('w-8 h-8', stat.color)} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters Section */}
      <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 space-y-4">
        {/* Search and Sort Row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search subdomains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
            >
              <option value="createdAt">Sort: Date</option>
              <option value="subdomain">Sort: Name</option>
              <option value="httpStatus">Sort: Status</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* All Filters Grid */}
        {!filterOptions ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
            <span className="ml-2 text-sm text-slate-400">Loading filters...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select
                value={filterAlive}
                onChange={(e) => setFilterAlive(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                <option value="true">Alive</option>
                <option value="false">Dead</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">HTTP Status</label>
              <select
                value={filterHttpStatus}
                onChange={(e) => setFilterHttpStatus(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                {filterOptions?.httpStatuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Platform</label>
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                {filterOptions?.platforms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select
                value={filterProgramType}
                onChange={(e) => setFilterProgramType(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                <option value="bbp">BBP</option>
                <option value="vdp">VDP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Program</label>
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                {filterOptions?.programs.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Domain</label>
              <select
                value={filterDomain}
                onChange={(e) => setFilterDomain(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                {filterOptions?.domains.map((d) => (
                  <option key={d._id} value={d._id}>{d.domain}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data Source</label>
              <select
                value={filterDataSource}
                onChange={(e) => setFilterDataSource(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                {filterOptions?.dataSources.map((ds) => (
                  <option key={ds} value={ds}>{ds}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">CDN</label>
              <select
                value={filterCdn}
                onChange={(e) => setFilterCdn(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                {filterOptions?.cdns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Technology</label>
              <select
                value={filterTechnology}
                onChange={(e) => setFilterTechnology(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                {filterOptions?.technologies.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Source</label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                {filterOptions?.sources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Freshness</label>
              <select
                value={filterFresh}
                onChange={(e) => setFilterFresh(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                <option value="true">Fresh</option>
                <option value="false">Not Fresh</option>
              </select>
            </div>
          </div>
        )}

        {/* Active Filters Tags */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-dark-700 flex-wrap">
            <span className="text-xs text-slate-500">Active:</span>
            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                &quot;{debouncedSearch}&quot;
                <button onClick={() => setSearchQuery('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterAlive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                {filterAlive === 'true' ? 'Alive' : 'Dead'}
                <button onClick={() => setFilterAlive('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterHttpStatus && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                HTTP {filterHttpStatus}
                <button onClick={() => setFilterHttpStatus('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterPlatform && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                {filterPlatform}
                <button onClick={() => setFilterPlatform('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterProgramType && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                {filterProgramType === 'bbp' ? 'BBP' : 'VDP'}
                <button onClick={() => setFilterProgramType('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterProgram && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                {filterOptions?.programs.find(p => p._id === filterProgram)?.name || 'Program'}
                <button onClick={() => setFilterProgram('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterDomain && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                {filterOptions?.domains.find(d => d._id === filterDomain)?.domain || 'Domain'}
                <button onClick={() => setFilterDomain('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterDataSource && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                {filterDataSource}
                <button onClick={() => setFilterDataSource('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterCdn && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                CDN: {filterCdn}
                <button onClick={() => setFilterCdn('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterTechnology && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                {filterTechnology}
                <button onClick={() => setFilterTechnology('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterSource && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                {filterSource}
                <button onClick={() => setFilterSource('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterFresh && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">
                {filterFresh === 'true' ? 'Fresh' : 'Not Fresh'}
                <button onClick={() => setFilterFresh('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <span className="ml-3 text-slate-400">Loading subdomains...</span>
        </div>
      )}

      {/* Subdomains Table */}
      {!loading && subdomains.length > 0 && (
        <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="w-8 px-2"></th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Subdomain</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Program</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">
                    <div className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      Status
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">
                    <div className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      Title
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">IP / CNAME</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">
                    <div className="flex items-center gap-1">
                      <Server className="w-3.5 h-3.5" />
                      Server
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">CDN / WAF</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">
                    <div className="flex items-center gap-1">
                      <Code className="w-3.5 h-3.5" />
                      Tech
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subdomains.map((sub, index) => (
                  <>
                    <motion.tr
                      key={sub._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(index * 0.01, 0.3) }}
                      className={cn(
                        'border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors cursor-pointer',
                        expandedRows.has(sub._id) && 'bg-dark-800/20'
                      )}
                      onClick={() => toggleRowExpansion(sub._id)}
                    >
                      <td className="px-2 py-3">
                        <button className="p-1 text-slate-500 hover:text-white transition-colors">
                          {expandedRows.has(sub._id) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {sub.isAlive ? (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-white truncate max-w-[200px]">{sub.subdomain}</span>
                              {sub.isNew && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full" title="Fresh discovery">
                                  <Sparkles className="w-3 h-3" />
                                  New
                                </span>
                              )}
                            </div>
                            {sub.domainId?.domain && (
                              <div className="text-xs text-slate-500">{sub.domainId.domain}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {sub.domainId?.programId ? (
                          <div className="min-w-0">
                            <div className="text-sm text-white truncate max-w-[120px]">{sub.domainId.programId.name}</div>
                            {sub.domainId.programId.platform && (
                              <div className="text-xs text-slate-500">{sub.domainId.programId.platform}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sub.httpStatus ? (
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded font-mono text-sm',
                            getStatusBgColor(sub.httpStatus),
                            getStatusColor(sub.httpStatus)
                          )}>
                            {sub.httpStatus}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sub.title ? (
                          <div className="text-sm text-slate-300 truncate max-w-[180px]" title={sub.title}>
                            {sub.title}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sub.ip && sub.ip.length > 0 ? (
                          <div className="space-y-0.5">
                            <div className="font-mono text-sm text-slate-300">{sub.ip[0]}</div>
                            {sub.ip.length > 1 && (
                              <div className="text-xs text-slate-500">+{sub.ip.length - 1} more</div>
                            )}
                          </div>
                        ) : sub.cname && sub.cname.length > 0 ? (
                          <div className="text-xs text-cyan-400 truncate max-w-[120px]" title={sub.cname[0]}>
                            → {sub.cname[0]}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sub.webServer ? (
                          <span className="text-sm text-slate-300 truncate max-w-[100px]" title={sub.webServer}>
                            {sub.webServer.split('/')[0]}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sub.cdn && sub.cdn.length > 0 ? (
                          <span className="px-1.5 py-0.5 bg-orange-500/20 text-xs text-orange-400 rounded">
                            {sub.cdn[0]}
                          </span>
                        ) : sub.waf && sub.waf.length > 0 ? (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500/20 text-xs text-yellow-400 rounded">
                            <Shield className="w-3 h-3" />
                            {sub.waf[0]}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sub.technologies && sub.technologies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {sub.technologies.slice(0, 2).map((tech) => (
                              <span key={tech} className="px-1.5 py-0.5 bg-primary-500/20 text-xs text-primary-400 rounded">
                                {tech}
                              </span>
                            ))}
                            {sub.technologies.length > 2 && (
                              <span className="px-1.5 py-0.5 bg-slate-500/20 text-xs text-slate-400 rounded">
                                +{sub.technologies.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/dashboard/subdomains/${sub._id}`}
                            className="p-1.5 text-slate-400 hover:text-white transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => copyToClipboard(sub.subdomain, sub._id)}
                            className="p-1.5 text-slate-400 hover:text-white transition-colors"
                            title="Copy"
                          >
                            {copiedId === sub._id ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          {sub.isAlive && (
                            <a
                              href={`https://${sub.subdomain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-white transition-colors"
                              title="Open"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                    <AnimatePresence>
                      {expandedRows.has(sub._id) && (
                        <tr key={`${sub._id}-details`}>
                          <td colSpan={10} className="p-0">
                            <SubdomainDetails sub={sub} />
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-800">
            <div className="text-sm text-slate-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total.toLocaleString()} subdomains
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={!pagination.hasPrev}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPrev}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={pagination.totalPages}
                  defaultValue={pagination.page}
                  key={pagination.page}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = parseInt((e.target as HTMLInputElement).value, 10);
                      if (value >= 1 && value <= pagination.totalPages) {
                        handlePageChange(value);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (value >= 1 && value <= pagination.totalPages && value !== pagination.page) {
                      handlePageChange(value);
                    }
                  }}
                  className="w-16 px-2 py-1 bg-dark-800 border border-dark-700 rounded text-sm text-white text-center focus:outline-none focus:border-primary-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-sm text-slate-400">/ {pagination.totalPages}</span>
              </div>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNext}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={!pagination.hasNext}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && subdomains.length === 0 && (
        <div className="text-center py-12">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No subdomains found</h3>
          <p className="text-slate-400 mb-4">
            {searchQuery || activeFilterCount > 0
              ? 'Try adjusting your filters' 
              : 'Run the subdomain enumeration to discover subdomains'}
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-white font-medium transition-colors mr-2"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          )}
          <a
            href="/dashboard/cron"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Go to Cron Jobs
          </a>
        </div>
      )}
    </div>
  );
}
