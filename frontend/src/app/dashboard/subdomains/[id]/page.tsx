'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  ArrowLeft,
  ExternalLink,
  Server,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Lock,
  Loader2,
  Copy,
  Code,
  FileText,
  Hash,
  Wifi,
  Link2,
  Eye,
  Sparkles,
  Tag,
  MapPin,
  Activity,
  Fingerprint,
  Cookie,
  Network,
  StickyNote,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { subdomainsApi } from '@/lib/api';

interface Subdomain {
  _id: string;
  subdomain: string;
  domainId?: {
    _id: string;
    domain: string;
    programId?: {
      _id: string;
      name: string;
      handle?: string;
      platform?: string;
    };
  };
  ip?: string[];
  cname?: string[];
  cdn?: string[];
  waf?: string[];
  isAlive: boolean;
  httpStatus?: number;
  httpsStatus?: number;
  title?: string;
  technologies?: string[];
  ports?: { port: number; protocol?: string; service?: string; version?: string; banner?: string }[];
  sources?: string[];
  headers?: Record<string, string>;
  cookies?: string[];
  webServer?: string;
  contentLength?: number;
  contentType?: string;
  faviconHash?: string;
  screenshot?: string;
  favicon?: string;
  ssl?: {
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    isExpired?: boolean;
    isValid?: boolean;
  };
  vulnerabilityCount?: number;
  endpointCount?: number;
  abuseScore?: number;
  tags?: string[];
  notes?: string;
  isNew?: boolean;
  firstSeen?: string;
  lastSeen?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Endpoint {
  _id: string;
  url: string;
  method?: string;
  statusCode?: number;
  contentType?: string;
  source?: string;
}

const formatDateTime = (date: string | undefined) => {
  if (!date) return '-';
  return new Date(date).toLocaleString();
};

const formatDate = (date: string | undefined) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

const getStatusColor = (status: number | undefined) => {
  if (!status) return 'text-slate-500';
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-blue-400';
  if (status >= 400 && status < 500) return 'text-yellow-400';
  return 'text-red-400';
};

const getStatusBgColor = (status: number | undefined) => {
  if (!status) return 'bg-slate-500/20';
  if (status >= 200 && status < 300) return 'bg-green-500/20';
  if (status >= 300 && status < 400) return 'bg-blue-500/20';
  if (status >= 400 && status < 500) return 'bg-yellow-500/20';
  return 'bg-red-500/20';
};

const getAbuseScoreColor = (score: number | undefined) => {
  if (score === undefined) return 'text-slate-500';
  if (score >= 75) return 'text-red-400';
  if (score >= 50) return 'text-orange-400';
  if (score >= 25) return 'text-yellow-400';
  return 'text-green-400';
};

export default function SubdomainDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [subdomain, setSubdomain] = useState<Subdomain | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, endpointsRes] = await Promise.all([
          subdomainsApi.getById(params.id),
          subdomainsApi.getEndpoints(params.id).catch(() => ({ data: [] })),
        ]);
        setSubdomain(subRes.data);
        setEndpoints(endpointsRes.data || []);
      } catch (err: any) {
        console.error('Failed to fetch subdomain:', err);
        setError(err.response?.data?.message || 'Failed to load subdomain');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (error || !subdomain) {
    return (
      <div className="text-center py-24">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Error loading subdomain</h3>
        <p className="text-slate-400 mb-4">{error || 'Subdomain not found'}</p>
        <Link
          href="/dashboard/subdomains"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Subdomains
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'network', label: 'Network' },
    { id: 'http', label: 'HTTP Details' },
    { id: 'security', label: 'Security' },
    { id: 'endpoints', label: `Endpoints (${endpoints.length})` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/subdomains"
            className="p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              {subdomain.isAlive ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
              <h1 className="text-2xl font-bold text-white font-mono">{subdomain.subdomain}</h1>
              {subdomain.isNew && (
                <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                  <Sparkles className="w-3 h-3" />
                  New
                </span>
              )}
              {subdomain.httpStatus && (
                <span className={cn(
                  'px-2 py-1 rounded text-sm font-mono',
                  getStatusBgColor(subdomain.httpStatus),
                  getStatusColor(subdomain.httpStatus)
                )}>
                  {subdomain.httpStatus}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm">
              {subdomain.domainId?.programId && (
                <>
                  <Link 
                    href={`/dashboard/programs/${subdomain.domainId.programId._id}`}
                    className="text-primary-400 hover:text-primary-300"
                  >
                    {subdomain.domainId.programId.name}
                  </Link>
                  <span className="text-slate-500">•</span>
                </>
              )}
              {subdomain.domainId?.domain && (
                <>
                  <Link 
                    href={`/dashboard/domains/${subdomain.domainId._id}`}
                    className="text-slate-400 hover:text-white"
                  >
                    {subdomain.domainId.domain}
                  </Link>
                  <span className="text-slate-500">•</span>
                </>
              )}
              <span className="text-slate-500">
                First seen: {formatDate(subdomain.firstSeen)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => copyToClipboard(subdomain.subdomain, 'subdomain')}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 rounded-lg transition-colors"
          >
            {copiedField === 'subdomain' ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            Copy
          </button>
          {subdomain.isAlive && (
            <a
              href={`https://${subdomain.subdomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Visit
            </a>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {[
          { label: 'Status', value: subdomain.isAlive ? 'Alive' : 'Dead', icon: Activity, color: subdomain.isAlive ? 'text-green-400' : 'text-red-400' },
          { label: 'HTTP', value: subdomain.httpStatus || '-', icon: Globe, color: getStatusColor(subdomain.httpStatus) },
          { label: 'IPs', value: subdomain.ip?.length || 0, icon: Network, color: 'text-blue-400' },
          { label: 'Ports', value: subdomain.ports?.length || 0, icon: Server, color: 'text-cyan-400' },
          { label: 'Tech', value: subdomain.technologies?.length || 0, icon: Code, color: 'text-purple-400' },
          { label: 'Endpoints', value: subdomain.endpointCount || endpoints.length, icon: Link2, color: 'text-yellow-400' },
          { label: 'Vulns', value: subdomain.vulnerabilityCount || 0, icon: Shield, color: 'text-red-400' },
          { label: 'Abuse Score', value: subdomain.abuseScore ?? '-', icon: AlertTriangle, color: getAbuseScoreColor(subdomain.abuseScore) },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="p-3 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800"
          >
            <div className="flex items-center gap-2">
              <stat.icon className={cn('w-4 h-4', stat.color)} />
              <span className="text-xs text-slate-400">{stat.label}</span>
            </div>
            <p className={cn('text-lg font-bold mt-1', stat.color)}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-dark-800 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === tab.id
                ? 'text-primary-400 border-primary-400'
                : 'text-slate-400 border-transparent hover:text-white'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <OverviewTab subdomain={subdomain} copyToClipboard={copyToClipboard} copiedField={copiedField} />
        )}
        {activeTab === 'network' && (
          <NetworkTab subdomain={subdomain} copyToClipboard={copyToClipboard} copiedField={copiedField} />
        )}
        {activeTab === 'http' && (
          <HttpTab subdomain={subdomain} />
        )}
        {activeTab === 'security' && (
          <SecurityTab subdomain={subdomain} />
        )}
        {activeTab === 'endpoints' && (
          <EndpointsTab endpoints={endpoints} />
        )}
      </div>
    </div>
  );
}


// Overview Tab Component
function OverviewTab({ subdomain, copyToClipboard, copiedField }: { 
  subdomain: Subdomain; 
  copyToClipboard: (text: string, field: string) => void;
  copiedField: string | null;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Basic Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary-400" />
          Basic Information
        </h3>
        <div className="space-y-3">
          <InfoRow label="Subdomain" value={subdomain.subdomain} mono copyable onCopy={() => copyToClipboard(subdomain.subdomain, 'sub')} copied={copiedField === 'sub'} />
          <InfoRow label="Domain" value={subdomain.domainId?.domain || '-'} />
          <InfoRow label="Program" value={subdomain.domainId?.programId?.name || '-'} />
          <InfoRow label="Platform" value={subdomain.domainId?.programId?.platform || '-'} />
          <InfoRow label="Status" value={subdomain.isAlive ? 'Alive' : 'Dead'} badge badgeColor={subdomain.isAlive ? 'green' : 'red'} />
          <InfoRow label="Fresh" value={subdomain.isNew ? 'Yes' : 'No'} badge badgeColor={subdomain.isNew ? 'emerald' : 'slate'} />
        </div>
      </motion.div>

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-400" />
          Timeline
        </h3>
        <div className="space-y-3">
          <InfoRow label="First Seen" value={formatDateTime(subdomain.firstSeen)} />
          <InfoRow label="Last Seen" value={formatDateTime(subdomain.lastSeen)} />
          <InfoRow label="Created" value={formatDateTime(subdomain.createdAt)} />
          <InfoRow label="Updated" value={formatDateTime(subdomain.updatedAt)} />
        </div>
      </motion.div>

      {/* Technologies */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Code className="w-5 h-5 text-primary-400" />
          Technologies ({subdomain.technologies?.length || 0})
        </h3>
        {subdomain.technologies && subdomain.technologies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {subdomain.technologies.map((tech, idx) => (
              <span key={idx} className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm">
                {tech}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No technologies detected</p>
        )}
      </motion.div>

      {/* Discovery Sources */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary-400" />
          Discovery Sources ({subdomain.sources?.length || 0})
        </h3>
        {subdomain.sources && subdomain.sources.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {subdomain.sources.map((source, idx) => (
              <span key={idx} className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm">
                {source}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No sources recorded</p>
        )}
      </motion.div>

      {/* Tags */}
      {subdomain.tags && subdomain.tags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary-400" />
            Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {subdomain.tags.map((tag, idx) => (
              <span key={idx} className="px-3 py-1.5 bg-slate-500/20 text-slate-300 rounded-lg text-sm">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Notes */}
      {subdomain.notes && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6 lg:col-span-2"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-primary-400" />
            Notes
          </h3>
          <p className="text-slate-300 whitespace-pre-wrap">{subdomain.notes}</p>
        </motion.div>
      )}
    </div>
  );
}

// Network Tab Component
function NetworkTab({ subdomain, copyToClipboard, copiedField }: { 
  subdomain: Subdomain;
  copyToClipboard: (text: string, field: string) => void;
  copiedField: string | null;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* IP Addresses */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Network className="w-5 h-5 text-primary-400" />
          IP Addresses ({subdomain.ip?.length || 0})
        </h3>
        {subdomain.ip && subdomain.ip.length > 0 ? (
          <div className="space-y-2">
            {subdomain.ip.map((ip, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-dark-800/50 rounded-lg">
                <span className="font-mono text-sm text-white">{ip}</span>
                <button
                  onClick={() => copyToClipboard(ip, `ip-${idx}`)}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                >
                  {copiedField === `ip-${idx}` ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No IP addresses resolved</p>
        )}
      </motion.div>

      {/* CNAME Records */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary-400" />
          CNAME Records ({subdomain.cname?.length || 0})
        </h3>
        {subdomain.cname && subdomain.cname.length > 0 ? (
          <div className="space-y-2">
            {subdomain.cname.map((cname, idx) => (
              <div key={idx} className="p-2 bg-dark-800/50 rounded-lg">
                <span className="font-mono text-sm text-cyan-400 break-all">→ {cname}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No CNAME records</p>
        )}
      </motion.div>

      {/* Open Ports */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6 lg:col-span-2"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-primary-400" />
          Open Ports ({subdomain.ports?.length || 0})
        </h3>
        {subdomain.ports && subdomain.ports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-400">Port</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-400">Protocol</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-400">Service</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-400">Version</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-400">Banner</th>
                </tr>
              </thead>
              <tbody>
                {subdomain.ports.map((port, idx) => (
                  <tr key={idx} className="border-b border-dark-800/50">
                    <td className="px-4 py-2">
                      <span className="font-mono text-cyan-400">{port.port}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-300">{port.protocol || '-'}</td>
                    <td className="px-4 py-2 text-slate-300">{port.service || '-'}</td>
                    <td className="px-4 py-2 text-slate-400 text-sm">{port.version || '-'}</td>
                    <td className="px-4 py-2 text-slate-500 text-sm truncate max-w-[200px]">{port.banner || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No open ports detected</p>
        )}
      </motion.div>
    </div>
  );
}


// HTTP Tab Component
function HttpTab({ subdomain }: { subdomain: Subdomain }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* HTTP Response Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary-400" />
          HTTP Response
        </h3>
        <div className="space-y-3">
          <InfoRow label="HTTP Status" value={subdomain.httpStatus || '-'} badge badgeColor={
            subdomain.httpStatus && subdomain.httpStatus >= 200 && subdomain.httpStatus < 300 ? 'green' :
            subdomain.httpStatus && subdomain.httpStatus >= 300 && subdomain.httpStatus < 400 ? 'blue' :
            subdomain.httpStatus && subdomain.httpStatus >= 400 && subdomain.httpStatus < 500 ? 'yellow' : 'red'
          } />
          <InfoRow label="HTTPS Status" value={subdomain.httpsStatus || '-'} />
          <InfoRow label="Title" value={subdomain.title || '-'} />
          <InfoRow label="Web Server" value={subdomain.webServer || '-'} />
          <InfoRow label="Content Type" value={subdomain.contentType || '-'} />
          <InfoRow label="Content Length" value={subdomain.contentLength ? `${subdomain.contentLength.toLocaleString()} bytes` : '-'} />
        </div>
      </motion.div>

      {/* Favicon & Fingerprint */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Fingerprint className="w-5 h-5 text-primary-400" />
          Fingerprint
        </h3>
        <div className="space-y-3">
          <InfoRow label="Favicon Hash" value={subdomain.faviconHash || '-'} mono />
          {subdomain.favicon && (
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm w-32">Favicon</span>
              <img src={subdomain.favicon} alt="Favicon" className="w-8 h-8 rounded" />
            </div>
          )}
        </div>
      </motion.div>

      {/* Response Headers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6 lg:col-span-2"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-400" />
          Response Headers ({subdomain.headers ? Object.keys(subdomain.headers).length : 0})
        </h3>
        {subdomain.headers && Object.keys(subdomain.headers).length > 0 ? (
          <div className="bg-dark-800/50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <table className="w-full text-sm font-mono">
              <tbody>
                {Object.entries(subdomain.headers).map(([key, value]) => (
                  <tr key={key} className="border-b border-dark-700 last:border-0">
                    <td className="py-2 pr-4 text-cyan-400 whitespace-nowrap align-top">{key}</td>
                    <td className="py-2 text-slate-300 break-all">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No headers captured</p>
        )}
      </motion.div>

      {/* Cookies */}
      {subdomain.cookies && subdomain.cookies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6 lg:col-span-2"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Cookie className="w-5 h-5 text-primary-400" />
            Cookies ({subdomain.cookies.length})
          </h3>
          <div className="space-y-2">
            {subdomain.cookies.map((cookie, idx) => (
              <div key={idx} className="p-2 bg-dark-800/50 rounded-lg">
                <span className="font-mono text-sm text-slate-300 break-all">{cookie}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Security Tab Component
function SecurityTab({ subdomain }: { subdomain: Subdomain }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* SSL Certificate */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary-400" />
          SSL Certificate
        </h3>
        {subdomain.ssl && (subdomain.ssl.issuer || subdomain.ssl.validTo) ? (
          <div className="space-y-3">
            <InfoRow label="Issuer" value={subdomain.ssl.issuer || '-'} />
            <InfoRow label="Valid From" value={formatDateTime(subdomain.ssl.validFrom)} />
            <InfoRow label="Valid To" value={formatDateTime(subdomain.ssl.validTo)} />
            <InfoRow 
              label="Status" 
              value={subdomain.ssl.isExpired ? 'Expired' : subdomain.ssl.isValid ? 'Valid' : 'Unknown'} 
              badge 
              badgeColor={subdomain.ssl.isExpired ? 'red' : subdomain.ssl.isValid ? 'green' : 'slate'} 
            />
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No SSL certificate information</p>
        )}
      </motion.div>

      {/* CDN & WAF */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-400" />
          CDN & WAF Protection
        </h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-400 mb-2">CDN ({subdomain.cdn?.length || 0})</p>
            {subdomain.cdn && subdomain.cdn.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subdomain.cdn.map((cdn, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-sm">
                    {cdn}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No CDN detected</p>
            )}
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-2">WAF ({subdomain.waf?.length || 0})</p>
            {subdomain.waf && subdomain.waf.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subdomain.waf.map((waf, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {waf}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No WAF detected</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Abuse Score */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary-400" />
          Abuse Score
        </h3>
        {subdomain.abuseScore !== undefined ? (
          <div className="flex items-center gap-4">
            <div className={cn(
              'text-4xl font-bold',
              subdomain.abuseScore >= 75 ? 'text-red-400' :
              subdomain.abuseScore >= 50 ? 'text-orange-400' :
              subdomain.abuseScore >= 25 ? 'text-yellow-400' : 'text-green-400'
            )}>
              {subdomain.abuseScore}
            </div>
            <div className="text-sm text-slate-400">
              {subdomain.abuseScore >= 75 ? 'High risk - likely malicious' :
               subdomain.abuseScore >= 50 ? 'Medium risk - suspicious activity' :
               subdomain.abuseScore >= 25 ? 'Low risk - some reports' : 'Clean - no significant reports'}
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No abuse score available</p>
        )}
      </motion.div>

      {/* Vulnerabilities */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          Vulnerabilities
        </h3>
        <div className="text-center py-4">
          <p className={cn(
            'text-4xl font-bold',
            (subdomain.vulnerabilityCount || 0) > 0 ? 'text-red-400' : 'text-green-400'
          )}>
            {subdomain.vulnerabilityCount || 0}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {(subdomain.vulnerabilityCount || 0) > 0 ? 'vulnerabilities found' : 'No vulnerabilities detected'}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// Endpoints Tab Component
function EndpointsTab({ endpoints }: { endpoints: Endpoint[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden"
    >
      {endpoints.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">URL</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Method</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Content Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Source</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((endpoint) => (
                <tr key={endpoint._id} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-white break-all">{endpoint.url}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      endpoint.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                      endpoint.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                      endpoint.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                      endpoint.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-500/20 text-slate-400'
                    )}>
                      {endpoint.method || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'font-mono text-sm',
                      endpoint.statusCode && endpoint.statusCode >= 200 && endpoint.statusCode < 300 ? 'text-green-400' :
                      endpoint.statusCode && endpoint.statusCode >= 300 && endpoint.statusCode < 400 ? 'text-blue-400' :
                      endpoint.statusCode && endpoint.statusCode >= 400 && endpoint.statusCode < 500 ? 'text-yellow-400' :
                      'text-slate-400'
                    )}>
                      {endpoint.statusCode || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{endpoint.contentType || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs">
                      {endpoint.source || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <Link2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No endpoints found</h3>
          <p className="text-slate-400">Run endpoint discovery to find URLs</p>
        </div>
      )}
    </motion.div>
  );
}

// Helper component for info rows
function InfoRow({ 
  label, 
  value, 
  mono, 
  badge, 
  badgeColor,
  copyable,
  onCopy,
  copied
}: { 
  label: string; 
  value: string | number; 
  mono?: boolean;
  badge?: boolean;
  badgeColor?: 'green' | 'red' | 'yellow' | 'blue' | 'orange' | 'cyan' | 'purple' | 'emerald' | 'slate';
  copyable?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    blue: 'bg-blue-500/20 text-blue-400',
    orange: 'bg-orange-500/20 text-orange-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    purple: 'bg-purple-500/20 text-purple-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    slate: 'bg-slate-500/20 text-slate-400',
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-dark-800 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {badge ? (
          <span className={cn('px-2 py-0.5 rounded text-xs', colorMap[badgeColor || 'slate'])}>
            {value}
          </span>
        ) : (
          <span className={cn('text-white text-sm', mono && 'font-mono')}>{value}</span>
        )}
        {copyable && onCopy && (
          <button onClick={onCopy} className="p-1 text-slate-400 hover:text-white transition-colors">
            {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}
