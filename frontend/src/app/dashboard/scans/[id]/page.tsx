'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Scan,
  Globe,
  ArrowLeft,
  Play,
  Pause,
  Square,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Shield,
  Layers,
  Server,
  Eye,
  Download,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDateTime, formatDuration } from '@/lib/utils';

// Mock scan data
const scanData = {
  id: '1',
  domain: 'example.com',
  type: 'full',
  status: 'running',
  progress: 68,
  startedAt: '2024-01-15T08:00:00Z',
  completedAt: null,
  results: {
    subdomains: 156,
    ports: 423,
    vulnerabilities: 12,
    endpoints: 89,
  },
  stages: [
    { name: 'Subdomain Enumeration', status: 'completed', progress: 100, found: 156 },
    { name: 'DNS Resolution', status: 'completed', progress: 100, found: 142 },
    { name: 'Port Scanning', status: 'running', progress: 75, found: 423 },
    { name: 'HTTP Probing', status: 'pending', progress: 0, found: 0 },
    { name: 'Technology Detection', status: 'pending', progress: 0, found: 0 },
    { name: 'Vulnerability Scanning', status: 'pending', progress: 0, found: 0 },
  ],
  logs: [
    { time: '08:00:00', level: 'info', message: 'Scan started for example.com' },
    { time: '08:00:05', level: 'info', message: 'Starting subdomain enumeration...' },
    { time: '08:05:23', level: 'success', message: 'Found 156 subdomains' },
    { time: '08:05:30', level: 'info', message: 'Starting DNS resolution...' },
    { time: '08:10:45', level: 'success', message: 'Resolved 142 hosts' },
    { time: '08:10:50', level: 'info', message: 'Starting port scanning...' },
    { time: '08:15:00', level: 'info', message: 'Scanning ports on 142 hosts...' },
    { time: '08:20:00', level: 'warning', message: 'Rate limited by target, slowing down...' },
  ],
  vulnerabilities: [
    { id: 1, title: 'SQL Injection', severity: 'critical', target: 'api.example.com/users' },
    { id: 2, title: 'XSS Reflected', severity: 'high', target: 'app.example.com/search' },
    { id: 3, title: 'Information Disclosure', severity: 'medium', target: 'dev.example.com' },
    { id: 4, title: 'Missing Security Headers', severity: 'low', target: 'example.com' },
  ],
};

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500' },
  pending: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-600' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500' },
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/50',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  low: 'bg-green-500/20 text-green-400 border-green-500/50',
};

export default function ScanDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [scan, setScan] = useState(scanData);

  // Simulate real-time progress
  useEffect(() => {
    if (scan.status !== 'running') return;
    
    const interval = setInterval(() => {
      setScan(prev => ({
        ...prev,
        progress: Math.min(prev.progress + 1, 100),
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [scan.status]);

  const StatusIcon = statusConfig[scan.status].icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/scans"
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{scan.domain}</h1>
              <span className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs',
                statusConfig[scan.status].bg + '/20',
                statusConfig[scan.status].color
              )}>
                <StatusIcon className={cn('w-3 h-3', scan.status === 'running' && 'animate-spin')} />
                {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              Started {formatDateTime(scan.startedAt)}
              {scan.completedAt && ` • Duration: ${formatDuration(new Date(scan.startedAt), new Date(scan.completedAt))}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scan.status === 'running' && (
            <>
              <button className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-lg transition-colors">
                <Pause className="w-4 h-4" />
                Pause
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors">
                <Square className="w-4 h-4" />
                Stop
              </button>
            </>
          )}
          {(scan.status === 'completed' || scan.status === 'failed') && (
            <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
              Re-run
            </button>
          )}
          <button className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium">Overall Progress</span>
          <span className="text-primary-400 font-bold">{scan.progress}%</span>
        </div>
        <div className="h-3 bg-dark-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${scan.progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-r from-primary-500 to-accent-cyan rounded-full"
          />
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Subdomains', value: scan.results.subdomains, icon: Layers, color: 'text-blue-400' },
          { label: 'Open Ports', value: scan.results.ports, icon: Server, color: 'text-green-400' },
          { label: 'Vulnerabilities', value: scan.results.vulnerabilities, icon: Shield, color: 'text-red-400' },
          { label: 'Endpoints', value: scan.results.endpoints, icon: Globe, color: 'text-purple-400' },
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
              <stat.icon className={cn('w-8 h-8', stat.color)} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-800">
        {['overview', 'vulnerabilities', 'logs'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab
                ? 'text-primary-400 border-primary-400'
                : 'text-slate-400 border-transparent hover:text-white'
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Scan Stages</h3>
          <div className="space-y-4">
            {scan.stages.map((stage, index) => {
              const StageIcon = statusConfig[stage.status].icon;
              return (
                <div key={stage.name} className="flex items-center gap-4">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    statusConfig[stage.status].bg + '/20'
                  )}>
                    <StageIcon className={cn(
                      'w-4 h-4',
                      statusConfig[stage.status].color,
                      stage.status === 'running' && 'animate-spin'
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium">{stage.name}</span>
                      <span className="text-sm text-slate-400">
                        {stage.found > 0 && `${stage.found} found`}
                      </span>
                    </div>
                    <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          stage.status === 'completed' ? 'bg-green-500' :
                          stage.status === 'running' ? 'bg-blue-500' :
                          'bg-slate-600'
                        )}
                        style={{ width: `${stage.progress}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-slate-400 w-12 text-right">{stage.progress}%</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {activeTab === 'vulnerabilities' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Vulnerability</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Severity</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Target</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scan.vulnerabilities.map((vuln) => (
                <tr key={vuln.id} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={cn(
                        'w-4 h-4',
                        vuln.severity === 'critical' ? 'text-red-400' :
                        vuln.severity === 'high' ? 'text-orange-400' :
                        vuln.severity === 'medium' ? 'text-yellow-400' :
                        'text-green-400'
                      )} />
                      <span className="text-white font-medium">{vuln.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-1 rounded text-xs border',
                      severityColors[vuln.severity]
                    )}>
                      {vuln.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300 font-mono text-sm">{vuln.target}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/vulnerabilities`}
                      className="p-1.5 text-slate-400 hover:text-white transition-colors inline-block"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {activeTab === 'logs' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-4 font-mono text-sm"
        >
          <div className="space-y-1">
            {scan.logs.map((log, index) => (
              <div key={index} className="flex items-start gap-3 py-1">
                <span className="text-slate-500">[{log.time}]</span>
                <span className={cn(
                  log.level === 'success' ? 'text-green-400' :
                  log.level === 'warning' ? 'text-yellow-400' :
                  log.level === 'error' ? 'text-red-400' :
                  'text-slate-300'
                )}>
                  {log.message}
                </span>
              </div>
            ))}
            {scan.status === 'running' && (
              <div className="flex items-center gap-2 text-blue-400 mt-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Scanning in progress...</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

