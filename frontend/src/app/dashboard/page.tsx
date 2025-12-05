'use client';

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

// Mock data - replace with real API data
const stats = [
  { name: 'Programs', value: 12, change: '+2', icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { name: 'Domains', value: 48, change: '+8', icon: Globe, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  { name: 'Subdomains', value: 1247, change: '+156', icon: Server, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  { name: 'Vulnerabilities', value: 89, change: '+12', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20' },
];

const vulnBySeverity = [
  { name: 'Critical', value: 8, color: '#dc3545' },
  { name: 'High', value: 23, color: '#fd7e14' },
  { name: 'Medium', value: 34, color: '#ffc107' },
  { name: 'Low', value: 24, color: '#28a745' },
];

const activityData = [
  { date: 'Mon', scans: 12, vulns: 4 },
  { date: 'Tue', scans: 19, vulns: 8 },
  { date: 'Wed', scans: 15, vulns: 6 },
  { date: 'Thu', scans: 22, vulns: 12 },
  { date: 'Fri', scans: 28, vulns: 15 },
  { date: 'Sat', scans: 18, vulns: 7 },
  { date: 'Sun', scans: 24, vulns: 11 },
];

const recentScans = [
  { id: 1, domain: 'example.com', status: 'completed', vulns: 5, time: '2 min ago' },
  { id: 2, domain: 'test.io', status: 'running', vulns: null, time: '5 min ago' },
  { id: 3, domain: 'demo.org', status: 'completed', vulns: 12, time: '15 min ago' },
  { id: 4, domain: 'app.net', status: 'queued', vulns: null, time: '20 min ago' },
];

const recentVulns = [
  { id: 1, title: 'SQL Injection in login', severity: 'critical', target: 'api.example.com', time: '5m ago' },
  { id: 2, title: 'XSS in search parameter', severity: 'high', target: 'www.test.io', time: '12m ago' },
  { id: 3, title: 'CORS misconfiguration', severity: 'medium', target: 'cdn.demo.org', time: '25m ago' },
  { id: 4, title: 'Missing security headers', severity: 'low', target: 'app.net', time: '1h ago' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Overview of your bug bounty activities</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/domains/new"
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Domain
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors">
            <Play className="w-4 h-4" />
            New Scan
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative group"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-600/50 to-accent-cyan/50 rounded-xl blur opacity-0 group-hover:opacity-30 transition duration-300" />
            <div className="relative p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-dark-700 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {stat.change}
                </span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{stat.value.toLocaleString()}</div>
              <div className="text-sm text-slate-400">{stat.name}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-400" />
              Activity Overview
            </h3>
            <select className="px-3 py-1 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorVulns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="scans"
                  stroke="#22c55e"
                  fillOpacity={1}
                  fill="url(#colorScans)"
                />
                <Area
                  type="monotone"
                  dataKey="vulns"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#colorVulns)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Severity Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary-400" />
            Severity Distribution
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vulnBySeverity}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {vulnBySeverity.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {vulnBySeverity.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-slate-400">{item.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Scans */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-400" />
              Recent Scans
            </h3>
            <Link href="/dashboard/scans" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View all <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentScans.map((scan) => (
              <div
                key={scan.id}
                className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`status-dot ${scan.status === 'completed' ? 'online' : scan.status === 'running' ? 'scanning' : 'pending'}`} />
                  <div>
                    <div className="text-sm font-medium text-white">{scan.domain}</div>
                    <div className="text-xs text-slate-500">{scan.time}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-300 capitalize">{scan.status}</div>
                  {scan.vulns !== null && (
                    <div className="text-xs text-slate-500">{scan.vulns} vulns</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Vulnerabilities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Recent Vulnerabilities
            </h3>
            <Link href="/dashboard/vulnerabilities" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View all <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentVulns.map((vuln) => (
              <div
                key={vuln.id}
                className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`px-2 py-1 rounded text-xs font-medium bg-severity-${vuln.severity} border severity-${vuln.severity}`}>
                    {vuln.severity.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{vuln.title}</div>
                    <div className="text-xs text-slate-500">{vuln.target}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500">{vuln.time}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

