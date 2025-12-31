'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Globe,
  DollarSign,
  Calendar,
  ExternalLink,
  Shield,
  CheckCircle,
  Loader2,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn, formatDate } from '@/lib/utils';
import { programsApi } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsMobile } from '@/hooks';

interface Program {
  _id: string;
  name: string;
  platform: string;
  handle: string;
  url?: string;
  status: string;
  offersBounties: boolean;
  scopes?: { assetIdentifier: string; assetType: string; status?: string }[];
  scopeCount?: number;
  createdAt?: string;
  dataSources?: string[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface DashboardStats {
  totalPrograms: number;
  activePrograms: number;
  totalScopes: number;
  bbpCount: number;
  vdpCount: number;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Active' },
  paused: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Paused' },
  inactive: { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Inactive' },
  open: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Open' },
  soft_launched: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Soft Launch' },
  public_mode: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Public' },
};

const platformColors: Record<string, string> = {
  hackerone: 'bg-purple-500/20 text-purple-400',
  HackerOne: 'bg-purple-500/20 text-purple-400',
  bugcrowd: 'bg-orange-500/20 text-orange-400',
  Bugcrowd: 'bg-orange-500/20 text-orange-400',
  intigriti: 'bg-green-500/20 text-green-400',
  yeswehack: 'bg-cyan-500/20 text-cyan-400',
  synack: 'bg-blue-500/20 text-blue-400',
  Synack: 'bg-blue-500/20 text-blue-400',
  'Self-hosted': 'bg-slate-500/20 text-slate-400',
};

const dataSourceConfig: Record<string, { label: string; color: string }> = {
  'hackerone-api': { label: 'H1 API', color: 'bg-purple-500/30 text-purple-300 border-purple-500/50' },
  'bugcrowd-api': { label: 'BC API', color: 'bg-orange-500/30 text-orange-300 border-orange-500/50' },
  'chaos': { label: 'Chaos', color: 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50' },
  'bounty-targets': { label: 'BT Data', color: 'bg-sky-500/30 text-sky-300 border-sky-500/50' },
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export default function ProgramsPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedDataSource, setSelectedDataSource] = useState<string | null>(null);
  const [selectedProgramType, setSelectedProgramType] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const fetchDashboardStats = useCallback(async () => {
    try {
      const response = await programsApi.getDashboardStats();
      setDashboardStats(response.data);
    } catch (err: any) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  }, []);

  const fetchPrograms = useCallback(
    async (page = 1, limit = pagination.limit) => {
      setLoading(true);
      setError(null);
      try {
        const response = await programsApi.getAll({
          status: selectedStatus || undefined,
          platform: selectedPlatform || undefined,
          search: debouncedSearch || undefined,
          offersBounties:
            selectedProgramType === 'bbp'
              ? 'true'
              : selectedProgramType === 'vdp'
                ? 'false'
                : undefined,
          dataSource: selectedDataSource || undefined,
          page,
          limit,
        });
        const { data, pagination: paginationData } = response.data;
        setPrograms(Array.isArray(data) ? data : []);
        setPagination(paginationData);
      } catch (err: any) {
        console.error('Failed to fetch programs:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load programs');
      } finally {
        setLoading(false);
      }
    },
    [selectedStatus, selectedPlatform, debouncedSearch, selectedProgramType, selectedDataSource, pagination.limit]
  );

  useEffect(() => {
    fetchPrograms(1, pagination.limit);
    fetchDashboardStats();
  }, [selectedStatus, selectedPlatform, debouncedSearch, selectedProgramType, selectedDataSource]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchPrograms(newPage, pagination.limit);
    }
  };

  const handlePageSizeChange = (newLimit: number) => {
    setPagination((prev) => ({ ...prev, limit: newLimit }));
    fetchPrograms(1, newLimit);
  };

  const hasActiveFilters =
    selectedStatus || selectedPlatform || selectedDataSource || selectedProgramType || searchQuery;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus(null);
    setSelectedPlatform(null);
    setSelectedDataSource(null);
    setSelectedProgramType(null);
  };

  // Page-level stats (for filtered view)
  const pageActiveCount = programs.filter(
    (p) => p.status === 'active' || p.status === 'open' || p.status === 'public_mode'
  ).length;
  const pageTotalScopes = programs.reduce((a, b) => a + (b.scopeCount || b.scopes?.length || 0), 0);

  const getPageNumbers = () => {
    const { page, totalPages } = pagination;
    const pages: (number | string)[] = [];
    const showPages = 5;

    if (totalPages <= showPages + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-6 h-6 md:w-7 md:h-7 text-primary-400" />
            Programs
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">Manage your bug bounty programs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPrograms(pagination.page, pagination.limit)}
            disabled={loading}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 font-medium transition-colors border border-dark-700 min-h-[44px]"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            href="/dashboard/programs/new"
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Program</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        {[
          { label: 'Total Programs', value: dashboardStats?.totalPrograms ?? pagination.total, icon: Building2, color: 'text-primary-400' },
          { label: 'Active', value: dashboardStats?.activePrograms ?? pageActiveCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Total Scopes', value: dashboardStats?.totalScopes ?? pageTotalScopes, icon: Globe, color: 'text-blue-400' },
          { label: 'BBP', value: dashboardStats?.bbpCount ?? 0, icon: DollarSign, color: 'text-yellow-400' },
          { label: 'VDP', value: dashboardStats?.vdpCount ?? 0, icon: Shield, color: 'text-slate-400' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-3 md:p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs md:text-sm">{stat.label}</p>
                <p className="text-xl md:text-2xl font-bold text-white mt-1">{loading ? '...' : stat.value}</p>
              </div>
              <stat.icon className={cn('w-6 h-6 md:w-8 md:h-8', stat.color)} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Search - always visible */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search programs by name or handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter toggle button - mobile only */}
        {isMobile && (
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className={cn(
              'flex items-center justify-between w-full px-4 py-3',
              'bg-dark-800 border border-dark-700 rounded-lg',
              'text-sm text-slate-300 font-medium',
              'transition-colors hover:bg-dark-700',
              'min-h-[44px]'
            )}
            aria-expanded={filtersExpanded}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded-full">
                  Active
                </span>
              )}
            </div>
            {filtersExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        )}

        {/* Filter controls - collapsible on mobile */}
        {(!isMobile || filtersExpanded) && (
          <div className={cn(
            'flex gap-2',
            isMobile ? 'flex-col p-4 bg-dark-800/50 border border-dark-700 rounded-lg' : 'flex-row flex-wrap items-center'
          )}>
            {!isMobile && <Filter className="w-4 h-4 text-slate-400" />}
            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value || null)}
              className={cn(
                'px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50',
                isMobile && 'w-full min-h-[44px]'
              )}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="open">Open</option>
              <option value="public_mode">Public</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={selectedPlatform || ''}
              onChange={(e) => setSelectedPlatform(e.target.value || null)}
              className={cn(
                'px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50',
                isMobile && 'w-full min-h-[44px]'
              )}
            >
              <option value="">All Platforms</option>
              <option value="hackerone">HackerOne</option>
              <option value="bugcrowd">Bugcrowd</option>
              <option value="intigriti">Intigriti</option>
              <option value="yeswehack">YesWeHack</option>
              <option value="synack">Synack</option>
              <option value="federacy">Federacy</option>
              <option value="github">GitHub</option>
              <option value="custom">Custom</option>
            </select>
            <select
              value={selectedProgramType || ''}
              onChange={(e) => setSelectedProgramType(e.target.value || null)}
              className={cn(
                'px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50',
                isMobile && 'w-full min-h-[44px]'
              )}
            >
              <option value="">All Types</option>
              <option value="bbp">BBP (Bounty)</option>
              <option value="vdp">VDP (No Bounty)</option>
            </select>
            <select
              value={selectedDataSource || ''}
              onChange={(e) => setSelectedDataSource(e.target.value || null)}
              className={cn(
                'px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50',
                isMobile && 'w-full min-h-[44px]'
              )}
            >
              <option value="">All Sources</option>
              <option value="hackerone-api">HackerOne API</option>
              <option value="bugcrowd-api">Bugcrowd API</option>
              <option value="chaos">Chaos</option>
              <option value="bounty-targets">Bounty Targets</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className={cn(
                  'flex items-center justify-center gap-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors',
                  isMobile && 'w-full min-h-[44px]'
                )}
              >
                <X className="w-3 h-3" />
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
          <span>Filtered: {pagination.total} programs</span>
          {debouncedSearch && <span className="px-2 py-0.5 bg-dark-800 rounded text-xs">Search: &quot;{debouncedSearch}&quot;</span>}
          {selectedStatus && <span className="px-2 py-0.5 bg-dark-800 rounded text-xs">Status: {selectedStatus}</span>}
          {selectedPlatform && <span className="px-2 py-0.5 bg-dark-800 rounded text-xs">Platform: {selectedPlatform}</span>}
          {selectedProgramType && <span className="px-2 py-0.5 bg-dark-800 rounded text-xs">Type: {selectedProgramType.toUpperCase()}</span>}
          {selectedDataSource && <span className="px-2 py-0.5 bg-dark-800 rounded text-xs">Source: {selectedDataSource}</span>}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <span className="ml-3 text-slate-400">Loading programs...</span>
        </div>
      )}

      {!loading && (
        <>
          <div className="space-y-3 md:space-y-4">
            {programs.map((program, index) => {
              const status = statusConfig[program.status] || statusConfig.active;
              const platformColor = platformColors[program.platform] || 'bg-slate-500/20 text-slate-400';

              return (
                <motion.div
                  key={program._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.5) }}
                  className="group relative"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-600/50 to-accent-cyan/50 rounded-xl blur opacity-0 group-hover:opacity-20 transition duration-300" />
                  <div 
                    className={cn(
                      "relative p-4 md:p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-dark-700 transition-colors",
                      isMobile && "cursor-pointer active:bg-dark-800"
                    )}
                    onClick={() => isMobile && router.push(`/dashboard/programs/${program._id}`)}
                    role={isMobile ? "button" : undefined}
                    tabIndex={isMobile ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isMobile && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        router.push(`/dashboard/programs/${program._id}`);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                        <div className="p-2 md:p-3 bg-primary-500/20 rounded-xl shrink-0">
                          <Building2 className="w-5 h-5 md:w-6 md:h-6 text-primary-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 md:gap-3 mb-1 flex-wrap">
                            <Link
                              href={`/dashboard/programs/${program._id}`}
                              className="text-base md:text-lg font-semibold text-white hover:text-primary-400 transition-colors truncate"
                              onClick={(e) => isMobile && e.stopPropagation()}
                            >
                              {program.name}
                            </Link>
                            <span className={cn('px-2 py-0.5 rounded text-xs font-medium shrink-0', status.bg, status.color)}>
                              {status.label}
                            </span>
                            {program.offersBounties ? (
                              <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400 shrink-0">BBP</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400 shrink-0">VDP</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mb-2 md:mb-3">@{program.handle}</p>
                          <div className="flex items-center gap-2 md:gap-4 text-sm flex-wrap">
                            <span className={cn('px-2 py-1 rounded text-xs capitalize', platformColor)}>
                              {program.platform}
                            </span>
                            {program.dataSources && program.dataSources.length > 0 && !isMobile && (
                              <div className="flex items-center gap-1">
                                {program.dataSources.map((source) => {
                                  const config = dataSourceConfig[source] || {
                                    label: source,
                                    color: 'bg-slate-500/30 text-slate-300 border-slate-500/50',
                                  };
                                  return (
                                    <span
                                      key={source}
                                      className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium border', config.color)}
                                      title={`Data from: ${source}`}
                                    >
                                      {config.label}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            <span className="flex items-center gap-1 text-slate-400">
                              <Globe className="w-4 h-4" />
                              {program.scopeCount || program.scopes?.length || 0} scopes
                            </span>
                            {program.url && !isMobile && (
                              <a
                                href={program.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary-400 hover:text-primary-300"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-4 h-4" />
                                View Program
                              </a>
                            )}
                            {program.createdAt && !isMobile && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Calendar className="w-4 h-4" />
                                {formatDate(program.createdAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {!isMobile && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            href={`/dashboard/programs/${program._id}`}
                            className="p-2 text-slate-400 hover:text-primary-400 transition-colors"
                            title="View Details"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button className="p-2 text-slate-400 hover:text-white transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {program.scopes && program.scopes.length > 0 && !isMobile && (
                      <div className="mt-4 pt-4 border-t border-dark-800">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate-500">Scope:</span>
                          {program.scopes.slice(0, 3).map((s, i) => (
                            <span key={i} className="px-2 py-1 bg-dark-800 text-xs text-slate-300 rounded">
                              {s.assetIdentifier}
                            </span>
                          ))}
                          {program.scopes.length > 3 && (
                            <span className="text-xs text-slate-500">+{program.scopes.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col gap-4 mt-6 p-4 bg-dark-900/80 rounded-xl border border-dark-800">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm text-slate-400">
                  <span className="text-center sm:text-left">
                    Showing {(pagination.page - 1) * pagination.limit + 1}-
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>Per page:</span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                      className="px-2 py-1 bg-dark-800 border border-dark-700 rounded text-slate-300 focus:outline-none focus:border-primary-500/50 min-h-[36px]"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mobile: Simple prev/next */}
                {isMobile ? (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </button>
                    <span className="px-3 py-2 text-sm text-slate-300">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* Desktop: Full pagination */
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={pagination.page === 1}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="First page"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1 mx-2">
                      {getPageNumbers().map((pageNum, idx) =>
                        pageNum === '...' ? (
                          <span key={`ellipsis-${idx}`} className="px-2 text-slate-500">
                            ...
                          </span>
                        ) : (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum as number)}
                            className={cn(
                              'min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-colors',
                              pagination.page === pageNum
                                ? 'bg-primary-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-dark-700'
                            )}
                          >
                            {pageNum}
                          </button>
                        )
                      )}
                    </div>

                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.totalPages)}
                      disabled={pagination.page === pagination.totalPages}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Last page"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && programs.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No programs found</h3>
          <p className="text-slate-400 mb-4">
            {searchQuery ? 'Try adjusting your search query' : 'Sync programs from HackerOne or Bugcrowd to get started'}
          </p>
          <Link
            href="/dashboard/cron"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Go to Sync
          </Link>
        </div>
      )}
    </div>
  );
}
