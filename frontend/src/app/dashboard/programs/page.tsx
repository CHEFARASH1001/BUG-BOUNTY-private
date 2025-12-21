'use client';

import { useState, useEffect } from 'react';
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
  Users,
  Target,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import { programsApi } from '@/lib/api';

interface Program {
  _id: string;
  name: string;
  platform: string;
  handle: string;
  url?: string;
  status: string;
  offersBounties: boolean;
  scopes?: { assetIdentifier: string; assetType: string }[];
  createdAt?: string;
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

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const fetchPrograms = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await programsApi.getAll({
        status: selectedStatus || undefined,
        platform: selectedPlatform || undefined,
        search: searchQuery || undefined,
      });
      const data = response.data;
      setPrograms(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch programs:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, [selectedStatus, selectedPlatform]);

  const filteredPrograms = programs.filter((program) => {
    const matchesSearch = !searchQuery || 
      program.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      program.handle?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const activeCount = programs.filter(p => p.status === 'active' || p.status === 'open' || p.status === 'public_mode').length;
  const totalScopes = programs.reduce((a, b) => a + (b.scopes?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary-400" />
            Programs
          </h1>
          <p className="text-slate-400 mt-1">Manage your bug bounty programs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPrograms}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 font-medium transition-colors border border-dark-700"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <Link
            href="/dashboard/programs/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Program
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Programs', value: programs.length, icon: Building2, color: 'text-primary-400' },
          { label: 'Active', value: activeCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Total Scopes', value: totalScopes, icon: Globe, color: 'text-blue-400' },
          { label: 'With Bounties', value: programs.filter(p => p.offersBounties).length, icon: DollarSign, color: 'text-yellow-400' },
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

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search programs..."
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
            <option value="active">Active</option>
            <option value="open">Open</option>
            <option value="public_mode">Public</option>
            <option value="paused">Paused</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={selectedPlatform || ''}
            onChange={(e) => setSelectedPlatform(e.target.value || null)}
            className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
          >
            <option value="">All Platforms</option>
            <option value="hackerone">HackerOne</option>
            <option value="bugcrowd">Bugcrowd</option>
            <option value="intigriti">Intigriti</option>
            <option value="yeswehack">YesWeHack</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <span className="ml-3 text-slate-400">Loading programs...</span>
        </div>
      )}

      {/* Programs List */}
      {!loading && (
        <div className="space-y-4">
          {filteredPrograms.slice(0, 50).map((program, index) => {
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
                <div className="relative p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-dark-700 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-primary-500/20 rounded-xl">
                        <Building2 className="w-6 h-6 text-primary-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <Link
                            href={`/dashboard/programs/${program._id}`}
                            className="text-lg font-semibold text-white hover:text-primary-400 transition-colors"
                          >
                            {program.name}
                          </Link>
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            status.bg,
                            status.color
                          )}>
                            {status.label}
                          </span>
                          {program.offersBounties && (
                            <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
                              Bounty
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mb-3">@{program.handle}</p>
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <span className={cn('px-2 py-1 rounded text-xs capitalize', platformColor)}>
                            {program.platform}
                          </span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Globe className="w-4 h-4" />
                            {program.scopes?.length || 0} scopes
                          </span>
                          {program.url && (
                            <a 
                              href={program.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary-400 hover:text-primary-300"
                            >
                              <ExternalLink className="w-4 h-4" />
                              View Program
                            </a>
                          )}
                          {program.createdAt && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Calendar className="w-4 h-4" />
                              {formatDate(program.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                  </div>

                  {/* Scope preview */}
                  {program.scopes && program.scopes.length > 0 && (
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

          {filteredPrograms.length > 50 && (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm">
                Showing 50 of {filteredPrograms.length} programs. Use filters to narrow results.
              </p>
            </div>
          )}
        </div>
      )}

      {!loading && filteredPrograms.length === 0 && (
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

