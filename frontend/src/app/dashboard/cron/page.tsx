'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  Timer,
  Zap,
  Settings2,
  History,
  AlertCircle,
  FileText,
  X,
  Terminal,
  Trash2,
  Activity,
} from 'lucide-react';
import { clsx } from 'clsx';
import { cronApi } from '@/lib/api';
import { useIsMobile } from '@/hooks';

interface CronConfig {
  _id: string;
  jobName: string;
  schedule: string;
  description: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
  failCount: number;
}

interface JobExecution {
  _id: string;
  jobName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  trigger: string;
  error?: string;
  result?: any;
  logs?: string[];
}

const jobDescriptions: Record<string, { icon: any; color: string; description: string }> = {
  watch_sync_programs: {
    icon: RefreshCw,
    color: 'text-blue-400',
    description: 'Sync bug bounty programs from HackerOne and Bugcrowd',
  },
  watch_subfinder_all: {
    icon: Zap,
    color: 'text-purple-400',
    description: 'Run subfinder for all domains (parallel via workers)',
  },
  watch_ns_all: {
    icon: Clock,
    color: 'text-cyan-400',
    description: 'DNS resolution for all discovered subdomains',
  },
  watch_http_all: {
    icon: Zap,
    color: 'text-green-400',
    description: 'HTTP probing for all live hosts',
  },
  watch_nuclei_all: {
    icon: AlertCircle,
    color: 'text-red-400',
    description: 'Run Nuclei vulnerability scans',
  },
  fresh_detection: {
    icon: Timer,
    color: 'text-yellow-400',
    description: 'Mark old assets as not fresh (24h threshold)',
  },
  score_calculation: {
    icon: Settings2,
    color: 'text-orange-400',
    description: 'Recalculate all target scores',
  },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function CronJobsPage() {
  const [configs, setConfigs] = useState<CronConfig[]>([]);
  const [executions, setExecutions] = useState<JobExecution[]>([]);
  const [runningJobs, setRunningJobs] = useState<JobExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);
  const [togglingJob, setTogglingJob] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'jobs' | 'history'>('jobs');
  const [selectedExecution, setSelectedExecution] = useState<JobExecution | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [subfinderQueueStats, setSubfinderQueueStats] = useState<{
    messages: number;
    consumers: number;
    messagesReady: number;
    messagesUnacked: number;
  } | null>(null);
  const [clearingQueue, setClearingQueue] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState<{ total: number; totalPages: number } | null>(null);
  const historyLimit = 20;
  const isMobile = useIsMobile();

  const fetchData = async () => {
    try {
      const [configsRes, executionsRes, runningRes, queueStatsRes] = await Promise.all([
        cronApi.getConfigs(),
        cronApi.getExecutions({ page: historyPage, limit: historyLimit }),
        cronApi.getRunningJobs(),
        cronApi.getSubfinderQueueStats().catch(() => ({ data: null })),
      ]);
      setConfigs(configsRes.data);
      setExecutions(executionsRes.data.data || executionsRes.data);
      if (executionsRes.data.pagination) {
        setHistoryPagination(executionsRes.data.pagination);
      }
      setRunningJobs(runningRes.data);
      if (queueStatsRes.data) {
        setSubfinderQueueStats(queueStatsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch cron data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [historyPage]);

  const handleTriggerJob = async (jobName: string) => {
    setTriggeringJob(jobName);
    try {
      await cronApi.triggerJob(jobName);
      // Refresh data after triggering
      await fetchData();
    } catch (error) {
      console.error('Failed to trigger job:', error);
    } finally {
      setTriggeringJob(null);
    }
  };

  const handleToggleJob = async (jobName: string, currentEnabled: boolean) => {
    setTogglingJob(jobName);
    try {
      await cronApi.updateConfig(jobName, { enabled: !currentEnabled });
      await fetchData();
    } catch (error) {
      console.error('Failed to toggle job:', error);
    } finally {
      setTogglingJob(null);
    }
  };

  const handleViewLogs = async (execution: JobExecution) => {
    setSelectedExecution(execution);
    setLoadingLogs(true);
    setLogsAutoRefresh(execution.status === 'running');
    try {
      const res = await cronApi.getExecutionLogs(execution._id);
      setExecutionLogs(res.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setExecutionLogs(['Failed to fetch logs']);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleCloseLogs = () => {
    setSelectedExecution(null);
    setExecutionLogs([]);
    setLogsAutoRefresh(false);
  };

  const handleCleanupStaleJobs = async () => {
    setCleaningUp(true);
    try {
      const res = await cronApi.cleanupStaleJobs(1); // 1 hour
      alert(res.data.message || `Cleaned up ${res.data.count} stale job(s)`);
      await fetchData();
    } catch (error: any) {
      console.error('Failed to cleanup stale jobs:', error);
      alert(error.response?.data?.message || 'Failed to cleanup stale jobs');
    } finally {
      setCleaningUp(false);
    }
  };

  const handleClearSubfinderQueue = async () => {
    if (!confirm('Are you sure you want to clear the subfinder queue? This will stop all pending subdomain scans.')) {
      return;
    }
    setClearingQueue(true);
    try {
      const res = await cronApi.clearSubfinderQueue();
      alert(res.data.message || 'Queue cleared');
      await fetchData();
    } catch (error: any) {
      console.error('Failed to clear queue:', error);
      alert(error.response?.data?.message || 'Failed to clear queue');
    } finally {
      setClearingQueue(false);
    }
  };

  const handleCancelJob = async (executionId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) {
      return;
    }
    try {
      const res = await cronApi.cancelJob(executionId);
      if (res.data.success) {
        alert('Job cancelled successfully');
        await fetchData();
      } else {
        alert(res.data.message || 'Failed to cancel job');
      }
    } catch (error: any) {
      console.error('Failed to cancel job:', error);
      alert(error.response?.data?.message || 'Failed to cancel job');
    }
  };

  // Auto-refresh logs for running jobs
  useEffect(() => {
    if (!logsAutoRefresh || !selectedExecution) return;

    const interval = setInterval(async () => {
      try {
        const res = await cronApi.getExecutionLogs(selectedExecution._id);
        setExecutionLogs(res.data);
        
        // Check if job is still running
        const executionsRes = await cronApi.getExecutions({ jobName: selectedExecution.jobName, limit: 1 });
        if (executionsRes.data[0]?.status !== 'running') {
          setLogsAutoRefresh(false);
          setSelectedExecution(prev => prev ? { ...prev, status: executionsRes.data[0]?.status } : null);
        }
      } catch (error) {
        console.error('Failed to refresh logs:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [logsAutoRefresh, selectedExecution]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-white">Cron Jobs</h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">Manage scheduled tasks and view execution history</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-sm text-slate-300 transition-colors touch-manipulation w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Running Jobs Alert */}
      {runningJobs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg shrink-0">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-blue-400">
                  {runningJobs.length} job{runningJobs.length > 1 ? 's' : ''} currently running
                </h3>
                <p className="text-xs text-blue-300/70 mt-0.5 truncate">
                  {runningJobs.map(j => j.jobName).join(', ')}
                </p>
              </div>
            </div>
            <button
              onClick={handleCleanupStaleJobs}
              disabled={cleaningUp}
              className={clsx(
                'flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg transition-colors touch-manipulation w-full sm:w-auto',
                cleaningUp
                  ? 'bg-dark-700 text-slate-500 cursor-not-allowed'
                  : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30'
              )}
            >
              {cleaningUp ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <XCircle className="w-3 h-3" />
              )}
              Cleanup Stale Jobs
            </button>
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-dark-800 pb-0 overflow-x-auto">
        <button
          onClick={() => setSelectedTab('jobs')}
          className={clsx(
            'px-4 py-2 min-h-[44px] text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap touch-manipulation',
            selectedTab === 'jobs'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-white'
          )}
        >
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Scheduled Jobs
          </span>
        </button>
        <button
          onClick={() => setSelectedTab('history')}
          className={clsx(
            'px-4 py-2 min-h-[44px] text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap touch-manipulation',
            selectedTab === 'history'
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-slate-400 hover:text-white'
          )}
        >
          <span className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Execution History
          </span>
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {selectedTab === 'jobs' ? (
          <motion.div
            key="jobs"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid gap-4"
          >
            {configs.map((config) => {
              const jobInfo = jobDescriptions[config.jobName] || {
                icon: Clock,
                color: 'text-slate-400',
                description: config.description,
              };
              const JobIcon = jobInfo.icon;
              const isRunning = runningJobs.some(j => j.jobName === config.jobName);
              const isExpanded = expandedJob === config.jobName;

              return (
                <motion.div
                  key={config._id}
                  layout
                  className={clsx(
                    'bg-dark-900/50 border rounded-xl overflow-hidden transition-colors',
                    config.enabled ? 'border-dark-800' : 'border-dark-800/50 opacity-60'
                  )}
                >
                  {/* Job Header */}
                  <div className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                        <div className={clsx(
                          'p-2 sm:p-3 rounded-xl shrink-0',
                          config.enabled ? 'bg-dark-800' : 'bg-dark-800/50'
                        )}>
                          <JobIcon className={clsx('w-4 h-4 sm:w-5 sm:h-5', jobInfo.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm sm:text-base font-semibold text-white">
                              {config.jobName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h3>
                            {isRunning && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Running
                              </span>
                            )}
                            {!config.enabled && (
                              <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 text-xs rounded-full border border-slate-500/30">
                                Disabled
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-slate-400 mt-1">
                            {jobInfo.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {config.schedule}
                            </span>
                            {config.lastRunAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Last: {formatRelativeTime(config.lastRunAt)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {config.runCount} runs
                            </span>
                            {config.failCount > 0 && (
                              <span className="flex items-center gap-1 text-red-400">
                                <XCircle className="w-3 h-3" />
                                {config.failCount} failed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleTriggerJob(config.jobName)}
                          disabled={triggeringJob === config.jobName || isRunning}
                          className={clsx(
                            'flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-all touch-manipulation',
                            triggeringJob === config.jobName || isRunning
                              ? 'bg-dark-700 text-slate-500 cursor-not-allowed'
                              : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 border border-primary-500/30'
                          )}
                        >
                          {triggeringJob === config.jobName ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Run Now
                        </button>

                        <button
                          onClick={() => handleToggleJob(config.jobName, config.enabled)}
                          disabled={togglingJob === config.jobName}
                          className={clsx(
                            'p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all touch-manipulation',
                            config.enabled
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                              : 'bg-dark-700 text-slate-400 hover:bg-dark-600 border border-dark-600'
                          )}
                          title={config.enabled ? 'Disable job' : 'Enable job'}
                        >
                          {togglingJob === config.jobName ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : config.enabled ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          onClick={() => setExpandedJob(isExpanded ? null : config.jobName)}
                          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-dark-800 text-slate-400 hover:text-white transition-colors touch-manipulation"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-dark-800"
                      >
                        <div className="p-4 bg-dark-800/30">
                          <h4 className="text-sm font-medium text-slate-300 mb-3">Recent Executions</h4>
                          <div className="space-y-2">
                            {executions
                              .filter(e => e.jobName === config.jobName)
                              .slice(0, 5)
                              .map((execution) => (
                                <div
                                  key={execution._id}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-dark-900/50 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    {getStatusIcon(execution.status)}
                                    <div>
                                      <p className="text-sm text-white">
                                        {formatDate(execution.startedAt)}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        Trigger: {execution.trigger}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between sm:justify-end gap-3">
                                    <button
                                      onClick={() => handleViewLogs(execution)}
                                      className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] bg-dark-800 hover:bg-dark-700 text-slate-300 text-xs rounded-lg transition-colors touch-manipulation"
                                    >
                                      <Terminal className="w-3 h-3" />
                                      Logs
                                    </button>
                                    <div className="text-right">
                                      <span className={clsx(
                                        'inline-flex px-2 py-0.5 text-xs rounded-full border',
                                        getStatusColor(execution.status)
                                      )}>
                                        {execution.status}
                                      </span>
                                      {execution.duration && (
                                        <p className="text-xs text-slate-500 mt-1">
                                          {formatDuration(execution.duration)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            {executions.filter(e => e.jobName === config.jobName).length === 0 && (
                              <p className="text-sm text-slate-500 text-center py-4">
                                No executions yet
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-dark-900/50 border border-dark-800 rounded-xl overflow-hidden"
          >
            {/* Mobile Card View */}
            {isMobile ? (
              <div className="divide-y divide-dark-800">
                {executions.map((execution) => (
                  <div key={execution._id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        {execution.jobName.replace(/_/g, ' ')}
                      </span>
                      <span className={clsx(
                        'inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full border',
                        getStatusColor(execution.status)
                      )}>
                        {getStatusIcon(execution.status)}
                        {execution.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full',
                        execution.trigger === 'manual'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-slate-500/20 text-slate-400'
                      )}>
                        {execution.trigger}
                      </span>
                      <span>{formatDate(execution.startedAt)}</span>
                      {execution.duration && (
                        <span>{formatDuration(execution.duration)}</span>
                      )}
                    </div>
                    {execution.error && (
                      <p className="text-xs text-red-400 truncate">{execution.error}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewLogs(execution)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-dark-800 hover:bg-dark-700 text-slate-300 text-xs rounded-lg transition-colors touch-manipulation"
                      >
                        <Terminal className="w-3 h-3" />
                        View Logs
                      </button>
                      {execution.status === 'running' && (
                        <button
                          onClick={() => handleCancelJob(execution._id)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded-lg transition-colors border border-red-500/30 touch-manipulation"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {executions.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    No executions found
                  </div>
                )}
              </div>
            ) : (
              /* Desktop Table View */
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-800">
                      <th className="text-left p-4 text-sm font-medium text-slate-400">Job</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-400">Trigger</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-400">Started</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-400">Duration</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-400">Error</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-400">Logs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((execution) => (
                      <tr key={execution._id} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                        <td className="p-4">
                          <span className="text-sm font-medium text-white">
                            {execution.jobName.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={clsx(
                            'inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full border',
                            getStatusColor(execution.status)
                          )}>
                            {getStatusIcon(execution.status)}
                            {execution.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={clsx(
                            'px-2 py-0.5 text-xs rounded-full',
                            execution.trigger === 'manual'
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-slate-500/20 text-slate-400'
                          )}>
                            {execution.trigger}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-300">
                          {formatDate(execution.startedAt)}
                        </td>
                        <td className="p-4 text-sm text-slate-400">
                          {execution.duration ? formatDuration(execution.duration) : '-'}
                        </td>
                        <td className="p-4">
                          {execution.error ? (
                            <span className="text-xs text-red-400 truncate max-w-[200px] block" title={execution.error}>
                              {execution.error}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewLogs(execution)}
                              className="flex items-center gap-1.5 px-2 py-1 bg-dark-800 hover:bg-dark-700 text-slate-300 text-xs rounded-lg transition-colors"
                            >
                              <Terminal className="w-3 h-3" />
                              Logs
                            </button>
                            {execution.status === 'running' && (
                              <button
                                onClick={() => handleCancelJob(execution._id)}
                                className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded-lg transition-colors border border-red-500/30"
                                title="Cancel job"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {executions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          No executions found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Pagination */}
            {historyPagination && historyPagination.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-dark-800">
                <div className="text-sm text-slate-400 text-center sm:text-left">
                  Showing {((historyPage - 1) * historyLimit) + 1} - {Math.min(historyPage * historyLimit, historyPagination.total)} of {historyPagination.total} executions
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className={clsx(
                      'px-3 py-2 min-h-[44px] text-sm rounded-lg transition-colors touch-manipulation',
                      historyPage === 1
                        ? 'bg-dark-800 text-slate-500 cursor-not-allowed'
                        : 'bg-dark-800 text-slate-300 hover:bg-dark-700'
                    )}
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-400 px-2">
                    Page {historyPage} of {historyPagination.totalPages}
                  </span>
                  <button
                    onClick={() => setHistoryPage(p => Math.min(historyPagination.totalPages, p + 1))}
                    disabled={historyPage === historyPagination.totalPages}
                    className={clsx(
                      'px-3 py-2 min-h-[44px] text-sm rounded-lg transition-colors touch-manipulation',
                      historyPage === historyPagination.totalPages
                        ? 'bg-dark-800 text-slate-500 cursor-not-allowed'
                        : 'bg-dark-800 text-slate-300 hover:bg-dark-700'
                    )}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs Modal */}
      <AnimatePresence>
        {selectedExecution && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70"
            onClick={handleCloseLogs}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: isMobile ? 100 : 0 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: isMobile ? 100 : 0 }}
              className="w-full sm:max-w-4xl max-h-[90vh] sm:max-h-[80vh] bg-dark-900 border-t sm:border border-dark-700 rounded-t-xl sm:rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-dark-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-dark-800 rounded-lg shrink-0">
                    <Terminal className="w-5 h-5 text-primary-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold text-white truncate">
                      Execution Logs
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 truncate">
                      {selectedExecution.jobName.replace(/_/g, ' ')} • {formatDate(selectedExecution.startedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  {logsAutoRefresh && (
                    <span className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Live updating
                    </span>
                  )}
                  <span className={clsx(
                    'inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full border',
                    getStatusColor(selectedExecution.status)
                  )}>
                    {getStatusIcon(selectedExecution.status)}
                    <span className="hidden sm:inline">{selectedExecution.status}</span>
                  </span>
                  <button
                    onClick={handleCloseLogs}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-dark-800 rounded-lg transition-colors touch-manipulation"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Logs Content */}
              <div className="p-4 overflow-auto max-h-[calc(90vh-140px)] sm:max-h-[calc(80vh-140px)]">
                {loadingLogs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                  </div>
                ) : executionLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No logs available yet</p>
                  </div>
                ) : (
                  <div className="bg-dark-950 rounded-lg p-3 sm:p-4 font-mono text-xs sm:text-sm overflow-x-auto">
                    {executionLogs.map((log, index) => {
                      const isError = log.includes('ERROR');
                      const isSuccess = log.includes('completed') || log.includes('NEW:');
                      const isInfo = log.includes('Starting') || log.includes('Fetching') || log.includes('Found');
                      
                      return (
                        <div
                          key={index}
                          className={clsx(
                            'py-1 px-2 -mx-2 rounded break-all',
                            isError && 'bg-red-500/10 text-red-400',
                            isSuccess && 'text-green-400',
                            isInfo && 'text-blue-400',
                            !isError && !isSuccess && !isInfo && 'text-slate-300'
                          )}
                        >
                          {log}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {selectedExecution.error && (
                <div className="p-4 border-t border-dark-700 bg-red-500/5">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-400">Error</p>
                      <p className="text-sm text-red-300/80 mt-1">{selectedExecution.error}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

