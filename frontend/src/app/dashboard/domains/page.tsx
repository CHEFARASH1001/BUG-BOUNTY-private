'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Play,
  ExternalLink,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDateTime, getSeverityColor } from '@/lib/utils';
import { domainsApi } from '@/lib/api';

interface Domain {
  _id: string;
  domain: string;
  programId?: { name: string };
  status: string;
  subdomainCount: number;
  vulnerabilityCount: number;
  lastScan?: string;
  technologies: string[];
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-500', label: 'Completed' },
  scanning: { icon: Loader2, color: 'text-blue-500', label: 'Scanning' },
  pending: { icon: Clock, color: 'text-yellow-500', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
};

export default function DomainsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchDomains = async () => {
      try {
        const response = await domainsApi.getAll({
          status: selectedStatus || undefined,
          search: searchQuery || undefined,
        });
        setDomains(response.data);
      } catch (err) {
        console.error('Failed to fetch domains:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDomains();
  }, [selectedStatus, searchQuery]);

  const filteredDomains = domains;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Globe className="w-7 h-7 text-primary-400" />
            Domains
          </h1>
          <p className="text-slate-400 mt-1">Manage your target domains</p>
        </div>
        <Link
          href="/dashboard/domains/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Domain
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedStatus || ''}
            onChange={(e) => setSelectedStatus(e.target.value || null)}
            className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary-500/50"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="scanning">Scanning</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Domains Grid */}
      {!mounted || loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDomains.map((domain, index) => {
          const StatusIcon = statusConfig[domain.status]?.icon || Clock;

          return (
            <motion.div
              key={domain._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group relative"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-600/50 to-accent-cyan/50 rounded-xl blur opacity-0 group-hover:opacity-30 transition duration-300" />
              <div className="relative p-5 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800 hover:border-dark-700 transition-colors">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-500/20 rounded-lg">
                      <Globe className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <Link
                        href={`/dashboard/domains/${domain._id}`}
                        className="text-white font-medium hover:text-primary-400 transition-colors"
                      >
                        {domain.domain}
                      </Link>
                      <p className="text-xs text-slate-500">{domain.programId?.name || 'Unknown Program'}</p>
                    </div>
                  </div>
                  <button className="p-1 text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 mb-4">
                  <StatusIcon className={cn(
                    'w-4 h-4',
                    statusConfig[domain.status]?.color || 'text-slate-400',
                    domain.status === 'scanning' && 'animate-spin'
                  )} />
                  <span className={cn('text-sm', statusConfig[domain.status]?.color || 'text-slate-400')}>
                    {statusConfig[domain.status]?.label || domain.status}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-dark-800/50 rounded-lg">
                    <div className="text-lg font-bold text-white">{domain.subdomainCount}</div>
                    <div className="text-xs text-slate-500">Subdomains</div>
                  </div>
                  <div className="p-3 bg-dark-800/50 rounded-lg">
                    <div className={cn(
                      'text-lg font-bold',
                      domain.vulnerabilityCount > 0 ? 'text-red-400' : 'text-slate-400'
                    )}>
                      {domain.vulnerabilityCount}
                    </div>
                    <div className="text-xs text-slate-500">Vulnerabilities</div>
                  </div>
                </div>

                {/* Technologies */}
                {domain.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {domain.technologies.slice(0, 3).map((tech) => (
                      <span
                        key={tech}
                        className="px-2 py-0.5 bg-dark-800 text-xs text-slate-400 rounded"
                      >
                        {tech}
                      </span>
                    ))}
                    {domain.technologies.length > 3 && (
                      <span className="px-2 py-0.5 text-xs text-slate-500">
                        +{domain.technologies.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-dark-800">
                  <span className="text-xs text-slate-500">
                    {domain.lastScan ? `Last scan: ${formatDateTime(domain.lastScan)}` : 'Not scanned'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1.5 text-slate-400 hover:text-primary-400 transition-colors"
                      title="Start Scan"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <a
                      href={`https://${domain.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-white transition-colors"
                      title="Open Website"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}

      {mounted && !loading && filteredDomains.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No domains found</h3>
          <p className="text-slate-400 mb-4">
            {searchQuery ? 'Try adjusting your search query' : 'Add your first domain to get started'}
          </p>
          <Link
            href="/dashboard/domains/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Domain
          </Link>
        </div>
      )}
    </div>
  );
}

