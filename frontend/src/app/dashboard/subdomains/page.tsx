'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Layers,
  Search,
  Filter,
  Download,
  ExternalLink,
  CheckCircle,
  XCircle,
  Globe,
  Server,
  Shield,
  Wifi,
  Copy,
  Eye,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { subdomainsApi } from '@/lib/api';

interface Subdomain {
  _id: string;
  subdomain: string;
  domain?: string;
  domainId?: { domain: string };
  ip?: string[];
  isAlive: boolean;
  httpStatus?: number;
  title?: string;
  technologies?: string[];
  ports?: number[];
  hasWaf?: boolean;
  wafName?: string;
  createdAt?: string;
  lastChecked?: string;
}

const getStatusColor = (status: number | null | undefined) => {
  if (!status) return 'text-slate-500';
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-blue-400';
  if (status >= 400 && status < 500) return 'text-yellow-400';
  return 'text-red-400';
};

export default function SubdomainsPage() {
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAlive, setFilterAlive] = useState<boolean | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSubdomains = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await subdomainsApi.getAll({
        isAlive: filterAlive ?? undefined,
        search: searchQuery || undefined,
      });
      const data = response.data;
      setSubdomains(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch subdomains:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load subdomains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubdomains();
  }, [filterAlive]);

  const filteredSubdomains = subdomains.filter((sub) => {
    const matchesSearch = !searchQuery || 
      sub.subdomain?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportSubdomains = () => {
    const data = filteredSubdomains.map(s => s.subdomain).join('\n');
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subdomains.txt';
    a.click();
  };

  const aliveCount = subdomains.filter(s => s.isAlive).length;
  const deadCount = subdomains.filter(s => !s.isAlive).length;
  const withWafCount = subdomains.filter(s => s.hasWaf).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Layers className="w-7 h-7 text-primary-400" />
            Subdomains
          </h1>
          <p className="text-slate-400 mt-1">
            {loading ? 'Loading...' : `${filteredSubdomains.length} subdomains found`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSubdomains}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-sm text-slate-300 font-medium transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={exportSubdomains}
            disabled={filteredSubdomains.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-sm text-slate-300 font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: loading ? '...' : subdomains.length, icon: Layers, color: 'text-primary-400' },
          { label: 'Alive', value: loading ? '...' : aliveCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Dead', value: loading ? '...' : deadCount, icon: XCircle, color: 'text-red-400' },
          { label: 'With WAF', value: loading ? '...' : withWafCount, icon: Shield, color: 'text-yellow-400' },
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

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search subdomains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterAlive === null ? '' : filterAlive ? 'alive' : 'dead'}
            onChange={(e) => setFilterAlive(e.target.value === '' ? null : e.target.value === 'alive')}
            className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
          >
            <option value="">All Status</option>
            <option value="alive">Alive</option>
            <option value="dead">Dead</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <span className="ml-3 text-slate-400">Loading subdomains...</span>
        </div>
      )}

      {/* Subdomains Table */}
      {!loading && filteredSubdomains.length > 0 && (
        <div className="bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Subdomain</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">IP Address</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Ports</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Technologies</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">WAF</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubdomains.slice(0, 100).map((sub, index) => (
                  <motion.tr
                    key={sub._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(index * 0.01, 0.5) }}
                    className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {sub.isAlive ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <div>
                          <div className="font-medium text-white">{sub.subdomain}</div>
                          {sub.title && (
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{sub.title}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {sub.httpStatus ? (
                        <span className={cn('font-mono text-sm', getStatusColor(sub.httpStatus))}>
                          {sub.httpStatus}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.ip && sub.ip.length > 0 ? (
                        <div className="space-y-1">
                          {sub.ip.slice(0, 2).map((ip) => (
                            <div key={ip} className="font-mono text-sm text-slate-300">{ip}</div>
                          ))}
                          {sub.ip.length > 2 && (
                            <div className="text-xs text-slate-500">+{sub.ip.length - 2} more</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.ports && sub.ports.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sub.ports.slice(0, 3).map((port) => (
                            <span key={port} className="px-1.5 py-0.5 bg-dark-800 text-xs text-slate-400 rounded">
                              {port}
                            </span>
                          ))}
                          {sub.ports.length > 3 && (
                            <span className="text-xs text-slate-500">+{sub.ports.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.technologies && sub.technologies.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sub.technologies.slice(0, 2).map((tech) => (
                            <span key={tech} className="px-1.5 py-0.5 bg-primary-500/20 text-xs text-primary-400 rounded">
                              {tech}
                            </span>
                          ))}
                          {sub.technologies.length > 2 && (
                            <span className="text-xs text-slate-500">+{sub.technologies.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.hasWaf ? (
                        <span className="flex items-center gap-1 text-yellow-400 text-sm">
                          <Shield className="w-3 h-3" />
                          {sub.wafName || 'Yes'}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyToClipboard(sub.subdomain, sub._id)}
                          className="p-1.5 text-slate-400 hover:text-white transition-colors"
                          title="Copy"
                        >
                          {copiedId === sub._id ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        {sub.isAlive && (
                          <a
                            href={`https://${sub.subdomain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-white transition-colors"
                            title="Open"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredSubdomains.length > 100 && (
            <div className="text-center py-3 border-t border-dark-800">
              <p className="text-slate-400 text-sm">
                Showing 100 of {filteredSubdomains.length} subdomains. Use filters to narrow results.
              </p>
            </div>
          )}
        </div>
      )}

      {!loading && filteredSubdomains.length === 0 && (
        <div className="text-center py-12">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No subdomains found</h3>
          <p className="text-slate-400 mb-4">
            {searchQuery 
              ? 'Try adjusting your search query' 
              : 'Run the subdomain enumeration cron job to discover subdomains'}
          </p>
          <a
            href="/dashboard/cron"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Go to Cron Jobs
          </a>
        </div>
      )}
    </div>
  );
}
