'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  ArrowLeft,
  Globe,
  DollarSign,
  Calendar,
  ExternalLink,
  Shield,
  Layers,
  Server,
  AlertTriangle,
  Plus,
  Settings,
  Play,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { programsApi } from '@/lib/api';

interface Program {
  _id: string;
  name: string;
  handle?: string;
  description?: string;
  platform: string;
  url?: string;
  platformUrl?: string;
  state?: string;
  offersBounties?: boolean;
  scope: string[];
  outOfScope: string[];
  rewards?: {
    critical?: string;
    high?: string;
    medium?: string;
    low?: string;
  };
  bountyRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  status: string;
  isActive?: boolean;
  tags?: string[];
  domainCount: number;
  subdomainCount: number;
  liveCount: number;
  httpServiceCount: number;
  vulnerabilityCount: number;
  firstSyncedAt?: string;
  lastSyncedAt?: string;
  lastScannedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Domain {
  _id: string;
  domain: string;
  programId: string;
  status: string;
  subdomainCount?: number;
  vulnerabilityCount?: number;
  lastScannedAt?: string;
  createdAt: string;
}

interface Vulnerability {
  _id: string;
  title: string;
  severity: string;
  status: string;
  target?: string;
  url?: string;
  createdAt: string;
}

interface Scope {
  _id: string;
  target: string;
  type: string;
  status: 'in_scope' | 'out_of_scope';
  description?: string;
  eligibility?: {
    isEligible?: boolean;
  };
}

interface Stats {
  program: Program;
  domainCount: number;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  totalVulnerabilities: number;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
  info: 'bg-blue-500/20 text-blue-400',
};

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  reported: 'bg-purple-500/20 text-purple-400',
  fixed: 'bg-green-500/20 text-green-400',
  active: 'text-green-400',
  paused: 'text-yellow-400',
  open: 'text-green-400',
  closed: 'text-red-400',
  archived: 'text-slate-400',
};

export default function ProgramDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [program, setProgram] = useState<Program | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch all data in parallel
        const [programRes, statsRes, domainsRes, vulnsRes, scopesRes] = await Promise.all([
          programsApi.getById(params.id),
          programsApi.getStats(params.id),
          programsApi.getDomains(params.id),
          programsApi.getVulnerabilities(params.id),
          programsApi.getScopes(params.id),
        ]);

        setProgram(programRes.data);
        setStats(statsRes.data);
        setDomains(domainsRes.data || []);
        setVulnerabilities(vulnsRes.data || []);
        setScopes(scopesRes.data || []);
      } catch (err: any) {
        console.error('Error fetching program data:', err);
        setError(err.response?.data?.message || 'Failed to load program data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading program...</span>
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-red-400 text-lg">{error || 'Program not found'}</div>
        <Link
          href="/dashboard/programs"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Programs
        </Link>
      </div>
    );
  }

  // Separate in-scope and out-of-scope (after null check)
  const inScopeItems = scopes.filter(s => s.status === 'in_scope');
  const outOfScopeItems = scopes.filter(s => s.status === 'out_of_scope');
  
  // Also include program.scope array (string array) if scopes collection is empty
  const allInScope = inScopeItems.length > 0 
    ? inScopeItems 
    : (program?.scope || []).map((item, index) => ({
        _id: `in-scope-${index}`,
        target: item,
        type: 'domain',
        status: 'in_scope' as const,
        description: undefined,
      }));
  
  // Also include program.outOfScope array (string array) if scopes collection is empty
  const allOutOfScope = outOfScopeItems.length > 0 
    ? outOfScopeItems 
    : (program?.outOfScope || []).map((item, index) => ({
        _id: `out-of-scope-${index}`,
        target: item,
        type: 'domain',
        status: 'out_of_scope' as const,
        description: undefined,
      }));

  // Format bounty range
  const bountyRange = program.bountyRange
    ? `${program.bountyRange.currency || '$'}${program.bountyRange.min || 0} - ${program.bountyRange.currency || '$'}${program.bountyRange.max || 0}`
    : program.offersBounties ? 'Bounties Available' : 'No Bounties';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/programs"
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{program.name}</h1>
              <span className={cn(
                'px-2 py-1 rounded text-xs',
                program.status === 'active' || program.status === 'open' 
                  ? 'bg-green-500/20 text-green-400' 
                  : program.status === 'paused' 
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-slate-500/20 text-slate-400'
              )}>
                {program.status}
              </span>
              {program.offersBounties && (
                <span className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400">
                  Bounties
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
              <span className="capitalize">{program.platform}</span>
              {program.createdAt && (
                <>
                  <span>•</span>
                  <span>Added {formatDate(program.createdAt)}</span>
                </>
              )}
              <span>•</span>
              <span>{bountyRange}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {program.platformUrl && (
            <a
              href={program.platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Program
            </a>
          )}
          <Link
            href={`/dashboard/programs/${program._id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            Edit
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Domains', value: stats?.domainCount ?? program.domainCount, icon: Globe, color: 'text-blue-400' },
          { label: 'Subdomains', value: program.subdomainCount, icon: Layers, color: 'text-purple-400' },
          { label: 'Total Vulns', value: stats?.totalVulnerabilities ?? program.vulnerabilityCount, icon: Shield, color: 'text-red-400' },
          { label: 'Critical', value: stats?.vulnerabilities?.critical ?? 0, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'High', value: stats?.vulnerabilities?.high ?? 0, icon: AlertTriangle, color: 'text-orange-400' },
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
        {['overview', 'domains', 'vulnerabilities', 'scope'].map((tab) => (
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Program Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Program Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">Platform</label>
                  <p className="text-white mt-1 capitalize">{program.platform || 'N/A'}</p>
                </div>
                {program.handle && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Handle</label>
                    <p className="text-white mt-1 font-mono">{program.handle}</p>
                  </div>
                )}
                {program.state && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">State</label>
                    <p className="text-white mt-1 capitalize">{program.state}</p>
                  </div>
                )}
                {program.url && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">URL</label>
                    <a
                      href={program.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-400 hover:text-primary-300 mt-1 block truncate"
                    >
                      {program.url}
                    </a>
                  </div>
                )}
                {program.platformUrl && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Platform URL</label>
                    <a
                      href={program.platformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-400 hover:text-primary-300 mt-1 block truncate"
                    >
                      {program.platformUrl}
                    </a>
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">Bounty Status</label>
                  <p className="text-white mt-1">{program.offersBounties ? 'Bounties Available' : 'No Bounties'}</p>
                </div>
              </div>
            </motion.div>

            {/* Bounty Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Bounty Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wide">Bounty Range</label>
                  <p className="text-white mt-1">{bountyRange}</p>
                </div>
                {program.rewards && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide mb-2 block">Rewards</label>
                    <div className="space-y-2">
                      {program.rewards.critical && (
                        <div className="flex items-center justify-between p-2 bg-red-500/10 rounded">
                          <span className="text-sm text-slate-300">Critical</span>
                          <span className="text-sm font-medium text-red-400">{program.rewards.critical}</span>
                        </div>
                      )}
                      {program.rewards.high && (
                        <div className="flex items-center justify-between p-2 bg-orange-500/10 rounded">
                          <span className="text-sm text-slate-300">High</span>
                          <span className="text-sm font-medium text-orange-400">{program.rewards.high}</span>
                        </div>
                      )}
                      {program.rewards.medium && (
                        <div className="flex items-center justify-between p-2 bg-yellow-500/10 rounded">
                          <span className="text-sm text-slate-300">Medium</span>
                          <span className="text-sm font-medium text-yellow-400">{program.rewards.medium}</span>
                        </div>
                      )}
                      {program.rewards.low && (
                        <div className="flex items-center justify-between p-2 bg-green-500/10 rounded">
                          <span className="text-sm text-slate-300">Low</span>
                          <span className="text-sm font-medium text-green-400">{program.rewards.low}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Description & Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Description</h3>
              <p className="text-slate-400 whitespace-pre-wrap">
                {program.description || 'No description available.'}
              </p>
              {program.notes && (
                <div className="mt-4 pt-4 border-t border-dark-700">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Notes</h4>
                  <p className="text-slate-400 text-sm whitespace-pre-wrap">{program.notes}</p>
                </div>
              )}
              {program.tags && program.tags.length > 0 && (
                <div className="mt-4 pt-4 border-t border-dark-700">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {program.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-dark-700 text-slate-300 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Sync Information & Recent Vulnerabilities */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Sync Information</h3>
              <div className="space-y-3 mb-6">
                {program.firstSyncedAt && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">First Synced</label>
                    <p className="text-white mt-1">{formatDateTime(program.firstSyncedAt)}</p>
                  </div>
                )}
                {program.lastSyncedAt && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Last Synced</label>
                    <p className="text-white mt-1">{formatDateTime(program.lastSyncedAt)}</p>
                  </div>
                )}
                {program.lastScannedAt && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Last Scanned</label>
                    <p className="text-white mt-1">{formatDateTime(program.lastScannedAt)}</p>
                  </div>
                )}
              </div>
              
              <div className="pt-4 border-t border-dark-700">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Recent Vulnerabilities</h4>
                {vulnerabilities.length === 0 ? (
                  <p className="text-slate-500 text-sm">No vulnerabilities found.</p>
                ) : (
                  <div className="space-y-2">
                    {vulnerabilities.slice(0, 5).map((vuln) => (
                      <div key={vuln._id} className="flex items-center justify-between p-2 bg-dark-800/50 rounded-lg">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <AlertTriangle className={cn(
                            'w-3.5 h-3.5 shrink-0',
                            vuln.severity === 'critical' ? 'text-red-400' :
                            vuln.severity === 'high' ? 'text-orange-400' :
                            vuln.severity === 'medium' ? 'text-yellow-400' :
                            vuln.severity === 'low' ? 'text-green-400' :
                            'text-blue-400'
                          )} />
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-xs font-medium truncate">{vuln.title}</p>
                            <p className="text-xs text-slate-500 truncate">{vuln.target || vuln.url || 'N/A'}</p>
                          </div>
                        </div>
                        <span className={cn('px-2 py-0.5 rounded text-xs shrink-0', statusColors[vuln.status] || 'bg-slate-500/20 text-slate-400')}>
                          {vuln.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Domains Tab */}
      {activeTab === 'domains' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-dark-800">
            <h3 className="font-semibold text-white">Domains ({domains.length})</h3>
            <Link
              href={`/dashboard/domains/new?programId=${program._id}`}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Domain
            </Link>
          </div>
          {domains.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No domains added yet. Add your first domain to start scanning.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Domain</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Subdomains</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Vulnerabilities</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Last Scan</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain._id} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/domains/${domain._id}`} className="flex items-center gap-2 hover:text-primary-400 transition-colors">
                        <Globe className="w-4 h-4 text-slate-500" />
                        <span className="text-white font-medium">{domain.domain}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{domain.subdomainCount ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'font-medium',
                        (domain.vulnerabilityCount ?? 0) > 0 ? 'text-red-400' : 'text-slate-400'
                      )}>
                        {domain.vulnerabilityCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-sm', statusColors[domain.status] || 'text-slate-400')}>
                        {domain.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {domain.lastScannedAt ? formatDateTime(domain.lastScannedAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 text-slate-400 hover:text-green-400 transition-colors" title="Scan">
                          <Play className="w-4 h-4" />
                        </button>
                        <Link href={`/dashboard/domains/${domain._id}`} className="p-1.5 text-slate-400 hover:text-white transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      )}

      {/* Vulnerabilities Tab */}
      {activeTab === 'vulnerabilities' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
        >
          {vulnerabilities.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No vulnerabilities found for this program.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Vulnerability</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Severity</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Target</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {vulnerabilities.map((vuln) => (
                  <tr key={vuln._id} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={cn(
                          'w-4 h-4',
                          vuln.severity === 'critical' ? 'text-red-400' :
                          vuln.severity === 'high' ? 'text-orange-400' :
                          vuln.severity === 'medium' ? 'text-yellow-400' :
                          vuln.severity === 'low' ? 'text-green-400' :
                          'text-blue-400'
                        )} />
                        <span className="text-white font-medium">{vuln.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded text-xs uppercase', severityColors[vuln.severity] || 'bg-slate-500/20 text-slate-400')}>
                        {vuln.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-sm">{vuln.target || vuln.url || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded text-xs capitalize', statusColors[vuln.status] || 'bg-slate-500/20 text-slate-400')}>
                        {vuln.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{formatDate(vuln.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      )}

      {/* Scope Tab */}
      {activeTab === 'scope' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* In Scope */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              In Scope ({allInScope.length > 0 ? allInScope.length : domains.length})
            </h3>
            
            {/* Show scopes if available, otherwise show domains */}
            {allInScope.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {allInScope.map((scope) => (
                  <div
                    key={scope._id}
                    className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
                  >
                    <Globe className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-300 font-mono text-sm break-all">{scope.target}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 capitalize">{scope.type?.replace('_', ' ') || 'domain'}</span>
                        {scope.eligibility?.isEligible && (
                          <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">Bounty</span>
                        )}
                      </div>
                      {scope.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{scope.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : domains.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                <p className="text-slate-400 text-xs mb-2">Showing domains as scope targets:</p>
                {domains.map((domain) => (
                  <Link
                    key={domain._id}
                    href={`/dashboard/domains/${domain._id}`}
                    className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors"
                  >
                    <Globe className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-slate-300 font-mono text-sm truncate">{domain.domain}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No in-scope targets found.</p>
            )}
          </motion.div>

          {/* Out of Scope */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              Out of Scope ({allOutOfScope.length})
            </h3>
            
            {allOutOfScope.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {allOutOfScope.map((scope) => (
                  <div
                    key={scope._id}
                    className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                  >
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-300 font-mono text-sm break-all">{scope.target}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 capitalize">{scope.type?.replace('_', ' ') || 'domain'}</span>
                      </div>
                      {scope.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{scope.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No out-of-scope targets defined. All listed targets are in scope.</p>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
