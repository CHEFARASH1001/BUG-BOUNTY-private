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
import { ResponsiveChart } from '@/components/ResponsiveChart';
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
      const [programsRes, domainsRes, subdomainsRes, aliveSubdomainsRes, executionsRes] = await Promise.all([
        programsApi.getAll({ limit: 1 }).catch(() => ({ data: { pagination: { total: 0 } } })),
        domainsApi.getAll({ limit: 1 }).catch(() => ({ data: { pagination: { total: 0 } } })),
        subdomainsApi.getAll({ limit: 1 }).catch(() => ({ data: { pagination: { total: 0 } } })),
        subdomainsApi.getAll({ limit: 1, isAlive: true }).catch(() => ({ data: { pagination: { total: 0 } } })),
        cronApi.getExecutions({ limit: 5 }).catch(() => ({ data: [] })),
      ]);

      // Extract totals from pagination - backend returns { data: [...], pagination: { total, ... } }
      const programsTotal = programsRes.data?.pagination?.total ?? 0;
      const domainsTotal = domainsRes.data?.pagination?.total ?? 0;
      const subdomainsTotal = subdomainsRes.data?.pagination?.total ?? 0;
      const aliveSubdomainsTotal = aliveSubdomainsRes.data?.pagination?.total ?? 0;
      const executions = Array.isArray(executionsRes.data) ? executionsRes.data : [];

      setStats({
        programs: programsTotal,
        domains: domainsTotal,
        subdomains: subdomainsTotal,
        aliveSubdomains: aliveSubdomainsTotal,
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
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-slate-400 mt-1 leading-relaxed">Overview of your bug bounty automation</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-xs sm:text-sm text-slate-300 hover:bg-dark-700 hover:text-white transition-colors min-h-[44px] touch-manipulation"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Refresh</span>
          </button>
          <Link
            href="/dashboard/cron"
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-xs sm:text-sm text-white font-medium transition-colors min-h-[44px] touch-manipulation"
          >
            <Play className="w-4 h-4" />
            <span className="hidden xs:inline">Run Jobs</span>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
              <div className="relative p-3 sm:p-4 lg:p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-dark-700 transition-colors">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 group-hover:text-primary-400 transition-colors" />
                </div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-0.5 sm:mb-1 leading-tight" style={{ minHeight: '1.75rem' }}>
                  {loading ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : stat.value.toLocaleString()}
                </div>
                <div className="text-xs sm:text-sm text-slate-400 leading-relaxed" style={{ fontSize: 'max(12px, 0.75rem)' }}>{stat.name}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
        {/* Activity Chart - Responsive */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="p-3 sm:p-4 md:p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2 leading-tight">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400" />
              Activity Overview
            </h3>
          </div>
          <ResponsiveChart
            type="area"
            data={[
              { name: 'Mon', subdomains: 45, alive: 32 },
              { name: 'Tue', subdomains: 52, alive: 38 },
              { name: 'Wed', subdomains: 48, alive: 35 },
              { name: 'Thu', subdomains: 70, alive: 52 },
              { name: 'Fri', subdomains: 61, alive: 45 },
              { name: 'Sat', subdomains: 55, alive: 40 },
              { name: 'Sun', subdomains: 67, alive: 48 },
            ]}
            series={[
              { dataKey: 'subdomains', name: 'Subdomains', color: '#06b6d4' },
              { dataKey: 'alive', name: 'Alive Hosts', color: '#22c55e' },
            ]}
            xAxisKey="name"
            showLegend={true}
            ariaLabel="Weekly activity chart showing subdomains and alive hosts"
          />
        </motion.div>

        {/* Recent Cron Executions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-3 sm:p-4 md:p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2 leading-tight">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400" />
              Recent Job Executions
            </h3>
            <Link href="/dashboard/cron" className="text-xs sm:text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Link>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-6 sm:py-8">
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary-400 animate-spin" />
              </div>
            ) : recentExecutions.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-sm text-slate-400 leading-relaxed">
                No recent executions. Run a cron job to get started.
              </div>
            ) : (
              recentExecutions.map((exec) => (
                <div
                  key={exec._id}
                  className="flex items-center justify-between p-2 sm:p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-2 h-2 rounded-full ${exec.status === 'completed' ? 'bg-green-500' : exec.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} />
                    <div>
                      <div className="text-xs sm:text-sm font-medium text-white leading-tight">{exec.jobName.replace('watch_', '').replace(/_/g, ' ')}</div>
                      <div className="text-xs text-slate-500 leading-relaxed">
                        {new Date(exec.startedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs sm:text-sm capitalize ${getStatusColor(exec.status)}`}>{exec.status}</div>
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
          className="p-3 sm:p-4 md:p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2 leading-tight">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Link
              href="/dashboard/cron"
              className="p-3 sm:p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors group"
            >
              <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg w-fit mb-2 sm:mb-3">
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              </div>
              <div className="text-xs sm:text-sm font-medium text-white group-hover:text-primary-400 transition-colors leading-tight">Sync Programs</div>
              <div className="text-xs text-slate-500 mt-0.5 sm:mt-1 leading-relaxed">Fetch from HackerOne</div>
            </Link>
            
            <Link
              href="/dashboard/cron"
              className="p-3 sm:p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors group"
            >
              <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg w-fit mb-2 sm:mb-3">
                <Server className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              </div>
              <div className="text-xs sm:text-sm font-medium text-white group-hover:text-primary-400 transition-colors leading-tight">Enumerate Subdomains</div>
              <div className="text-xs text-slate-500 mt-0.5 sm:mt-1 leading-relaxed">Discover new hosts</div>
            </Link>
            
            <Link
              href="/dashboard/cron"
              className="p-3 sm:p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors group"
            >
              <div className="p-1.5 sm:p-2 bg-cyan-500/20 rounded-lg w-fit mb-2 sm:mb-3">
                <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
              </div>
              <div className="text-xs sm:text-sm font-medium text-white group-hover:text-primary-400 transition-colors leading-tight">DNS Resolution</div>
              <div className="text-xs text-slate-500 mt-0.5 sm:mt-1 leading-relaxed">Resolve live hosts</div>
            </Link>
            
            <Link
              href="/dashboard/cron"
              className="p-3 sm:p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors group"
            >
              <div className="p-1.5 sm:p-2 bg-green-500/20 rounded-lg w-fit mb-2 sm:mb-3">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
              </div>
              <div className="text-xs sm:text-sm font-medium text-white group-hover:text-primary-400 transition-colors leading-tight">HTTP Probing</div>
              <div className="text-xs text-slate-500 mt-0.5 sm:mt-1 leading-relaxed">Check web services</div>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* System Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-3 sm:p-4 md:p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
      >
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2 leading-tight">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400" />
          System Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 bg-dark-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs sm:text-sm font-medium text-white leading-tight">Backend API</span>
            </div>
            <div className="text-xs text-slate-500 leading-relaxed">http://localhost:4000</div>
          </div>
          <div className="p-3 sm:p-4 bg-dark-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs sm:text-sm font-medium text-white leading-tight">MongoDB</span>
            </div>
            <div className="text-xs text-slate-500 leading-relaxed">Connected</div>
          </div>
          <div className="p-3 sm:p-4 bg-dark-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs sm:text-sm font-medium text-white leading-tight">RabbitMQ</span>
            </div>
            <div className="text-xs text-slate-500 leading-relaxed">Connected</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
