'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Scan,
  Plus,
  Search,
  Filter,
  Play,
  Pause,
  Square,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Globe,
  Layers,
  Shield,
  Server,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDateTime, formatDuration } from '@/lib/utils';
import { scansApi } from '@/lib/api';

interface ScanData {
  _id: string;
  target: string;
  targetType: string;
  type: string;
  status: string;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  results?: {
    subdomains?: number;
    ports?: number;
    vulnerabilities?: number;
    endpoints?: number;
  };
  stages?: {
    subdomain?: string;
    dns?: string;
    port?: string;
    http?: string;
    vulnerability?: string;
  };
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Running' },
  queued: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Queued' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' },
  paused: { icon: Pause, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Paused' },
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Pending' },
};

const stageConfig: Record<string, { color: string; label: string }> = {
  completed: { color: 'bg-green-500', label: 'Done' },
  running: { color: 'bg-blue-500 animate-pulse', label: 'Running' },
  pending: { color: 'bg-slate-600', label: 'Pending' },
  failed: { color: 'bg-red-500', label: 'Failed' },
  skipped: { color: 'bg-slate-700', label: 'Skipped' },
};

const scanTypes: Record<string, { color: string; label: string }> = {
  full: { color: 'bg-purple-500/20 text-purple-400', label: 'Full Scan' },
  quick: { color: 'bg-blue-500/20 text-blue-400', label: 'Quick Scan' },
  vulnerability: { color: 'bg-red-500/20 text-red-400', label: 'Vuln Scan' },
  subdomain: { color: 'bg-green-500/20 text-green-400', label: 'Subdomain' },
  FULL: { color: 'bg-purple-500/20 text-purple-400', label: 'Full Scan' },
};

export default function ScansPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchScans = async () => {
      try {
        const response = await scansApi.getAll({
          status: selectedStatus || undefined,
        });
        setScans(response.data);
      } catch (err) {
        console.error('Failed to fetch scans:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchScans();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchScans, 10000);
    return () => clearInterval(interval);
  }, [selectedStatus]);

  const filteredScans = scans.filter((scan) => {
    const matchesSearch = scan.target?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleRetry = async (scanId: string) => {
    try {
      await scansApi.retry(scanId);
      const response = await scansApi.getAll();
      setScans(response.data);
    } catch (err) {
      console.error('Failed to retry scan:', err);
    }
  };

  const handleCancel = async (scanId: string) => {
    try {
      await scansApi.cancel(scanId);
      const response = await scansApi.getAll();
      setScans(response.data);
    } catch (err) {
      console.error('Failed to cancel scan:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Scan className="w-7 h-7 text-primary-400" />
            Scans
          </h1>
          <p className="text-slate-400 mt-1">Monitor and manage your security scans</p>
        </div>
        <Link
          href="/dashboard/scans/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Scan
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Scans', value: scans.length, icon: Scan, color: 'text-primary-400' },
          { label: 'Running', value: scans.filter(s => s.status === 'running').length, icon: Loader2, color: 'text-blue-400' },
          { label: 'Completed', value: scans.filter(s => s.status === 'completed').length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Failed', value: scans.filter(s => s.status === 'failed').length, icon: XCircle, color: 'text-red-400' },
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
              <stat.icon className={cn('w-8 h-8', stat.color, stat.label === 'Running' && 'animate-spin')} />
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
            placeholder="Search by domain..."
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
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {!mounted || loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Scans List */}
          <div className="space-y-4">
            {filteredScans.map((scan, index) => {
              const status = statusConfig[scan.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const scanType = scanTypes[scan.type] || scanTypes.full;

              return (
                <motion.div
                  key={scan._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-600/50 to-accent-cyan/50 rounded-xl blur opacity-0 group-hover:opacity-20 transition duration-300" />
                  <div className="relative p-6 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-dark-700 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary-500/20 rounded-xl">
                          <Globe className="w-6 h-6 text-primary-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/dashboard/scans/${scan._id}`}
                              className="text-lg font-semibold text-white hover:text-primary-400 transition-colors"
                            >
                              {scan.target}
                            </Link>
                            <span className={cn('px-2 py-0.5 rounded text-xs', scanType.color)}>
                              {scanType.label}
                            </span>
                            <span className={cn(
                              'flex items-center gap-1 px-2 py-0.5 rounded text-xs',
                              status.bg,
                              status.color
                            )}>
                              <StatusIcon className={cn('w-3 h-3', scan.status === 'running' && 'animate-spin')} />
                              {status.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                            {scan.startedAt && (
                              <span>Started: {formatDateTime(scan.startedAt)}</span>
                            )}
                            {!scan.startedAt && scan.createdAt && (
                              <span>Created: {formatDateTime(scan.createdAt)}</span>
                            )}
                            {scan.completedAt && scan.startedAt && (
                              <span>Duration: {formatDuration(new Date(scan.startedAt), new Date(scan.completedAt))}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {scan.status === 'running' && (
                          <button 
                            onClick={() => handleCancel(scan._id)}
                            className="p-2 text-slate-400 hover:text-red-400 transition-colors" 
                            title="Cancel"
                          >
                            <Square className="w-4 h-4" />
                          </button>
                        )}
                        {(scan.status === 'completed' || scan.status === 'failed') && (
                          <button 
                            onClick={() => handleRetry(scan._id)}
                            className="p-2 text-slate-400 hover:text-primary-400 transition-colors" 
                            title="Re-run"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          href={`/dashboard/scans/${scan._id}`}
                          className="p-2 text-slate-400 hover:text-white transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-400">Progress</span>
                        <span className="text-white font-medium">{scan.progress || 0}%</span>
                      </div>
                      <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${scan.progress || 0}%` }}
                          transition={{ duration: 0.5 }}
                          className={cn(
                            'h-full rounded-full',
                            scan.status === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-primary-500 to-accent-cyan'
                          )}
                        />
                      </div>
                    </div>

                    {/* Stages */}
                    {scan.stages && (
                      <div className="flex items-center gap-2 mb-4">
                        {Object.entries(scan.stages).map(([stage, stageStatus]) => {
                          const stageInfo = stageConfig[stageStatus as string] || stageConfig.pending;
                          return (
                            <div key={stage} className="flex items-center gap-1">
                              <div className={cn('w-2 h-2 rounded-full', stageInfo.color)} />
                              <span className="text-xs text-slate-500 capitalize">{stage}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Results */}
                    <div className="grid grid-cols-4 gap-4 pt-4 border-t border-dark-800">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-400">
                          <span className="text-white font-medium">{scan.results?.subdomains || 0}</span> subdomains
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-400">
                          <span className="text-white font-medium">{scan.results?.ports || 0}</span> ports
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-400">
                          <span className={cn('font-medium', (scan.results?.vulnerabilities || 0) > 0 ? 'text-red-400' : 'text-white')}>
                            {scan.results?.vulnerabilities || 0}
                          </span> vulns
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-400">
                          <span className="text-white font-medium">{scan.results?.endpoints || 0}</span> endpoints
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {filteredScans.length === 0 && (
            <div className="text-center py-12">
              <Scan className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No scans found</h3>
              <p className="text-slate-400 mb-4">Start a new scan to begin reconnaissance</p>
              <Link
                href="/dashboard/scans/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Scan
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
