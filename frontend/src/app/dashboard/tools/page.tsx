'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  Search,
  Filter,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Download,
  Play,
  Github,
  X,
  Upload,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toolsApi } from '@/lib/api';
import { useIsMobile } from '@/hooks';

// Tool category enum matching backend
const ToolCategory = {
  SUBDOMAIN_ENUMERATION: 'subdomain_enumeration',
  HTTP_PROBING: 'http_probing',
  DIRECTORY_FUZZING: 'directory_fuzzing',
  VULNERABILITY_SCANNING: 'vulnerability_scanning',
  SECRET_DETECTION: 'secret_detection',
  JAVASCRIPT_ANALYSIS: 'javascript_analysis',
  PORT_SCANNING: 'port_scanning',
  WAF_DETECTION: 'waf_detection',
  URL_DISCOVERY: 'url_discovery',
  OSINT: 'osint',
  DNS_TOOLS: 'dns_tools',
  WEB_CRAWLING: 'web_crawling',
  PARAMETER_DISCOVERY: 'parameter_discovery',
  EXPLOITATION: 'exploitation',
} as const;

type ToolCategoryType = typeof ToolCategory[keyof typeof ToolCategory];

interface Tool {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  githubUrl: string;
  categories: ToolCategoryType[];
  validation?: {
    isValid: boolean;
    lastChecked: Date;
    stars: number;
    lastCommit: Date;
    reason?: string;
  };
  installation?: {
    isInstalled: boolean;
    version?: string;
    binaryName: string;
    lastChecked: Date;
  };
  isActive: boolean;
}

// Category display configuration
const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
  subdomain_enumeration: { label: 'Subdomain Enum', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  http_probing: { label: 'HTTP Probing', color: 'text-green-400', bg: 'bg-green-500/20' },
  directory_fuzzing: { label: 'Dir Fuzzing', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  vulnerability_scanning: { label: 'Vuln Scanning', color: 'text-red-400', bg: 'bg-red-500/20' },
  secret_detection: { label: 'Secret Detection', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  javascript_analysis: { label: 'JS Analysis', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  port_scanning: { label: 'Port Scanning', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  waf_detection: { label: 'WAF Detection', color: 'text-pink-400', bg: 'bg-pink-500/20' },
  url_discovery: { label: 'URL Discovery', color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
  osint: { label: 'OSINT', color: 'text-teal-400', bg: 'bg-teal-500/20' },
  dns_tools: { label: 'DNS Tools', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  web_crawling: { label: 'Web Crawling', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  parameter_discovery: { label: 'Param Discovery', color: 'text-lime-400', bg: 'bg-lime-500/20' },
  exploitation: { label: 'Exploitation', color: 'text-rose-400', bg: 'bg-rose-500/20' },
};

// Installation status configuration
const installationStatusConfig = {
  installed: { label: 'Installed', color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle },
  not_installed: { label: 'Not Installed', color: 'text-slate-400', bg: 'bg-slate-500/20', icon: XCircle },
  update_available: { label: 'Update Available', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: AlertCircle },
};

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failureCount: number;
    failures?: Array<{ name: string; reason: string }>;
  } | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const isMobile = useIsMobile();

  const fetchTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await toolsApi.getAll({
        search: searchQuery || undefined,
        category: selectedCategory || undefined,
      });
      const data = response.data;
      setTools(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch tools:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load tools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, [selectedCategory]);

  // Filter tools by search query (client-side for instant feedback)
  const filteredTools = useMemo(() => {
    if (!searchQuery) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.displayName.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
    );
  }, [tools, searchQuery]);

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tools.forEach((tool) => {
      tool.categories.forEach((cat) => {
        counts[cat] = (counts[cat] || 0) + 1;
      });
    });
    return counts;
  }, [tools]);

  // Get installation status for a tool
  const getInstallationStatus = (tool: Tool) => {
    if (!tool.installation) return 'not_installed';
    if (!tool.installation.isInstalled) return 'not_installed';
    // TODO: Check for update_available when version comparison is implemented
    return 'installed';
  };

  // Handle bulk import
  const handleBulkImport = async () => {
    setImporting(true);
    setImportResult(null);
    setImportModalOpen(true);
    try {
      const response = await toolsApi.bulkImport();
      const result = response.data;
      setImportResult(result);
      fetchTools();
    } catch (err: any) {
      console.error('Bulk import failed:', err);
      setImportResult({
        successCount: 0,
        failureCount: 1,
        failures: [{ name: 'Import', reason: err.response?.data?.message || 'Bulk import failed' }],
      });
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setImportResult(null);
  };

  // Stats
  const installedCount = tools.filter((t) => t.installation?.isInstalled).length;
  const activeCount = tools.filter((t) => t.isActive).length;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
            <Wrench className="w-6 h-6 md:w-7 md:h-7 text-primary-400" />
            Security Tools Registry
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">Manage and execute security reconnaissance tools</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTools}
            disabled={loading}
            className="flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 md:px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 font-medium transition-colors border border-dark-700 touch-manipulation"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleBulkImport}
            disabled={importing}
            className="flex items-center justify-center gap-2 min-h-[44px] px-3 md:px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors touch-manipulation"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden xs:inline">Import Tools</span>
            <span className="xs:hidden">Import</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Total Tools', value: tools.length, icon: Wrench, color: 'text-primary-400' },
          { label: 'Installed', value: installedCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Active', value: activeCount, icon: Play, color: 'text-blue-400' },
          { label: 'Categories', value: Object.keys(categoryCounts).length, icon: Filter, color: 'text-yellow-400' },
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
                <p className="text-lg md:text-2xl font-bold text-white mt-1">{loading ? '...' : stat.value}</p>
              </div>
              <stat.icon className={cn('w-6 h-6 md:w-8 md:h-8', stat.color)} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      {isMobile ? (
        <div className="space-y-3">
          {/* Search - always visible */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors touch-manipulation"
            />
          </div>
          
          {/* Collapsible filter button */}
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className={cn(
              'flex items-center justify-between w-full px-4 py-3 min-h-[44px]',
              'bg-dark-800 border border-dark-700 rounded-lg',
              'text-sm text-slate-300 font-medium',
              'transition-colors hover:bg-dark-700 touch-manipulation',
              filtersExpanded && 'border-primary-500/30 bg-dark-700'
            )}
            aria-expanded={filtersExpanded}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span>Category Filter</span>
              {selectedCategory && (
                <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded-full">
                  1
                </span>
              )}
            </div>
            {filtersExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {/* Expandable filter panel */}
          <div
            className={cn(
              'overflow-hidden transition-all duration-200 ease-in-out',
              filtersExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
            )}
          >
            <div className="p-4 bg-dark-800/50 border border-dark-700 rounded-lg space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Category</label>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="w-full px-3 py-3 min-h-[44px] bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50 touch-manipulation"
                >
                  <option value="">All Categories</option>
                  {Object.entries(ToolCategory).map(([key, value]) => (
                    <option key={value} value={value}>
                      {categoryConfig[value]?.label || key} ({categoryCounts[value] || 0})
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="w-full px-4 py-3 min-h-[44px] bg-dark-700 border border-dark-600 rounded-lg text-sm text-slate-400 hover:text-white transition-colors touch-manipulation"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Desktop Filters */
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
            >
              <option value="">All Categories</option>
              {Object.entries(ToolCategory).map(([key, value]) => (
                <option key={value} value={value}>
                  {categoryConfig[value]?.label || key} ({categoryCounts[value] || 0})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Category Tabs - Scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex items-center gap-2 min-w-max md:flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'px-3 py-2 md:py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap touch-manipulation min-h-[40px] md:min-h-0',
              !selectedCategory
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'bg-dark-800 text-slate-400 hover:text-white border border-dark-700'
            )}
          >
            All ({tools.length})
          </button>
          {Object.entries(ToolCategory)
            .map(([_, value]) => ({
              category: value,
              count: categoryCounts[value] || 0,
              config: categoryConfig[value],
            }))
            .filter((item) => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .map(({ category, count, config }) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  'px-3 py-2 md:py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap touch-manipulation min-h-[40px] md:min-h-0',
                  selectedCategory === category
                    ? `${config?.bg || 'bg-slate-500/20'} ${config?.color || 'text-slate-400'} border border-current/30`
                    : 'bg-dark-800 text-slate-400 hover:text-white border border-dark-700'
                )}
              >
                {config?.label || category} ({count})
              </button>
            ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <span className="ml-3 text-slate-400">Loading tools...</span>
        </div>
      )}

      {/* Tools Grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filteredTools.map((tool, index) => {
            const installStatus = getInstallationStatus(tool);
            const statusConfig = installationStatusConfig[installStatus];
            const StatusIcon = statusConfig.icon;

            return (
              <motion.div
                key={tool._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
                className="group relative"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-600/50 to-accent-cyan/50 rounded-xl blur opacity-0 group-hover:opacity-20 transition duration-300" />
                <div className="relative p-4 md:p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-dark-700 transition-colors h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                      <div className="p-1.5 md:p-2 bg-primary-500/20 rounded-lg flex-shrink-0">
                        <Wrench className="w-4 h-4 md:w-5 md:h-5 text-primary-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dashboard/tools/${tool._id}`}
                          className="text-base md:text-lg font-semibold text-white hover:text-primary-400 transition-colors block truncate"
                        >
                          {tool.displayName}
                        </Link>
                        <p className="text-xs text-slate-500 truncate">@{tool.name}</p>
                      </div>
                    </div>
                    <a
                      href={tool.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white transition-colors touch-manipulation"
                      title="View on GitHub"
                      aria-label="View on GitHub"
                    >
                      <Github className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-400 mb-4 line-clamp-2 flex-grow">
                    {tool.description}
                  </p>

                  {/* Categories */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    {tool.categories.slice(0, 2).map((cat) => {
                      const config = categoryConfig[cat];
                      return (
                        <span
                          key={cat}
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            config?.bg || 'bg-slate-500/20',
                            config?.color || 'text-slate-400'
                          )}
                        >
                          {config?.label || cat}
                        </span>
                      );
                    })}
                    {tool.categories.length > 2 && (
                      <span className="text-xs text-slate-500">+{tool.categories.length - 2}</span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-dark-800">
                    <span
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium',
                        statusConfig.bg,
                        statusConfig.color
                      )}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusConfig.label}
                    </span>
                    <Link
                      href={`/dashboard/tools/${tool._id}`}
                      className="flex items-center justify-center gap-1 min-h-[44px] px-3 text-xs text-primary-400 hover:text-primary-300 transition-colors touch-manipulation"
                    >
                      View Details
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredTools.length === 0 && (
        <div className="text-center py-12">
          <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No tools found</h3>
          <p className="text-slate-400 mb-4">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Import predefined security tools to get started'}
          </p>
          <button
            onClick={handleBulkImport}
            disabled={importing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Import Tools
          </button>
        </div>
      )}

      {/* Import Modal */}
      <AnimatePresence>
        {importModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-dark-900 rounded-xl border border-dark-700 overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-dark-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-500/20 rounded-lg">
                    <Upload className="w-5 h-5 text-primary-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Import Tools</h3>
                </div>
                {!importing && (
                  <button
                    onClick={closeImportModal}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white transition-colors touch-manipulation"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Modal Content */}
              <div className="p-4 md:p-6 overflow-y-auto flex-1">
                {importing ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-12 h-12 text-primary-400 animate-spin mx-auto mb-4" />
                    <p className="text-white font-medium">Importing tools...</p>
                    <p className="text-sm text-slate-400 mt-2">
                      Validating and adding predefined security tools
                    </p>
                  </div>
                ) : importResult ? (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <div className="p-3 md:p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                        <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-400 mx-auto mb-2" />
                        <p className="text-xl md:text-2xl font-bold text-green-400">{importResult.successCount}</p>
                        <p className="text-xs md:text-sm text-green-400/80">Succeeded</p>
                      </div>
                      <div className="p-3 md:p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
                        <XCircle className="w-6 h-6 md:w-8 md:h-8 text-red-400 mx-auto mb-2" />
                        <p className="text-xl md:text-2xl font-bold text-red-400">{importResult.failureCount}</p>
                        <p className="text-xs md:text-sm text-red-400/80">Failed</p>
                      </div>
                    </div>

                    {/* Failures List */}
                    {importResult.failures && importResult.failures.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-2">Failed Imports</h4>
                        <div className="max-h-40 overflow-y-auto space-y-2">
                          {importResult.failures.map((failure, index) => (
                            <div
                              key={index}
                              className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg"
                            >
                              <p className="text-sm font-medium text-red-400">{failure.name}</p>
                              <p className="text-xs text-red-400/70">{failure.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Success Message */}
                    {importResult.successCount > 0 && importResult.failureCount === 0 && (
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-green-400 text-center">
                          All tools imported successfully!
                        </p>
                      </div>
                    )}

                    {/* Close Button */}
                    <button
                      onClick={closeImportModal}
                      className="w-full py-3 min-h-[44px] bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors touch-manipulation"
                    >
                      Close
                    </button>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
