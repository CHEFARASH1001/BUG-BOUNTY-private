'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Activity,
  Target,
  Wrench,
  Play,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Zap,
  Shield,
  Search,
  Terminal,
  Cpu,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { hexstrikeApi } from '@/lib/api';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  version?: string;
  uptime?: number;
  toolsAvailable?: number;
  message?: string;
}

interface Process {
  pid: number;
  command: string;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  duration?: number;
}

interface Tool {
  name: string;
  displayName: string;
  category: string;
  isInstalled: boolean;
}

export default function HexStrikeDashboardPage() {
  const [health, setHealth] = useState<HealthStatus>({ status: 'unknown' });
  const [processes, setProcesses] = useState<Process[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Fetch health status
      const healthRes = await hexstrikeApi.getHealth().catch(() => ({
        data: { status: 'unhealthy', message: 'Unable to connect to HexStrike AI server' }
      }));
      setHealth(healthRes.data);

      // Fetch processes
      const processesRes = await hexstrikeApi.getProcesses().catch(() => ({ data: [] }));
      setProcesses(Array.isArray(processesRes.data) ? processesRes.data : []);

      // Fetch tools
      const toolsRes = await hexstrikeApi.getTools().catch(() => ({ data: [] }));
      setTools(Array.isArray(toolsRes.data) ? toolsRes.data : []);
    } catch (error) {
      console.error('Failed to fetch HexStrike data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'completed':
        return 'text-green-400';
      case 'running':
        return 'text-blue-400';
      case 'unhealthy':
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'completed':
        return 'bg-green-500/20';
      case 'running':
        return 'bg-blue-500/20';
      case 'unhealthy':
      case 'failed':
        return 'bg-red-500/20';
      default:
        return 'bg-slate-500/20';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const runningProcesses = processes.filter(p => p.status === 'running');
  const installedTools = tools.filter(t => t.isInstalled);

  // Quick action cards
  const quickActions = [
    {
      title: 'Analyze Target',
      description: 'AI-powered target profiling',
      icon: Target,
      href: '/dashboard/hexstrike/analyze',
      color: 'text-blue-400',
      bg: 'bg-blue-500/20',
    },
    {
      title: 'Security Tools',
      description: '150+ integrated tools',
      icon: Wrench,
      href: '/dashboard/hexstrike/tools',
      color: 'text-purple-400',
      bg: 'bg-purple-500/20',
    },
    {
      title: 'AI Workflows',
      description: 'Automated assessments',
      icon: Zap,
      href: '/dashboard/hexstrike/workflows',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/20',
    },
    {
      title: 'Process Monitor',
      description: 'Track active operations',
      icon: Activity,
      href: '/dashboard/hexstrike/processes',
      color: 'text-green-400',
      bg: 'bg-green-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Brain className="w-7 h-7 text-primary-400" />
            HexStrike AI
          </h1>
          <p className="text-slate-400 mt-1">AI-powered penetration testing framework</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
          <Link
            href="/dashboard/hexstrike/analyze"
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Target className="w-4 h-4" />
            New Analysis
          </Link>
        </div>
      </div>

      {/* Server Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'p-4 rounded-xl border flex items-center justify-between',
          health.status === 'healthy'
            ? 'bg-green-500/10 border-green-500/30'
            : health.status === 'unhealthy'
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-slate-500/10 border-slate-500/30'
        )}
      >
        <div className="flex items-center gap-4">
          <div className={cn('p-3 rounded-lg', getStatusBg(health.status))}>
            {health.status === 'healthy' ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : health.status === 'unhealthy' ? (
              <XCircle className="w-6 h-6 text-red-400" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <div>
            <h3 className={cn('font-semibold', getStatusColor(health.status))}>
              {health.status === 'healthy'
                ? 'HexStrike AI Server Online'
                : health.status === 'unhealthy'
                ? 'HexStrike AI Server Offline'
                : 'Checking Server Status...'}
            </h3>
            <p className="text-sm text-slate-400">
              {health.message || (health.version ? `Version ${health.version}` : 'Connecting...')}
            </p>
          </div>
        </div>
        {health.status === 'healthy' && (
          <div className="flex items-center gap-6 text-sm">
            {health.toolsAvailable && (
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{health.toolsAvailable}</p>
                <p className="text-slate-400">Tools Available</p>
              </div>
            )}
            {health.uptime && (
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{formatDuration(health.uptime)}</p>
                <p className="text-slate-400">Uptime</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            name: 'Server Status',
            value: health.status === 'healthy' ? 'Online' : health.status === 'unhealthy' ? 'Offline' : 'Unknown',
            icon: Cpu,
            color: getStatusColor(health.status),
            bg: getStatusBg(health.status),
          },
          {
            name: 'Active Processes',
            value: runningProcesses.length,
            icon: Activity,
            color: 'text-blue-400',
            bg: 'bg-blue-500/20',
          },
          {
            name: 'Available Tools',
            value: tools.length,
            icon: Wrench,
            color: 'text-purple-400',
            bg: 'bg-purple-500/20',
          },
          {
            name: 'Installed Tools',
            value: installedTools.length,
            icon: CheckCircle,
            color: 'text-green-400',
            bg: 'bg-green-500/20',
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={cn('p-2 rounded-lg', stat.bg)}>
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : stat.value}
            </div>
            <div className="text-sm text-slate-400">{stat.name}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-400" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors group"
              >
                <div className={cn('p-2 rounded-lg w-fit mb-3', action.bg)}>
                  <action.icon className={cn('w-5 h-5', action.color)} />
                </div>
                <div className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors">
                  {action.title}
                </div>
                <div className="text-xs text-slate-500 mt-1">{action.description}</div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent Processes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-400" />
              Recent Activity
            </h3>
            <Link
              href="/dashboard/hexstrike/processes"
              className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              View all <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
              </div>
            ) : processes.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No recent processes</p>
                <p className="text-xs mt-1">Start a scan or analysis to see activity here</p>
              </div>
            ) : (
              processes.slice(0, 5).map((process) => (
                <div
                  key={process.pid}
                  className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        process.status === 'completed'
                          ? 'bg-green-500'
                          : process.status === 'running'
                          ? 'bg-blue-500 animate-pulse'
                          : 'bg-red-500'
                      )}
                    />
                    <div>
                      <div className="text-sm font-medium text-white truncate max-w-[200px]">
                        {process.command}
                      </div>
                      <div className="text-xs text-slate-500">
                        PID: {process.pid} • {new Date(process.startTime).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn('text-sm capitalize', getStatusColor(process.status))}>
                      {process.status}
                    </div>
                    <div className="text-xs text-slate-500">{formatDuration(process.duration)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* AI Capabilities Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-400" />
          AI Capabilities
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-dark-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium text-white">Intelligent Analysis</span>
            </div>
            <p className="text-xs text-slate-400">
              AI-powered target profiling with attack surface scoring and vulnerability prediction
            </p>
          </div>
          <div className="p-4 bg-dark-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-medium text-white">Automated Workflows</span>
            </div>
            <p className="text-xs text-slate-400">
              12+ autonomous AI agents for bug bounty, CTF, and comprehensive security assessments
            </p>
          </div>
          <div className="p-4 bg-dark-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium text-white">Tool Orchestration</span>
            </div>
            <p className="text-xs text-slate-400">
              150+ integrated security tools with intelligent selection and execution
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
