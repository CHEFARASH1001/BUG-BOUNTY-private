'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench,
  Search,
  Loader2,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  Filter,
  CheckCircle,
  XCircle,
  Globe,
  Network,
  Cloud,
  Binary,
  Flag,
  Eye,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { hexstrikeApi } from '@/lib/api';

// Tool category type based on backend interfaces
type ToolCategory = 'network' | 'web' | 'cloud' | 'binary' | 'ctf' | 'osint';

// Tool parameter interface
interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

// Security tool interface
interface SecurityTool {
  name: string;
  displayName: string;
  category: ToolCategory;
  description: string;
  parameters: ToolParameter[];
  effectiveness: Record<string, number>;
  isInstalled: boolean;
}

// Category configuration for display
const categoryConfig: Record<ToolCategory, { label: string; icon: typeof Wrench; color: string; bg: string }> = {
  network: { label: 'Network', icon: Network, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  web: { label: 'Web', icon: Globe, color: 'text-green-400', bg: 'bg-green-500/20' },
  cloud: { label: 'Cloud', icon: Cloud, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  binary: { label: 'Binary', icon: Binary, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  ctf: { label: 'CTF', icon: Flag, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  osint: { label: 'OSINT', icon: Eye, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
};

export default function HexStrikeToolsPage() {
  const [tools, setTools] = useState<SecurityTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>('all');
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);

  const fetchTools = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await hexstrikeApi.getTools();
      setTools(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      setTools([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  // Filter and group tools
  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          tool.name.toLowerCase().includes(query) ||
          tool.displayName.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && tool.category !== selectedCategory) {
        return false;
      }

      // Installed filter
      if (showInstalledOnly && !tool.isInstalled) {
        return false;
      }

      return true;
    });
  }, [tools, searchQuery, selectedCategory, showInstalledOnly]);

  // Group tools by category
  const toolsByCategory = useMemo(() => {
    const grouped: Record<string, SecurityTool[]> = {};
    filteredTools.forEach((tool) => {
      if (!grouped[tool.category]) {
        grouped[tool.category] = [];
      }
      grouped[tool.category].push(tool);
    });
    return grouped;
  }, [filteredTools]);

  // Get category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tools.length };
    tools.forEach((tool) => {
      counts[tool.category] = (counts[tool.category] || 0) + 1;
    });
    return counts;
  }, [tools]);

  const installedCount = tools.filter((t) => t.isInstalled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/hexstrike"
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Wrench className="w-7 h-7 text-primary-400" />
              Security Tools
            </h1>
            <p className="text-slate-400 mt-1">150+ integrated security tools for penetration testing</p>
          </div>
        </div>
        <button
          onClick={() => fetchTools(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 hover:bg-dark-700 hover:text-white transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-2xl font-bold text-white">{tools.length}</div>
          <div className="text-sm text-slate-400">Total Tools</div>
        </div>
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-2xl font-bold text-green-400">{installedCount}</div>
          <div className="text-sm text-slate-400">Installed</div>
        </div>
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-2xl font-bold text-blue-400">{Object.keys(categoryConfig).length}</div>
          <div className="text-sm text-slate-400">Categories</div>
        </div>
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-2xl font-bold text-purple-400">{filteredTools.length}</div>
          <div className="text-sm text-slate-400">Filtered Results</div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools by name or description..."
              className="w-full pl-11 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as ToolCategory | 'all')}
              className="px-3 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500/50 transition-colors"
            >
              <option value="all">All Categories ({categoryCounts.all || 0})</option>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label} ({categoryCounts[key] || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Installed Only Toggle */}
          <button
            onClick={() => setShowInstalledOnly(!showInstalledOnly)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors',
              showInstalledOnly
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : 'bg-dark-800 border-dark-700 text-slate-400 hover:text-white'
            )}
          >
            <CheckCircle className="w-4 h-4" />
            Installed Only
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredTools.length === 0 && (
        <div className="p-8 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 text-center">
          <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Tools Found</h3>
          <p className="text-slate-400 text-sm">
            {searchQuery || selectedCategory !== 'all' || showInstalledOnly
              ? 'Try adjusting your filters to see more tools.'
              : 'No security tools are available at the moment.'}
          </p>
          {(searchQuery || selectedCategory !== 'all' || showInstalledOnly) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setShowInstalledOnly(false);
              }}
              className="mt-4 px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Tools by Category */}
      {!loading && filteredTools.length > 0 && (
        <div className="space-y-6">
          {Object.entries(toolsByCategory).map(([category, categoryTools]) => {
            const config = categoryConfig[category as ToolCategory];
            if (!config) return null;

            return (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
              >
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn('p-2 rounded-lg', config.bg)}>
                    <config.icon className={cn('w-5 h-5', config.color)} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{config.label} Tools</h3>
                    <p className="text-sm text-slate-400">{categoryTools.length} tools available</p>
                  </div>
                </div>

                {/* Tools Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categoryTools.map((tool) => (
                    <Link
                      key={tool.name}
                      href={`/dashboard/hexstrike/tools/${tool.name}`}
                      className="p-4 bg-dark-800/50 hover:bg-dark-800 rounded-lg border border-dark-700 hover:border-primary-500/30 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Zap className={cn('w-4 h-4', config.color)} />
                          <span className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors">
                            {tool.displayName}
                          </span>
                        </div>
                        {tool.isInstalled ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{tool.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {tool.parameters.length > 0 && (
                            <span className="px-2 py-0.5 bg-dark-700 rounded text-xs text-slate-400">
                              {tool.parameters.length} params
                            </span>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-primary-400 transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
