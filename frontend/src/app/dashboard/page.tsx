'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Server,
  AlertTriangle,
  Target,
  TrendingUp,
  Activity,
  Clock,
  ArrowUpRight,
  Plus,
  Play,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { programsApi, domainsApi, subdomainsApi, cronApi } from '@/lib/api';

interface DashboardStats {
  programs: number;
  domains: number;
  subdomains: number;
  aliveSubdomains: number;
}

interface CronExecution {
  _id: string;
  jobName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ programs: 0, domains: 0, subdomains: 0, aliveSubdomains: 0 });
  const [recentExecutions, setRecentExecutions] = useState<CronExecution[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [programsRes, domainsRes, subdomainsRes, executionsRes] = await Promise.all([
        programsApi.getAll().catch(() => ({ data: [] })),
        domainsApi.getAll().catch(() => ({ data: [] })),
        subdomainsApi.getAll().catch(() => ({ data: [] })),
        cronApi.getExecutions({ limit: 5 }).catch(() => ({ data: [] })),
      ]);

      const programs = Array.isArray(programsRes.data) ? programsRes.data : [];
      const domains = Array.isArray(domainsRes.data) ? domainsRes.data : [];
      const subdomains = Array.isArray(subdomainsRes.data) ? subdomainsRes.data : [];
      const executions = Array.isArray(executionsRes.data) ? executionsRes.data : [];

      setStats({
        programs: programs.length,
        domains: domains.length,
        subdomains: subdomains.length,
        aliveSubdomains: subdomains.filter((s: any) => s.isAlive).length,
      });
      setRecentExecutions(executions);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    { name: 'Programs', value: stats.programs, icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/20', href: '/dashboard/programs' },
    { name: 'Domains', value: stats.domains, icon: Globe, color: 'text-purple-400', bg: 'bg-purple-500/20', href: '/dashboard/domains' },
    { name: 'Subdomains', value: stats.subdomains, icon: Server, color: 'text-cyan-400', bg: 'bg-cyan-500/20', href: '/dashboard/subdomains' },
    { name: 'Alive Hosts', value: stats.aliveSubdomains, icon: Activity, color: 'text-green-400', bg: 'bg-green-500/20', href: '/dashboard/subdomains' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'running': return 'text-blue-400';
      case 'failed': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Overview of your bug bounty automation</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/dashboard/cron"
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Run Jobs
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative group"
          >
            <Link href={stat.href}>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-600/50 to-accent-cyan/50 rounded-xl blur opacity-0 group-hover:opacity-30 transition duration-300" />
              <div className="relative p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-dark-700 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-primary-400 transition-colors" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : stat.value.toLocaleString()}
                </div>
                <div className="text-sm text-slate-400">{stat.name}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cron Executions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-400" />
              Recent Job Executions
            </h3>
            <Link href="/dashboard/cron" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View all <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
              </div>
            ) : recentExecutions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No recent executions. Run a cron job to get started.
              </div>
            ) : (
              recentExecutions.map((exec) => (
                <div
                  key={exec._id}
                  className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${exec.status === 'completed' ? 'bg-green-500' : exec.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} />
                    <div>
                      <div className="text-sm font-medium text-white">{exec.jobName.replace('watch_', '').replace(/_/g, ' ')}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(exec.startedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm capitalize ${getStatusColor(exec.status)}`}>{exec.status}</div>
                    <div className="text-xs text-slate-500">{formatDuration(exec.duration)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-400" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/dashboard/cron"
              className="p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors group"
            >
              <div className="p-2 bg-blue-500/20 rounded-lg w-fit mb-3">
                <RefreshCw className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors">Sync Programs</div>
              <div className="text-xs text-slate-500 mt-1">Fetch from HackerOne</div>
            </Link>
            
            <Link
              href="/dashboard/cron"
              className="p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors group"
            >
              <div className="p-2 bg-purple-500/20 rounded-lg w-fit mb-3">
                <Server className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors">Enumerate Subdomains</div>
              <div className="text-xs text-slate-500 mt-1">Discover new hosts</div>
            </Link>
            
            <Link
              href="/dashboard/cron"
              className="p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors group"
            >
              <div className="p-2 bg-cyan-500/20 rounded-lg w-fit mb-3">
                <Globe className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors">DNS Resolution</div>
              <div className="text-xs text-slate-500 mt-1">Resolve live hosts</div>
            </Link>
            
            <Link
              href="/dashboard/cron"
              className="p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors group"
            >
              <div className="p-2 bg-green-500/20 rounded-lg w-fit mb-3">
                <Activity className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors">HTTP Probing</div>
              <div className="text-xs text-slate-500 mt-1">Check web services</div>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* System Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary-400" />
          System Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-dark-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-white">Backend API</span>
            </div>
            <div className="text-xs text-slate-500">http://localhost:4000</div>
          </div>
          <div className="p-4 bg-dark-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-white">MongoDB</span>
            </div>
            <div className="text-xs text-slate-500">Connected</div>
          </div>
          <div className="p-4 bg-dark-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-white">RabbitMQ</span>
            </div>
            <div className="text-xs text-slate-500">Connected</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
