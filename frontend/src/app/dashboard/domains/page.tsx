'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Play,
  ExternalLink,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDateTime } from '@/lib/utils';
import { domainsApi } from '@/lib/api';

interface Domain {
  _id: string;
  domain: string;
  programId?: { name: string };
  status: string;
  subdomainCount: number;
  vulnerabilityCount: number;
  lastScan?: string;
  technologies: string[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-500', label: 'Completed' },
  scanning: { icon: Loader2, color: 'text-blue-500', label: 'Scanning' },
  pending: { icon: Clock, color: 'text-yellow-500', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
};

const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48, 96];

export default function DomainsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 24,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchDomains = useCallback(async (page: number, limit: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await domainsApi.getAll({
        status: selectedStatus || undefined,
        search: debouncedSearch || undefined,
        page,
        limit,
      });
      setDomains(response.data.data || []);
      setPagination(response.data.pagination || {
        page: 1,
        limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    } catch (err: any) {
      console.error('Failed to fetch domains:', err);
      setError(err.response?.data?.message || 'Failed to load domains. Please try again.');
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, debouncedSearch]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchDomains(1, pagination.limit);
    }
  }, [mounted, selectedStatus, debouncedSearch, fetchDomains, pagination.limit]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchDomains(newPage, pagination.limit);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit }));
    fetchDomains(1, newLimit);
  };

  const handleRefresh = () => {
    fetchDomains(pagination.page, pagination.limit);
  };

  const handleStartScan = async (domainId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await domainsApi.startScan(domainId);
      fetchDomains(pagination.page, pagination.limit);
    } catch (err) {
      console.error('Failed to start scan:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Globe className="w-7 h-7 text-primary-400" />
            Domains
          </h1>
          <p className="text-slate-400 mt-1">
            Manage your target domains
            {pagination.total > 0 && (
              <span className="ml-2 text-slate-500">
                ({pagination.total.toLocaleString()} total)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <Link
            href="/dashboard/domains/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Domain
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedStatus || ''}
            onChange={(e) => setSelectedStatus(e.target.value || null)}
            className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="scanning">Scanning</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Show:</span>
          <select
            value={pagination.limit}
            onChange={(e) => handleLimitChange(Number(e.target.value))}
            className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
          >
            {ITEMS_PER_PAGE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={handleRefresh}
            className="ml-auto px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-sm text-red-400 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            <p className="text-slate-400 text-sm">Loading domains...</p>
          </div>
        </div>
      )}

      {/* Domains Grid */}
      {!loading && !error && domains.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {domains.map((domain, index) => {
              const StatusIcon = statusConfig[domain.status]?.icon || Clock;

              return (
                <motion.div
                  key={domain._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className="group relative"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-600/50 to-accent-cyan/50 rounded-xl blur opacity-0 group-hover:opacity-30 transition duration-300" />
                  <div className="relative p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-dark-700 transition-colors h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-1.5 bg-primary-500/20 rounded-lg flex-shrink-0">
                          <Globe className="w-4 h-4 text-primary-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/dashboard/domains/${domain._id}`}
                            className="text-white font-medium hover:text-primary-400 transition-colors truncate block"
                            title={domain.domain}
                          >
                            {domain.domain}
                          </Link>
                          <p className="text-xs text-slate-500 truncate">
                            {domain.programId?.name || 'Unknown Program'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 mb-3">
                      <StatusIcon className={cn(
                        'w-3.5 h-3.5',
                        statusConfig[domain.status]?.color || 'text-slate-400',
                        domain.status === 'scanning' && 'animate-spin'
                      )} />
                      <span className={cn('text-xs', statusConfig[domain.status]?.color || 'text-slate-400')}>
                        {statusConfig[domain.status]?.label || domain.status}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="p-2 bg-dark-800/50 rounded-lg">
                        <div className="text-sm font-bold text-white">{domain.subdomainCount || 0}</div>
                        <div className="text-xs text-slate-500">Subdomains</div>
                      </div>
                      <div className="p-2 bg-dark-800/50 rounded-lg">
                        <div className={cn(
                          'text-sm font-bold',
                          (domain.vulnerabilityCount || 0) > 0 ? 'text-red-400' : 'text-slate-400'
                        )}>
                          {domain.vulnerabilityCount || 0}
                        </div>
                        <div className="text-xs text-slate-500">Vulns</div>
                      </div>
                    </div>

                    {/* Technologies */}
                    {domain.technologies && domain.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {domain.technologies.slice(0, 2).map((tech) => (
                          <span
                            key={tech}
                            className="px-1.5 py-0.5 bg-dark-800 text-xs text-slate-400 rounded"
                          >
                            {tech}
                          </span>
                        ))}
                        {domain.technologies.length > 2 && (
                          <span className="px-1.5 py-0.5 text-xs text-slate-500">
                            +{domain.technologies.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-dark-800 mt-auto">
                      <span className="text-xs text-slate-500 truncate">
                        {domain.lastScan ? formatDateTime(domain.lastScan) : 'Not scanned'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleStartScan(domain._id, e)}
                          className="p-1 text-slate-400 hover:text-primary-400 transition-colors"
                          title="Start Scan"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`https://${domain.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-slate-400 hover:text-white transition-colors"
                          title="Open Website"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-dark-800">
              <div className="text-sm text-slate-400">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total.toLocaleString()} domains
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={!pagination.hasPrev}
                  className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="First page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {/* Page numbers */}
                <div className="flex items-center gap-1 mx-2">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={cn(
                          'w-8 h-8 text-sm rounded-lg transition-colors',
                          pageNum === pagination.page
                            ? 'bg-primary-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-dark-800'
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={!pagination.hasNext}
                  className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Last page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && !error && domains.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No domains found</h3>
          <p className="text-slate-400 mb-4">
            {debouncedSearch || selectedStatus
              ? 'Try adjusting your filters'
              : 'Add your first domain to get started'}
          </p>
          {!debouncedSearch && !selectedStatus && (
            <Link
              href="/dashboard/domains/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Domain
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
