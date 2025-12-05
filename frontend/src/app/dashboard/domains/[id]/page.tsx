'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  ArrowLeft,
  Play,
  Pause,
  Settings,
  ExternalLink,
  Layers,
  Server,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Wifi,
  Lock,
  Eye,
  Download,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDateTime } from '@/lib/utils';
import { domainsApi } from '@/lib/api';

interface Domain {
  _id: string;
  domain: string;
  programId?: { _id: string; name: string };
  status: string;
  subdomainCount: number;
  vulnerabilityCount: number;
  endpointCount: number;
  lastScan?: string;
  technologies: string[];
  createdAt: string;
}

interface DomainStats {
  domain: Domain;
  subdomainCount: number;
  aliveCount: number;
  deadCount: number;
  technologies: { _id: string; count: number }[];
  recentScans: any[];
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
};

const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-blue-400';
  if (status >= 400 && status < 500) return 'text-yellow-400';
  return 'text-red-400';
};

export default function DomainDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [domain, setDomain] = useState<Domain | null>(null);
  const [stats, setStats] = useState<DomainStats | null>(null);
  const [subdomains, setSubdomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDomainData = async () => {
      try {
        const [domainRes, statsRes, subdomainsRes] = await Promise.all([
          domainsApi.getById(params.id),
          domainsApi.getStats(params.id),
          domainsApi.getSubdomains(params.id),
        ]);
        setDomain(domainRes.data);
        setStats(statsRes.data);
        setSubdomains(subdomainsRes.data);
      } catch (err: any) {
        console.error('Failed to fetch domain:', err);
        setError(err.response?.data?.message || 'Failed to load domain');
      } finally {
        setLoading(false);
      }
    };
    fetchDomainData();
  }, [params.id]);

  const handleStartScan = async () => {
    try {
      setScanning(true);
      await domainsApi.startScan(params.id);
      // Refresh domain data
      const domainRes = await domainsApi.getById(params.id);
      setDomain(domainRes.data);
    } catch (err: any) {
      console.error('Failed to start scan:', err);
      setError(err.response?.data?.message || 'Failed to start scan');
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (error || !domain) {
    return (
      <div className="text-center py-24">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Error loading domain</h3>
        <p className="text-slate-400 mb-4">{error || 'Domain not found'}</p>
        <Link
          href="/dashboard/domains"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Domains
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/domains"
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{domain.domain}</h1>
              <span className={cn(
                'px-2 py-1 rounded text-xs',
                domain.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                domain.status === 'scanning' ? 'bg-blue-500/20 text-blue-400' :
                domain.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              )}>
                {domain.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {domain.programId && (
                <>
                  <Link href={`/dashboard/programs/${domain.programId._id}`} className="text-sm text-primary-400 hover:text-primary-300">
                    {domain.programId.name}
                  </Link>
                  <span className="text-slate-500">•</span>
                </>
              )}
              <span className="text-sm text-slate-400">
                {domain.lastScan ? `Last scan: ${formatDateTime(domain.lastScan)}` : 'Not scanned yet'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://${domain.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Visit Site
          </a>
          <button
            onClick={handleStartScan}
            disabled={scanning || domain.status === 'scanning'}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              scanning || domain.status === 'scanning'
                ? 'bg-dark-700 text-slate-500 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-500 text-white'
            )}
          >
            {scanning || domain.status === 'scanning' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: 'Subdomains', value: stats?.subdomainCount || domain.subdomainCount || 0, icon: Layers, color: 'text-blue-400' },
          { label: 'Alive', value: stats?.aliveCount || 0, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Dead', value: stats?.deadCount || 0, icon: XCircle, color: 'text-red-400' },
          { label: 'Vulnerabilities', value: domain.vulnerabilityCount || 0, icon: Shield, color: 'text-red-400' },
          { label: 'Endpoints', value: domain.endpointCount || 0, icon: Globe, color: 'text-cyan-400' },
          { label: 'Technologies', value: stats?.technologies?.length || domain.technologies?.length || 0, icon: Settings, color: 'text-yellow-400' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">{stat.label}</p>
                <p className="text-xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <stat.icon className={cn('w-6 h-6', stat.color)} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-dark-800">
        {['overview', 'subdomains', 'technologies'].map((tab) => (
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

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Recent Scans</h3>
            {stats?.recentScans && stats.recentScans.length > 0 ? (
              <div className="space-y-3">
                {stats.recentScans.map((scan: any) => (
                  <Link
                    key={scan._id}
                    href={`/dashboard/scans/${scan._id}`}
                    className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {scan.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : scan.status === 'running' ? (
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      ) : scan.status === 'failed' ? (
                        <XCircle className="w-4 h-4 text-red-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-400" />
                      )}
                      <div>
                        <p className="text-white text-sm font-medium capitalize">{scan.type} Scan</p>
                        <p className="text-xs text-slate-500">{formatDateTime(scan.createdAt)}</p>
                      </div>
                    </div>
                    <span className="text-sm text-slate-400 capitalize">
                      {scan.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No scans yet</p>
                <button
                  onClick={handleStartScan}
                  disabled={scanning}
                  className="mt-3 text-sm text-primary-400 hover:text-primary-300"
                >
                  Start your first scan →
                </button>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Domain Information</h3>
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-dark-800">
                <span className="text-slate-400">Domain</span>
                <span className="text-white font-mono">{domain.domain}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-dark-800">
                <span className="text-slate-400">Status</span>
                <span className={cn(
                  'px-2 py-0.5 rounded text-xs',
                  domain.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  domain.status === 'scanning' ? 'bg-blue-500/20 text-blue-400' :
                  domain.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                )}>
                  {domain.status}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-dark-800">
                <span className="text-slate-400">Program</span>
                <span className="text-primary-400">{domain.programId?.name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-dark-800">
                <span className="text-slate-400">Created</span>
                <span className="text-white">{formatDateTime(domain.createdAt)}</span>
              </div>
              {domain.lastScan && (
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Last Scan</span>
                  <span className="text-white">{formatDateTime(domain.lastScan)}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Subdomains Tab */}
      {activeTab === 'subdomains' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-dark-800">
            <h3 className="font-semibold text-white">Subdomains ({subdomains.length})</h3>
            <Link
              href="/dashboard/subdomains"
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              View All →
            </Link>
          </div>
          {subdomains.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Subdomain</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">IP</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Alive</th>
                </tr>
              </thead>
              <tbody>
                {subdomains.slice(0, 10).map((sub: any, index: number) => (
                  <tr key={sub._id || index} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                    <td className="px-4 py-3">
                      <span className="text-white font-mono text-sm">{sub.subdomain}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-400 font-mono text-sm">{sub.ip || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('font-mono text-sm', sub.httpStatus ? getStatusColor(sub.httpStatus) : 'text-slate-400')}>
                        {sub.httpStatus || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {sub.isAlive ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No subdomains found yet</p>
              <p className="text-slate-500 text-xs mt-1">Run a scan to discover subdomains</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Technologies Tab */}
      {activeTab === 'technologies' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
        >
          {stats?.technologies && stats.technologies.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {stats.technologies.map((tech: any, index: number) => (
                <div key={index} className="p-4 bg-dark-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{tech._id}</span>
                    <span className="text-primary-400 font-bold">{tech.count}</span>
                  </div>
                  <span className="text-xs text-slate-500">instances</span>
                </div>
              ))}
            </div>
          ) : domain.technologies && domain.technologies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {domain.technologies.map((tech: string, index: number) => (
                <span key={index} className="px-3 py-1.5 bg-dark-800 text-slate-300 rounded-lg text-sm">
                  {tech}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Settings className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No technologies detected yet</p>
              <p className="text-slate-500 text-xs mt-1">Run a scan to detect technologies</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
