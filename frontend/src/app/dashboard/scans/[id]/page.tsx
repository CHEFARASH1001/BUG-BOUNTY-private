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
import { scansApi } from '@/lib/api';

interface ScanData {
  _id: string;
  target: string;
  targetId?: string;
  targetType: string;
  type: string;
  status: string;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  currentStep?: string;
  logs?: string[];
  results?: {
    subdomainsFound?: number;
    aliveHosts?: number;
    portsFound?: number;
    vulnerabilitiesFound?: number;
    technologiesFound?: string[];
  };
  config?: {
    includeSubdomains?: boolean;
    includePorts?: boolean;
    includeNuclei?: boolean;
    includeScreenshots?: boolean;
    includeTechnologies?: boolean;
  };
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500', label: 'Completed' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500', label: 'Running' },
  pending: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-600', label: 'Pending' },
  queued: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500', label: 'Queued' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500', label: 'Failed' },
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/50',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  low: 'bg-green-500/20 text-green-400 border-green-500/50',
};

export default function ScanDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [scan, setScan] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScan = async () => {
      try {
        const response = await scansApi.getById(params.id);
        setScan(response.data);
      } catch (err: any) {
        console.error('Failed to fetch scan:', err);
        setError(err.response?.data?.message || 'Failed to load scan');
      } finally {
        setLoading(false);
      }
    };
    
    fetchScan();
    
    // Poll for updates if scan is running
    const interval = setInterval(() => {
      if (scan?.status === 'running' || scan?.status === 'queued') {
        fetchScan();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [params.id, scan?.status]);

  const handleRetry = async () => {
    try {
      await scansApi.retry(params.id);
      const response = await scansApi.getById(params.id);
      setScan(response.data);
    } catch (err) {
      console.error('Failed to retry scan:', err);
    }
  };

  const handleCancel = async () => {
    try {
      await scansApi.cancel(params.id);
      const response = await scansApi.getById(params.id);
      setScan(response.data);
    } catch (err) {
      console.error('Failed to cancel scan:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="text-center py-24">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Error loading scan</h3>
        <p className="text-slate-400 mb-4">{error || 'Scan not found'}</p>
        <Link
          href="/dashboard/scans"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scans
        </Link>
      </div>
    );
  }

  const status = statusConfig[scan.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  // Parse logs from the scan
  const parsedLogs = (scan.logs || []).map((log, index) => {
    const match = log.match(/\[([^\]]+)\]\s*(.*)/);
    if (match) {
      const time = new Date(match[1]).toLocaleTimeString();
      const message = match[2];
      const level = message.toLowerCase().includes('error') ? 'error' :
                    message.toLowerCase().includes('found') ? 'success' :
                    message.toLowerCase().includes('complete') ? 'success' :
                    'info';
      return { time, message, level };
    }
    return { time: '', message: log, level: 'info' };
  });

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
              <h1 className="text-2xl font-bold text-white">{scan.target}</h1>
              <span className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs',
                status.bg + '/20',
                status.color
              )}>
                <StatusIcon className={cn('w-3 h-3', scan.status === 'running' && 'animate-spin')} />
                {status.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {scan.startedAt ? `Started ${formatDateTime(scan.startedAt)}` : `Created ${formatDateTime(scan.createdAt)}`}
              {scan.completedAt && scan.startedAt && ` • Duration: ${formatDuration(new Date(scan.startedAt), new Date(scan.completedAt))}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scan.status === 'running' && (
            <button 
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}
          {(scan.status === 'completed' || scan.status === 'failed') && (
            <button 
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Re-run
            </button>
          )}
          <a
            href={`https://${scan.target}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Visit Site
          </a>
        </div>
      </div>

      {/* Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-white font-medium">Overall Progress</span>
            {scan.currentStep && (
              <span className="text-slate-400 text-sm ml-3">• {scan.currentStep}</span>
            )}
          </div>
          <span className="text-primary-400 font-bold">{scan.progress || 0}%</span>
        </div>
        <div className="h-3 bg-dark-800 rounded-full overflow-hidden">
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
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Subdomains', value: scan.results?.subdomainsFound || 0, icon: Layers, color: 'text-blue-400' },
          { label: 'Alive Hosts', value: scan.results?.aliveHosts || 0, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Open Ports', value: scan.results?.portsFound || 0, icon: Server, color: 'text-purple-400' },
          { label: 'Vulnerabilities', value: scan.results?.vulnerabilitiesFound || 0, icon: Shield, color: 'text-red-400' },
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
        {['overview', 'logs'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize',
              activeTab === tab
                ? 'text-primary-400 border-primary-400'
                : 'text-slate-400 border-transparent hover:text-white'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Scan Configuration</h3>
            <div className="space-y-3">
              {[
                { label: 'Scan Type', value: scan.type?.toUpperCase() || 'Full' },
                { label: 'Target Type', value: scan.targetType || 'Domain' },
                { label: 'Subdomain Enumeration', value: scan.config?.includeSubdomains ? 'Yes' : 'No' },
                { label: 'Port Scanning', value: scan.config?.includePorts ? 'Yes' : 'No' },
                { label: 'Vulnerability Scan', value: scan.config?.includeNuclei ? 'Yes' : 'No' },
                { label: 'Technology Detection', value: scan.config?.includeTechnologies ? 'Yes' : 'No' },
              ].map((item, index) => (
                <div key={index} className="flex justify-between py-2 border-b border-dark-800 last:border-0">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Technologies Found</h3>
            {scan.results?.technologiesFound && scan.results.technologiesFound.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {scan.results.technologiesFound.map((tech, index) => (
                  <span key={index} className="px-3 py-1.5 bg-dark-800 text-slate-300 rounded-lg text-sm">
                    {tech}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Server className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No technologies detected yet</p>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {activeTab === 'logs' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-4 font-mono text-sm max-h-96 overflow-y-auto"
        >
          {parsedLogs.length > 0 ? (
            <div className="space-y-1">
              {parsedLogs.map((log, index) => (
                <div key={index} className="flex items-start gap-3 py-1">
                  {log.time && <span className="text-slate-500">[{log.time}]</span>}
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
          ) : (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No logs available yet</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
