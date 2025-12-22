'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
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
  title?: string;
  technologies?: string[];
  ports?: { port: number }[];
  waf?: string[];
  sources?: string[];
  createdAt?: string;
  lastSeen?: string;
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

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function SubdomainsPage() {
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAlive, setFilterAlive] = useState<string>('');
  const [showLiveOnly, setShowLiveOnly] = useState(false); // New toggle state for live filter
  const [filterProgram, setFilterProgram] = useState<string>('');
  const [filterDomain, setFilterDomain] = useState<string>('');
  const [filterHttpStatus, setFilterHttpStatus] = useState<string>('');
  const [filterCdn, setFilterCdn] = useState<string>('');
  const [filterTechnology, setFilterTechnology] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

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
      // Only add if it matches current filters
      if (!showLiveOnly || data.subdomain.isAlive) {
        setSubdomains(prev => [data.subdomain, ...prev.slice(0, pagination.limit - 1)]);
        setPagination(prev => ({ ...prev, total: prev.total + 1 }));
      }
    } else if (data.action === 'deleted') {
      setSubdomains(prev => prev.filter(sub => sub._id !== data.subdomain._id));
      setPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    }
  }, [showLiveOnly, pagination.limit]);

  // Handle subdomain status change (live/offline)
  const handleSubdomainStatusChange = useCallback((data: { subdomainId: string; isAlive: boolean; httpStatus?: number; title?: string; technologies?: string[] }) => {
    setSubdomains(prev => prev.map(sub => {
      if (sub._id === data.subdomainId) {
        const updated = { 
          ...sub, 
          isAlive: data.isAlive,
          httpStatus: data.httpStatus ?? sub.httpStatus,
          title: data.title ?? sub.title,
          technologies: data.technologies ?? sub.technologies,
        };
        return updated;
      }
      return sub;
    }));
    
    // If showing live only and subdomain went offline, remove it from the list
    if (showLiveOnly && !data.isAlive) {
      setSubdomains(prev => prev.filter(sub => sub._id !== data.subdomainId));
    }
  }, [showLiveOnly]);

  // Connect to WebSocket and subscribe to subdomain events
  useEffect(() => {
    socketClient.connect();
    
    const unsubscribeUpdate = socketClient.on('subdomain:update', handleSubdomainUpdate);
    const unsubscribeStatus = socketClient.on('subdomain:status', handleSubdomainStatusChange);
    
    return () => {
      unsubscribeUpdate();
      unsubscribeStatus();
    };
  }, [handleSubdomainUpdate, handleSubdomainStatusChange]);

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const response = await subdomainsApi.getFilterOptions();
        setFilterOptions(response.data);
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    };
    fetchFilterOptions();
  }, []);

  const fetchSubdomains = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, limit: pagination.limit, sortBy, sortOrder };
      if (filterAlive) params.isAlive = filterAlive;
      if (filterProgram) params.programId = filterProgram;
      if (filterDomain) params.domainId = filterDomain;
      if (filterHttpStatus) params.httpStatus = filterHttpStatus;
      if (filterCdn) params.cdn = filterCdn;
      if (filterTechnology) params.technology = filterTechnology;
      if (filterSource) params.source = filterSource;
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
  }, [pagination.limit, filterAlive, filterProgram, filterDomain, filterHttpStatus, filterCdn, filterTechnology, filterSource, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchSubdomains(1);
  }, [filterAlive, filterProgram, filterDomain, filterHttpStatus, filterCdn, filterTechnology, filterSource, debouncedSearch, sortBy, sortOrder]);

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
  };

  const activeFilterCount = [filterAlive, filterProgram, filterDomain, filterHttpStatus, filterCdn, filterTechnology, filterSource].filter(Boolean).length;

  const exportSubdomains = async () => {
    try {
      const params: any = { limit: 10000 };
      if (filterAlive) params.isAlive = filterAlive;
      if (filterProgram) params.programId = filterProgram;
      if (filterDomain) params.domainId = filterDomain;
      if (filterHttpStatus) params.httpStatus = filterHttpStatus;
      if (filterCdn) params.cdn = filterCdn;
      if (filterTechnology) params.technology = filterTechnology;
      if (filterSource) params.source = filterSource;
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

  const aliveCount = subdomains.filter(s => s.isAlive).length;
  const deadCount = subdomains.filter(s => !s.isAlive).length;
  const withCdnCount = subdomains.filter(s => s.cdn && s.cdn.length > 0).length;

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
          {/* Live Filter Toggle Button */}
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
          { label: 'Total', value: pagination.total.toLocaleString(), icon: Layers, color: 'text-primary-400' },
          { label: 'Alive (page)', value: aliveCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Dead (page)', value: deadCount, icon: XCircle, color: 'text-red-400' },
          { label: 'With CDN (page)', value: withCdnCount, icon: Shield, color: 'text-orange-400' },
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
                <p className="text-2xl font-bold text-white mt-1">{loading ? '...' : stat.value}</p>
              </div>
              <stat.icon className={cn('w-8 h-8', stat.color)} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search and Filter Toggle */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search subdomains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors',
            showFilters || activeFilterCount > 0
              ? 'bg-primary-600/20 border-primary-500/50 text-primary-400'
              : 'bg-dark-800 border-dark-700 text-slate-300 hover:bg-dark-700'
          )}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 bg-primary-500 text-white text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
            Clear all
          </button>
        )}

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
        >
          <option value="createdAt">Sort by Date</option>
          <option value="subdomain">Sort by Name</option>
          <option value="httpStatus">Sort by Status</option>
        </select>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
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
              <label className="block text-xs text-slate-400 mb-1">Program</label>
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All Programs</option>
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
                <option value="">All Domains</option>
                {filterOptions?.domains.map((d) => (
                  <option key={d._id} value={d._id}>{d.domain}</option>
                ))}
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
          </div>
        </motion.div>
      )}

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
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Subdomain</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Domain</th>
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">CDN</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Sources</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">
                    <div className="flex items-center gap-1">
                      <Code className="w-3.5 h-3.5" />
                      Technologies
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subdomains.map((sub, index) => (
                  <motion.tr
                    key={sub._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(index * 0.01, 0.3) }}
                    className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {sub.isAlive ? (
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate max-w-[250px]">{sub.subdomain}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {sub.domainId?.domain ? (
                        <span className="text-sm text-slate-300">{sub.domainId.domain}</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.domainId?.programId ? (
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate max-w-[150px]">{sub.domainId.programId.name}</div>
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
                        <div className="text-sm text-slate-300 truncate max-w-[200px]" title={sub.title}>
                          {sub.title}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.ip && sub.ip.length > 0 ? (
                        <div className="space-y-1">
                          {sub.ip.slice(0, 2).map((ip) => (
                            <div key={ip} className="font-mono text-sm text-slate-300">{ip}</div>
                          ))}
                          {sub.ip.length > 2 && (
                            <div className="text-xs text-slate-500">+{sub.ip.length - 2} more</div>
                          )}
                          {sub.cname && sub.cname.length > 0 && (
                            <div className="text-xs text-cyan-400 truncate max-w-[150px]" title={sub.cname[0]}>
                              → {sub.cname[0]}
                            </div>
                          )}
                        </div>
                      ) : sub.cname && sub.cname.length > 0 ? (
                        <div className="text-xs text-cyan-400 truncate max-w-[150px]" title={sub.cname[0]}>
                          → {sub.cname[0]}
                        </div>
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
                        <span className="flex items-center gap-1 text-yellow-400 text-sm">
                          <Shield className="w-3 h-3" />
                          {sub.waf[0]}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.sources && sub.sources.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sub.sources.map((source) => (
                            <span key={source} className="px-1.5 py-0.5 bg-blue-500/20 text-xs text-blue-400 rounded">
                              {source}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.technologies && sub.technologies.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sub.technologies.slice(0, 3).map((tech) => (
                            <span key={tech} className="px-1.5 py-0.5 bg-primary-500/20 text-xs text-primary-400 rounded">
                              {tech}
                            </span>
                          ))}
                          {sub.technologies.length > 3 && (
                            <span className="px-1.5 py-0.5 bg-slate-500/20 text-xs text-slate-400 rounded" title={sub.technologies.slice(3).join(', ')}>
                              +{sub.technologies.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
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
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPrev}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
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
                  title="Go to page"
                />
                <span className="text-sm text-slate-400">/ {pagination.totalPages}</span>
              </div>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNext}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={!pagination.hasNext}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Last page"
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
