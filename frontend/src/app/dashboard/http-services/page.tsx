'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Search,
  Filter,
  Download,
  ExternalLink,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Code,
  FileText,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Shield,
  Activity,
  Copy,
  CheckCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { httpServicesApi } from '@/lib/api';

interface HttpService {
  _id: string;
  url: string;
  subdomain: string;
  domain: string;
  statusCode?: number;
  title?: string;
  technologies?: string[];
  headers?: Record<string, string>;
  isCdn?: boolean;
  cdnProvider?: string[];
  waf?: string[];
  isFresh?: boolean;
  faviconHash?: string;
  contentLength?: number;
  webServer?: string;
  redirectChain?: string[];
  finalUrl?: string;
  scannedAt?: string;
  firstSeen?: string;
  lastSeen?: string;
  // Change tracking
  statusCodeChanged?: boolean;
  titleChanged?: boolean;
  techChanged?: boolean;
  previousScan?: {
    statusCode?: number;
    title?: string;
    technologies?: string[];
    scannedAt?: string;
  };
}

interface Stats {
  total: number;
  fresh: number;
  statusCodes: Record<number, number>;
  technologies: { name: string; count: number }[];
  statusCodeChanges: number;
  titleChanges: number;
  techChanges: number;
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


// Change indicator badge component
function ChangeBadge({ 
  type, 
  previousValue, 
  currentValue 
}: { 
  type: 'status' | 'title' | 'tech'; 
  previousValue: any; 
  currentValue: any;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const badgeConfig = {
    status: { label: 'Status', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    title: { label: 'Title', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    tech: { label: 'Tech', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  };

  const config = badgeConfig[type];
  
  const formatValue = (val: any) => {
    if (val === undefined || val === null) return 'N/A';
    if (Array.isArray(val)) return val.join(', ') || 'None';
    return String(val);
  };

  return (
    <div className="relative inline-block">
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border cursor-help',
          config.color
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <AlertCircle className="w-3 h-3" />
        {config.label}
      </span>
      
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-64 p-3 bg-dark-800 border border-dark-700 rounded-lg shadow-xl">
          <div className="text-xs font-medium text-slate-300 mb-2">{config.label} Changed</div>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-xs text-slate-500 w-16 shrink-0">Previous:</span>
              <span className="text-xs text-red-400 break-all">{formatValue(previousValue)}</span>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-slate-500 w-16 shrink-0">Current:</span>
              <span className="text-xs text-green-400 break-all">{formatValue(currentValue)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HttpServicesPage() {
  const [services, setServices] = useState<HttpService[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Advanced filters
  const [filterStatusCode, setFilterStatusCode] = useState<string>('');
  const [filterTechnology, setFilterTechnology] = useState<string>('');
  const [filterCdn, setFilterCdn] = useState<string>('');
  const [filterFresh, setFilterFresh] = useState<string>('');
  const [filterStatusChanged, setFilterStatusChanged] = useState<string>('');
  const [filterTitleChanged, setFilterTitleChanged] = useState<string>('');
  const [filterTechChanged, setFilterTechChanged] = useState<string>('');
  const [headerRegex, setHeaderRegex] = useState('');
  
  const debouncedSearch = useDebounce(searchQuery, 300);
  const debouncedHeaderRegex = useDebounce(headerRegex, 500);


  // Fetch stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await httpServicesApi.getStats({});
        setStats(response.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };
    fetchStats();
  }, []);

  const fetchServices = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { 
        limit, 
        offset: (pageNum - 1) * limit,
      };
      
      if (debouncedSearch) params.title = debouncedSearch;
      if (filterStatusCode) params.statusCode = parseInt(filterStatusCode, 10);
      if (filterTechnology) params.tech = filterTechnology;
      if (filterCdn === 'true') params.isCdn = true;
      if (filterCdn === 'false') params.isCdn = false;
      if (filterFresh === 'true') params.isFresh = true;
      if (filterFresh === 'false') params.isFresh = false;
      if (filterStatusChanged === 'true') params.statusCodeChanged = true;
      if (filterTitleChanged === 'true') params.titleChanged = true;
      if (filterTechChanged === 'true') params.techChanged = true;
      if (debouncedHeaderRegex) params.headerRegex = debouncedHeaderRegex;

      const response = await httpServicesApi.getAll(params);
      const result = response.data;
      
      if (Array.isArray(result)) {
        setServices(result);
        setTotal(result.length >= limit ? (pageNum * limit) + 1 : (pageNum - 1) * limit + result.length);
      } else {
        setServices([]);
        setTotal(0);
      }
      setPage(pageNum);
    } catch (err: any) {
      console.error('Failed to fetch HTTP services:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load HTTP services');
    } finally {
      setLoading(false);
    }
  }, [limit, debouncedSearch, filterStatusCode, filterTechnology, filterCdn, filterFresh, filterStatusChanged, filterTitleChanged, filterTechChanged, debouncedHeaderRegex]);

  useEffect(() => {
    fetchServices(1);
  }, [debouncedSearch, filterStatusCode, filterTechnology, filterCdn, filterFresh, filterStatusChanged, filterTitleChanged, filterTechChanged, debouncedHeaderRegex]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1) {
      fetchServices(newPage);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterStatusCode('');
    setFilterTechnology('');
    setFilterCdn('');
    setFilterFresh('');
    setFilterStatusChanged('');
    setFilterTitleChanged('');
    setFilterTechChanged('');
    setHeaderRegex('');
  };

  const activeFilterCount = [
    filterStatusCode, 
    filterTechnology, 
    filterCdn, 
    filterFresh, 
    filterStatusChanged, 
    filterTitleChanged, 
    filterTechChanged,
    headerRegex,
  ].filter(Boolean).length;

  const exportServices = async () => {
    try {
      const params: any = { limit: 10000 };
      if (filterStatusCode) params.statusCode = parseInt(filterStatusCode, 10);
      if (filterTechnology) params.tech = filterTechnology;
      if (filterCdn === 'true') params.isCdn = true;
      if (filterFresh === 'true') params.isFresh = true;

      const response = await httpServicesApi.getAll(params);
      const result = response.data;
      const allServices = Array.isArray(result) ? result : [];
      const data = allServices.map((s: HttpService) => s.url).join('\n');
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'http-services.txt';
      a.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Get unique status codes and technologies for filter dropdowns
  const statusCodes = stats?.statusCodes ? Object.keys(stats.statusCodes).map(Number).sort((a, b) => a - b) : [];
  const technologies = stats?.technologies?.map(t => t.name) || [];

  const totalPages = Math.ceil(total / limit);
  const hasNext = services.length === limit;
  const hasPrev = page > 1;


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Globe className="w-7 h-7 text-primary-400" />
            HTTP Services
          </h1>
          <p className="text-slate-400 mt-1">
            {loading ? 'Loading...' : `${stats?.total?.toLocaleString() || 0} services total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchServices(page)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-sm text-slate-300 font-medium transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={exportServices}
            disabled={total === 0}
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
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: 'Total', value: stats?.total?.toLocaleString() || '0', icon: Globe, color: 'text-primary-400' },
          { label: 'Fresh', value: stats?.fresh?.toLocaleString() || '0', icon: Sparkles, color: 'text-green-400' },
          { label: 'With CDN', value: '-', icon: Shield, color: 'text-orange-400' },
          { label: 'Status Changes', value: stats?.statusCodeChanges?.toLocaleString() || '0', icon: Activity, color: 'text-yellow-400' },
          { label: 'Title Changes', value: stats?.titleChanges?.toLocaleString() || '0', icon: FileText, color: 'text-purple-400' },
          { label: 'Tech Changes', value: stats?.techChanges?.toLocaleString() || '0', icon: Code, color: 'text-cyan-400' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">{stat.label}</p>
                <p className="text-xl font-bold text-white mt-1">{loading ? '...' : stat.value}</p>
              </div>
              <stat.icon className={cn('w-6 h-6', stat.color)} />
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
            placeholder="Search by title..."
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
      </div>


      {/* Advanced Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {/* Status Code Filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status Code</label>
              <select
                value={filterStatusCode}
                onChange={(e) => setFilterStatusCode(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                {statusCodes.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>

            {/* Technology Filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Technology</label>
              <select
                value={filterTechnology}
                onChange={(e) => setFilterTechnology(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                {technologies.slice(0, 50).map((tech) => (
                  <option key={tech} value={tech}>{tech}</option>
                ))}
              </select>
            </div>

            {/* CDN Filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">CDN</label>
              <select
                value={filterCdn}
                onChange={(e) => setFilterCdn(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                <option value="true">With CDN</option>
                <option value="false">Without CDN</option>
              </select>
            </div>

            {/* Freshness Filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Freshness</label>
              <select
                value={filterFresh}
                onChange={(e) => setFilterFresh(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                <option value="true">Fresh Only</option>
                <option value="false">Not Fresh</option>
              </select>
            </div>

            {/* Status Changed Filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status Changed</label>
              <select
                value={filterStatusChanged}
                onChange={(e) => setFilterStatusChanged(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                <option value="true">Changed</option>
              </select>
            </div>

            {/* Title Changed Filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Title Changed</label>
              <select
                value={filterTitleChanged}
                onChange={(e) => setFilterTitleChanged(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                <option value="true">Changed</option>
              </select>
            </div>

            {/* Tech Changed Filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tech Changed</label>
              <select
                value={filterTechChanged}
                onChange={(e) => setFilterTechChanged(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
              >
                <option value="">All</option>
                <option value="true">Changed</option>
              </select>
            </div>
          </div>

          {/* Header Regex Search */}
          <div className="mt-4 pt-4 border-t border-dark-700">
            <label className="block text-xs text-slate-400 mb-1">
              Header Regex Search
              <span className="ml-2 text-slate-500">(searches through all header values)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g., nginx|apache or X-Powered-By.*PHP"
                value={headerRegex}
                onChange={(e) => setHeaderRegex(e.target.value)}
                className="flex-1 max-w-md px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 font-mono"
              />
              {headerRegex && (
                <button
                  onClick={() => setHeaderRegex('')}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}


      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <span className="ml-3 text-slate-400">Loading HTTP services...</span>
        </div>
      )}

      {/* Services Table */}
      {!loading && services.length > 0 && (
        <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">URL</th>
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">
                    <div className="flex items-center gap-1">
                      <Code className="w-3.5 h-3.5" />
                      Technologies
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">CDN / WAF</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Changes</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, index) => (
                  <motion.tr
                    key={service._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(index * 0.01, 0.3) }}
                    className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {service.isFresh && (
                          <Sparkles className="w-4 h-4 text-green-400 flex-shrink-0" title="Fresh" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate max-w-[300px]" title={service.url}>
                            {service.subdomain}
                          </div>
                          <div className="text-xs text-slate-500 truncate max-w-[300px]" title={service.url}>
                            {service.url}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {service.statusCode ? (
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded font-mono text-sm',
                          getStatusBgColor(service.statusCode),
                          getStatusColor(service.statusCode)
                        )}>
                          {service.statusCode}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {service.title ? (
                        <div className="text-sm text-slate-300 truncate max-w-[200px]" title={service.title}>
                          {service.title}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {service.technologies && service.technologies.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {service.technologies.slice(0, 3).map((tech) => (
                            <span key={tech} className="px-1.5 py-0.5 bg-primary-500/20 text-xs text-primary-400 rounded">
                              {tech}
                            </span>
                          ))}
                          {service.technologies.length > 3 && (
                            <span 
                              className="px-1.5 py-0.5 bg-slate-500/20 text-xs text-slate-400 rounded cursor-help" 
                              title={service.technologies.slice(3).join(', ')}
                            >
                              +{service.technologies.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {service.isCdn && service.cdnProvider && service.cdnProvider.length > 0 ? (
                          <span className="px-1.5 py-0.5 bg-orange-500/20 text-xs text-orange-400 rounded">
                            {service.cdnProvider[0]}
                          </span>
                        ) : service.isCdn ? (
                          <span className="px-1.5 py-0.5 bg-orange-500/20 text-xs text-orange-400 rounded">
                            CDN
                          </span>
                        ) : null}
                        {service.waf && service.waf.length > 0 && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500/20 text-xs text-yellow-400 rounded">
                            <Shield className="w-3 h-3" />
                            {service.waf[0]}
                          </span>
                        )}
                        {!service.isCdn && (!service.waf || service.waf.length === 0) && (
                          <span className="text-slate-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {service.statusCodeChanged && (
                          <ChangeBadge 
                            type="status" 
                            previousValue={service.previousScan?.statusCode} 
                            currentValue={service.statusCode} 
                          />
                        )}
                        {service.titleChanged && (
                          <ChangeBadge 
                            type="title" 
                            previousValue={service.previousScan?.title} 
                            currentValue={service.title} 
                          />
                        )}
                        {service.techChanged && (
                          <ChangeBadge 
                            type="tech" 
                            previousValue={service.previousScan?.technologies} 
                            currentValue={service.technologies} 
                          />
                        )}
                        {!service.statusCodeChanged && !service.titleChanged && !service.techChanged && (
                          <span className="text-slate-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyToClipboard(service.url, service._id)}
                          className="p-1.5 text-slate-400 hover:text-white transition-colors"
                          title="Copy URL"
                        >
                          {copiedId === service._id ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <a
                          href={service.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-400 hover:text-white transition-colors"
                          title="Open URL"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
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
              Showing {((page - 1) * limit) + 1} to{' '}
              {Math.min(page * limit, (page - 1) * limit + services.length)} services
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={!hasPrev}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={!hasPrev}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                <span className="px-3 py-1 bg-dark-800 border border-dark-700 rounded text-sm text-white">
                  Page {page}
                </span>
              </div>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={!hasNext}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && services.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No HTTP services found</h3>
          <p className="text-slate-400 mb-4">
            {searchQuery || activeFilterCount > 0
              ? 'Try adjusting your filters' 
              : 'Run HTTP probing to discover services'}
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
