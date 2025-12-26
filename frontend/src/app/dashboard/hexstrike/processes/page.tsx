'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Search,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Terminal,
  Play,
  Square,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  Wrench,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { hexstrikeApi } from '@/lib/api';
import { socketClient } from '@/lib/socket';

// Process status type
type ProcessStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'pending';

// Process interface matching backend
interface HexStrikeProcess {
  pid: number;
  command: string;
  status: ProcessStatus;
  startTime: string;
  endTime?: string;
  duration?: number;
  output?: string;
  error?: string;
  tool?: string;
  target?: string;
}

// Status configuration for display
const statusConfig: Record<ProcessStatus, { label: string; color: string; bg: string; icon: typeof Activity }> = {
  running: { label: 'Running', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Play },
  completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle },
  failed: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Square },
  pending: { label: 'Pending', color: 'text-slate-400', bg: 'bg-slate-500/20', icon: Clock },
};

// Format duration helper
const formatDuration = (ms?: number): string => {
  if (!ms || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
};

// Calculate duration from start time
const calculateDuration = (startTime: string, endTime?: string): number => {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  return end - start;
};

export default function HexStrikeProcessesPage() {
  const [processes, setProcesses] = useState<HexStrikeProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ProcessStatus | 'all'>('all');
  const [selectedTool, setSelectedTool] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [expandedProcess, setExpandedProcess] = useState<number | null>(null);
  const [terminatingPid, setTerminatingPid] = useState<number | null>(null);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  // Fetch processes from API
  const fetchProcesses = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await hexstrikeApi.getProcesses();
      const data = Array.isArray(response.data) ? response.data : [];
      setProcesses(data);
    } catch (error) {
      console.error('Failed to fetch processes:', error);
      setProcesses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Handle WebSocket updates for real-time process status
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const attemptReconnect = () => {
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setConnectionStatus('connecting');
        reconnectTimeout = setTimeout(() => {
          socketClient.reconnect();
        }, 1000 * reconnectAttempts); // Exponential backoff
      }
    };

    socketClient.connect();
    setConnectionStatus('connecting');

    const handleConnect = () => {
      setConnectionStatus('connected');
      reconnectAttempts = 0;
      // Subscribe to HexStrike process updates
      socketClient.subscribeHexStrikeProcesses();
    };

    const handleDisconnect = () => {
      setConnectionStatus('disconnected');
      attemptReconnect();
    };

    const handleProcessUpdate = (data: HexStrikeProcess) => {
      setProcesses((prev) => {
        const index = prev.findIndex((p) => p.pid === data.pid);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...data };
          return updated;
        }
        return [data, ...prev];
      });
    };

    const handleProcessComplete = (data: { pid: number; status: ProcessStatus; endTime: string }) => {
      setProcesses((prev) =>
        prev.map((p) =>
          p.pid === data.pid
            ? { ...p, status: data.status, endTime: data.endTime }
            : p
        )
      );
    };

    const handleProcessNew = (data: HexStrikeProcess) => {
      setProcesses((prev) => {
        // Check if process already exists
        if (prev.some((p) => p.pid === data.pid)) {
          return prev;
        }
        return [data, ...prev];
      });
    };

    const handleProcessTerminated = (data: { pid: number }) => {
      setProcesses((prev) =>
        prev.map((p) =>
          p.pid === data.pid
            ? { ...p, status: 'cancelled' as ProcessStatus, endTime: new Date().toISOString() }
            : p
        )
      );
    };

    // Subscribe to socket events
    const unsubConnect = socketClient.on('connect', handleConnect);
    const unsubDisconnect = socketClient.on('disconnect', handleDisconnect);
    const unsubProcessUpdate = socketClient.on('hexstrike:process:update', handleProcessUpdate);
    const unsubProcessComplete = socketClient.on('hexstrike:process:complete', handleProcessComplete);
    const unsubProcessNew = socketClient.on('hexstrike:process:new', handleProcessNew);
    const unsubProcessTerminated = socketClient.on('hexstrike:process:terminated', handleProcessTerminated);

    // Initial fetch
    fetchProcesses();

    // Polling fallback for real-time updates (every 10 seconds)
    // This ensures data stays fresh even if WebSocket is disconnected
    const pollInterval = setInterval(() => {
      fetchProcesses(true);
    }, 10000);

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubProcessUpdate();
      unsubProcessComplete();
      unsubProcessNew();
      unsubProcessTerminated();
      clearInterval(pollInterval);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      // Unsubscribe from HexStrike process updates
      socketClient.unsubscribeHexStrikeProcesses();
    };
  }, [fetchProcesses]);

  // Terminate a process
  const handleTerminate = async (pid: number) => {
    setTerminatingPid(pid);
    try {
      await hexstrikeApi.terminateProcess(pid);
      setProcesses((prev) =>
        prev.map((p) =>
          p.pid === pid ? { ...p, status: 'cancelled' as ProcessStatus } : p
        )
      );
    } catch (error) {
      console.error('Failed to terminate process:', error);
    } finally {
      setTerminatingPid(null);
      setShowTerminateConfirm(null);
    }
  };

  // Get unique tools from processes
  const availableTools = useMemo(() => {
    const tools = new Set<string>();
    processes.forEach((p) => {
      if (p.tool) tools.add(p.tool);
    });
    return Array.from(tools).sort();
  }, [processes]);

  // Filter processes
  const filteredProcesses = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return processes.filter((process) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          process.command.toLowerCase().includes(query) ||
          process.pid.toString().includes(query) ||
          (process.tool && process.tool.toLowerCase().includes(query)) ||
          (process.target && process.target.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && process.status !== selectedStatus) {
        return false;
      }

      // Tool filter
      if (selectedTool !== 'all' && process.tool !== selectedTool) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const processDate = new Date(process.startTime);
        switch (dateFilter) {
          case 'today':
            if (processDate < todayStart) return false;
            break;
          case 'week':
            if (processDate < weekStart) return false;
            break;
          case 'month':
            if (processDate < monthStart) return false;
            break;
        }
      }

      return true;
    });
  }, [processes, searchQuery, selectedStatus, selectedTool, dateFilter]);

  // Get status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: processes.length };
    processes.forEach((p) => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return counts;
  }, [processes]);

  const runningCount = statusCounts.running || 0;
  const completedCount = statusCounts.completed || 0;
  const failedCount = statusCounts.failed || 0;

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
              <Activity className="w-7 h-7 text-primary-400" />
              Process Monitor
            </h1>
            <p className="text-slate-400 mt-1">Track and manage HexStrike AI processes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection Status Indicator */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer hover:opacity-80 transition-opacity',
            connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400' :
            connectionStatus === 'disconnected' ? 'bg-red-500/20 text-red-400' :
            'bg-yellow-500/20 text-yellow-400'
          )}
          onClick={() => {
            if (connectionStatus === 'disconnected') {
              setConnectionStatus('connecting');
              socketClient.reconnect();
            }
          }}
          title={connectionStatus === 'disconnected' ? 'Click to reconnect' : undefined}
          >
            <div className={cn(
              'w-2 h-2 rounded-full',
              connectionStatus === 'connected' ? 'bg-green-400' :
              connectionStatus === 'disconnected' ? 'bg-red-400' :
              'bg-yellow-400 animate-pulse'
            )} />
            {connectionStatus === 'connected' ? 'Live' : connectionStatus === 'disconnected' ? 'Offline (click to reconnect)' : 'Connecting'}
          </div>
          <button
            onClick={() => fetchProcesses(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-2xl font-bold text-white">{processes.length}</div>
          <div className="text-sm text-slate-400">Total Processes</div>
        </div>
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-blue-400">{runningCount}</div>
            {runningCount > 0 && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
          </div>
          <div className="text-sm text-slate-400">Running</div>
        </div>
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-2xl font-bold text-green-400">{completedCount}</div>
          <div className="text-sm text-slate-400">Completed</div>
        </div>
        <div className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800">
          <div className="text-2xl font-bold text-red-400">{failedCount}</div>
          <div className="text-sm text-slate-400">Failed</div>
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
              placeholder="Search by command, PID, tool, or target..."
              className="w-full pl-11 pr-4 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ProcessStatus | 'all')}
              className="px-3 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500/50 transition-colors"
            >
              <option value="all">All Status ({statusCounts.all || 0})</option>
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label} ({statusCounts[key] || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Tool Filter */}
          {availableTools.length > 0 && (
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-slate-500" />
              <select
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
                className="px-3 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500/50 transition-colors"
              >
                <option value="all">All Tools</option>
                {availableTools.map((tool) => (
                  <option key={tool} value={tool}>
                    {tool}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'week' | 'month')}
              className="px-3 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500/50 transition-colors"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredProcesses.length === 0 && (
        <div className="p-8 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 text-center">
          <Terminal className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Processes Found</h3>
          <p className="text-slate-400 text-sm">
            {searchQuery || selectedStatus !== 'all' || selectedTool !== 'all' || dateFilter !== 'all'
              ? 'Try adjusting your filters to see more processes.'
              : 'No HexStrike AI processes are running or have been executed recently.'}
          </p>
          {(searchQuery || selectedStatus !== 'all' || selectedTool !== 'all' || dateFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('all');
                setSelectedTool('all');
                setDateFilter('all');
              }}
              className="mt-4 px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Process List */}
      {!loading && filteredProcesses.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredProcesses.map((process) => {
              const config = statusConfig[process.status] || statusConfig.pending;
              const isExpanded = expandedProcess === process.pid;
              const duration = process.duration || calculateDuration(process.startTime, process.endTime);

              return (
                <motion.div
                  key={process.pid}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
                >
                  {/* Process Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-dark-800/50 transition-colors"
                    onClick={() => setExpandedProcess(isExpanded ? null : process.pid)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Status Indicator */}
                        <div className={cn('p-2 rounded-lg', config.bg)}>
                          <config.icon className={cn('w-5 h-5', config.color, process.status === 'running' && 'animate-pulse')} />
                        </div>

                        {/* Process Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white truncate">
                              {process.command}
                            </span>
                            <span className="text-xs text-slate-500 shrink-0">
                              PID: {process.pid}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            {process.tool && (
                              <span className="flex items-center gap-1">
                                <Wrench className="w-3 h-3" />
                                {process.tool}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(process.startTime).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(duration)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <span className={cn('px-2 py-1 rounded text-xs font-medium', config.bg, config.color)}>
                          {config.label}
                        </span>

                        {/* Terminate Button (only for running processes) */}
                        {process.status === 'running' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTerminateConfirm(process.pid);
                            }}
                            disabled={terminatingPid === process.pid}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Terminate process"
                          >
                            {terminatingPid === process.pid ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Expand/Collapse */}
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
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
                        transition={{ duration: 0.2 }}
                        className="border-t border-dark-700"
                      >
                        <div className="p-4 space-y-4">
                          {/* Process Details Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Process ID</div>
                              <div className="text-sm text-white font-mono">{process.pid}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Status</div>
                              <div className={cn('text-sm font-medium', config.color)}>{config.label}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Start Time</div>
                              <div className="text-sm text-white">{new Date(process.startTime).toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 mb-1">Duration</div>
                              <div className="text-sm text-white">{formatDuration(duration)}</div>
                            </div>
                            {process.tool && (
                              <div>
                                <div className="text-xs text-slate-500 mb-1">Tool</div>
                                <div className="text-sm text-white">{process.tool}</div>
                              </div>
                            )}
                            {process.target && (
                              <div>
                                <div className="text-xs text-slate-500 mb-1">Target</div>
                                <div className="text-sm text-white font-mono truncate">{process.target}</div>
                              </div>
                            )}
                            {process.endTime && (
                              <div>
                                <div className="text-xs text-slate-500 mb-1">End Time</div>
                                <div className="text-sm text-white">{new Date(process.endTime).toLocaleString()}</div>
                              </div>
                            )}
                          </div>

                          {/* Command */}
                          <div>
                            <div className="text-xs text-slate-500 mb-2">Command</div>
                            <div className="p-3 bg-dark-800 rounded-lg font-mono text-sm text-slate-300 break-all">
                              {process.command}
                            </div>
                          </div>

                          {/* Output */}
                          {process.output && (
                            <div>
                              <div className="text-xs text-slate-500 mb-2">Output</div>
                              <div className="p-3 bg-dark-800 rounded-lg font-mono text-xs text-slate-300 max-h-64 overflow-auto whitespace-pre-wrap">
                                {process.output}
                              </div>
                            </div>
                          )}

                          {/* Error */}
                          {process.error && (
                            <div>
                              <div className="text-xs text-red-400 mb-2 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Error
                              </div>
                              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg font-mono text-xs text-red-300 max-h-32 overflow-auto whitespace-pre-wrap">
                                {process.error}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Terminate Confirmation Modal */}
      <AnimatePresence>
        {showTerminateConfirm !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowTerminateConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-900 border border-dark-700 rounded-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Terminate Process?</h3>
              </div>
              <p className="text-slate-400 text-sm mb-6">
                Are you sure you want to terminate process <span className="font-mono text-white">PID {showTerminateConfirm}</span>? 
                This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowTerminateConfirm(null)}
                  className="px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleTerminate(showTerminateConfirm)}
                  disabled={terminatingPid === showTerminateConfirm}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm text-white font-medium transition-colors flex items-center gap-2"
                >
                  {terminatingPid === showTerminateConfirm ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Terminating...
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" />
                      Terminate
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
