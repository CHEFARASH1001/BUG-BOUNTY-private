'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Database,
  Eye,
  EyeOff,
  Download,
  Play,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { cn, formatDateTime, formatNumber } from '@/lib/utils';
import { chaosApi } from '@/lib/api';

interface ChaosProgram {
  name: string;
  url: string;
  count: number;
  lastUpdated: string;
}

interface ChaosSyncJob {
  id: string;
  programName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: {
    program: string;
    subdomainsImported: number;
    newSubdomains: number;
    timestamp: string;
  };
  error?: string;
  startedAt: string;
  completedAt?: string;
}

interface WatchedProgram {
  _id: string;
  programName: string;
  chaosUrl?: string;
  subdomainsImported: number;
  newSubdomains: number;
  syncedAt?: string;
  watchEnabled: boolean;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Running' },
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' },
};

export default function ChaosPage() {
  // State
  const [programs, setPrograms] = useState<ChaosProgram[]>([]);
  const [watchedPrograms, setWatchedPrograms] = useState<WatchedProgram[]>([]);
  const [syncJobs, setSyncJobs] = useState<Map<string, ChaosSyncJob>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [showWatchedOnly, setShowWatchedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'count' | 'lastUpdated'>('count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');


  // Fetch programs and watched programs on mount
  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
      try {
        const [programsRes, watchedRes] = await Promise.all([
          chaosApi.getPrograms(),
          chaosApi.getWatched(),
        ]);
        setPrograms(programsRes.data || []);
        setWatchedPrograms(watchedRes.data || []);
      } catch (err) {
        console.error('Failed to fetch Chaos data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Poll for sync job updates
  useEffect(() => {
    const runningJobs = Array.from(syncJobs.values()).filter(
      (job) => job.status === 'running' || job.status === 'pending'
    );
    if (runningJobs.length === 0) return;

    const interval = setInterval(async () => {
      for (const job of runningJobs) {
        try {
          const response = await chaosApi.getSyncStatus(job.id);
          const updatedJob = response.data;
          setSyncJobs((prev) => {
            const newMap = new Map(prev);
            newMap.set(job.programName, updatedJob);
            return newMap;
          });

          // If job completed, update syncing state and refresh watched programs
          if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
            setSyncing((prev) => {
              const newSet = new Set(prev);
              newSet.delete(job.programName);
              return newSet;
            });

            // Refresh watched programs list
            const watchedRes = await chaosApi.getWatched();
            setWatchedPrograms(watchedRes.data || []);
          }
        } catch (err) {
          console.error('Failed to poll sync status:', err);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [syncJobs]);

  const handleSync = async (programName: string) => {
    if (syncing.has(programName)) return;

    setSyncing((prev) => new Set(prev).add(programName));
    try {
      const response = await chaosApi.sync({ programName });
      const job: ChaosSyncJob = {
        id: response.data.id,
        programName: response.data.programName,
        status: response.data.status,
        startedAt: new Date().toISOString(),
      };
      setSyncJobs((prev) => {
        const newMap = new Map(prev);
        newMap.set(programName, job);
        return newMap;
      });
    } catch (err) {
      console.error('Failed to start sync:', err);
      setSyncing((prev) => {
        const newSet = new Set(prev);
        newSet.delete(programName);
        return newSet;
      });
    }
  };

  const handleToggleWatch = async (programName: string, currentlyWatched: boolean) => {
    try {
      await chaosApi.setWatch(programName, { enabled: !currentlyWatched });
      // Refresh watched programs
      const watchedRes = await chaosApi.getWatched();
      setWatchedPrograms(watchedRes.data || []);
    } catch (err) {
      console.error('Failed to toggle watch:', err);
    }
  };

  const handleRefreshPrograms = async () => {
    setLoading(true);
    try {
      const [programsRes, watchedRes] = await Promise.all([
        chaosApi.getPrograms(searchQuery || undefined),
        chaosApi.getWatched(),
      ]);
      setPrograms(programsRes.data || []);
      setWatchedPrograms(watchedRes.data || []);
    } catch (err) {
      console.error('Failed to refresh programs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await chaosApi.getPrograms(searchQuery || undefined);
      setPrograms(response.data || []);
    } catch (err) {
      console.error('Failed to search programs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get watched program names for quick lookup
  const watchedProgramNames = new Set(watchedPrograms.map((p) => p.programName.toLowerCase()));

  // Filter and sort programs
  const filteredPrograms = programs
    .filter((p) => {
      if (showWatchedOnly) {
        return watchedProgramNames.has(p.name.toLowerCase());
      }
      if (searchQuery) {
        return p.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'count':
          comparison = a.count - b.count;
          break;
        case 'lastUpdated':
          comparison = new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Get sync status for a program
  const getSyncStatus = (programName: string): ChaosSyncJob | undefined => {
    return syncJobs.get(programName);
  };

  // Get watched program data
  const getWatchedData = (programName: string): WatchedProgram | undefined => {
    return watchedPrograms.find((p) => p.programName.toLowerCase() === programName.toLowerCase());
  };

  // Stats
  const totalPrograms = programs.length;
  const totalSubdomains = programs.reduce((acc, p) => acc + p.count, 0);
  const watchedCount = watchedPrograms.length;
  const syncedSubdomains = watchedPrograms.reduce((acc, p) => acc + (p.subdomainsImported || 0), 0);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Zap className="w-7 h-7 text-primary-400" />
            Chaos Sync
          </h1>
          <p className="text-slate-400 mt-1">
            Sync subdomain data from ProjectDiscovery Chaos dataset
          </p>
        </div>
        <button
          onClick={handleRefreshPrograms}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Programs', value: totalPrograms, icon: Database, color: 'text-primary-400' },
          { label: 'Total Subdomains', value: totalSubdomains, icon: Globe, color: 'text-blue-400' },
          { label: 'Watched Programs', value: watchedCount, icon: Eye, color: 'text-green-400' },
          { label: 'Synced Subdomains', value: syncedSubdomains, icon: Download, color: 'text-yellow-400' },
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
                <p className="text-2xl font-bold text-white mt-1">{formatNumber(stat.value)}</p>
              </div>
              <stat.icon className={cn('w-8 h-8', stat.color)} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search programs..."
            className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowWatchedOnly(!showWatchedOnly)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              showWatchedOnly
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'bg-dark-800 text-slate-400 border border-dark-700 hover:border-dark-600'
            )}
          >
            {showWatchedOnly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showWatchedOnly ? 'Watched Only' : 'All Programs'}
          </button>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
            className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500/50"
          >
            <option value="count-desc">Most Subdomains</option>
            <option value="count-asc">Least Subdomains</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="lastUpdated-desc">Recently Updated</option>
            <option value="lastUpdated-asc">Oldest Updated</option>
          </select>
        </div>
      </div>

      {/* Programs List */}
      <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden">
        {!mounted || loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div className="text-center py-16">
            <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">
              {searchQuery ? 'No programs match your search' : 'No programs available'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-dark-800">
            {filteredPrograms.map((program, index) => {
              const isWatched = watchedProgramNames.has(program.name.toLowerCase());
              const watchedData = getWatchedData(program.name);
              const syncJob = getSyncStatus(program.name);
              const isSyncing = syncing.has(program.name);

              return (
                <ProgramRow
                  key={program.name}
                  program={program}
                  isWatched={isWatched}
                  watchedData={watchedData}
                  syncJob={syncJob}
                  isSyncing={isSyncing}
                  onSync={() => handleSync(program.name)}
                  onToggleWatch={() => handleToggleWatch(program.name, isWatched)}
                  index={index}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


// Program Row Component
function ProgramRow({
  program,
  isWatched,
  watchedData,
  syncJob,
  isSyncing,
  onSync,
  onToggleWatch,
  index,
}: {
  program: ChaosProgram;
  isWatched: boolean;
  watchedData?: WatchedProgram;
  syncJob?: ChaosSyncJob;
  isSyncing: boolean;
  onSync: () => void;
  onToggleWatch: () => void;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const status = syncJob ? statusConfig[syncJob.status] : null;
  const StatusIcon = status?.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.5) }}
      className="hover:bg-dark-800/50 transition-colors"
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Program Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-white truncate">{program.name}</h3>
              {isWatched && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                  <Eye className="w-3 h-3" />
                  Watching
                </span>
              )}
              {syncJob && StatusIcon && (
                <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs', status?.bg, status?.color)}>
                  <StatusIcon className={cn('w-3 h-3', syncJob.status === 'running' && 'animate-spin')} />
                  {status?.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {formatNumber(program.count)} subdomains
              </span>
              <span>Updated: {formatDateTime(program.lastUpdated)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSync}
              disabled={isSyncing}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isSyncing
                  ? 'bg-blue-500/20 text-blue-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-500 text-white'
              )}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  Sync
                </>
              )}
            </button>
            <button
              onClick={onToggleWatch}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isWatched
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-dark-700 text-slate-400 hover:bg-dark-600 hover:text-white'
              )}
              title={isWatched ? 'Disable watching' : 'Enable watching'}
            >
              {isWatched ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {isWatched ? 'Watching' : 'Watch'}
            </button>
            {(watchedData || syncJob?.result) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (watchedData || syncJob?.result) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-dark-700"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {watchedData && (
                <>
                  <div>
                    <p className="text-xs text-slate-500">Subdomains Imported</p>
                    <p className="text-sm font-medium text-white">
                      {formatNumber(watchedData.subdomainsImported)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">New Subdomains</p>
                    <p className="text-sm font-medium text-green-400">
                      +{formatNumber(watchedData.newSubdomains)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Last Synced</p>
                    <p className="text-sm font-medium text-white">
                      {watchedData.syncedAt ? formatDateTime(watchedData.syncedAt) : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Watch Status</p>
                    <p className={cn('text-sm font-medium', watchedData.watchEnabled ? 'text-green-400' : 'text-slate-400')}>
                      {watchedData.watchEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </>
              )}
              {syncJob?.result && !watchedData && (
                <>
                  <div>
                    <p className="text-xs text-slate-500">Subdomains Imported</p>
                    <p className="text-sm font-medium text-white">
                      {formatNumber(syncJob.result.subdomainsImported)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">New Subdomains</p>
                    <p className="text-sm font-medium text-green-400">
                      +{formatNumber(syncJob.result.newSubdomains)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Synced At</p>
                    <p className="text-sm font-medium text-white">
                      {formatDateTime(syncJob.result.timestamp)}
                    </p>
                  </div>
                </>
              )}
              {syncJob?.error && (
                <div className="col-span-full">
                  <p className="text-xs text-slate-500">Error</p>
                  <p className="text-sm text-red-400">{syncJob.error}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
